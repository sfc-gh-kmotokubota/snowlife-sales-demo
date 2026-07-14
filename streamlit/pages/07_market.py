"""
06_📈_マーケット.py - マーケット・インサイトダッシュボード (F-13)
財務企画部共有の金利・株価データで保険提案タイミングを分析
"""
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import date, timedelta
import random
from snowflake.snowpark.context import get_active_session

st.set_page_config(page_title="マーケット・インサイト", layout="wide")
st.title("📈 マーケット・インサイト")
st.caption("データ提供: スノー生命 財務企画部 Snowflake（Secure Data Sharing・ゼロコピー）")
st.info("💡 このデータは財務企画部の Snowflake アカウントから Secure Data Sharing でゼロコピー・リアルタイム共有されています。")

session = get_active_session()

# ────────────────────────────────────────
# 金利データ（デモ用固定値）
# ────────────────────────────────────────
import random
random.seed(42)
start_date = date.today() - timedelta(days=730)
dates = [start_date + timedelta(days=i) for i in range(0, 730, 7)]

# 日本国債10年利回りの推移（2024〜2026）
base_rates = []
rate = 0.62
for d in dates:
    rate += random.gauss(0.003, 0.015)
    rate = max(0.3, min(2.0, rate))
    base_rates.append(round(rate, 3))

current_rate = 1.45
base_rates[-1] = current_rate

rate_df = pd.DataFrame({"日付": dates, "利回り": base_rates})

# ────────────────────────────────────────
# KPI
# ────────────────────────────────────────
col1, col2, col3, col4 = st.columns(4)
col1.metric("10年国債利回り", f"{current_rate:.2f}%", f"+0.35% (1年)")
col2.metric("金利環境", "📈 上昇局面", "DB年金積立改善傾向")
col3.metric("DC移行提案", "★★★ 最適タイミング", "金利上昇でコスト低")
col4.metric("役員保険訴求", "★★ 検討タイミング", "高金利で予定利率改善")

st.markdown("---")

# ────────────────────────────────────────
# 金利チャート
# ────────────────────────────────────────
col_chart, col_signal = st.columns([3, 2])

with col_chart:
    st.subheader("📊 長期金利推移（日本国債10年）")
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=rate_df["日付"], y=rate_df["利回り"],
        mode="lines", name="10年国債利回り",
        line=dict(color="#E60012", width=2)
    ))
    fig.add_hline(y=1.0, line_dash="dash", line_color="#888",
                  annotation_text="DB年金計算基準金利（目安）",
                  annotation_position="bottom right")
    fig.add_hline(y=current_rate, line_dash="dot", line_color="#E60012",
                  annotation_text=f"現在: {current_rate}%",
                  annotation_position="top right")
    fig.update_layout(
        height=300, yaxis_title="利回り（%）",
        yaxis=dict(range=[0, 2.2]),
        margin=dict(t=10, b=10),
        showlegend=False
    )
    st.plotly_chart(fig, use_container_width=True)

with col_signal:
    st.subheader("📋 市場サマリー")
    st.markdown(f"""
    **現在の金利水準**: {current_rate}%
    **1年前比**: +0.35%ポイント

    **保険提案への影響:**

    🟢 **DC移行提案**: ★★★ 最適タイミング
    - DB積立余剰が発生中
    - 移行コストが最も低い時期
    - 対象: DB年金保有企業（トヨタ・パナHD・伊藤忠・野村・鹿島等）

    🟡 **役員退職慰労金保険**: ★★ 好機
    - 高金利で保険の予定利率が改善
    - 積立効率がUP

    📊 **GLTD・団体医療**: ★ 通常通り
    - 金利の影響は軽微
    """)

st.markdown("---")

# ────────────────────────────────────────
# 担当先企業の株価シグナル
# ────────────────────────────────────────
st.subheader("📉 担当先企業の株価シグナル × 保険提案機会")

