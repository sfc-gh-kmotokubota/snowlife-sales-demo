# 法人営業支援AI（スノー生命 法人営業部）

生命保険会社の法人営業部向けの営業支援アプリです。**お客様選定 → 事前準備 → 商談 → 振り返り → 再訪問**という営業業務フローに沿って、求人データ・顧客情報・CRMデータ（商談書き起こし、名刺接点、商談履歴）を統合し、Snowflake Cortex による生成AIで各工程を支援します。

Snowflake App Runtime（Next.js on Snowpark Container Services）で動作し、すべてのデータ処理とAI推論が Snowflake アカウント内で完結します。

> 本アプリはデモ用です。保険会社「スノー生命」は架空であり、顧客企業の財務・求人・商談データはすべてデモ用に生成された架空データです。

---

## 主な機能

| 業務フロー | 画面 | 機能 |
|---|---|---|
| ① お客様選定 | `/attack-list` | 7要素の複合スコアでアタックリストを抽出。条件フィルタと AI による推奨理由・初回トーク生成 |
| ② 事前準備 | `/customers`, `/customers/[id]` | 顧客情報の網羅的表示（基本情報・財務推移・求人動向・契約ポートフォリオ・キーマンマップ・ニュース・商談履歴の7タブ） |
| ③ 商談 | `/meetings`, `/meetings/[id]` | 商談一覧と書き起こし・AI要約・抽出ニーズ・ネクストアクションの表示 |
| ④ 振り返り | `/meetings/[id]` | トップ営業との実績比較と、暗黙知に基づく差分分析・課題ニーズの精緻化 |
| ⑤ 再訪問 | `/proposals/[companyId]` | 提案ストーリー（課題仮説・ヒアリング設計・想定反論）と提案書ドラフトの生成 |
| 横断レイヤー | `/knowledge` | 暗黙知ライブラリ。トップ営業の成約商談から抽出した行動パターンを引用根拠付きで提供 |

営業員切替UIによりデータのスコープを担当者単位に絞り込めます（Owner's Rights + `?rep=` パラメータ）。

---

## アーキテクチャ

```
求人データ ─┐
顧客情報   ─┼─→ ANALYTICS ビュー ─→ アタックリスト / 顧客360°
CRMデータ  ─┘        │
                     └─→ 暗黙知抽出（Cortex COMPLETE）─→ 提案ストーリー / 提案書 / 振り返り
```

### 参照する Snowflake オブジェクト

すべて `LIFEINSURANCE_DEMO_DB` 配下です。

**RAW スキーマ（原データ）**

| テーブル | 内容 |
|---|---|
| `T_CUSTOMER_COMPANIES` | 顧客企業20社の属性（従業員数、年金制度、健康経営認定など） |
| `T_JOB_POSTINGS` | 求人データ516件。保険ニーズシグナル7種に変換済み |
| `T_CONTACTS` / `T_CONTACT_TOUCHPOINTS` | キーマン情報と名刺接点履歴（SanSan相当） |
| `T_MEETINGS` / `T_MEETING_TRANSCRIPTS` / `T_MEETING_SUMMARIES` | 商談160件・書き起こし3,117発言・AI要約 |
| `T_CONTRACTS` / `T_INSURANCE_PRODUCTS` | 契約と商品マスタ |
| `T_SALES_REPS` / `T_SALES_REP_SKILLS` | 営業員とスキル階層（トップ／中堅／若手） |
| `T_FINANCIAL_DATA` / `T_COMPANY_NEWS` / `T_EVENT_ALERTS` / `T_PROSPECTS` / `T_NEXT_ACTIONS` | 財務・ニュース・イベント・見込み・アクション |

**ANALYTICS スキーマ（分析ビュー）**

| ビュー | 用途 |
|---|---|
| `V_ATTACK_LIST_SCORES` | 7要素の重み付けスコア算出エンジン |
| `V_ATTACK_LIST` | 上記にトリガー判定と優先度グレードを付与（アプリはこちらを参照） |
| `V_CUSTOMER_360` | 顧客1社1行の統合ビュー |
| `V_MEETING_QUALITY` | 商談品質スコア（0-100） |
| `V_KEY_PERSON_COVERAGE` | キーマンごとの接点カバレッジ |
| `V_HIRING_SIGNAL` | 求人シグナルの月次・種別集計 |

**AI スキーマ（生成物）**

`T_TACIT_KNOWLEDGE`（暗黙知30パターン）、`T_PROPOSAL_STORIES`、`T_PROPOSALS`、`T_ATTACK_LIST_RUNS`

**SEARCH スキーマ（Cortex Search）**

`TACIT_KNOWLEDGE_SEARCH`、`JOB_POSTING_SEARCH`、`CUSTOMER_INFO_SEARCH`、`NEWS_SEARCH`、`PRODUCT_SEARCH`

