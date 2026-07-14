"""
01_🚨_アラート.py - 事業イベントアラートダッシュボード (F-10)
"""
import streamlit as st
import pydeck as pdk
import pandas as pd
from snowflake.snowpark.context import get_active_session

st.set_page_config(page_title="事業イベントアラート", layout="wide")

st.title("🚨 事業イベント・アラートダッシュボード")
st.caption("AIが夜間に全担当先のニュースを自動スキャン。今すぐアプローチすべき企業を優先度順に表示します。")

session = get_active_session()

# ────────────────────────────────────────
# KPI
# ────────────────────────────────────────
kpi_data = session.sql("""
    SELECT
        COUNT(*) AS TOTAL_UNREAD,
        SUM(CASE WHEN INSURANCE_RELEVANCE = '最高' THEN 1 ELSE 0 END) AS CRITICAL,
        SUM(CASE WHEN INSURANCE_RELEVANCE = '高' THEN 1 ELSE 0 END) AS HIGH,
        SUM(CASE WHEN URGENCY_DAYS <= 7 AND STATUS = 'UNREAD' THEN 1 ELSE 0 END) AS THIS_WEEK
    FROM LIFEINSURANCE_DEMO_DB.RAW.T_EVENT_ALERTS
    WHERE STATUS = 'UNREAD'
""").collect()[0]

c1, c2, c3, c4 = st.columns(4)
c1.metric("未対応アラート", f"{kpi_data['TOTAL_UNREAD']}件")
c2.metric("🔴 最高優先度", f"{kpi_data['CRITICAL']}件")
c3.metric("🟡 高優先度", f"{kpi_data['HIGH']}件")
c4.metric("⏰ 今週対応必要", f"{kpi_data['THIS_WEEK']}件")

st.markdown("---")

# ────────────────────────────────────────
# 地図 + アラートリスト
# ────────────────────────────────────────
col_map, col_list = st.columns([1, 1])

# アラートデータ取得
alerts_df = session.sql("""
    SELECT
        ea.ALERT_ID, ea.COMPANY_ID, c.COMPANY_NAME, c.INDUSTRY_LARGE,
        ea.EVENT_TYPE, ea.EVENT_SUMMARY, ea.INSURANCE_RELEVANCE,
        ea.RECOMMENDED_ACTION, ea.URGENCY_DAYS, ea.DETECTED_AT,
        cl.LATITUDE, cl.LONGITUDE
    FROM LIFEINSURANCE_DEMO_DB.RAW.T_EVENT_ALERTS ea
    JOIN LIFEINSURANCE_DEMO_DB.RAW.T_CUSTOMER_COMPANIES c ON ea.COMPANY_ID = c.COMPANY_ID
    LEFT JOIN LIFEINSURANCE_DEMO_DB.RAW.T_COMPANY_LOCATIONS cl
        ON ea.COMPANY_ID = cl.COMPANY_ID AND cl.IS_HEADQUARTERS = TRUE
    WHERE ea.STATUS = 'UNREAD'
    ORDER BY
        CASE ea.INSURANCE_RELEVANCE WHEN '最高' THEN 1 WHEN '高' THEN 2 WHEN '中' THEN 3 ELSE 4 END,
        ea.URGENCY_DAYS ASC
    LIMIT 50
""").to_pandas()

