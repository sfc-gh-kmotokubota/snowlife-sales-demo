"""
04_matching.py - 企業ニーズ分析・商品マッチング (F-07)
4軸スコアリング + AI_COMPLETE による深掘り分析
"""
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import re
from snowflake.snowpark.context import get_active_session

st.set_page_config(page_title="商品マッチング", layout="wide")
st.title("🔍 企業ニーズ分析・商品マッチング")
st.caption("4軸スコアリングによる客観評価 + AI による企業固有の深掘り分析で、保険提案の論拠を構築します。")

session = get_active_session()

# ────────────────────────────────────────
# 企業選択
# ────────────────────────────────────────
companies = session.sql("""
    SELECT COMPANY_ID, COMPANY_NAME, INDUSTRY_LARGE, EMPLOYEE_COUNT,
           PENSION_TYPE, HEALTH_CERT_STATUS, PROSPECT_RANK,
           AVERAGE_AGE, AVERAGE_SALARY_JPY, TURNOVER_RATE, WELFARE_EXPENSE_RATIO
    FROM LIFEINSURANCE_DEMO_DB.RAW.T_CUSTOMER_COMPANIES
    ORDER BY PROSPECT_RANK, COMPANY_NAME
""").to_pandas()

col_sel, col_info = st.columns([1, 2])
with col_sel:
    company_options = {f"{r['COMPANY_NAME']} [{r['PROSPECT_RANK']}ランク]": r['COMPANY_ID'] for _, r in companies.iterrows()}
    selected_label = st.selectbox("分析対象企業", list(company_options.keys()))
    selected_cid = company_options[selected_label]

selected_company = companies[companies["COMPANY_ID"] == selected_cid].iloc[0]

with col_info:
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("従業員数", f"{selected_company['EMPLOYEE_COUNT']:,}名")
    c2.metric("業種", selected_company["INDUSTRY_LARGE"])
    c3.metric("年金制度", selected_company["PENSION_TYPE"] or "未確認")
    c4.metric("見込みランク", selected_company["PROSPECT_RANK"])

# ────────────────────────────────────────
# 最新アラート
# ────────────────────────────────────────
alerts = session.sql(f"""
    SELECT EVENT_TYPE, INSURANCE_RELEVANCE, EVENT_SUMMARY
    FROM LIFEINSURANCE_DEMO_DB.RAW.T_EVENT_ALERTS
    WHERE COMPANY_ID = '{selected_cid}' AND STATUS = 'UNREAD'
    ORDER BY CASE INSURANCE_RELEVANCE WHEN '最高' THEN 1 WHEN '高' THEN 2 ELSE 3 END
    LIMIT 3
""").to_pandas()

# 財務データ（直近1年）
fin_data = session.sql(f"""
    SELECT FISCAL_YEAR, REVENUE_JPY, OPERATING_PROFIT, EMPLOYEE_COUNT, AVERAGE_SALARY, WELFARE_EXPENSE_RATIO
    FROM LIFEINSURANCE_DEMO_DB.RAW.T_FINANCIAL_DATA
    WHERE COMPANY_ID = '{selected_cid}'
    ORDER BY FISCAL_YEAR DESC LIMIT 1
""").to_pandas()

# 過去面談の要約
meetings_summary = session.sql(f"""
    SELECT mt.TRANSCRIPT_TEXT
    FROM LIFEINSURANCE_DEMO_DB.RAW.T_MEETING_TRANSCRIPTS mt
    JOIN LIFEINSURANCE_DEMO_DB.RAW.T_MEETINGS m ON mt.MEETING_ID = m.MEETING_ID
    WHERE m.COMPANY_ID = '{selected_cid}'
    ORDER BY m.MEETING_DATE DESC LIMIT 5
""").to_pandas()

if not alerts.empty:
    st.markdown("#### 📡 直近の事業イベント（スコアに反映中）")
    event_cols = st.columns(len(alerts))
    for i, (_, row) in enumerate(alerts.iterrows()):
        icon = {"最高": "🔴", "高": "🟡", "中": "🟢"}.get(row["INSURANCE_RELEVANCE"], "⚪")
        with event_cols[i]:
            st.info(f"{icon} **{row['EVENT_TYPE']}**\n\n{str(row['EVENT_SUMMARY'])[:80]}...")

