import { querySnowflake } from "@/lib/snowflake"
import { AI_SCHEMA, ANALYTICS, CORTEX_MODEL, RAW } from "@/lib/constants"
import { safeId, sqlStr, toArray, toNum } from "@/lib/format"
import { aiError, cortexCompleteJson } from "@/lib/cortex"
import { getProposals } from "@/lib/queries"

export const dynamic = "force-dynamic"

interface ProposalPayload {
  title: string
  executive_summary: string
  sections: { heading: string; body: string; evidence?: string[] }[]
  recommended_products: { product: string; reason: string; estimated_premium?: number }[]
  estimated_premium_total?: number
}

/** GET — list saved proposals. */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams
    return Response.json(await getProposals(params.get("company"), params.get("rep")))
  } catch (e) {
    return aiError("api/ai/proposal GET", e)
  }
}

/**
 * POST — generate a proposal document.
 *
 * Grounded in the customer's real figures so every number in the output can be
 * traced back to a Snowflake column. When a story id is supplied, its hypothesis
 * and recommended products steer the narrative, keeping the proposal consistent
 * with what the rep already agreed with the customer.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { companyId?: string; storyId?: string; repId?: string }
    const companyId = safeId(body.companyId)
    if (!companyId) return Response.json({ error: "companyId が不正です" }, { status: 400 })
    const storyId = safeId(body.storyId ?? null)
    const repId = safeId(body.repId ?? null)

    const [companyRows, storyRows, contractRows, gapRows, needRows, signalRows] = await Promise.all([
      querySnowflake(`
        SELECT COMPANY_NAME, INDUSTRY_LARGE, INDUSTRY_DETAIL, EMPLOYEE_COUNT, EMPLOYEE_COUNT_JAPAN,
               EMPLOYEE_COUNT_OVERSEAS, AVERAGE_AGE, AVERAGE_SALARY_JPY, TURNOVER_RATE,
               EMPLOYEE_RETENTION_RATE, WELFARE_EXPENSE_RATIO, PENSION_TYPE, HEALTH_CERT_STATUS,
               LATEST_REVENUE, OP_MARGIN, EMPLOYEE_COUNT_YOY, CONTRACT_COUNT, TOTAL_PREMIUM,
               TOTAL_INSURED, EXPIRING_90D, NEAREST_EXPIRY, SALES_REP_NAME, PROSPECT_RANK
        FROM ${ANALYTICS}.V_CUSTOMER_360 WHERE COMPANY_ID = '${sqlStr(companyId)}'
      `),
      storyId
        ? querySnowflake(`
            SELECT TITLE, HYPOTHESIS, KEY_ISSUES, RECOMMENDED_PRODUCTS, HEARING_QUESTIONS
            FROM ${AI_SCHEMA}.T_PROPOSAL_STORIES WHERE STORY_ID = '${sqlStr(storyId)}'
          `)
        : Promise.resolve([]),
      querySnowflake(`
        SELECT p.PRODUCT_NAME, p.PRODUCT_CATEGORY, k.ANNUAL_PREMIUM, k.INSURED_COUNT,
               k.CONTRACT_DATE, k.EXPIRY_DATE
        FROM ${RAW}.T_CONTRACTS k
        LEFT JOIN ${RAW}.T_INSURANCE_PRODUCTS p ON p.PRODUCT_ID = k.PRODUCT_ID
        WHERE k.COMPANY_ID = '${sqlStr(companyId)}' ORDER BY k.EXPIRY_DATE
      `),
      querySnowflake(`
        SELECT p.PRODUCT_NAME, p.PRODUCT_CATEGORY, p.DESCRIPTION, p.TARGET_AUDIENCE
        FROM ${RAW}.T_INSURANCE_PRODUCTS p
        WHERE p.PRODUCT_CATEGORY NOT IN (
          SELECT DISTINCT p2.PRODUCT_CATEGORY FROM ${RAW}.T_CONTRACTS k2
          JOIN ${RAW}.T_INSURANCE_PRODUCTS p2 ON p2.PRODUCT_ID = k2.PRODUCT_ID
          WHERE k2.COMPANY_ID = '${sqlStr(companyId)}'
        ) LIMIT 12
      `),
      querySnowflake(`
        SELECT f.VALUE:need::TEXT AS NEED, f.VALUE:depth::TEXT AS DEPTH, f.VALUE:evidence::TEXT AS EVIDENCE
        FROM ${RAW}.T_MEETING_SUMMARIES s
        JOIN ${RAW}.T_MEETINGS m ON m.MEETING_ID = s.MEETING_ID,
        LATERAL FLATTEN(input => s.CUSTOMER_NEEDS) f
        WHERE m.COMPANY_ID = '${sqlStr(companyId)}' AND f.VALUE:depth::TEXT IN ('深層','中層')
        ORDER BY m.MEETING_DATE DESC LIMIT 10
      `),
      querySnowflake(`
        SELECT INSURANCE_SIGNAL_TYPE, SUM(OPENINGS) AS OPENINGS, COUNT(*) AS POSTINGS,
               MAX(SIGNAL_STRENGTH) AS STRENGTH, ANY_VALUE(SIGNAL_RATIONALE) AS RATIONALE
        FROM ${RAW}.T_JOB_POSTINGS
        WHERE COMPANY_ID = '${sqlStr(companyId)}' AND POSTING_DATE >= DATEADD(day,-180,CURRENT_DATE())
        GROUP BY 1 ORDER BY STRENGTH DESC LIMIT 5
      `),
    ])

    const c = companyRows[0]
    if (!c) return Response.json({ error: "対象企業が見つかりません" }, { status: 404 })
    const story = storyRows[0]

    const contractText = contractRows.length
      ? contractRows
          .map(
            (k) =>
              `- ${k.PRODUCT_NAME}（${k.PRODUCT_CATEGORY}）: 年間保険料 ${Math.round(toNum(k.ANNUAL_PREMIUM) / 10000).toLocaleString("ja-JP")}万円・被保険者 ${toNum(k.INSURED_COUNT).toLocaleString("ja-JP")}名・満期 ${k.EXPIRY_DATE}`,
          )
          .join("\n")
      : "- 既存契約なし（新規開拓）"

    const prompt = `あなたはスノー生命の法人営業を支援するAIアシスタントです。以下のデータに基づき、法人顧客に提出する提案書のドラフトを作成してください。

# 提案先企業の実データ
- 企業名: ${c.COMPANY_NAME}（${c.INDUSTRY_LARGE} / ${c.INDUSTRY_DETAIL}）
- 従業員数: ${toNum(c.EMPLOYEE_COUNT).toLocaleString("ja-JP")}名（国内 ${toNum(c.EMPLOYEE_COUNT_JAPAN).toLocaleString("ja-JP")}名・海外 ${toNum(c.EMPLOYEE_COUNT_OVERSEAS).toLocaleString("ja-JP")}名）
- 平均年齢 ${c.AVERAGE_AGE}歳 / 平均年収 ${Math.round(toNum(c.AVERAGE_SALARY_JPY) / 10000)}万円 / 離職率 ${c.TURNOVER_RATE}% / 定着率 ${c.EMPLOYEE_RETENTION_RATE}%
- 福利厚生費比率 ${c.WELFARE_EXPENSE_RATIO}% / 年金制度 ${c.PENSION_TYPE} / 健康経営認定 ${c.HEALTH_CERT_STATUS}
- 直近売上 ${Math.round(toNum(c.LATEST_REVENUE) / 100000000).toLocaleString("ja-JP")}億円 / 営業利益率 ${c.OP_MARGIN}% / 従業員数前年比 ${c.EMPLOYEE_COUNT_YOY}%
- 担当営業: ${c.SALES_REP_NAME} / 見込みランク: ${c.PROSPECT_RANK}

# 既存契約
${contractText}
（合計 ${toNum(c.CONTRACT_COUNT)}件・年間保険料 ${Math.round(toNum(c.TOTAL_PREMIUM) / 10000).toLocaleString("ja-JP")}万円・被保険者 ${toNum(c.TOTAL_INSURED).toLocaleString("ja-JP")}名・90日以内満期 ${toNum(c.EXPIRING_90D)}件）

# 未加入カテゴリで提案可能な商品
${gapRows.map((g) => `- ${g.PRODUCT_NAME}（${g.PRODUCT_CATEGORY}）: ${g.DESCRIPTION ?? ""}`).join("\n") || "- なし"}

# 求人データから読み取れる保険ニーズシグナル（直近180日）
${signalRows.map((s) => `- ${s.INSURANCE_SIGNAL_TYPE}（強度${s.STRENGTH}/5・${s.POSTINGS}件・募集${s.OPENINGS}名）: ${s.RATIONALE}`).join("\n") || "- なし"}

# 過去商談で確認済みの顧客ニーズ
${needRows.map((n) => `- [${n.DEPTH}] ${n.NEED}（根拠となる顧客の発言: ${n.EVIDENCE}）`).join("\n") || "- なし"}

${
  story
    ? `# 事前に作成した提案ストーリー
- 表題: ${story.TITLE}
- 課題仮説: ${story.HYPOTHESIS}
- 想定課題: ${toArray<string>(story.KEY_ISSUES).join(" / ")}
- 推奨商品: ${toArray<{ product: string; reason: string }>(story.RECOMMENDED_PRODUCTS).map((p) => p.product).join("、")}
この提案ストーリーの方向性に沿った提案書にすること。`
    : ""
}

# 作成タスク
1. title: 提案書のタイトル（30〜50文字）。顧客名と提案の主題を含める。
2. executive_summary: エグゼクティブサマリー（250〜400文字）。顧客の課題、提案の骨子、期待効果を、上記の具体的な数値を引用しながら記述する。
3. sections: 提案書の本文を5〜6章。各要素は {"heading":"章タイトル","body":"本文（250〜450文字）","evidence":["この章で引用した数値やデータの出典を示す短い文字列"]} 形式。章構成は以下を基本とする。
   - 貴社を取り巻く環境と課題認識
   - 現行制度の分析と改善余地
   - ご提案内容
   - 導入効果の試算
   - 導入スケジュールと支援体制
4. recommended_products: 推奨商品を3〜4件。各要素は {"product":"商品名","reason":"推奨理由","estimated_premium":想定年間保険料の数値（円）} 形式。estimated_premium は従業員数と平均年収から現実的な水準で試算すること。
5. estimated_premium_total: recommended_products の estimated_premium の合計（数値・円）。

# 厳守事項
- 上記データに存在しない数値を創作してはならない。試算値を示す場合は「試算」であることを本文中に明記する。
- 保険業法・金融商品取引法に抵触する表現（利回りの断定的保証、他社の不当な誹謗、誤認を招く比較）を使わないこと。
- 顧客企業の実名を使うが、記載する財務・従業員データは上記の提供値のみを用いること。

# 出力形式
JSONオブジェクトのみを出力すること。マークダウンのコードブロックや前後の説明文は一切出力しないこと。
{"title":"...","executive_summary":"...","sections":[],"recommended_products":[],"estimated_premium_total":0}`

    const gen = await cortexCompleteJson<ProposalPayload>(prompt, {
      temperature: 0.45,
      maxTokens: 14000,
    })

    const totalPremium =
      toNum(gen.estimated_premium_total) ||
      (gen.recommended_products ?? []).reduce((sum, p) => sum + toNum(p.estimated_premium), 0)

    const dataEvidence = {
      employeeCount: toNum(c.EMPLOYEE_COUNT),
      averageSalary: toNum(c.AVERAGE_SALARY_JPY),
      turnoverRate: toNum(c.TURNOVER_RATE),
      latestRevenue: toNum(c.LATEST_REVENUE),
      opMargin: toNum(c.OP_MARGIN),
      currentPremium: toNum(c.TOTAL_PREMIUM),
      currentInsured: toNum(c.TOTAL_INSURED),
      signalTypes: signalRows.map((s) => String(s.INSURANCE_SIGNAL_TYPE)),
      needsReferenced: needRows.length,
    }

    const proposalId = `PR${Date.now().toString(36).toUpperCase()}`
    await querySnowflake(`
      INSERT INTO ${AI_SCHEMA}.T_PROPOSALS
        (PROPOSAL_ID, COMPANY_ID, STORY_ID, SALES_REP_ID, TITLE, EXECUTIVE_SUMMARY, SECTIONS,
         RECOMMENDED_PRODUCTS, ESTIMATED_PREMIUM, DATA_EVIDENCE, VERSION, STATUS, MODEL_USED)
      SELECT '${sqlStr(proposalId)}', '${sqlStr(companyId)}',
             ${storyId ? `'${sqlStr(storyId)}'` : "NULL"},
             ${repId ? `'${sqlStr(repId)}'` : `(SELECT SALES_REP_ID FROM ${RAW}.T_CUSTOMER_COMPANIES WHERE COMPANY_ID='${sqlStr(companyId)}')`},
             '${sqlStr(gen.title ?? "")}', '${sqlStr(gen.executive_summary ?? "")}',
             PARSE_JSON('${sqlStr(JSON.stringify(gen.sections ?? []))}'),
             PARSE_JSON('${sqlStr(JSON.stringify(gen.recommended_products ?? []))}'),
             ${totalPremium},
             PARSE_JSON('${sqlStr(JSON.stringify(dataEvidence))}'),
             (SELECT COALESCE(MAX(VERSION),0)+1 FROM ${AI_SCHEMA}.T_PROPOSALS WHERE COMPANY_ID='${sqlStr(companyId)}'),
             'DRAFT', '${sqlStr(CORTEX_MODEL)}'
    `)

    const saved = await getProposals(companyId, null)
    return Response.json(saved.find((p) => p.proposalId === proposalId) ?? saved[0])
  } catch (e) {
    return aiError("api/ai/proposal POST", e)
  }
}
