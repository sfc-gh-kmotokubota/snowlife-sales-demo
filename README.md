# 生命保険会社 法人営業AIアシスタント
## Snowflake Intelligence + Streamlit で実現する営業DX

[![Snowflake](https://img.shields.io/badge/Snowflake-29B5E8?logo=snowflake&logoColor=white)](https://snowflake.com)
[![Streamlit](https://img.shields.io/badge/Streamlit-FF4B4B?logo=streamlit&logoColor=white)](https://streamlit.io)

架空の生命保険会社「スノー生命」の法人営業部向けAIアシスタントデモ。  
Snowflake Intelligence（Cortex Agent）と Streamlit on Snowflake を組み合わせ、**商談前 → 商談中 → 商談後** の営業活動を全面サポートします。

---

## Snowflake Intelligence の使い方 — 商談フェーズ別プロンプト例

Snowflake Intelligence（Cortex Agent）に自然言語で話しかけるだけで、社内データとAIが連動します。以下のプロンプトをそのままコピーして使えます。

---

### 商談前 — 訪問準備・アラート確認

**目的**: 訪問先企業の最新動向を把握し、最適な提案ネタを事前に用意する

**プロンプト例 1 — 事業イベントの確認**
```
伊藤忠商事に関する最新ニュースと、提案すべき保険商品を教えて
```
> 使用ツール: `news_search` + `product_search`  
> 出力: 直近のM&A・経営陣交代・採用動向 + 適合商品レコメンド

**プロンプト例 2 — 過去面談の振り返り**
```
パナソニックとの過去面談でDCや福利厚生について何を話したか教えて
```
> 使用ツール: `customer_search`  
> 出力: 過去面談の要約・先方担当者の課題発言・合意事項の抽出

**プロンプト例 3 — AIスコアと見込みランク確認**
```
今週訪問予定のAランク企業を見込み金額が高い順に教えて
```
> 使用ツール: `sales_analytics`（Semantic View経由）  
> 出力: 企業名・見込み金額・AIスコア・優先アクションの一覧

**プロンプト例 4 — 決算内容のパワポ作成**
```
ソフトバンクGのIR資料を中心に、決算を分かりやすく、利益の要因分析と社長同士の話材を含めてパワポ3枚にまとめて
```
> 使用スキル: `earnings_analysis` + ツール: `generate_earnings_pptx`  
> 出力: 決算サマリー・要因分析・訪問時話材の3枚スライド（PPTX downloadリンク）

---

### 商談中 — その場での即答・提案

**目的**: 顧客の質問にリアルタイムで回答し、その場で提案の説得力を高める

**プロンプト例 5 — 商品詳細の即答**
```
GLTDとは何か、導入メリットと他の就業不能保険との違いを教えて
```
> 使用ツール: `product_search`  
> 出力: 商品概要・保障内容・導入事例・競合比較

**プロンプト例 6 — 競合質問への対応**
```
「他社の団体保険より高い」と言われた。スノー生命の差別化ポイントを教えて
```
> 使用スキル: `compliance_guidelines` + ツール: `product_search`  
> 出力: 保険業法に沿った適切な表現での差別化説明（断定表現の検知・修正付き）

**プロンプト例 7 — その場でのKPI確認**
```
従業員数5,000名以上でAランクの見込み件数と合計金額は？業種別の内訳も
```
> 使用ツール: `sales_analytics`  
> 出力: SQLで集計したKPI数値・グラフ

---

### 商談後 — 提案書作成・フォローアップ

**目的**: 面談内容をもとに提案書を自動生成し、次アクションを整理する

**プロンプト例 8 — 提案書（PPTX）の自動生成**
```
KDDI向けに、先ほどの面談内容と健康経営強化のニュースをもとに、GLTDとWellness-Starを中心とした提案書をPowerPointで作って
```
> 使用ツール: `news_search` + `customer_search` + `product_search` + `generate_proposal_pptx`  
> 出力: 5セクション構成の提案書PPTX（ダウンロードURLをチャットに返却）

**プロンプト例 9 — 提案書（Word）の自動生成**
```
同じ内容でWord版も作って
```
> 使用ツール: `generate_proposal_docx`  
> 出力: Word形式の提案書（ダウンロードURLをチャットに返却）

**プロンプト例 10 — コンプライアンスチェック**
```
この提案書の文言に問題がないか確認して：「この保険に加入すれば確実に税負担が軽減されます」
```
> 使用スキル: `compliance_guidelines`  
> 出力: 違反表現の検出・該当法令の説明・適切な言い換え例

**プロンプト例 11 — 今週の対応優先度整理**
```
今週中に対応すべき未読アラートのある企業をリストアップして、優先度と推奨アクションも教えて
```
> 使用ツール: `news_search` + `sales_analytics`  
> 出力: 企業別の緊急度・イベント内容・推奨アクション一覧

---

## Snowflake Intelligence が実現する価値

| 従来の作業 | Snowflake Intelligence 活用後 |
|---|---|
| 複数システムを開いて情報収集（30分〜） | 自然言語1文で即時取得（数秒） |
| 面談前に過去議事録を手動検索 | 「○○社の面談内容を教えて」で要約取得 |
| IR資料を読んで手動でパワポ作成（数時間） | プロンプト1文で3枚スライド自動生成 |
| 提案書の文言チェックを法務に依頼 | コンプライアンススキルで即時チェック |
| Excelでパイプライン集計 | 「Aランク合計は？」で即座に回答 |

---

## アプリ構成（Streamlit 7画面）

| # | ファイル | 画面 | 主な機能 |
|---|---------|------|---------|
| – | `main.py` | ホーム | KPI ダッシュボード・各機能への導線 |
| 1 | `01_alert.py` | 事業イベントアラート | M&A・IPO・経営陣交代等をAIが自動検知。pydeck地図で可視化 |
| 2 | `02_prepare.py` | 面談前準備 | 企業ブリーフィング1クリック生成・想定Q&A自動作成 |
| 3 | `03_meeting.py` | 面談録音・要約 | 音声/会話ログ対応・AI要約・コンプライアンス検知 |
| 4 | `04_prospect.py` | 見込み管理 | カンバンボード・昇格チェックリスト・1クリック昇格 |
| 5 | `05_matching.py` | 商品マッチング | 4軸説明可能AIスコアリング + AI深掘り分析 |
| 6 | `06_proposal.py` | DP自動生成 | ディスカッションペーパー・PPTX/Word対応 |
| 7 | `07_market.py` | マーケット・インサイト | 金利・株価データで提案タイミングを分析 |

---

## Snowflake Intelligence（Cortex Agent）

**エージェント**: `LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SALES_AGENT`

| ツール/スキル | タイプ | 用途 |
|-------|--------|------|
| `customer_search` | Cortex Search | 顧客・面談記録の全文検索 |
| `news_search` | Cortex Search | 企業ニュース・事業イベント検索 |
| `product_search` | Cortex Search | 保険商品・非保険サービス検索 |
| `sales_analytics` | Cortex Analyst | KPI・見込み・アラートのSQL分析 |
| `generate_proposal_pptx` | Generic (SP) | PowerPoint 提案書生成 → presigned URL |
| `generate_proposal_docx` | Generic (SP) | Word 提案書生成 → presigned URL |
| `generate_earnings_pptx` | Generic (SP) | 決算サマリー3枚スライド生成 → presigned URL |
| `proposal_generation` | Skill | 提案書5セクション構成のガイド |
| `compliance_guidelines` | Skill | 保険業法コンプライアンスチェック |
| `earnings_analysis` | Skill | 決算データ収集・JSON構造化 |

---

## セットアップ手順（ワンクリック）

### 前提条件

- Snowflake アカウント（ACCOUNTADMIN ロール）
- Snowsight または Snowflake CLI

### デプロイ（Snowsightで1ステップ）

1. `setup.sql` の内容をコピー
2. Snowsight の SQL ワークシートに貼り付けて実行

これで以下が全て自動で実行されます：
1. DB / WH / スキーマ / ロール作成
2. 16 テーブル DDL 作成
3. マスターデータ投入（20社・14商品・5サービス）
4. ダミーデータ生成（ニュース400件・面談160件・見込み50件 等）
5. 分析ビュー 3 件作成
6. Cortex Search サービス 3 件作成
7. Semantic View 作成
8. Streamlit アプリ（7ページ）デプロイ
9. Cortex Agent（7ツール + 3スキル）作成
10. PPTX/Word/決算サマリー 生成ストアドプロシージャ作成

---

## データ構成

| テーブル | 件数 | 内容 |
|---------|------|------|
| `T_CUSTOMER_COMPANIES` | 20社 | 従業員2,000名以上の実在大企業 |
| `T_INSURANCE_PRODUCTS` | 14商品 | スノー生命の保険商品 |
| `T_SNOWLIFE_SERVICES` | 5サービス | 非保険サービス（ヘルスケア・ビジネスマッチング等） |
| `T_COMPANY_NEWS` | 401件 | 事業イベント分類・保険適合度付き |
| `T_EVENT_ALERTS` | 34件 | 未読アラート（M&A・IPO・経営陣交代等） |
| `T_MEETINGS` | 223件 | 面談記録＋文字起こし |
| `T_FINANCIAL_DATA` | 200件 | 20社×5年分の財務データ |
| `T_PROSPECTS` | 54件 | 見込み管理（AIスコア・ランク付き） |
| `T_COMPANY_LOCATIONS` | 20件 | 本社座標（pydeck地図用） |

---

## リポジトリ構造

```
lifeinsurance-sales-demo/
├── README.md
├── setup.sql              # ワンクリックデプロイSQL（全セクション統合）
├── sql/
│   └── generate_earnings_pptx.sql  # 決算サマリーPPTX生成SP
├── streamlit/
│   ├── snowflake.yml
│   ├── environment.yml
│   ├── main.py
│   └── pages/
│       ├── 01_alert.py       # 事業イベントアラート
│       ├── 02_prepare.py     # 面談前準備
│       ├── 03_meeting.py     # 面談録音・要約
│       ├── 04_prospect.py    # 見込み管理
│       ├── 05_matching.py    # 商品マッチング
│       ├── 06_proposal.py    # DP自動生成
│       └── 07_market.py      # マーケット・インサイト
└── si_agent/
    ├── agent_spec.json             # Cortex Agent 設定
    ├── demo_scenarios.md           # デモシナリオ集
    ├── skill_proposal_generation.md
    ├── skill_compliance_guidelines.md
    └── skill_earnings_analysis.md
```

---

## Snowflake オブジェクト一覧

| オブジェクト | 場所 | 説明 |
|-------------|------|------|
| `LIFEINSURANCE_DEMO_WH` | – | デモ用ウェアハウス（Medium） |
| `LIFEINSURANCE_DEMO_DB.RAW` | スキーマ | テーブル・Streamlit |
| `LIFEINSURANCE_DEMO_DB.ANALYTICS` | スキーマ | ビュー・Semantic View |
| `LIFEINSURANCE_DEMO_DB.SEARCH` | スキーマ | Cortex Search |
| `CUSTOMER_INFO_SEARCH` | SEARCH | 面談記録の全文検索 |
| `NEWS_SEARCH` | SEARCH | 企業ニュースの全文検索 |
| `PRODUCT_SEARCH` | SEARCH | 保険商品・サービスの全文検索 |
| `SV_SALES_ANALYTICS` | ANALYTICS | Cortex Analyst 用 Semantic View |
| `LIFEINSURANCE_SALES_AGENT` | RAW | Cortex Agent（7ツール + 3スキル） |
| `LIFEINSURANCE_SALES_DEMO` | RAW | Streamlit on Snowflake |

---

*作成: Snowflake SE チーム | 最終更新: 2026年6月*