st.markdown("---")

# ────────────────────────────────────────
# 4軸スコアリング
# ────────────────────────────────────────
products = session.sql("""
    SELECT PRODUCT_ID, PRODUCT_NAME, PRODUCT_CATEGORY, PRODUCT_TYPE,
           TARGET_AUDIENCE, DESCRIPTION, TRIGGER_EVENTS, INDUSTRY_FIT_SCORE
    FROM LIFEINSURANCE_DEMO_DB.RAW.T_INSURANCE_PRODUCTS
    ORDER BY PRODUCT_CATEGORY, PRODUCT_ID
""").to_pandas()

def calculate_score(product_row, company_row, alerts_df):
    import json
    pid = product_row["PRODUCT_ID"]
    industry = company_row["INDUSTRY_LARGE"]
    pension = company_row["PENSION_TYPE"] or ""
    emp = company_row["EMPLOYEE_COUNT"]
    triggers = product_row.get("TRIGGER_EVENTS") or []

    event_score = 0
    reasons = []
    if not alerts_df.empty:
        for _, alert in alerts_df.iterrows():
            event_type = alert["EVENT_TYPE"]
            relevance = alert["INSURANCE_RELEVANCE"]
            if isinstance(triggers, list) and any(event_type in str(t) for t in triggers):
                score_add = {"最高": 25, "高": 18, "中": 10}.get(relevance, 5)
                event_score = min(25, event_score + score_add)
                reasons.append(f"{event_type}への対応商品")
    event_score = event_score or 10

    rate = 1.45
    market_score = 12
    if pid == "P013":
        market_score = min(25, int((rate - 0.5) * 22))
        reasons.append(f"10年金利{rate}%→DB積立改善傾向")
    elif pid == "P014":
        market_score = min(25, int((rate - 0.8) * 30))
        reasons.append(f"高金利環境でDC移行コストが低い")
    elif pid in ("P001","P002"):
        market_score = 15
        reasons.append("株価変動局面で役員保護ニーズ高まる")

    attr_score = 12
    try:
        fit_scores = json.loads(product_row["INDUSTRY_FIT_SCORE"]) if product_row["INDUSTRY_FIT_SCORE"] else {}
        industry_key_map = {
            "製造業": "製造業", "商社": "商社", "IT": "IT", "IT通信": "IT",
            "金融": "金融", "エネルギー": "エネルギー", "小売": "小売",
            "建設": "建設", "物流": "物流", "製薬": "製薬", "航空": "航空",
            "不動産": "建設", "鉄鋼": "製造業", "食品": "小売", "鉄道": "物流", "化学": "製造業"
        }
        mapped_industry = industry_key_map.get(industry, "製造業")
        attr_score = int(fit_scores.get(mapped_industry, 75) * 25 / 100)
        reasons.append(f"{industry}業種への適合性スコア{attr_score*4}")
    except:
        attr_score = 15

    interest_score = min(25, int(emp / 5000))
    if interest_score < 8:
        interest_score = 8
    reasons.append(f"従業員{emp:,}名規模での導入実績が高い")

    total = event_score + market_score + attr_score + interest_score
    numbered = [f"{chr(0x2460 + i)}{r}" for i, r in enumerate(reasons[:3])]
    return total, numbered, {"event": event_score, "market": market_score, "attr": attr_score, "interest": interest_score}

scored = []
for _, prod in products.iterrows():
    total, reasons, breakdown = calculate_score(prod, selected_company, alerts)
    scored.append({
        "PRODUCT_ID": prod["PRODUCT_ID"],
        "PRODUCT_NAME": prod["PRODUCT_NAME"],
        "CATEGORY": prod["PRODUCT_CATEGORY"],
        "SCORE": total,
        "REASONS": reasons,
        "BREAKDOWN": breakdown,
        "DESCRIPTION": str(prod["DESCRIPTION"])[:300] if prod["DESCRIPTION"] else "",
        "TRIGGER_EVENTS": prod.get("TRIGGER_EVENTS") or []
    })

scored_df = pd.DataFrame(scored).sort_values("SCORE", ascending=False)

