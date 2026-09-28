# AGENTS.md — CoCo（Cortex Code）向けデプロイ手順

このリポジトリは「スノー生命 法人営業AI」デモ一式です。デプロイ対象は2層に分かれています。
ユーザーの依頼がどちらに当たるかを判断してから作業してください。

| 層 | 中身 | 作成方法 | 対象アカウント |
|---|---|---|---|
| **ベース** | データ・Cortex Search・Semantic View・Cortex Agent（CoWork）・Streamlit | `setup.sql` | Trial アカウント含むすべて |
| **App Runtime（任意）** | Next.js 版「法人営業支援AI」 | `app-runtime/` 配下 | App Runtime が有効なアカウントのみ |

- 「デプロイして」「セットアップして」とだけ言われた場合は、**ベースだけ**を作成し、App Runtime も作るかどうかを `ask_user_question` で確認する。
- `setup.sql` は App Runtime を作成しない。この分離を崩さないこと。

---

## 1. ベース（setup.sql）

前提: ACCOUNTADMIN を使えること。

```bash
snow sql -c <接続名> -f setup.sql --enable-templating NONE
```

- `--enable-templating NONE` は必須（SQL 内の `&` 等を snow CLI がテンプレートとして解釈し `SQL rendering error` になる）。
- 所要時間は数分（`GENERATE_DEMO_DATA` はバルクINSERTで20秒前後）。
- 成功すると、最後に `セットアップ完了！...` が返る。
- Section 8 では公開 GitHub リポジトリから Streamlit を作成する。PAT は不要。
  フォークから配布する場合は `API_ALLOWED_PREFIXES` と `ORIGIN` を書き換える。

確認:

```sql
SHOW STREAMLITS IN SCHEMA LIFEINSURANCE_DEMO_DB.RAW;
SHOW AGENTS IN SCHEMA LIFEINSURANCE_DEMO_DB.RAW;
SHOW CORTEX SEARCH SERVICES IN DATABASE LIFEINSURANCE_DEMO_DB;
```

---

## 2. App Runtime 版（app-runtime/）

**`snowflake-apps` スキルを必ずロードしてから進める。** デプロイ手順とエラー対処はスキル側が正本。

### 2-1. 前提チェック（すべて満たさなければ中断してユーザーに報告）

1. ベース（手順1）が作成済み: `SHOW DATABASES LIKE 'LIFEINSURANCE_DEMO_DB'` が1件返る
2. アプリの配置先: `SHOW PARAMETERS LIKE 'DEFAULT_SNOWFLAKE_APPS%' IN ACCOUNT` を確認する。
   - 値が入っていれば、それを 2-3 で使う。
   - **空の場合**（SE のデモアカウントではよくある）、`snow app deploy` は個人DB `USER$<ユーザー>` にデプロイしてしまう。ユーザーの承認を得てから既定の配置先を作る:
     ```sql
     CREATE DATABASE IF NOT EXISTS SNOWFLAKE_APPS;
     CREATE WAREHOUSE IF NOT EXISTS SNOWFLAKE_APPS_QUERY_WH
       WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE;
     ```
3. `claude-sonnet-5` が使える（`setup.sql` がクロスリージョン推論を有効化済み）:
   `SELECT SNOWFLAKE.CORTEX.COMPLETE('claude-sonnet-5','ping')`
4. ローカルに `snow` CLI と `npm` がある（`snow --version`）

### 2-2. アプリ用データの投入（snow CLI で実行。PUT は Snowsight では動かない）

**リポジトリ直下**から順に実行する（`02` の PUT は相対パス `app-runtime/snapshot/data/` を使う）。

```bash
snow sql -c <接続名> -f app-runtime/sql/01_app_tables.sql --enable-templating NONE     # テーブル定義（setup.sql 版の上位互換）
snow sql -c <接続名> -f app-runtime/sql/02_load_snapshot.sql --enable-templating NONE  # デモデータ投入
snow sql -c <接続名> -f app-runtime/sql/03_app_views.sql --enable-templating NONE      # 分析ビュー
snow sql -c <接続名> -f app-runtime/sql/04_search_services.sql --enable-templating NONE # Cortex Search（setup.sql 由来の2本も再作成）
```

- `01` は RAW/AI の19テーブルを `CREATE OR REPLACE` する。列は setup.sql 版の上位互換なので、Streamlit・Agent・Semantic View はそのまま動く。
- 投入件数の確認: `SELECT COUNT(*) FROM LIFEINSURANCE_DEMO_DB.RAW.T_MEETING_TRANSCRIPTS` が 3117、`AI.T_TACIT_KNOWLEDGE` が 30。

### 2-3. マニフェストの調整

`app-runtime/snowflake.yml` の次の3項目は、デプロイ先アカウントの値に合わせる。
値は 2-1 の2で確認した `DEFAULT_SNOWFLAKE_APPS_*` パラメータ（プラットフォーム既定値は `SNOWFLAKE_APPS` / `PUBLIC` / `SNOWFLAKE_APPS_QUERY_WH`）を使う。

- `identifier.database`
- `identifier.schema`
- `query_warehouse`

アプリが読むデータの場所は `app-runtime/lib/constants.ts` の `DB` 定数（既定 `LIFEINSURANCE_DEMO_DB`）。DB 名を変えた場合だけ編集する。

### 2-4. デプロイ

`app-runtime/` をカレントにして、`snowflake-apps` スキルの deploy 手順に従う（設定のサマリを提示し、**ユーザーの承認を得てから** `snow app deploy`）。完了したら `.snowflakecomputing.app` の URL をユーザーに返す。初回はビルドとエンドポイント準備で8分前後かかる。

URL を開くと Snowflake のログイン画面が出る。デプロイしたアカウントのユーザーでログインする。

アプリの所有ロールには、データへのアクセス権が必要（ACCOUNTADMIN 以外でデプロイした場合）:

```sql
GRANT USAGE ON DATABASE LIFEINSURANCE_DEMO_DB TO ROLE <app_owner_role>;
GRANT USAGE ON ALL SCHEMAS IN DATABASE LIFEINSURANCE_DEMO_DB TO ROLE <app_owner_role>;
GRANT SELECT ON ALL TABLES IN DATABASE LIFEINSURANCE_DEMO_DB TO ROLE <app_owner_role>;
GRANT SELECT ON ALL VIEWS IN DATABASE LIFEINSURANCE_DEMO_DB TO ROLE <app_owner_role>;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA LIFEINSURANCE_DEMO_DB.AI TO ROLE <app_owner_role>;
GRANT USAGE ON CORTEX SEARCH SERVICE LIFEINSURANCE_DEMO_DB.SEARCH.TACIT_KNOWLEDGE_SEARCH TO ROLE <app_owner_role>;
GRANT USAGE ON WAREHOUSE LIFEINSURANCE_DEMO_WH TO ROLE <app_owner_role>;
```

### 2-5. 動作確認

`/attack-list`、`/customers`、`/meetings`、`/knowledge` がデータ付きで表示されること。
エラーになったら `snowflake-apps` スキルの operate 手順でログを確認する。

---

## 触らないもの

- `app-runtime/snapshot/data/*.json.gz` は架空データのスナップショット。再生成・編集しない。
- `app-runtime/sql/extras/` はアプリ専用 Semantic View / Agent の参考定義。デプロイ手順には含まない。
