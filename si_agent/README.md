# Cortex Agent 設定ガイド

## エージェント概要

**エージェント名**: `LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SALES_AGENT`

生命保険会社 法人営業部向け AI アシスタント。
担当営業担当者が大企業（従業員2,000名以上）への保険提案・営業活動を行う際の全面支援。

---

## ツール構成（4ツール）

| ツール名 | タイプ | データソース | 用途 |
|----------|--------|-------------|------|
| `customer_search` | Cortex Search | `LIFEINSURANCE_DEMO_DB.SEARCH.CUSTOMER_INFO_SEARCH` | 面談記録・文字起こし全文検索 |
| `news_search` | Cortex Search | `LIFEINSURANCE_DEMO_DB.SEARCH.NEWS_SEARCH` | 企業ニュース・事業イベント検索 |
| `product_search` | Cortex Search | `LIFEINSURANCE_DEMO_DB.SEARCH.PRODUCT_SEARCH` | 保険商品・非保険サービス検索 |
| `sales_analytics` | Cortex Analyst | `LIFEINSURANCE_DEMO_DB.ANALYTICS.SV_SALES_ANALYTICS` | KPI・見込み管理・アラート分析 |

---

## デプロイ方法

### 前提条件

- ACCOUNTADMIN ロール
- <your_connection> 接続
- `uv` インストール済み

```bash
# エージェントの新規作成
SKILL_DIR="/Applications/Cortex Code.app/Contents/Resources/app/resources/snowflake/skills/cortex-code-skills/cortex-agent"
cd /path/to/snowlife-sales-demo

uv run --project "$SKILL_DIR" python "$SKILL_DIR/scripts/create_or_alter_agent.py" create \
  --agent-name LIFEINSURANCE_SALES_AGENT \
  --config-file si_agent/agent_spec.json \
  --database LIFEINSURANCE_DEMO_DB \
  --schema RAW \
  --role ACCOUNTADMIN \
  --connection <your_connection>

# ⚠️ 注意: CREATE OR REPLACE AGENT はコメントを削除するため、毎回以下を実行すること
snow sql -q "ALTER AGENT LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SALES_AGENT SET COMMENT = '生命保険会社 法人営業AIアシスタント | 担当先企業の事業イベント検知・商品マッチング・提案書作成・コンプライアンスチェックを自然言語でサポート'" -c <your_connection>
```
  --role ACCOUNTADMIN \
  --connection <your_connection>
```

### SQL で直接作成する場合

```sql
USE ROLE ACCOUNTADMIN;
USE DATABASE LIFEINSURANCE_DEMO_DB;
USE SCHEMA RAW;
USE WAREHOUSE LIFEINSURANCE_DEMO_WH;

-- agent_spec.json の内容を $spec$ ... $spec$ 内に貼り付け
CREATE OR REPLACE AGENT LIFEINSURANCE_SALES_AGENT
FROM SPECIFICATION $spec$
{...}
$spec$;
```

---

## 動作確認

```bash
# 基本動作テスト
uv run --project "$SKILL_DIR" python "$SKILL_DIR/scripts/test_agent.py" \
  --agent-name LIFEINSURANCE_SALES_AGENT \
  --question "あなたは何ができますか？" \
  --workspace LIFEINSURANCE_DEMO_DB_RAW_LIFEINSURANCE_SALES_AGENT \
  --output-name test_basic.json \
  --database LIFEINSURANCE_DEMO_DB \
  --schema RAW \
  --connection <your_connection>
```

---

## デモ質問例

| カテゴリ | 質問例 |
|---------|--------|
| 事業イベント検知 | 「パナソニックに関する最新ニュースと提案すべき商品を教えて」 |
| 面談振り返り | 「伊藤忠商事との過去面談でDCについて何を話したか」 |
| 商品提案 | 「M&A後に最初に提案すべき商品はどれか理由付きで教えて」 |
| KPI分析 | 「Aランクの見込み件数と合計金額は？業種別の内訳も」 |
| コンプライアンス | 「この提案書の文言に問題がないか確認して：確実に年金が増えます」 |
| アラート確認 | 「今週中に対応すべき未読アラートのある企業をリストアップして」 |

---

## Snowflake CoWork（SI）での使用

Snowsight の Snowflake CoWork 画面で以下を設定：

1. **エージェントを選択**: `LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SALES_AGENT`
2. **System Prompt**: `si_agent/agent_spec.json` の instructions.orchestration を参照
3. **ウェアハウス**: `LIFEINSURANCE_DEMO_WH`

---

## vs Databricks の優位性（エージェント観点）

| 機能 | Snowflake Cortex Agent | Databricks Genie |
|------|----------------------|-----------------|
| Web検索 | ✅ ネイティブ内蔵（MCP不要） | ⚠️ MCP経由（外部API） |
| コンプライアンス検知 | ✅ 保険業法特化（AI_CLASSIFY） | ❌ なし |
| 金融データ漏洩リスク | ✅ 全処理をSnowflake内で完結 | ⚠️ 外部API呼び出し発生 |
| Semantic View（KPI分析） | ✅ ネイティブCortex Analyst | ⚠️ Delta Sharing+Genie |
| Cortex Search統合 | ✅ ネイティブ（遅延なし） | ❌ 別サービス連携必要 |