# ────────────────────────────────────────
# 表示
# ────────────────────────────────────────
st.subheader("🏆 AI 商品マッチング（スコア降順・根拠付き）")
st.caption("4軸スコア（客観評価）+ AI深掘り分析（企業固有の根拠）の2層構造で提案の論拠を構築します。")

col_table, col_chart = st.columns([3, 2])

# 深掘り分析生成関数
def generate_deep_analysis(product_name, product_desc, company, alerts_df, fin_df, meetings_df):
    emp = company["EMPLOYEE_COUNT"]
    industry = company["INDUSTRY_LARGE"]
    pension = company["PENSION_TYPE"] or "未確認"
    cname = company["COMPANY_NAME"]

    alert_text = ""
    if not alerts_df.empty:
        alert_text = "、".join([f"{r['EVENT_TYPE']}（{r['INSURANCE_RELEVANCE']}）" for _, r in alerts_df.iterrows()])

    fin_text = ""
    if not fin_df.empty:
        row = fin_df.iloc[0]
        fin_text = f"売上{row['REVENUE_JPY']/1e12:.2f}兆円、営業利益{row['OPERATING_PROFIT']/1e12:.2f}兆円（{row['FISCAL_YEAR']}年度）"

    mtg_text = ""
    if not meetings_df.empty:
        mtg_text = " ".join([str(r["TRANSCRIPT_TEXT"])[:80] for _, r in meetings_df.head(3).iterrows()])[:300]

    ctx = f"""企業名: {cname}
業種: {industry}
従業員数: {emp:,}名
年金制度: {pension}
直近事業イベント: {alert_text or "なし"}
財務情報: {fin_text or "なし"}
過去面談の発言抜粋: {mtg_text or "なし"}
提案商品: {product_name}
商品概要: {product_desc}""".replace("'", "''").replace("\\", "")

    try:
        raw = session.sql(f"""
            SELECT AI_COMPLETE('mistral-large2', CONCAT(
                '保険営業の専門家向けに、以下の企業情報と商品情報を元に、
                 この商品をこの企業に提案する根拠を分析してください。
                 マークダウン記法（#、**、*）は一切使わないこと。
                 以下の形式で日本語で出力（各セクションは実際に改行を入れること）:
                 【なぜ今・なぜこの企業に】
                 （企業固有の状況と直近イベントを組み合わせた根拠。2-3文）
                 【定量インパクト試算】
                 （従業員数・単価などから推計した数値。具体的な金額・割合で示す）
                 【CFOへの訴求角度】
                 （財務・コスト・バランスシートの視点。1-2文）
                 【CHROへの訴求角度】
                 （人材獲得・定着・エンゲージメントの視点。1-2文）
                 【対応しないリスク】
                 （今対応しないと将来発生するリスク。1-2点箇条書き）
                 企業情報と商品情報: {ctx}')) AS ANALYSIS
        """).collect()[0]["ANALYSIS"]
        text = raw.replace('\\n', '\n').replace('\\t', ' ').strip('"').strip("'")
        text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
        text = re.sub(r'\*(.+?)\*', r'\1', text)
        return text
    except Exception as e:
        return f"""【なぜ今・なぜこの企業に】
{cname}（{emp:,}名/{industry}）は{alert_text or "事業拡大"}の局面にあり、従業員の安心基盤整備が急務です。

【定量インパクト試算】
従業員{emp:,}名規模での試算: 保険料単価8,000〜15,000円/人・月 × {emp:,}名 = 年間推定{int(emp*10000/1e8):.0f}〜{int(emp*15000*12/1e8):.0f}億円の財源確保が可能

【CFOへの訴求角度】
退職給付費用の安定化と損金算入による節税効果で、財務負担を最小化しながら従業員保護を実現できます。

【CHROへの訴求角度】
採用競争が激化する中、充実した福利厚生は給与水準に並ぶ重要な差別化要因となります。

【対応しないリスク】
・高度人材の採用・定着が競合他社に対して不利になるリスク
・万一の際の従業員対応コストが企業財務に直接影響するリスク"""

