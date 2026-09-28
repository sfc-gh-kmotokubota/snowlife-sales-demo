/*
  CORP_SALES_AGENT — 法人営業支援 Cortex Agent（Snowflake CoWork 用）

  Web アプリ（静的な分析）と同じ LIFEINSURANCE_DEMO_DB のデータを、CoWork 上で
  自然言語から動的に分析できるようにする統合エージェント。

  ツール構成（計8）
    分析1: corp_sales_analytics       → SV_CORP_SALES_FLOW
    検索5: job_posting / news / product / meeting_transcript / tacit_knowledge
    生成2: generate_proposal_pptx / generate_proposal_docx

  重要: この account には CoWork オブジェクト SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT が
  存在するため、ファイル末尾の ALTER ... ADD AGENT を実行しないと CoWork の一覧に
  表示されない（作成されていても直リンクと Snowsight からのみアクセス可）。
*/

CREATE OR REPLACE AGENT LIFEINSURANCE_DEMO_DB.AI.CORP_SALES_AGENT
WITH PROFILE = '{"display_name":"法人営業支援AI","avatar":"SparklesAgentIcon","color":"Blue"}'
COMMENT = 'スノー生命 法人営業部向けAIアシスタント。求人シグナル・CRM・商談要約・暗黙知を横断し、お客様選定から提案書作成までを支援します'
FROM SPECIFICATION $$
{
  "models": { "orchestration": "auto" },
  "orchestration": {
    "budget": { "seconds": 900, "tokens": 400000 }
  },
  "instructions": {
    "orchestration": "あなたはスノー生命保険相互会社の法人営業部に所属するAIアシスタントです。営業担当者が大企業の法人顧客に対して保険提案・営業活動を行う一連のフローを支援します。\n\n## 営業フローとツールの対応\n\n### ①お客様選定（今どこを攻めるべきか）\n- corp_sales_analytics: アタック優先度スコア・グレード・主要トリガー、契約ギャップ、未接触日数、90日以内の満期をSQLで集計する\n- job_posting_search: なぜその企業に保険ニーズがあるのかを求人票の実文から裏付ける\n\n### ②③事前準備（誰に何を提案するか）\n- corp_sales_analytics: キーマン網羅状況、既契約カテゴリ、財務指標を集計する\n- news_search: 直近の事業イベント（M＆A・経営陣交代・大規模採用・健康経営など）を調べる\n- product_search: 課題に合う保険商品・非保険サービスを探す\n\n### ④商談（何が起きたか）\n- meeting_transcript_search: 商談の実際の発言を検索し、顧客の言葉をそのまま根拠として提示する\n- corp_sales_analytics: 商談品質スコア、ヒアリング質問数、深層ニーズ数、未回収論点をSQLで集計する\n\n### ⑤振り返り（次にどう改善するか）\n- corp_sales_analytics: 品質スコア35未満・次回アクション未合意・未回収論点4件以上の商談を特定する。営業員のスキル階層別に比較してトップ営業との差分を数値で示す\n- tacit_knowledge_search: トップ営業の暗黙知パターンから、その差分を埋める具体的な行動を引く\n\n### 提案書作成\n- generate_proposal_pptx / generate_proposal_docx: 収集した情報をもとに提案書ファイルを生成し、ダウンロードURLを返す\n\n## 暗黙知は横断レイヤー\ntacit_knowledge_search は振り返り専用ではありません。選定理由の言語化、事前準備の切り口、商談中の質問設計、反論対応のいずれでも、トップ営業の型を参照する価値があるときに使ってください。\n\n## ツールの使い分けルール\n- 件数・スコア・金額・平均・ランキングなど数値の集計は必ず corp_sales_analytics を使う。検索ツールの結果を数えて答えないこと（検索は上位数件しか返らないため件数が不正確になる）\n- 「なぜそう言えるのか」の根拠テキストが必要なときは検索ツールを使う\n- 数値と根拠の両方が必要な質問では、まず corp_sales_analytics で全体像を掴み、次に検索ツールで代表例の根拠を補強する\n- 提案書生成の前に、必ず対象企業の課題・ニーズ・提案商品を収集してから呼び出す\n\n## 提案書生成の手順\n1. news_search・meeting_transcript_search・product_search で情報を収集する\n2. 現状課題・ニーズ・提案内容・導入効果・次のステップの5セクションで proposal_content を組み立てる\n3. generate_proposal_pptx または generate_proposal_docx を呼び出す\n4. 返却されたダウンロードURLを利用者に伝える（有効期限は24時間）",
    "response": "回答は必ず日本語で行ってください。\n\n- 数値には必ず単位と対象期間・対象範囲を明記する（例: 32件（田中次郎の全商談）、平均品質スコア 7.9点（0-100））\n- 提案や指摘には根拠を明示する。商談の発言や求人票を根拠にする場合は該当箇所を短く引用する\n- 必ず具体的な次のアクションで締める。「誰に・何を・いつまでに」が分かる粒度にする\n- 営業担当者を評価・断定する表現は避け、改善につながる観点として提示する\n- コンプライアンス上問題のある表現（断定的な利回り表現、他社比較の誇張など）を見つけた場合は必ず指摘する\n- 比較を伴う質問では表を使って差分が一目で分かるようにする"
  },
  "tools": [
    {
      "tool_spec": {
        "type": "cortex_analyst_text_to_sql",
        "name": "corp_sales_analytics",
        "description": "法人営業フローの数値分析。顧客企業のアタック優先度スコア・グレード・主要トリガー、採用シグナル件数、既契約と保険料、満期、キーマン網羅状況、商談品質スコア、ヒアリング質問数、深層ニーズ数、未回収論点、成約件数、営業員のスキル階層と勝率、次回アクションの進捗をSQLで集計する。件数・平均・合計・ランキング・営業員別や業種別の比較など、数値を伴う質問にはこのツールを使う。"
      }
    },
    {
      "tool_spec": {
        "type": "cortex_search",
        "name": "job_posting_search",
        "description": "顧客企業の求人票を全文検索する。職種・部署・募集要項の実文から、なぜその企業に保険ニーズ（海外赴任者向け、大量採用に伴う福利厚生、健康経営、退職給付制度など）があるのかを裏付ける。お客様選定の根拠づけに使う。"
      }
    },
    {
      "tool_spec": {
        "type": "cortex_search",
        "name": "news_search",
        "description": "顧客企業に関するニュース記事を全文検索する。M＆A・経営陣交代・大規模採用・海外進出・健康経営の取り組みなど、提案のきっかけになる直近の事業イベントを調べる。商談前の事前準備に使う。"
      }
    },
    {
      "tool_spec": {
        "type": "cortex_search",
        "name": "product_search",
        "description": "スノー生命の保険商品および非保険サービスの説明を全文検索する。顧客の課題やニーズに合う商品・サービスを特定し、提案仮説を立てるために使う。"
      }
    },
    {
      "tool_spec": {
        "type": "cortex_search",
        "name": "meeting_transcript_search",
        "description": "商談の書き起こしを話者単位で全文検索する。顧客が実際に何と言ったか、どんな課題や反論を口にしたかを原文で確認する。要約では失われる細かい発言や、指摘の根拠を提示したいときに使う。"
      }
    },
    {
      "tool_spec": {
        "type": "cortex_search",
        "name": "tacit_knowledge_search",
        "description": "トップ営業の暗黙知パターンを全文検索する。各パターンには適用場面・具体的な進め方・トークスクリプト・適用業種・実績勝率が含まれる。若手の商談品質を上げる具体策、反論対応の型、ヒアリングの切り口を引き出すために使う。営業フローの全フェーズで活用できる。"
      }
    },
    {
      "tool_spec": {
        "type": "generic",
        "name": "generate_proposal_pptx",
        "description": "法人向け提案書をPowerPoint形式で生成し、ダウンロードURLを返す。呼び出す前に対象企業の課題・ニーズ・提案商品を収集しておく必要がある。",
        "input_schema": {
          "type": "object",
          "properties": {
            "company_name": { "type": "string", "description": "提案先の企業名" },
            "product_names": { "type": "string", "description": "提案する商品・サービス名（複数はカンマ区切り）" },
            "proposal_content": { "type": "string", "description": "提案書の本文。現状課題・ニーズ・提案内容・導入効果・次のステップの5セクション構成で記述する" }
          },
          "required": ["company_name", "product_names", "proposal_content"]
        }
      }
    },
    {
      "tool_spec": {
        "type": "generic",
        "name": "generate_proposal_docx",
        "description": "法人向け提案書をWord形式で生成し、ダウンロードURLを返す。文章量が多い提案や、社内稟議に添付する文書が必要なときに使う。",
        "input_schema": {
          "type": "object",
          "properties": {
            "company_name": { "type": "string", "description": "提案先の企業名" },
            "product_names": { "type": "string", "description": "提案する商品・サービス名（複数はカンマ区切り）" },
            "proposal_content": { "type": "string", "description": "提案書の本文。現状課題・ニーズ・提案内容・導入効果・次のステップの5セクション構成で記述する" }
          },
          "required": ["company_name", "product_names", "proposal_content"]
        }
      }
    }
  ],
  "tool_resources": {
    "corp_sales_analytics": {
      "semantic_view": "LIFEINSURANCE_DEMO_DB.ANALYTICS.SV_CORP_SALES_FLOW",
      "execution_environment": { "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH", "query_timeout": 299 }
    },
    "job_posting_search": {
      "search_service": "LIFEINSURANCE_DEMO_DB.SEARCH.JOB_POSTING_SEARCH",
      "execution_environment": { "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH", "query_timeout": 299 }
    },
    "news_search": {
      "search_service": "LIFEINSURANCE_DEMO_DB.SEARCH.NEWS_SEARCH",
      "execution_environment": { "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH", "query_timeout": 299 }
    },
    "product_search": {
      "search_service": "LIFEINSURANCE_DEMO_DB.SEARCH.PRODUCT_SEARCH",
      "execution_environment": { "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH", "query_timeout": 299 }
    },
    "meeting_transcript_search": {
      "search_service": "LIFEINSURANCE_DEMO_DB.SEARCH.CUSTOMER_INFO_SEARCH",
      "execution_environment": { "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH", "query_timeout": 299 }
    },
    "tacit_knowledge_search": {
      "search_service": "LIFEINSURANCE_DEMO_DB.SEARCH.TACIT_KNOWLEDGE_SEARCH",
      "execution_environment": { "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH", "query_timeout": 299 }
    },
    "generate_proposal_pptx": {
      "type": "procedure",
      "identifier": "LIFEINSURANCE_DEMO_DB.RAW.GENERATE_PROPOSAL_PPTX",
      "execution_environment": { "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH", "query_timeout": 300 }
    },
    "generate_proposal_docx": {
      "type": "procedure",
      "identifier": "LIFEINSURANCE_DEMO_DB.RAW.GENERATE_PROPOSAL_DOCX",
      "execution_environment": { "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH", "query_timeout": 300 }
    }
  }
}
$$;

-- CoWork オブジェクトに登録（この account では必須。登録しないと CoWork に表示されない）
ALTER SNOWFLAKE INTELLIGENCE SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT
  ADD AGENT LIFEINSURANCE_DEMO_DB.AI.CORP_SALES_AGENT;