# 期間ごとの騰落率（デモ固定値）全20社分
CHANGE_BY_PERIOD = {
    "1M": {
        "C001": +2.3, "C002": -4.1, "C003": +6.8, "C004": +1.5, "C005": -7.5,
        "C006": None, "C007": +3.2, "C008": +5.1, "C009": -1.8, "C010": -2.8,
        "C011": +4.5, "C012": +8.5, "C013": -0.9, "C014": +7.2, "C015": +1.1,
        "C016": +5.8, "C017": +2.9, "C018": None, "C019": +0.6, "C020": +3.4,
    },
    "3M": {
        "C001": +8.1, "C002": -9.3, "C003": +14.2, "C004": +5.8, "C005": -12.4,
        "C006": None, "C007": +6.5, "C008": +9.8, "C009": -4.2, "C010": -6.1,
        "C011": +11.3, "C012": +18.7, "C013": -3.1, "C014": +15.6, "C015": +2.8,
        "C016": +12.4, "C017": +7.3, "C018": None, "C019": +1.9, "C020": +7.1,
    },
    "1Y": {
        "C001": +21.5, "C002": -18.7, "C003": +32.4, "C004": +14.2, "C005": -24.1,
        "C006": None, "C007": +9.3, "C008": +22.6, "C009": -8.5, "C010": -11.3,
        "C011": +28.9, "C012": +41.2, "C013": +5.2, "C014": +38.7, "C015": +6.4,
        "C016": +29.3, "C017": +19.8, "C018": None, "C019": +4.7, "C020": +15.2,
    },
}

market_df = session.sql("""
    SELECT COMPANY_ID, COMPANY_NAME, INDUSTRY_LARGE, PROSPECT_RANK,
           LATEST_STOCK_PRICE, PENSION_RATE_SIGNAL, UNREAD_ALERTS, PENSION_TYPE, STOCK_TICKER
    FROM LIFEINSURANCE_DEMO_DB.ANALYTICS.V_MARKET_INSIGHT
    WHERE COMPANY_ID != 'C006'
    ORDER BY
        CASE PROSPECT_RANK WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END,
        COMPANY_ID
""").to_pandas()

period = st.radio("表示期間", ["1M", "3M", "1Y"], horizontal=True)
period_label = {"1M": "1ヶ月", "3M": "3ヶ月", "1Y": "1年"}[period]

display_cols = st.columns([2, 1, 1, 1, 2, 2])
headers = ["企業名", "ランク", "株価", f"{period_label}騰落率", "金利シグナル", "提案機会"]
for h, col in zip(headers, display_cols):
    col.markdown(f"**{h}**")

st.markdown("---")

for _, row in market_df.iterrows():
    cid = row["COMPANY_ID"]
    chg = CHANGE_BY_PERIOD[period].get(cid)
    if chg is not None:
        icon = "🟢" if chg > 5 else ("🔴" if chg < -5 else "✅")
        chg_str = f"{icon} {chg:+.1f}%"
    else:
        chg_str = "— (非上場)"

    price = row.get("LATEST_STOCK_PRICE")
    price_str = f"¥{price:,.0f}" if price else "—"

    pension_sig = row.get("PENSION_RATE_SIGNAL") or "—"
    prop_signal = ""
    if row.get("PENSION_TYPE") and "DB" in str(row.get("PENSION_TYPE")):
        prop_signal = "💡 DC移行提案の好機"
    if chg is not None and chg < -5:
        prop_signal += " ⚠ 株価下落→役員保険訴求"
    elif chg is not None and chg > 10:
        prop_signal += " 🎯 業績好調→福利厚生強化提案"

    cols = st.columns([2, 1, 1, 1, 2, 2])
    alerts_badge = f" 🔔{int(row.get('UNREAD_ALERTS', 0))}" if row.get("UNREAD_ALERTS", 0) > 0 else ""
    cols[0].markdown(f"{row['COMPANY_NAME'][:15]}{alerts_badge}")
    cols[1].markdown(f"**{row.get('PROSPECT_RANK', '?')}**")
    cols[2].markdown(price_str)
    cols[3].markdown(chg_str)
    cols[4].markdown(f"<small>{str(pension_sig)[:30]}</small>", unsafe_allow_html=True)
    cols[5].markdown(f"<small>{prop_signal[:40]}</small>", unsafe_allow_html=True)

st.markdown("---")
st.markdown("""
**📌 Snowflake Data Sharing の優位性（vs Databricks Delta Sharing）**
- **ゼロコピー**: データは財務企画部のアカウントに存在したまま、法人営業部がリアルタイムで参照
- **設定**: `ALTER SHARE ADD ACCOUNT` 1行のみ（Databricksのトークン発行不要）
- **リアルタイム**: 財務企画部が更新した瞬間に反映（Databricksはバッチ更新が基本）
""")