with col_table:
    for _, row in scored_df.head(8).iterrows():
        score = row["SCORE"]
        color = "#E60012" if score >= 80 else ("#F5A623" if score >= 60 else "#4A90D9")
        bar_html = f'<div style="background:{color};width:{int(score)}%;height:8px;border-radius:4px;margin:4px 0"></div>'

        with st.expander(f"{'★ ' if score >= 80 else ''}{row['PRODUCT_NAME']}　　スコア: {score}/100", expanded=score >= 80):
            st.markdown(bar_html, unsafe_allow_html=True)
            st.markdown(f"**カテゴリ**: {row['CATEGORY']}")

            if row["REASONS"]:
                st.markdown("**推奨根拠（上位3理由）**:")
                for r in row["REASONS"]:
                    st.markdown(f"- {r}")

            bd = row["BREAKDOWN"]
            st.markdown(f"**スコア内訳**: 事業イベント{bd['event']}/25 ＋ 市場環境{bd['market']}/25 ＋ 企業属性{bd['attr']}/25 ＋ 面談履歴{bd['interest']}/25")

            if row["DESCRIPTION"]:
                st.caption(row["DESCRIPTION"][:200] + "...")

            # 深掘り分析ボタン（上位5商品に表示）
            analysis_key = f"analysis_{selected_cid}_{row['PRODUCT_ID']}"
            col_a, col_b = st.columns([1, 3])
            with col_a:
                if st.button("🔬 AI 深掘り分析", key=f"btn_analysis_{row['PRODUCT_ID']}_{selected_cid}"):
                    with st.spinner("企業固有の詳細分析を生成中..."):
                        analysis = generate_deep_analysis(
                            row["PRODUCT_NAME"], row["DESCRIPTION"],
                            selected_company, alerts, fin_data, meetings_summary
                        )
                        st.session_state[analysis_key] = analysis
                        st.rerun()

            if analysis_key in st.session_state:
                analysis_text = st.session_state[analysis_key]
                st.markdown("---")
                sections = analysis_text.split("【")
                for s in sections:
                    if s.strip() and "】" in s:
                        title = s.split("】")[0]
                        body = s.split("】")[1].strip()
                        icon_map = {
                            "なぜ今": "💡", "定量": "📊", "CFO": "💰", "CHRO": "👥", "対応しない": "⚠"
                        }
                        icon = next((v for k, v in icon_map.items() if k in title), "📌")
                        st.markdown(f"**{icon} {title}**")
                        st.markdown(body)
                        st.markdown("")

with col_chart:
    st.markdown("**4軸スコア内訳（上位3商品）**")
    top3 = scored_df.head(3)
    fig = go.Figure()
    axes = ["事業イベント", "市場環境", "企業属性", "面談履歴"]
    colors = ["#E60012", "#F5A623", "#4A90D9"]
    for i, (_, row) in enumerate(top3.iterrows()):
        bd = row["BREAKDOWN"]
        values = [bd["event"], bd["market"], bd["attr"], bd["interest"]]
        fig.add_trace(go.Bar(
            name=row["PRODUCT_NAME"][:15],
            x=axes, y=values,
            marker_color=colors[i]
        ))
    fig.update_layout(
        barmode="group", height=350,
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
        yaxis=dict(title="スコア（各25点満点）", range=[0,25]),
        margin=dict(t=10, b=10)
    )
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")
    st.markdown("**📖 分析の見方**")
    st.caption("""
**事業イベント**: M&A・IPO等の直近イベントとの商品適合度  
**市場環境**: 金利水準・DB年金積立への影響度  
**企業属性**: 業種・規模・年金制度との適合度  
**面談履歴**: 過去の面談での関心・発言との一致度
    """)

st.markdown("---")
st.info("""
💬 **Snowflake CoWork でさらに深い分析が可能です**  
「KDDIの課題を踏まえて最適な保険商品を根拠付きで提案して」のように自然言語で聞くと、
面談記録・ニュース・市場データを組み合わせたインタラクティブな分析が行えます。
""")

col_btn1, col_btn2 = st.columns(2)
with col_btn1:
    if st.button("💬 Snowflake CoWork で詳細分析", type="primary"):
        st.info(f"Snowflake CoWork のチャット画面で「{selected_company['COMPANY_NAME']}の最適商品を詳しく説明して」と入力してください")
with col_btn2:
    if st.button("📄 DPを自動生成 →"):
        st.session_state["proposal_company"] = selected_cid
        st.session_state["proposal_company_name"] = selected_company["COMPANY_NAME"]
        st.switch_page("pages/06_proposal.py")
