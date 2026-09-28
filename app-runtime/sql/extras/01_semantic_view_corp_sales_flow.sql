/*
  SV_CORP_SALES_FLOW — 法人営業フロー（①お客様選定 → ②③事前準備 → ④商談 → ⑤振り返り）分析用セマンティックビュー

  設計方針
  --------
  Web アプリ（corp-sales-copilot）が画面に出している指標とエージェントの回答を一致させるため、
  生テーブルではなく既に集計済みの ANALYTICS ビューを土台にする。

  意図的に除外したもの
  - V_CUSTOMER_360: V_ATTACK_LIST と同じ「1行/企業」粒度。両方入れると同一企業が2テーブルに現れ、
    TOTAL_PREMIUM 等が二重計上される。財務指標は V_ATTACK_LIST 側にも含まれるため実害は小さい。
  - V_HIRING_SIGNAL: 「企業 × シグナル種別 × 月」粒度。企業に結合するとファンアウトして
    企業側メトリクスが膨らむ。求人明細は Cortex Search (JOB_POSTING_SEARCH) 側で扱う。

  既存の SV_SALES_ANALYTICS は旧エージェント LIFEINSURANCE_SALES_AGENT が使用中のため変更しない。
*/

CREATE OR REPLACE SEMANTIC VIEW LIFEINSURANCE_DEMO_DB.ANALYTICS.SV_CORP_SALES_FLOW

  TABLES (
    COMPANIES AS LIFEINSURANCE_DEMO_DB.ANALYTICS.V_ATTACK_LIST
      PRIMARY KEY (COMPANY_ID)
      WITH SYNONYMS = ('企業', '顧客企業', '担当先', 'アタックリスト')
      COMMENT = '顧客企業マスタとアタックリストスコア。1行1企業。採用シグナル・契約ギャップ・接触鮮度・満期を統合した優先度スコアを持つ（①お客様選定）',

    MEETINGS AS LIFEINSURANCE_DEMO_DB.ANALYTICS.V_MEETING_QUALITY
      PRIMARY KEY (MEETING_ID)
      WITH SYNONYMS = ('商談', '面談', '訪問', '商談履歴')
      COMMENT = '商談と AI 要約から算出した商談品質。1行1商談（④商談・⑤振り返り）',

    CONTACTS AS LIFEINSURANCE_DEMO_DB.ANALYTICS.V_KEY_PERSON_COVERAGE
      PRIMARY KEY (CONTACT_ID)
      WITH SYNONYMS = ('担当者', 'キーマン', '窓口', '人的接点')
      COMMENT = '顧客企業側の担当者とその接触状況。1行1担当者（キーマン網羅の把握）',

    REPS AS LIFEINSURANCE_DEMO_DB.RAW.T_SALES_REP_SKILLS
      PRIMARY KEY (SALES_REP_ID)
      WITH SYNONYMS = ('営業員', '営業担当', '担当営業', 'セールス')
      COMMENT = '自社の営業担当者とそのスキル階層・勝率。1行1営業員',

    ACTIONS AS LIFEINSURANCE_DEMO_DB.RAW.T_NEXT_ACTIONS
      PRIMARY KEY (ACTION_ID)
      WITH SYNONYMS = ('次回アクション', 'ToDo', '宿題', 'タスク')
      COMMENT = '商談から生まれた次回アクション。1行1アクション（⑤振り返り→再訪問）'
  )

  RELATIONSHIPS (
    MEETINGS_TO_COMPANIES AS MEETINGS (COMPANY_ID) REFERENCES COMPANIES,
    MEETINGS_TO_REPS      AS MEETINGS (SALES_REP_ID) REFERENCES REPS,
    CONTACTS_TO_COMPANIES AS CONTACTS (COMPANY_ID) REFERENCES COMPANIES,
    ACTIONS_TO_COMPANIES  AS ACTIONS (COMPANY_ID) REFERENCES COMPANIES
  )

  FACTS (
    -- COMPANIES
    COMPANIES.ATTACK_SCORE AS COMPANIES.TOTAL_SCORE
      COMMENT = 'アタック優先度スコア（0-100）。採用シグナル・契約ギャップ・財務・イベント鮮度・接触ギャップ・企業規模・満期の加重合計',
    COMPANIES.PIPELINE_AMOUNT_FACT AS COMPANIES.PIPELINE_AMOUNT
      COMMENT = '見込みパイプライン金額（円・年額）',
    COMPANIES.TOTAL_PREMIUM_FACT AS COMPANIES.TOTAL_PREMIUM
      COMMENT = '既契約の年間保険料合計（円）',
    COMPANIES.DAYS_SINCE_TOUCH_FACT AS COMPANIES.DAYS_SINCE_TOUCH
      COMMENT = '最終接触からの経過日数。大きいほど放置されている',
    COMPANIES.RECENT_POSTINGS_90D_FACT AS COMPANIES.RECENT_POSTINGS_90D
      COMMENT = '直近90日の求人掲載件数',
    COMPANIES.EXPIRING_90D_FACT AS COMPANIES.EXPIRING_90D
      COMMENT = '90日以内に満期を迎える契約件数',
    COMPANIES.EMPLOYEE_COUNT_FACT AS COMPANIES.EMPLOYEE_COUNT
      COMMENT = '従業員数（連結）',
    COMPANIES.ANNUAL_REVENUE_FACT AS COMPANIES.ANNUAL_REVENUE_JPY
      COMMENT = '年間売上高（円）',
    COMPANIES.OP_MARGIN_FACT AS COMPANIES.OP_MARGIN
      COMMENT = '営業利益率',
    COMPANIES.CONTRACT_COUNT_FACT AS COMPANIES.CONTRACT_COUNT
      COMMENT = '既契約件数',
    COMPANIES.COVERED_CATEGORY_COUNT_FACT AS COMPANIES.COVERED_CATEGORY_COUNT
      COMMENT = '契約済みの商品カテゴリ数。ALL_CATEGORIES との差が提案余地',

    -- MEETINGS
    MEETINGS.QUALITY_SCORE_FACT AS MEETINGS.QUALITY_SCORE
      COMMENT = '商談品質スコア（0-100）。ヒアリングの深さ・深層ニーズ抽出・反論対応・次回合意から算出。35未満は要振り返り',
    MEETINGS.HEARING_QUESTION_COUNT_FACT AS MEETINGS.HEARING_QUESTION_COUNT
      COMMENT = '商談中のヒアリング質問数',
    MEETINGS.DEEP_NEED_COUNT_FACT AS MEETINGS.DEEP_NEED_COUNT
      COMMENT = '抽出できた深層ニーズの数',
    MEETINGS.MISSED_COUNT_FACT AS MEETINGS.MISSED_COUNT
      COMMENT = '拾えなかった論点（未回収）の数。多いほど振り返りが必要',
    MEETINGS.OBJECTION_COUNT_FACT AS MEETINGS.OBJECTION_COUNT
      COMMENT = '顧客から出た反論の数',
    MEETINGS.OBJECTIONS_HANDLED_FACT AS MEETINGS.OBJECTIONS_HANDLED
      COMMENT = '対応できた反論の数',
    MEETINGS.COMPLIANCE_ISSUE_COUNT_FACT AS MEETINGS.COMPLIANCE_ISSUE_COUNT
      COMMENT = 'コンプライアンス上の指摘件数',
    MEETINGS.KEY_ISSUE_COUNT_FACT AS MEETINGS.KEY_ISSUE_COUNT
      COMMENT = '抽出された課題の数',
    MEETINGS.NEED_COUNT_FACT AS MEETINGS.NEED_COUNT
      COMMENT = '抽出された顧客ニーズの数',
    MEETINGS.TURN_COUNT_FACT AS MEETINGS.TURN_COUNT
      COMMENT = '商談中の発言ターン数',
    MEETINGS.DURATION_MINUTES_FACT AS MEETINGS.DURATION_MINUTES
      COMMENT = '商談時間（分）',

    -- CONTACTS
    CONTACTS.TOUCHPOINT_COUNT_FACT AS CONTACTS.TOUCHPOINT_COUNT
      COMMENT = 'その担当者との接触回数',
    CONTACTS.CONTACT_DAYS_SINCE_TOUCH_FACT AS CONTACTS.DAYS_SINCE_TOUCH
      COMMENT = 'その担当者との最終接触からの経過日数',
    CONTACTS.FACE_TO_FACE_COUNT_FACT AS CONTACTS.FACE_TO_FACE_COUNT
      COMMENT = '対面での接触回数',
    CONTACTS.POSITIVE_TOUCHES_FACT AS CONTACTS.POSITIVE_TOUCHES
      COMMENT = '好意的な反応だった接触回数',

    -- REPS
    REPS.WIN_RATE_FACT AS REPS.WIN_RATE
      COMMENT = '営業員の勝率（0-1）',
    REPS.AVG_DEAL_SIZE_FACT AS REPS.AVG_DEAL_SIZE
      COMMENT = '営業員の平均案件規模（円）'
  )

  DIMENSIONS (
    -- COMPANIES
    COMPANIES.COMPANY_ID AS COMPANIES.COMPANY_ID
      WITH SYNONYMS = ('企業ID', '会社ID')
      COMMENT = '顧客企業ID（C001〜C020）',
    COMPANIES.COMPANY_NAME AS COMPANIES.COMPANY_NAME
      WITH SYNONYMS = ('企業名', '会社名', '担当先企業名')
      COMMENT = '顧客企業名',
    COMPANIES.INDUSTRY AS COMPANIES.INDUSTRY_LARGE
      WITH SYNONYMS = ('業種', '産業', '業界')
      COMMENT = '業種（大分類）',
    COMPANIES.INDUSTRY_DETAIL AS COMPANIES.INDUSTRY_DETAIL
      WITH SYNONYMS = ('業種詳細', '細分類')
      COMMENT = '業種（詳細分類）',
    COMPANIES.PREFECTURE AS COMPANIES.PREFECTURE
      WITH SYNONYMS = ('都道府県', '所在地')
      COMMENT = '本社所在都道府県',
    COMPANIES.ATTACK_GRADE AS COMPANIES.ATTACK_GRADE
      WITH SYNONYMS = ('アタック優先度', 'アタックグレード', '優先度ランク')
      COMMENT = 'アタック優先度の等級。スコアに基づく S / A / B / C 等',
    COMPANIES.PROSPECT_RANK AS COMPANIES.PROSPECT_RANK
      WITH SYNONYMS = ('見込みランク', 'ランク')
      COMMENT = '見込みランク S / A / B / C',
    COMPANIES.PRIMARY_TRIGGER AS COMPANIES.PRIMARY_TRIGGER
      WITH SYNONYMS = ('主要トリガー', 'アタック理由', '攻める理由')
      COMMENT = 'その企業を今アタックすべき最大の理由',
    COMPANIES.TOP_SIGNAL_TYPE AS COMPANIES.TOP_SIGNAL_TYPE
      WITH SYNONYMS = ('求人シグナル種別', 'シグナル種別')
      COMMENT = '求人票から検知した最有力の保険ニーズシグナル種別',
    COMPANIES.TOP_SIGNAL_RATIONALE AS COMPANIES.TOP_SIGNAL_RATIONALE
      WITH SYNONYMS = ('シグナル根拠')
      COMMENT = '求人シグナルが保険ニーズに結びつく根拠',
    COMPANIES.PENSION_TYPE AS COMPANIES.PENSION_TYPE
      WITH SYNONYMS = ('年金制度', '退職給付制度')
      COMMENT = '企業年金制度の種別（DB / DC 等）',
    COMPANIES.HEALTH_CERT_STATUS AS COMPANIES.HEALTH_CERT_STATUS
      WITH SYNONYMS = ('健康経営認定', '健康経営ステータス')
      COMMENT = '健康経営優良法人の認定状況',
    COMPANIES.HAS_OVERSEAS_SUBSIDIARY AS COMPANIES.HAS_OVERSEAS_SUBSIDIARY
      WITH SYNONYMS = ('海外子会社有無', '海外拠点')
      COMMENT = '海外子会社を持つか。海外赴任者向け保険の提案余地に直結',
    COMPANIES.NEAREST_EXPIRY AS COMPANIES.NEAREST_EXPIRY
      WITH SYNONYMS = ('直近満期日', '次回満期')
      COMMENT = '最も近い契約満期日',
    COMPANIES.LAST_TOUCH_DATE AS COMPANIES.LAST_TOUCH_DATE
      WITH SYNONYMS = ('最終接触日')
      COMMENT = '最後に接触した日',

    -- MEETINGS
    MEETINGS.MEETING_ID AS MEETINGS.MEETING_ID
      WITH SYNONYMS = ('商談ID')
      COMMENT = '商談ID',
    MEETINGS.MEETING_DATE AS MEETINGS.MEETING_DATE
      WITH SYNONYMS = ('商談日', '面談日', '訪問日')
      COMMENT = '商談を実施した日',
    MEETINGS.MEETING_TYPE AS MEETINGS.MEETING_TYPE
      WITH SYNONYMS = ('商談形式', '面談形式')
      COMMENT = '商談の形式（訪問 / オンライン / 電話）',
    MEETINGS.AGENDA AS MEETINGS.AGENDA
      WITH SYNONYMS = ('議題', 'アジェンダ', 'テーマ')
      COMMENT = '商談の議題（保険見直し・GLTD導入・健康経営 等）',
    MEETINGS.OUTCOME AS MEETINGS.OUTCOME
      WITH SYNONYMS = ('商談結果', '結果', '成果')
      COMMENT = '商談の結果（成約 / ランクアップ / 継続検討 / 停滞）',
    MEETINGS.SENTIMENT AS MEETINGS.SENTIMENT
      WITH SYNONYMS = ('顧客の反応', '反応', '感情')
      COMMENT = '顧客の反応（好意的 / 中立 / 消極的）',
    MEETINGS.NEXT_ACTION_AGREED AS MEETINGS.NEXT_ACTION_AGREED
      WITH SYNONYMS = ('次回アクション合意', '次回合意')
      COMMENT = '次回アクションを顧客と合意できたか',
    MEETINGS.SUMMARY_TEXT AS MEETINGS.SUMMARY_TEXT
      WITH SYNONYMS = ('商談要約', '要約', 'サマリー')
      COMMENT = 'AI が生成した商談要約テキスト',
    MEETINGS.NEEDS_REVIEW AS IFF(MEETINGS.QUALITY_SCORE < 35 OR MEETINGS.NEXT_ACTION_AGREED = FALSE OR MEETINGS.MISSED_COUNT >= 4, '要振り返り', '対応不要')
      WITH SYNONYMS = ('振り返り要否', '要振り返り')
      COMMENT = '振り返りが必要な商談かの判定。品質スコア35未満、次回アクション未合意、未回収論点4件以上のいずれかで要振り返り',

    -- CONTACTS
    CONTACTS.CONTACT_NAME AS CONTACTS.CONTACT_NAME
      WITH SYNONYMS = ('担当者名', 'キーマン名')
      COMMENT = '顧客企業側の担当者名',
    CONTACTS.CONTACT_TITLE AS CONTACTS.TITLE
      WITH SYNONYMS = ('役職', '肩書')
      COMMENT = '担当者の役職',
    CONTACTS.CONTACT_DEPARTMENT AS CONTACTS.DEPARTMENT
      WITH SYNONYMS = ('部署', '所属')
      COMMENT = '担当者の所属部署',
    CONTACTS.CONTACT_ROLE AS CONTACTS.CONTACT_ROLE
      WITH SYNONYMS = ('意思決定役割', '役割')
      COMMENT = '意思決定上の役割（決裁者 / 影響者 / 実務担当 等）',
    CONTACTS.COVERAGE_STATUS AS CONTACTS.COVERAGE_STATUS
      WITH SYNONYMS = ('網羅状況', 'カバレッジ', '接触状況')
      COMMENT = 'その担当者を接触できているかの状況',

    -- REPS
    REPS.SALES_REP_ID AS REPS.SALES_REP_ID
      WITH SYNONYMS = ('営業員ID', '担当者ID')
      COMMENT = '営業担当者ID（SR001〜SR003）',
    REPS.SALES_REP_NAME AS REPS.FULL_NAME
      WITH SYNONYMS = ('営業員名', '担当営業名', '担当者名')
      COMMENT = '自社の営業担当者名',
    REPS.SKILL_TIER AS REPS.SKILL_TIER
      WITH SYNONYMS = ('スキル階層', 'スキルティア', '習熟度')
      COMMENT = '営業員のスキル階層（トップ / 中堅 / 若手）',
    REPS.BEHAVIOR_PROFILE AS REPS.BEHAVIOR_PROFILE
      WITH SYNONYMS = ('行動特性', '営業スタイル')
      COMMENT = '営業員の行動特性の記述',

    -- ACTIONS
    ACTIONS.ACTION_TITLE AS ACTIONS.ACTION_TITLE
      WITH SYNONYMS = ('アクション名', 'ToDo名')
      COMMENT = '次回アクションの表題',
    ACTIONS.ACTION_PRIORITY AS ACTIONS.PRIORITY
      WITH SYNONYMS = ('アクション優先度', '優先度')
      COMMENT = '次回アクションの優先度',
    ACTIONS.ACTION_STATUS AS ACTIONS.STATUS
      WITH SYNONYMS = ('アクション状態', 'ステータス', '進捗')
      COMMENT = '次回アクションの状態（未着手 / 進行中 / 完了 等）',
    ACTIONS.ACTION_DUE_DATE AS ACTIONS.DUE_DATE
      WITH SYNONYMS = ('期限', '期日')
      COMMENT = '次回アクションの期限'
  )

  METRICS (
    -- COMPANIES
    COMPANIES.COMPANY_COUNT AS COUNT(COMPANIES.COMPANY_ID)
      WITH SYNONYMS = ('企業数', '担当先数')
      COMMENT = '顧客企業の件数',
    COMPANIES.AVG_ATTACK_SCORE AS AVG(COMPANIES.ATTACK_SCORE)
      WITH SYNONYMS = ('平均アタックスコア', '平均優先度スコア')
      COMMENT = 'アタック優先度スコアの平均',
    COMPANIES.MAX_ATTACK_SCORE AS MAX(COMPANIES.ATTACK_SCORE)
      WITH SYNONYMS = ('最高アタックスコア')
      COMMENT = 'アタック優先度スコアの最大値',
    COMPANIES.TOTAL_PIPELINE_AMOUNT AS SUM(COMPANIES.PIPELINE_AMOUNT_FACT)
      WITH SYNONYMS = ('パイプライン金額合計', '見込み金額合計')
      COMMENT = '見込みパイプライン金額の合計（円）',
    COMPANIES.TOTAL_PREMIUM_SUM AS SUM(COMPANIES.TOTAL_PREMIUM_FACT)
      WITH SYNONYMS = ('既契約保険料合計', '保険料合計')
      COMMENT = '既契約の年間保険料合計（円）',
    COMPANIES.AVG_DAYS_SINCE_TOUCH AS AVG(COMPANIES.DAYS_SINCE_TOUCH_FACT)
      WITH SYNONYMS = ('平均未接触日数')
      COMMENT = '最終接触からの経過日数の平均',
    COMPANIES.TOTAL_RECENT_POSTINGS_90D AS SUM(COMPANIES.RECENT_POSTINGS_90D_FACT)
      WITH SYNONYMS = ('直近90日求人件数')
      COMMENT = '直近90日の求人掲載件数の合計',
    COMPANIES.TOTAL_EXPIRING_90D AS SUM(COMPANIES.EXPIRING_90D_FACT)
      WITH SYNONYMS = ('90日内満期件数')
      COMMENT = '90日以内に満期を迎える契約件数の合計',
    COMPANIES.TOTAL_EMPLOYEE_COUNT AS SUM(COMPANIES.EMPLOYEE_COUNT_FACT)
      WITH SYNONYMS = ('従業員数合計')
      COMMENT = '従業員数の合計',
    COMPANIES.TOTAL_ANNUAL_REVENUE AS SUM(COMPANIES.ANNUAL_REVENUE_FACT)
      WITH SYNONYMS = ('売上高合計')
      COMMENT = '年間売上高の合計（円）',
    COMPANIES.AVG_OP_MARGIN AS AVG(COMPANIES.OP_MARGIN_FACT)
      WITH SYNONYMS = ('平均営業利益率')
      COMMENT = '営業利益率の平均',
    COMPANIES.TOTAL_CONTRACT_COUNT AS SUM(COMPANIES.CONTRACT_COUNT_FACT)
      WITH SYNONYMS = ('既契約件数合計')
      COMMENT = '既契約件数の合計',

    -- MEETINGS
    MEETINGS.MEETING_COUNT AS COUNT(MEETINGS.MEETING_ID)
      WITH SYNONYMS = ('商談件数', '面談件数', '訪問件数')
      COMMENT = '商談の件数',
    MEETINGS.AVG_QUALITY_SCORE AS AVG(MEETINGS.QUALITY_SCORE_FACT)
      WITH SYNONYMS = ('平均商談品質', '平均品質スコア')
      COMMENT = '商談品質スコアの平均（0-100）',
    MEETINGS.MIN_QUALITY_SCORE AS MIN(MEETINGS.QUALITY_SCORE_FACT)
      WITH SYNONYMS = ('最低品質スコア')
      COMMENT = '商談品質スコアの最小値',
    MEETINGS.AVG_HEARING_QUESTIONS AS AVG(MEETINGS.HEARING_QUESTION_COUNT_FACT)
      WITH SYNONYMS = ('平均ヒアリング質問数')
      COMMENT = 'ヒアリング質問数の平均。トップ営業との差が出やすい指標',
    MEETINGS.AVG_DEEP_NEEDS AS AVG(MEETINGS.DEEP_NEED_COUNT_FACT)
      WITH SYNONYMS = ('平均深層ニーズ数')
      COMMENT = '抽出できた深層ニーズ数の平均',
    MEETINGS.TOTAL_MISSED AS SUM(MEETINGS.MISSED_COUNT_FACT)
      WITH SYNONYMS = ('未回収論点合計', '拾えなかった論点数')
      COMMENT = '拾えなかった論点の合計',
    MEETINGS.AVG_MISSED AS AVG(MEETINGS.MISSED_COUNT_FACT)
      WITH SYNONYMS = ('平均未回収論点数')
      COMMENT = '拾えなかった論点数の平均',
    MEETINGS.WON_MEETING_COUNT AS SUM(IFF(MEETINGS.OUTCOME = '成約', 1, 0))
      WITH SYNONYMS = ('成約件数')
      COMMENT = '結果が成約だった商談の件数',
    MEETINGS.STALLED_MEETING_COUNT AS SUM(IFF(MEETINGS.OUTCOME = '停滞', 1, 0))
      WITH SYNONYMS = ('停滞件数')
      COMMENT = '結果が停滞だった商談の件数',
    MEETINGS.NEXT_ACTION_AGREED_RATE AS AVG(IFF(MEETINGS.NEXT_ACTION_AGREED, 1, 0))
      WITH SYNONYMS = ('次回アクション合意率')
      COMMENT = '次回アクションを合意できた商談の割合（0-1）',
    MEETINGS.TOTAL_COMPLIANCE_ISSUES AS SUM(MEETINGS.COMPLIANCE_ISSUE_COUNT_FACT)
      WITH SYNONYMS = ('コンプライアンス指摘件数')
      COMMENT = 'コンプライアンス指摘の合計件数',
    MEETINGS.TOTAL_OBJECTIONS AS SUM(MEETINGS.OBJECTION_COUNT_FACT)
      WITH SYNONYMS = ('反論件数合計')
      COMMENT = '顧客から出た反論の合計件数',
    MEETINGS.OBJECTION_HANDLED_RATE AS DIV0(SUM(MEETINGS.OBJECTIONS_HANDLED_FACT), SUM(MEETINGS.OBJECTION_COUNT_FACT))
      WITH SYNONYMS = ('反論対応率')
      COMMENT = '出た反論のうち対応できた割合（0-1）。分母0のときは0を返す',
    MEETINGS.AVG_DURATION_MINUTES AS AVG(MEETINGS.DURATION_MINUTES_FACT)
      WITH SYNONYMS = ('平均商談時間')
      COMMENT = '商談時間の平均（分）',
    MEETINGS.AVG_TURN_COUNT AS AVG(MEETINGS.TURN_COUNT_FACT)
      WITH SYNONYMS = ('平均発言ターン数')
      COMMENT = '商談中の発言ターン数の平均',

    -- CONTACTS
    CONTACTS.CONTACT_COUNT AS COUNT(CONTACTS.CONTACT_ID)
      WITH SYNONYMS = ('担当者数', 'キーマン数', '接点人数')
      COMMENT = '顧客企業側の担当者の人数',
    CONTACTS.TOTAL_TOUCHPOINTS AS SUM(CONTACTS.TOUCHPOINT_COUNT_FACT)
      WITH SYNONYMS = ('接触回数合計')
      COMMENT = '接触回数の合計',
    CONTACTS.AVG_CONTACT_DAYS_SINCE_TOUCH AS AVG(CONTACTS.CONTACT_DAYS_SINCE_TOUCH_FACT)
      WITH SYNONYMS = ('担当者別平均未接触日数')
      COMMENT = '担当者ごとの最終接触からの経過日数の平均',
    CONTACTS.TOTAL_FACE_TO_FACE AS SUM(CONTACTS.FACE_TO_FACE_COUNT_FACT)
      WITH SYNONYMS = ('対面接触回数合計')
      COMMENT = '対面接触回数の合計',

    -- REPS
    REPS.REP_COUNT AS COUNT(REPS.SALES_REP_ID)
      WITH SYNONYMS = ('営業員数')
      COMMENT = '営業担当者の人数',
    REPS.AVG_WIN_RATE AS AVG(REPS.WIN_RATE_FACT)
      WITH SYNONYMS = ('平均勝率')
      COMMENT = '営業員の勝率の平均（0-1）',
    REPS.AVG_DEAL_SIZE_METRIC AS AVG(REPS.AVG_DEAL_SIZE_FACT)
      WITH SYNONYMS = ('平均案件規模')
      COMMENT = '営業員の平均案件規模の平均（円）',

    -- ACTIONS
    ACTIONS.ACTION_COUNT AS COUNT(ACTIONS.ACTION_ID)
      WITH SYNONYMS = ('アクション件数', 'ToDo件数')
      COMMENT = '次回アクションの件数',
    ACTIONS.OPEN_ACTION_COUNT AS SUM(IFF(ACTIONS.STATUS <> '完了', 1, 0))
      WITH SYNONYMS = ('未完了アクション件数')
      COMMENT = '未完了の次回アクション件数',
    ACTIONS.OVERDUE_ACTION_COUNT AS SUM(IFF(ACTIONS.STATUS <> '完了' AND ACTIONS.DUE_DATE < CURRENT_DATE(), 1, 0))
      WITH SYNONYMS = ('期限超過アクション件数')
      COMMENT = '期限を過ぎているのに未完了の次回アクション件数'
  )

  COMMENT = 'スノー生命 法人営業フロー分析用セマンティックビュー。①お客様選定（アタックリストスコア・採用シグナル）→②③事前準備（キーマン網羅・契約ギャップ）→④商談→⑤振り返り（商談品質・未回収論点）までを横断分析する。既存 SV_SALES_ANALYTICS の後継として法人営業支援AIアプリと同じ指標定義を持つ'

  /*
    検証済みクエリ（VQR）。営業フロー各フェーズの代表質問を登録し、
    Cortex Analyst の SQL 生成精度と回答の一貫性を上げる。
    SQL は論理テーブル名で記述する（物理列も参照可能）。
  */
  AI_VERIFIED_QUERIES (
    attack_top_companies AS (
      QUESTION 'アタック優先度が高い企業トップ10とその主要トリガーを教えて'
      VERIFIED_AT 1785715200
      ONBOARDING_QUESTION TRUE
      VERIFIED_BY '(STEWARD = kosuke.motokubota)'
      SQL 'SELECT
             c.company_name,
             c.attack_grade,
             c.primary_trigger,
             MAX(c.total_score) AS attack_score
           FROM companies AS c
           GROUP BY c.company_name, c.attack_grade, c.primary_trigger
           ORDER BY attack_score DESC NULLS LAST
           LIMIT 10'
    ),
    rep_meeting_quality AS (
      QUESTION '営業員別の平均商談品質スコアと商談件数を教えて'
      VERIFIED_AT 1785715200
      ONBOARDING_QUESTION TRUE
      VERIFIED_BY '(STEWARD = kosuke.motokubota)'
      SQL 'SELECT
             m.sales_rep_name,
             m.skill_tier,
             COUNT(m.meeting_id) AS meeting_count,
             AVG(m.quality_score) AS avg_quality_score,
             AVG(m.hearing_question_count) AS avg_hearing_questions
           FROM meetings AS m
           GROUP BY m.sales_rep_name, m.skill_tier
           ORDER BY avg_quality_score DESC NULLS LAST'
    ),
    meetings_needing_review AS (
      QUESTION '振り返りが必要な商談は営業員別に何件ある？'
      VERIFIED_AT 1785715200
      ONBOARDING_QUESTION TRUE
      VERIFIED_BY '(STEWARD = kosuke.motokubota)'
      SQL 'SELECT
             m.sales_rep_name,
             COUNT(m.meeting_id) AS needs_review_count
           FROM meetings AS m
           WHERE m.quality_score < 35
           GROUP BY m.sales_rep_name
           ORDER BY needs_review_count DESC NULLS LAST'
    ),
    uncovered_key_persons AS (
      QUESTION 'キーマンに90日以上接触できていない企業と担当者を教えて'
      VERIFIED_AT 1785715200
      ONBOARDING_QUESTION TRUE
      VERIFIED_BY '(STEWARD = kosuke.motokubota)'
      SQL 'SELECT
             k.company_name,
             k.contact_name,
             k.title,
             k.contact_role,
             k.days_since_touch
           FROM contacts AS k
           WHERE k.days_since_touch >= 90
           ORDER BY k.days_since_touch DESC NULLS LAST'
    ),
    expiring_contracts AS (
      QUESTION '90日以内に満期を迎える契約がある企業を教えて'
      VERIFIED_AT 1785715200
      ONBOARDING_QUESTION TRUE
      VERIFIED_BY '(STEWARD = kosuke.motokubota)'
      SQL 'SELECT
             c.company_name,
             c.nearest_expiry,
             c.expiring_90d,
             c.total_premium
           FROM companies AS c
           WHERE c.expiring_90d > 0
           ORDER BY c.nearest_expiry ASC NULLS LAST'
    )
  )

  COPY GRANTS
;