### アタックリストのスコア設計

7要素を重み付けして合算します（重みの合計は 1.00）。

| 要素 | 重み | 意味 |
|---|---|---|
| 求人シグナル | 0.28 | シグナル種別数・直近の強シグナル件数・募集人数 |
| 契約空白 | 0.18 | 未加入の商品カテゴリ比率 |
| 満期接近 | 0.14 | 最短満期までの日数 |
| イベント鮮度 | 0.14 | 未処理の事業イベントアラートの新しさ |
| 接点空白 | 0.12 | 最終接触からの経過日数と決裁者未接触フラグ |
| 財務健全性 | 0.08 | 営業利益率と従業員数の伸び |
| 従業員規模 | 0.06 | 従業員数の対数 |

### 求人シグナルの設計

求人票を企業属性と突き合わせ、7種の保険ニーズシグナルに変換しています。たとえば健康経営認定を持たない企業が産業保健師を募集していれば「健康経営」シグナル、確定給付年金のみの企業がDC移行担当を募集していれば「年金制度」シグナルとして検出します。

---

## 生成AI機能

すべて `SNOWFLAKE.CORTEX.COMPLETE`（`claude-sonnet-5`）を使用します。モデル名は `lib/constants.ts` の `CORTEX_MODEL` 一箇所で管理しています。

| API ルート | 用途 | 目安時間 |
|---|---|---|
| `POST /api/ai/attack-reason` | アタックリスト上位企業の推奨理由と初回トーク | 15〜33秒（企業数に比例） |
| `POST /api/ai/proposal-story` | 提案ストーリー（課題仮説・ヒアリング設計・想定反論） | 54〜71秒 |
| `POST /api/ai/proposal` | 提案書ドラフト（章立て・数値根拠・想定保険料） | 65〜89秒 |
| `POST /api/ai/needs-deepdive` | 商談の振り返り。ニーズ精緻化とトップ営業との差分分析 | 50〜72秒 |

いずれも10秒を超えるため `querySnowflakeLongRunning`（非同期サブミット＋ポーリング）を使用します。上限は `maxWaitMs = 300秒`です。

`max_tokens` に達した場合、Cortex は `finish_reason` を返さず切り詰めたテキストをそのまま返すため、下流では「JSONを抽出できませんでした」という原因の分かりにくいエラーになります。`lib/cortex.ts` では `usage.completion_tokens` を予算と比較し、打ち切りを明示的なエラーとして surface します。トークン予算は提案書・振り返りが 14,000、提案ストーリーが 12,000、アタック理由が 10,000 です。

### ハルシネーション対策

- 生成プロンプトには顧客の実データのみを注入し、「提供されたデータに存在しない数値を創作しない」ことを明示的に指示しています。
- 暗黙知は抽出時に**書き起こしからの逐語引用**を必須とし、引用が実際に書き起こしに存在するかを照合して検証率を `EVIDENCE_VERIFIED_PCT` に記録、確信度に反映しています（現状95.2%が検証済み）。
- 提案ストーリー・振り返りで適用した暗黙知は `knowledge_id` として画面に表示し、根拠を追跡できるようにしています。

---

## 開発

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

ローカル開発では `~/.snowflake/config.toml` のデフォルト接続が自動的に使われます。

### デプロイ

```bash
snow app deploy --verbose
```

### コード構成

| パス | 役割 |
|---|---|
| `lib/constants.ts` | ブランド設定、Snowflakeオブジェクト名、業務フロー定義、バッジ配色 |
| `lib/format.ts` | SDK戻り値の正規化（TIMESTAMP→ISO、VARIANT→配列/オブジェクト）とSQLエスケープ |
| `lib/queries.ts` | 全画面のSQLを集約。列の正規化はここに一元化 |
| `lib/cortex.ts` | Cortex COMPLETE 呼び出しとJSON抽出 |
| `lib/snowflake.ts` | 接続・認証・プーリング（テンプレート提供。変更しない） |
| `components/ui-kit.tsx` | バッジ、スコアバー、KPIカードなどの共通UI |
| `components/dashboard-charts.tsx` | Recharts によるグラフ |
| `components/workflow-stepper.tsx` | 業務フロー5ステージのステッパー |

### 実装上の注意

- Snowflake SDK は TIMESTAMP を JS `Date`、VARIANT/ARRAY を JSON文字列で返します。API境界で必ず `lib/format.ts` のヘルパーを通してください。
- VARIANT 配列の要素型は生成結果によって文字列とオブジェクトが混在します。文字列として表示する配列は `toStringArray()` を使ってください。
- Client Component から `querySnowflake()` は呼べません。API ルート経由で `fetch` してください。
- `lib/snowflake.ts` と `next.config.mjs` は変更しないでください。`next.config.mjs` の workspace-root ピン留めを外すとビルドが壊れます。
