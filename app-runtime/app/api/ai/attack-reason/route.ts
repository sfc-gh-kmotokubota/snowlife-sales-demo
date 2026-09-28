import { querySnowflake } from "@/lib/snowflake"
import { ANALYTICS, RAW } from "@/lib/constants"
import { safeId, sqlStr, toArray, toNum } from "@/lib/format"
import { aiError, cortexCompleteJson } from "@/lib/cortex"

export const dynamic = "force-dynamic"

interface ReasonPayload {
  companies: {
    company_id: string
    headline: string
    reason: string
    recommended_approach: string
    talking_point: string
  }[]
}

/**
 * POST — generate the "why now" narrative for the top companies on the attack
 * list. Batched into a single Cortex call so the screen shows reasons for the
 * whole shortlist after one round trip rather than N.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { companyIds?: string[] }
    const ids = (body.companyIds ?? []).map((v) => safeId(v)).filter((v): v is string => Boolean(v))
    if (!ids.length) return Response.json({ error: "companyIds が空です" }, { status: 400 })

    const capped = ids.slice(0, 8)
    const inList = capped.map((v) => `'${sqlStr(v)}'`).join(",")

    const [rows, signalRows] = await Promise.all([
      querySnowflake(`
        SELECT COMPANY_ID, COMPANY_NAME, INDUSTRY_LARGE, INDUSTRY_DETAIL, EMPLOYEE_COUNT,
               PROSPECT_RANK, ATTACK_GRADE, TOTAL_SCORE, PRIMARY_TRIGGER, TRIGGERS,
               TOP_SIGNAL_TYPE, TOP_JOB_TITLE, TOP_SIGNAL_RATIONALE,
               SCORE_HIRING_SIGNAL, SCORE_CONTRACT_GAP, SCORE_EVENT_FRESH,
               SCORE_CONTACT_GAP, SCORE_RENEWAL,
               RECENT_POSTINGS_90D, RECENT_OPENINGS_90D, SIGNAL_TYPE_COUNT,
               CONTRACT_COUNT, TOTAL_PREMIUM, EXPIRING_90D, NEAREST_EXPIRY,
               DAYS_SINCE_TOUCH, HAS_DM_CONTACT, CONTACT_COUNT, ALERT_COUNT,
               PENSION_TYPE, HEALTH_CERT_STATUS, TURNOVER_RATE, OP_MARGIN
        FROM ${ANALYTICS}.V_ATTACK_LIST WHERE COMPANY_ID IN (${inList})
        ORDER BY TOTAL_SCORE DESC
      `),
      querySnowflake(`
        SELECT COMPANY_ID, INSURANCE_SIGNAL_TYPE, SUM(OPENINGS) AS OPENINGS,
               COUNT(*) AS POSTINGS, MAX(SIGNAL_STRENGTH) AS STRENGTH,
               LISTAGG(DISTINCT JOB_TITLE, '、') AS TITLES
        FROM ${RAW}.T_JOB_POSTINGS
        WHERE COMPANY_ID IN (${inList}) AND POSTING_DATE >= DATEADD(day,-120,CURRENT_DATE())
          AND SIGNAL_STRENGTH >= 3
        GROUP BY 1,2 ORDER BY STRENGTH DESC
      `),
    ])

    if (!rows.length) return Response.json({ companies: [] })

    const signalsByCompany = new Map<string, string[]>()
    for (const s of signalRows) {
      const key = String(s.COMPANY_ID)
      const arr = signalsByCompany.get(key) ?? []
      arr.push(
        `${s.INSURANCE_SIGNAL_TYPE}（強度${s.STRENGTH}/5・${s.POSTINGS}件・募集${s.OPENINGS}名: ${s.TITLES}）`,
      )
      signalsByCompany.set(key, arr)
    }

    const companyBlocks = rows
      .map((r) => {
        const id = String(r.COMPANY_ID)
        return `## ${id} ${r.COMPANY_NAME}
- 業種: ${r.INDUSTRY_LARGE}/${r.INDUSTRY_DETAIL} / 従業員 ${toNum(r.EMPLOYEE_COUNT).toLocaleString("ja-JP")}名 / 見込みランク ${r.PROSPECT_RANK}
- アタック優先度: ${r.ATTACK_GRADE}（総合スコア ${toNum(r.TOTAL_SCORE)}）/ 主トリガー: ${r.PRIMARY_TRIGGER}
- 検出トリガー: ${toArray<string>(r.TRIGGERS).join("、") || "なし"}
- スコア内訳: 求人シグナル ${toNum(r.SCORE_HIRING_SIGNAL)} / 契約空白 ${toNum(r.SCORE_CONTRACT_GAP)} / イベント鮮度 ${toNum(r.SCORE_EVENT_FRESH)} / 接点空白 ${toNum(r.SCORE_CONTACT_GAP)} / 満期接近 ${toNum(r.SCORE_RENEWAL)}
- 求人動向: 直近90日 ${toNum(r.RECENT_POSTINGS_90D)}件・募集${toNum(r.RECENT_OPENINGS_90D)}名・シグナル種別${toNum(r.SIGNAL_TYPE_COUNT)}種
- 求人シグナル詳細: ${(signalsByCompany.get(id) ?? ["なし"]).join(" / ")}
- 既存契約: ${toNum(r.CONTRACT_COUNT)}件・年間保険料 ${Math.round(toNum(r.TOTAL_PREMIUM) / 10000).toLocaleString("ja-JP")}万円 / 90日以内満期 ${toNum(r.EXPIRING_90D)}件（最短 ${r.NEAREST_EXPIRY ?? "—"}）
- 接点状況: 最終接触から ${toNum(r.DAYS_SINCE_TOUCH)}日 / 登録キーマン ${toNum(r.CONTACT_COUNT)}名 / 決裁者接触 ${toNum(r.HAS_DM_CONTACT) === 1 ? "あり" : "なし"}
- 属性: 年金制度 ${r.PENSION_TYPE} / 健康経営認定 ${r.HEALTH_CERT_STATUS} / 離職率 ${r.TURNOVER_RATE}% / 営業利益率 ${r.OP_MARGIN}%
- 未処理の事業イベントアラート: ${toNum(r.ALERT_COUNT)}件`
      })
      .join("\n\n")

    const prompt = `あなたはスノー生命の法人営業を支援するAIアシスタントです。以下のアタックリスト候補について、営業員が今すぐ動くべき理由を簡潔に言語化してください。

# アタックリスト候補
${companyBlocks}

# 作成タスク
各企業について以下を作成してください。

- company_id: 上記の企業ID（例 C001）をそのまま使うこと
- headline: 今アプローチすべき理由の要約（25〜40文字）。最も強いトリガーを核にする
- reason: 根拠（120〜200文字）。求人シグナル・満期・接点空白・契約空白のうち実際にスコアが高い要素を、上記の具体的な数値を引用して説明する
- recommended_approach: 推奨アプローチ（80〜140文字）。誰にどう接触し何を切り口にするか。決裁者未接触の場合はその突破策を述べる
- talking_point: 初回の切り出しトーク例（60〜120文字）。求人情報など公開情報への言及から入る形にする

# 厳守事項
- 上記データに存在しない数値を創作してはならない。
- スコアが低い要素を主要因として述べてはならない。
- 保険業法に抵触する断定的な表現を使わないこと。

# 出力形式
JSONオブジェクトのみを出力すること。マークダウンのコードブロックや前後の説明文は一切出力しないこと。
{"companies":[{"company_id":"...","headline":"...","reason":"...","recommended_approach":"...","talking_point":"..."}]}`

    const gen = await cortexCompleteJson<ReasonPayload>(prompt, {
      temperature: 0.5,
      maxTokens: 10000,
    })
    return Response.json(gen)
  } catch (e) {
    return aiError("api/ai/attack-reason POST", e)
  }
}
