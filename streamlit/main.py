"""
main.py - スノー生命 法人営業AIアシスタント
Snowflake on Streamlit エントリポイント
"""
import streamlit as st
from snowflake.snowpark.context import get_active_session

st.set_page_config(
    page_title="スノー生命 法人営業AIアシスタント",
    page_icon="🏢",
    layout="wide",
    initial_sidebar_state="expanded"
)

# CSS スタイル（スノー生命ブランドカラー）
st.markdown("""
<style>
/* プライマリボタン */
.stButton > button[kind="primary"] {
    background-color: #E60012;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: bold;
}
.stButton > button {
    border-radius: 6px;
}
/* アラートカード: 最高 */
.alert-critical {
    background: #FFF0F0;
    border-left: 4px solid #E60012;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 8px 0;
}
/* アラートカード: 高 */
.alert-high {
    background: #FFFBF0;
    border-left: 4px solid #F5A623;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 8px 0;
}
/* アラートカード: 中 */
.alert-medium {
    background: #F0F8FF;
    border-left: 4px solid #4A90D9;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 8px 0;
}
/* 見込みカード */
.prospect-card {
    background: white;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    margin: 6px 0;
}
/* KPIカード */
.kpi-card {
    background: white;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
    box-shadow: 0 1px 4px rgba(0,0,0,0.10);
}
.kpi-number { font-size: 28px; font-weight: bold; color: #E60012; }
.kpi-label  { font-size: 12px; color: #666; }
/* サイドバー */
section[data-testid="stSidebar"] { background: #1A1A2E; }
section[data-testid="stSidebar"] * { color: white !important; }
section[data-testid="stSidebar"] .stSelectbox label { color: #aaa !important; }
</style>
""", unsafe_allow_html=True)

# セッション
try:
    session = get_active_session()
except Exception:
    import snowflake.snowpark as snowpark
    session = None

# サイドバー
with st.sidebar:
    st.markdown("## 🏢 法人営業AIアシスタント")
    st.markdown("**スノー生命保険相互会社**")
    st.markdown("---")
    st.markdown("### 📋 メニュー")
    st.markdown("👉 左のページリストからお選びください")
    st.markdown("---")

    if session:
        # 未読アラート数を表示
        try:
            alerts = session.sql("""
                SELECT COUNT(*) AS CNT FROM LIFEINSURANCE_DEMO_DB.RAW.T_EVENT_ALERTS
                WHERE STATUS = 'UNREAD'
            """).collect()
            cnt = alerts[0]["CNT"] if alerts else 0
            if cnt > 0:
                st.error(f"🚨 未対応アラート: {cnt}件")
        except:
            pass

    st.markdown("---")
    st.markdown("**担当者**: 山田 太郎（法人部）")
    st.markdown("**デモ環境**: DEMO")

# メインページ
st.title("🏢 スノー生命 法人営業 AI アシスタント")
st.markdown("### Snowflake CoWork + Streamlit で営業生産性を劇的に向上")

col1, col2, col3, col4 = st.columns(4)

if session:
    try:
        # KPI データ取得
        kpi = session.sql("""
            SELECT
                (SELECT COUNT(DISTINCT COMPANY_ID) FROM LIFEINSURANCE_DEMO_DB.RAW.T_CUSTOMER_COMPANIES) AS COMPANIES,
                (SELECT COUNT(*) FROM LIFEINSURANCE_DEMO_DB.RAW.T_EVENT_ALERTS WHERE STATUS = 'UNREAD') AS ALERTS,
                (SELECT COUNT(*) FROM LIFEINSURANCE_DEMO_DB.RAW.T_PROSPECTS WHERE CURRENT_RANK IN ('A','B')) AS AB_PROSPECTS,
                (SELECT SUM(PROSPECT_AMOUNT)/1e8 FROM LIFEINSURANCE_DEMO_DB.RAW.T_PROSPECTS) AS TOTAL_AMOUNT
        """).collect()[0]

        with col1:
            st.markdown(f"""<div class="kpi-card">
                <div class="kpi-number">{kpi['COMPANIES']}</div>
                <div class="kpi-label">担当企業数</div>
            </div>""", unsafe_allow_html=True)
        with col2:
            st.markdown(f"""<div class="kpi-card">
                <div class="kpi-number" style="color:#E60012">{kpi['ALERTS']}</div>
                <div class="kpi-label">🚨 未対応アラート</div>
            </div>""", unsafe_allow_html=True)
        with col3:
            st.markdown(f"""<div class="kpi-card">
                <div class="kpi-number">{kpi['AB_PROSPECTS']}</div>
                <div class="kpi-label">A/Bランク見込み</div>
            </div>""", unsafe_allow_html=True)
        with col4:
            amt = kpi['TOTAL_AMOUNT'] or 0
            st.markdown(f"""<div class="kpi-card">
                <div class="kpi-number">{amt:.0f}億円</div>
                <div class="kpi-label">見込み保険料合計</div>
            </div>""", unsafe_allow_html=True)
    except Exception as e:
        st.warning(f"データ取得中... ({e})")

st.markdown("---")

# 7つのアプリの案内
apps = [
    ("🎯", "面談前準備", "企業ブリーフィングを1クリックで生成。面談で聞かれそうな質問と回答例（想定Q&A）を企業・商品に合わせて自動作成します。"),
    ("🚨", "事業イベントアラート", "M&A・IPO・経営陣交代等の保険提案機会をAIが自動検知。今すぐアプローチすべき企業を表示。"),
    ("🎙", "面談録音・要約", "音声ファイルや会話ログを読み込んで文字起こし・要約・コンプライアンスチェック・Salesforce登録まで自動化。"),
    ("📊", "見込み管理", "担当20社の見込みをPipedriveスタイルで管理。昇格チェックリストと1クリック昇格ボタンで進捗を見える化。"),
    ("🔍", "商品マッチング", "4軸の説明可能AIで最適商品を根拠付きでスコアリング。企業の事業イベント・市場環境・属性・面談履歴の4軸から最適商品を提案します。"),
    ("📄", "DP自動生成", "企業名と商品を選んでボタン1つ。最新情報が差し込まれたPPTX・Wordのディスカッションペーパーが30秒で完成。"),
    ("📈", "マーケット・インサイト", "財務企画部共有の金利・株価データで保険提案タイミングを分析。DC移行提案の最適時期を可視化。"),
]

cols = st.columns(3)
for i, (icon, title, desc) in enumerate(apps):
    with cols[i % 3]:
        st.markdown(f"""
        <div class="prospect-card" style="min-height:120px">
            <h3>{icon} {title}</h3>
            <p style="font-size:13px;color:#555">{desc}</p>
        </div>
        """, unsafe_allow_html=True)
