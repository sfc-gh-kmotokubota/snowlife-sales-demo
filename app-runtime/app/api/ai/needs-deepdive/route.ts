import { querySnowflake } from "@/lib/snowflake"
import { AI_SCHEMA, ANALYTICS, CORTEX_MODEL, RAW } from "@/lib/constants"
import { safeId, sqlStr, toNum } from "@/lib/format"
import { aiError, cortexCompleteJson } from "@/lib/cortex"

export const dynamic = "force-dynamic"

interface DeepDivePayload {
  refined_needs: {
    need: string
    current_depth: string
    target_depth: string
    why_it_matters: string
    probe_questions: string[]
  }[]
  gap_analysis: {
    dimension: string
    this_meeting: string
    top_performer: string
    advice: string
    knowledge_id?: string
  }[]
  missed_recovery: { missed: string; recovery_action: string; script: string }[]
  next_meeting_focus: string
}

/**
 * POST — post-meeting review: refine the customer needs surfaced in a meeting,
 * and compare the rep's behaviour against the top performer's extracted
 * patterns so the feedback is concrete rather than generic coaching.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { meetingId?: string }
    const meetingId = safeId(body.meetingId)
    if (!meetingId) return Response.json({ error: "meetingId が不正です" }, { status: 400 })

    const [metaRows, transcriptRows, knowledgeRows, benchRows] = await Promise.all([
      querySnowflake(`
        SELECT q.MEETING_ID, q.COMPANY_NAME, q.INDUSTRY_LARGE, q.SALES_REP_NAME, q.SKILL_TIER,
               q.MEETING_DATE, q.AGENDA, q.OUTCOME, q.QUALITY_SCORE, q.HEARING_QUESTION_COUNT,
               q.NEED_COUNT, q.DEEP_NEED_COUNT, q.MISSED_COUNT, q.OBJECTION_COUNT,
               q.OBJECTIONS_HANDLED, q.NEXT_ACTION_AGREED, q.SENTIMENT,
               s.SUMMARY_TEXT, s.CUSTOMER_NEEDS, s.MISSED_OPPORTUNITIES, s.OBJECTIONS, s.KEY_ISSUES,
               c.EMPLOYEE_COUNT, c.PENSION_TYPE, c.HEALTH_CERT_STATUS
        FROM ${ANALYTICS}.V_MEETING_QUALITY q
        LEFT JOIN ${RAW}.T_MEETING_SUMMARIES s ON s.MEETING_ID = q.MEETING_ID
        JOIN ${RAW}.T_CUSTOMER_COMPANIES c ON c.COMPANY_ID = q.COMPANY_ID
        WHERE q.MEETING_ID = '${sqlStr(meetingId)}'
      `),
      querySnowflake(`
        SELECT LISTAGG(SPEAKER_LABEL || ': ' || TRANSCRIPT_TEXT, '\\n')
               WITHIN GROUP (ORDER BY START_TIME_SEC) AS FULL_TEXT
        FROM ${RAW}.T_MEETING_TRANSCRIPTS WHERE MEETING_ID = '${sqlStr(meetingId)}'
      `),
      querySnowflake(`
        SELECT KNOWLEDGE_ID, CATEGORY, PATTERN_TITLE, PATTERN_DETAIL, WHEN_TO_USE, TALK_SCRIPT
        FROM ${AI_SCHEMA}.T_TACIT_KNOWLEDGE
        QUALIFY ROW_NUMBER() OVER (PARTITION BY CATEGORY ORDER BY CONFIDENCE DESC) <= 3
      `),
      querySnowflake(`
        SELECT SKILL_TIER, ROUND(AVG(QUALITY_SCORE),1) AS AVG_QUALITY,
               ROUND(AVG(HEARING_QUESTION_COUNT),1) AS AVG_QUESTIONS,
               ROUND(AVG(DEEP_NEED_COUNT),2) AS AVG_DEEP_NEEDS,
               ROUND(AVG(MISSED_COUNT),1) AS AVG_MISSED,
               ROUND(100.0 * COUNT_IF(NEXT_ACTION_AGREED) / NULLIF(COUNT(*),0),0) AS PCT_NEXT_ACTION
        FROM ${ANALYTICS}.V_MEETING_QUALITY GROUP BY 1
      `),
    ])

    const m = metaRows[0]
    if (!m) return Response.json({ error: "対象商談が見つかりません" }, { status: 404 })
    const transcript = String(transcriptRows[0]?.FULL_TEXT ?? "")
    if (!transcript) return Response.json({ error: "書き起こしがありません" }, { status: 404 })

    const top = benchRows.find((b) => String(b.SKILL_TIER) === "トップ")

    const prompt = `あなたはスノー生命の法人営業を支援するAIコーチです。以下の商談を分析し、課題・ニーズの精緻化と、トップ営業との差分に基づく具体的なフィードバックを行ってください。

# 商談情報
- 顧客: ${m.COMPANY_NAME}（${m.INDUSTRY_LARGE}・従業員${toNum(m.EMPLOYEE_COUNT).toLocaleString("ja-JP")}名・年金制度${m.PENSION_TYPE}・健康経営認定${m.HEALTH_CERT_STATUS}）
- 担当営業: ${m.SALES_REP_NAME}（スキル階層: ${m.SKILL_TIER}）
- 商談日: ${m.MEETING_DATE} / 議題: ${m.AGENDA} / 結果: ${m.OUTCOME}

# この商談の実績値
- 商談品質スコア: ${toNum(m.QUALITY_SCORE)} / 100
- ヒアリング質問数: ${toNum(m.HEARING_QUESTION_COUNT)}回
- 抽出ニーズ数: ${toNum(m.NEED_COUNT)}件（うち深層ニーズ ${toNum(m.DEEP_NEED_COUNT)}件）
- 拾えなかった論点: ${toNum(m.MISSED_COUNT)}件
- 顧客の懸念: ${toNum(m.OBJECTION_COUNT)}件（うち適切に応対 ${toNum(m.OBJECTIONS_HANDLED)}件）
- 次回アクションの合意: ${m.NEXT_ACTION_AGREED ? "あり" : "なし"} / 顧客の反応: ${m.SENTIMENT}

# トップ営業（山田太郎・成約率68%）の平均値
- 商談品質スコア: ${toNum(top?.AVG_QUALITY)} / ヒアリング質問数: ${toNum(top?.AVG_QUESTIONS)}回 / 深層ニーズ: ${toNum(top?.AVG_DEEP_NEEDS)}件 / 拾えなかった論点: ${toNum(top?.AVG_MISSED)}件 / 次回アクション合意率: ${toNum(top?.PCT_NEXT_ACTION)}%

# 商談要約
${m.SUMMARY_TEXT ?? "（要約なし）"}

# 抽出済みの顧客ニーズ（JSON）
${JSON.stringify(m.CUSTOMER_NEEDS ?? [])}

# 拾えなかった論点（JSON）
${JSON.stringify(m.MISSED_OPPORTUNITIES ?? [])}

# 顧客の懸念と応対状況（JSON）
${JSON.stringify(m.OBJECTIONS ?? [])}

# 商談書き起こし
${transcript}

# トップ営業から抽出された暗黙知パターン
${knowledgeRows.map((k) => `- [${k.KNOWLEDGE_ID}] ${k.CATEGORY}／${k.PATTERN_TITLE}\n  内容: ${k.PATTERN_DETAIL}\n  使う場面: ${k.WHEN_TO_USE}\n  トーク例: ${k.TALK_SCRIPT}`).join("\n")}

# 分析タスク
1. refined_needs: 抽出済みニーズを精緻化して3〜5件。各要素は {"need":"精緻化したニーズ","current_depth":"表層|中層|深層","target_depth":"次回到達すべき深さ","why_it_matters":"このニーズが提案上なぜ重要か","probe_questions":["次回投げるべき深掘り質問",...]} 形式。書き起こしに根拠がある内容のみ。
2. gap_analysis: トップ営業との差分を4〜5件。各要素は {"dimension":"比較の観点","this_meeting":"この商談の状況","top_performer":"トップ営業ならどうするか","advice":"具体的な改善アクション","knowledge_id":"根拠となる暗黙知のID"} 形式。上記の実績値とトップ平均値の差を必ず引用すること。
3. missed_recovery: 拾えなかった論点の回収策を2〜4件。各要素は {"missed":"拾えなかった論点","recovery_action":"次回どう回収するか","script":"そのまま使えるトーク（80〜150文字）"} 形式。
4. next_meeting_focus: 次回商談で最も注力すべき一点（100〜180文字）。

# 厳守事項
- knowledge_id は上記リストに実在するIDのみ使うこと。該当しない場合は空文字にする。
- 書き起こしに存在しない発言を根拠として引用してはならない。
- 担当営業を非難する表現ではなく、再現可能な行動として改善策を示すこと。

# 出力形式
JSONオブジェクトのみを出力すること。マークダウンのコードブロックや前後の説明文は一切出力しないこと。
{"refined_needs":[],"gap_analysis":[],"missed_recovery":[],"next_meeting_focus":"..."}`

    const gen = await cortexCompleteJson<DeepDivePayload>(prompt, {
      temperature: 0.4,
      maxTokens: 14000,
    })

    return Response.json({
      meetingId,
      generatedAt: new Date().toISOString(),
      modelUsed: CORTEX_MODEL,
      metrics: {
        qualityScore: toNum(m.QUALITY_SCORE),
        hearingQuestionCount: toNum(m.HEARING_QUESTION_COUNT),
        deepNeedCount: toNum(m.DEEP_NEED_COUNT),
        missedCount: toNum(m.MISSED_COUNT),
        objectionsHandled: toNum(m.OBJECTIONS_HANDLED),
        objectionCount: toNum(m.OBJECTION_COUNT),
        topAvgQuality: toNum(top?.AVG_QUALITY),
        topAvgQuestions: toNum(top?.AVG_QUESTIONS),
        topAvgDeepNeeds: toNum(top?.AVG_DEEP_NEEDS),
        topAvgMissed: toNum(top?.AVG_MISSED),
      },
      ...gen,
    })
  } catch (e) {
    return aiError("api/ai/needs-deepdive POST", e)
  }
}
