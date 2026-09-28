import { querySnowflake } from "@/lib/snowflake"
import { AI_SCHEMA, ANALYTICS, CORTEX_MODEL, RAW } from "@/lib/constants"
import { safeId, sqlStr, toArray, toNum } from "@/lib/format"
import { aiError, cortexCompleteJson } from "@/lib/cortex"
import { getProposalStories } from "@/lib/queries"

export const dynamic = "force-dynamic"

interface StoryPayload {
  title: string
  hypothesis: string
  key_issues: string[]
  hearing_questions: { question: string; intent: string; knowledge_id?: string }[]
  expected_objections: { objection: string; response: string; knowledge_id?: string }[]
  recommended_products: { product: string; reason: string }[]
}

/** GET — list saved stories for a company. */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams
    return Response.json(await getProposalStories(params.get("company"), params.get("rep")))
  } catch (e) {
    return aiError("api/ai/proposal-story GET", e)
  }
}

/**
 * POST — generate a new proposal story for a company.
 *
 * The prompt is grounded in three things so the output is defensible rather
 * than generic: the company's own attributes and financials, the job-posting
 * signals that triggered the target, and the tacit-knowledge patterns extracted
 * from the top performer's winning meetings.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { companyId?: string; repId?: string }
    const companyId = safeId(body.companyId)
    if (!companyId) {
      return Response.json({ error: "companyId が不正です" }, { status: 400 })
    }
    const repId = safeId(body.repId ?? null)

    // --- gather grounding context -------------------------------------------
    const [companyRows, signalRows, knowledgeRows, gapRows, needRows] = await Promise.all([
      querySnowflake(`
        SELECT COMPANY_NAME, INDUSTRY_LARGE, INDUSTRY_DETAIL, EMPLOYEE_COUNT,
               EMPLOYEE_COUNT_OVERSEAS, AVERAGE_AGE, AVERAGE_SALARY_JPY, TURNOVER_RATE,
               EMPLOYEE_RETENTION_RATE, WELFARE_EXPENSE_RATIO, PENSION_TYPE, HEALTH_CERT_STATUS,
               HAS_OVERSEAS_SUBSIDIARY, LATEST_REVENUE, OP_MARGIN, EMPLOYEE_COUNT_YOY,
               CONTRACT_COUNT, TOTAL_PREMIUM, TOTAL_INSURED, EXPIRING_90D, NEAREST_EXPIRY,
               COVERED_CATEGORY_LIST, SALES_REP_NAME, PROSPECT_RANK, PIPELINE_AMOUNT
        FROM ${ANALYTICS}.V_CUSTOMER_360 WHERE COMPANY_ID = '${sqlStr(companyId)}'
      `),
      querySnowflake(`
        SELECT INSURANCE_SIGNAL_TYPE, ANY_VALUE(SIGNAL_RATIONALE) AS RATIONALE,
               COUNT(*) AS POSTINGS, SUM(OPENINGS) AS OPENINGS, MAX(SIGNAL_STRENGTH) AS STRENGTH,
               LISTAGG(DISTINCT JOB_TITLE, '、') AS TITLES
        FROM ${RAW}.T_JOB_POSTINGS
        WHERE COMPANY_ID = '${sqlStr(companyId)}'
          AND POSTING_DATE >= DATEADD(day, -180, CURRENT_DATE())
        GROUP BY 1 ORDER BY STRENGTH DESC, POSTINGS DESC LIMIT 6
      `),
      querySnowflake(`
        SELECT KNOWLEDGE_ID, CATEGORY, PATTERN_TITLE, PATTERN_DETAIL, WHEN_TO_USE, TALK_SCRIPT
        FROM ${AI_SCHEMA}.T_TACIT_KNOWLEDGE
        WHERE CATEGORY IN ('課題の引き出し方','反論への切り返し','数値と事例の使い方')
        QUALIFY ROW_NUMBER() OVER (PARTITION BY CATEGORY ORDER BY CONFIDENCE DESC) <= 3
      `),
      querySnowflake(`
        SELECT DISTINCT p.PRODUCT_CATEGORY, LISTAGG(DISTINCT p.PRODUCT_NAME, '、') AS PRODUCTS
        FROM ${RAW}.T_INSURANCE_PRODUCTS p
        WHERE p.PRODUCT_CATEGORY NOT IN (
          SELECT DISTINCT p2.PRODUCT_CATEGORY FROM ${RAW}.T_CONTRACTS k2
          JOIN ${RAW}.T_INSURANCE_PRODUCTS p2 ON p2.PRODUCT_ID = k2.PRODUCT_ID
          WHERE k2.COMPANY_ID = '${sqlStr(companyId)}'
        ) GROUP BY 1
      `),
      querySnowflake(`
        SELECT f.VALUE:need::TEXT AS NEED, f.VALUE:depth::TEXT AS DEPTH, f.VALUE:evidence::TEXT AS EVIDENCE
        FROM ${RAW}.T_MEETING_SUMMARIES s
        JOIN ${RAW}.T_MEETINGS m ON m.MEETING_ID = s.MEETING_ID,
        LATERAL FLATTEN(input => s.CUSTOMER_NEEDS) f
        WHERE m.COMPANY_ID = '${sqlStr(companyId)}'
        ORDER BY m.MEETING_DATE DESC LIMIT 12
      `),
    ])

    const c = companyRows[0]
    if (!c) return Response.json({ error: "対象企業が見つかりません" }, { status: 404 })

    const signalText = signalRows.length
      ? signalRows
          .map(
            (s) =>
              `- ${s.INSURANCE_SIGNAL_TYPE}（強度${s.STRENGTH}/5・直近180日で${s.POSTINGS}件・募集${s.OPENINGS}名）: ${s.TITLES}\n  読み取れる示唆: ${s.RATIONALE}`,
          )
          .join("\n")
      : "- 直近180日の求人シグナルは検出されていない"

    const knowledgeText = knowledgeRows
      .map(
        (k) =>
          `- [${k.KNOWLEDGE_ID}] ${k.CATEGORY}／${k.PATTERN_TITLE}\n  内容: ${k.PATTERN_DETAIL}\n  使う場面: ${k.WHEN_TO_USE}`,
      )
      .join("\n")

    const gapText = gapRows.length
      ? gapRows.map((g) => `- ${g.PRODUCT_CATEGORY}: ${g.PRODUCTS}`).join("\n")
      : "- 主要カテゴリはすべて加入済み"

    const needText = needRows.length
      ? needRows.map((n) => `- [${n.DEPTH}] ${n.NEED}（根拠: ${n.EVIDENCE}）`).join("\n")
      : "- 過去商談から抽出されたニーズはまだない"

    const covered = toArray<string>(c.COVERED_CATEGORY_LIST)

    const prompt = `あなたはスノー生命の法人営業を支援するAIアシスタントです。以下のデータに基づいて、次回商談に向けた提案ストーリーを作成してください。

# 対象企業
- 企業名: ${c.COMPANY_NAME}
- 業種: ${c.INDUSTRY_LARGE} / ${c.INDUSTRY_DETAIL}
- 従業員数: ${toNum(c.EMPLOYEE_COUNT).toLocaleString("ja-JP")}名（うち海外 ${toNum(c.EMPLOYEE_COUNT_OVERSEAS).toLocaleString("ja-JP")}名）
- 平均年齢: ${c.AVERAGE_AGE}歳 / 平均年収: ${Math.round(toNum(c.AVERAGE_SALARY_JPY) / 10000)}万円
- 離職率: ${c.TURNOVER_RATE}% / 定着率: ${c.EMPLOYEE_RETENTION_RATE}% / 福利厚生費比率: ${c.WELFARE_EXPENSE_RATIO}%
- 年金制度: ${c.PENSION_TYPE} / 健康経営認定: ${c.HEALTH_CERT_STATUS} / 海外子会社: ${c.HAS_OVERSEAS_SUBSIDIARY ? "あり" : "なし"}
- 直近売上: ${Math.round(toNum(c.LATEST_REVENUE) / 100000000).toLocaleString("ja-JP")}億円 / 営業利益率: ${c.OP_MARGIN}% / 従業員数前年比: ${c.EMPLOYEE_COUNT_YOY}%
- 見込みランク: ${c.PROSPECT_RANK} / 担当: ${c.SALES_REP_NAME}

# 既存契約の状況
- 契約件数: ${toNum(c.CONTRACT_COUNT)}件 / 年間保険料: ${Math.round(toNum(c.TOTAL_PREMIUM) / 10000).toLocaleString("ja-JP")}万円 / 被保険者数: ${toNum(c.TOTAL_INSURED).toLocaleString("ja-JP")}名
- 加入済みカテゴリ: ${covered.length ? covered.join("、") : "なし"}
- 90日以内に満期を迎える契約: ${toNum(c.EXPIRING_90D)}件（最短満期 ${c.NEAREST_EXPIRY ?? "—"}）

# 未加入カテゴリ（提案余地）
${gapText}

# 求人データから検出された保険ニーズシグナル
${signalText}

# 過去商談から抽出済みの顧客ニーズ
${needText}

# 参照すべき暗黙知（トップ営業 山田太郎の商談から抽出。成約率68%）
${knowledgeText}

# 作成タスク
1. title: この提案ストーリーの表題（25〜45文字）。何を訴求するかが分かる具体的な表現にする。
2. hypothesis: 課題仮説（200〜350文字）。上記の求人シグナル・財務・従業員属性の具体的な数値を必ず根拠として引用し、「なぜ今この企業にこの提案が必要か」を論理的に述べる。
3. key_issues: 想定される経営・人事課題を4〜5件。各要素は文字列。データの裏付けがある課題のみ挙げること。
4. hearing_questions: 商談で投げるヒアリング質問を5〜6件。各要素は {"question":"質問文","intent":"この質問で何を確認したいか","knowledge_id":"参考にした暗黙知のID"} 形式。暗黙知の「課題の引き出し方」パターンを反映し、クローズドではなくオープンな問いにすること。
5. expected_objections: 想定される顧客の反論と切り返しを3〜4件。各要素は {"objection":"顧客が言いそうな懸念","response":"切り返しトーク","knowledge_id":"参考にした暗黙知のID"} 形式。暗黙知の「反論への切り返し」パターンを反映すること。
6. recommended_products: 推奨する保険商品・サービスを3〜4件。各要素は {"product":"商品名またはカテゴリ","reason":"推奨理由。求人シグナルや未加入カテゴリと紐づけて述べる"} 形式。

# 厳守事項
- 上記データに存在しない数値を創作してはならない。
- knowledge_id は上記の暗黙知リストに実在するIDのみ使うこと。参考にしていない場合は空文字にすること。
- 保険業法に抵触する断定的な利回り保証や誤認を招く表現を使わないこと。

# 出力形式
JSONオブジェクトのみを出力すること。マークダウンのコードブロックや前後の説明文は一切出力しないこと。
{"title":"...","hypothesis":"...","key_issues":[],"hearing_questions":[],"expected_objections":[],"recommended_products":[]}`

    const gen = await cortexCompleteJson<StoryPayload>(prompt, { temperature: 0.5, maxTokens: 12000 })

    // --- persist ------------------------------------------------------------
    const signalEvidence = signalRows.map((s) => ({
      signalType: String(s.INSURANCE_SIGNAL_TYPE),
      postings: toNum(s.POSTINGS),
      openings: toNum(s.OPENINGS),
      strength: toNum(s.STRENGTH),
      jobTitles: String(s.TITLES ?? ""),
    }))
    const appliedIds = Array.from(
      new Set(
        [...(gen.hearing_questions ?? []), ...(gen.expected_objections ?? [])]
          .map((x) => x.knowledge_id)
          .filter((v): v is string => Boolean(v)),
      ),
    )

    const storyId = `ST${Date.now().toString(36).toUpperCase()}`
    await querySnowflake(`
      INSERT INTO ${AI_SCHEMA}.T_PROPOSAL_STORIES
        (STORY_ID, COMPANY_ID, SALES_REP_ID, TITLE, HYPOTHESIS, KEY_ISSUES, HEARING_QUESTIONS,
         EXPECTED_OBJECTIONS, RECOMMENDED_PRODUCTS, SIGNAL_EVIDENCE, APPLIED_KNOWLEDGE_IDS,
         STATUS, MODEL_USED)
      SELECT '${sqlStr(storyId)}', '${sqlStr(companyId)}',
             ${repId ? `'${sqlStr(repId)}'` : `(SELECT SALES_REP_ID FROM ${RAW}.T_CUSTOMER_COMPANIES WHERE COMPANY_ID='${sqlStr(companyId)}')`},
             '${sqlStr(gen.title ?? "")}', '${sqlStr(gen.hypothesis ?? "")}',
             PARSE_JSON('${sqlStr(JSON.stringify(gen.key_issues ?? []))}'),
             PARSE_JSON('${sqlStr(JSON.stringify(gen.hearing_questions ?? []))}'),
             PARSE_JSON('${sqlStr(JSON.stringify(gen.expected_objections ?? []))}'),
             PARSE_JSON('${sqlStr(JSON.stringify(gen.recommended_products ?? []))}'),
             PARSE_JSON('${sqlStr(JSON.stringify(signalEvidence))}'),
             PARSE_JSON('${sqlStr(JSON.stringify(appliedIds))}'),
             'DRAFT', '${sqlStr(CORTEX_MODEL)}'
    `)

    const saved = await getProposalStories(companyId, null)
    return Response.json(saved.find((s) => s.storyId === storyId) ?? saved[0])
  } catch (e) {
    return aiError("api/ai/proposal-story POST", e)
  }
}