with col_map:
    st.subheader("📍 アラートマップ")
    if not alerts_df.empty:
        map_df = alerts_df.dropna(subset=["LATITUDE", "LONGITUDE"]).copy()

        def get_color(rel):
            return {"最高": [230, 0, 18, 220], "高": [245, 166, 35, 200], "中": [100, 149, 237, 180]}.get(rel, [150, 150, 150, 150])

        map_df["color"] = map_df["INSURANCE_RELEVANCE"].apply(get_color)
        map_df["radius"] = map_df["URGENCY_DAYS"].apply(lambda x: max(2000, 8000 - (x or 30) * 120))

        # 東京都内など近接企業の座標ジッター（±0.002°≒200m）
        import hashlib
        def jitter(val, name, axis):
            seed = int(hashlib.md5(f"{name}{axis}".encode()).hexdigest(), 16) % 1000
            return val + (seed - 500) * 0.000004

        map_df["lon_j"] = map_df.apply(lambda r: jitter(r["LONGITUDE"], r["COMPANY_NAME"], "x"), axis=1)
        map_df["lat_j"] = map_df.apply(lambda r: jitter(r["LATITUDE"], r["COMPANY_NAME"], "y"), axis=1)

        scatter_layer = pdk.Layer(
            "ScatterplotLayer",
            data=map_df,
            get_position=["lon_j", "lat_j"],
            get_color="color",
            get_radius="radius",
            opacity=0.6,
            pickable=True,
            auto_highlight=True,
        )
        text_layer = pdk.Layer(
            "TextLayer",
            data=map_df,
            get_position=["lon_j", "lat_j"],
            get_text="COMPANY_NAME",
            get_size=11,
            get_color=[40, 40, 40, 200],
            get_anchor="middle",
            get_alignment_baseline="top",
            pickable=False,
        )
        tooltip = {
            "html": "<b>{COMPANY_NAME}</b><br/>🚨 {EVENT_TYPE}<br/>{EVENT_SUMMARY}<br/>⏰ {URGENCY_DAYS}日以内",
            "style": {"backgroundColor": "#1A1A2E", "color": "white", "fontSize": "13px", "maxWidth": "300px"}
        }
        st.pydeck_chart(pdk.Deck(
            layers=[scatter_layer, text_layer],
            initial_view_state=pdk.ViewState(latitude=35.8, longitude=137.5, zoom=5.5, pitch=0),
            tooltip=tooltip,
            map_style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        ))

with col_list:
    st.subheader("📋 優先度別アラート一覧")

    # フィルター
    filt_rel = st.selectbox("優先度フィルター", ["すべて", "最高", "高", "中"])
    filtered = alerts_df if filt_rel == "すべて" else alerts_df[alerts_df["INSURANCE_RELEVANCE"] == filt_rel]

    for idx_, row in filtered.iterrows():
        rel = row["INSURANCE_RELEVANCE"]
        icon = {"最高": "🔴", "高": "🟡", "中": "🟢"}.get(rel, "⚪")
        css_class = {"最高": "alert-critical", "高": "alert-high", "中": "alert-medium"}.get(rel, "")

        st.markdown(f"""
        <div class="{css_class}">
            <strong>{icon} {row['COMPANY_NAME']}</strong>
            &nbsp;&nbsp;<span style="font-size:12px;color:#666">{rel}優先度 | {row['EVENT_TYPE']} | ⏰{row.get('URGENCY_DAYS','?')}日以内</span><br/>
            <span style="font-size:13px">{str(row['EVENT_SUMMARY'])[:150]}...</span><br/>
            <span style="font-size:12px;color:#555">💡 {str(row.get('RECOMMENDED_ACTION',''))[:100]}</span>
        </div>
        """, unsafe_allow_html=True)

        cols_btn = st.columns([1, 1, 2])
        with cols_btn[0]:
            if st.button("✅ 対応済み", key=f"done_{row['ALERT_ID']}_{idx_}"):
                session.sql(f"UPDATE LIFEINSURANCE_DEMO_DB.RAW.T_EVENT_ALERTS SET STATUS='DONE' WHERE ALERT_ID='{row['ALERT_ID']}'").collect()
                st.rerun()
        with cols_btn[1]:
            if st.button("📄 DP作成", key=f"prop_{row['ALERT_ID']}_{idx_}"):
                st.session_state["proposal_company"] = row["COMPANY_ID"]
                st.session_state["proposal_company_name"] = row["COMPANY_NAME"]
                st.switch_page("pages/06_proposal.py")

st.markdown("---")
st.markdown("**※ データ提供**: Snowflake Streams + Tasks により夜間自動スキャン | 全処理はSnowflakeネットワーク内で完結")
