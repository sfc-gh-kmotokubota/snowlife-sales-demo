"""
07_prepare.py - 面談前準備（企業ブリーフィング + 想定Q&A生成）
"""
import streamlit as st
import pandas as pd
import re
from datetime import date
from snowflake.snowpark.context import get_active_session

st.set_page_config(page_title="面談前準備", layout="wide")
st.title("🎯 面談前準備（ブリーフィング + 想定Q&A）")
st.caption("面談の前に1クリックで企業情報を統合。先方から考えられる質問と回答例を事前に準備できます。")

session = get_active_session()

# 企業・面談情報選択
companies = session.sql("""
    SELECT COMPANY_ID, COMPANY_NAME, INDUSTRY_LARGE, EMPLOYEE_COUNT,
           PENSION_TYPE, PROSPECT_RANK, PREFECTURE
    FROM LIFEINSURANCE_DEMO_DB.RAW.T_CUSTOMER_COMPANIES
    ORDER BY PROSPECT_RANK, COMPANY_NAME
""").to_pandas()

col1, col2, col3 = st.columns([2, 1, 1])
with col1:
    rank_filter = st.selectbox("ランクで絞り込み", ["すべて", "A", "B", "C", "S"])
    filtered = companies if rank_filter == "すべて" else companies[companies["PROSPECT_RANK"] == rank_filter]
    company_options = {
        f"{r['COMPANY_NAME']} [{r['PROSPECT_RANK']}ランク]": r["COMPANY_ID"]
        for _, r in filtered.iterrows()
    }
    selected_label = st.selectbox("対象企業", list(company_options.keys()))
    selected_cid = company_options[selected_label]
    selected_company = companies[companies["COMPANY_ID"] == selected_cid].iloc[0]
with col2:
    meeting_date = st.date_input("面談予定日", value=date.today())
with col3:
    meeting_type = st.selectbox("面談形式", ["訪問", "オンライン", "電話"])

st.markdown("---")
col_a, col_b, col_c, col_d = st.columns(4)
col_a.metric("従業員数", f"{selected_company['EMPLOYEE_COUNT']:,}名")
col_b.metric("業種", selected_company["INDUSTRY_LARGE"])
col_c.metric("年金制度", selected_company["PENSION_TYPE"] or "未確認")
col_d.metric("見込みランク", selected_company["PROSPECT_RANK"])

# アラートデータをページロード時に取得（タブ間で共有）
alerts_data = session.sql(f"""
    SELECT EVENT_TYPE, EVENT_SUMMARY, INSURANCE_RELEVANCE, URGENCY_DAYS
    FROM LIFEINSURANCE_DEMO_DB.RAW.T_EVENT_ALERTS
    WHERE COMPANY_ID = '{selected_cid}' AND STATUS = 'UNREAD'
    ORDER BY CASE INSURANCE_RELEVANCE WHEN '最高' THEN 1 WHEN '高' THEN 2 ELSE 3 END
    LIMIT 3
""").to_pandas()

# タブ（1つだけ定義）
tab_brief, tab_qa = st.tabs(["📊 企業ブリーフィング", "💬 想定Q&A生成"])

# ════════════════════════════════════════
# タブ1: 企業ブリーフィング
# ════════════════════════════════════════
with tab_brief:
    st.subheader("📊 企業ブリーフィング")
    st.caption("社内データ（面談履歴・ニュース・財務・アラート）を統合してブリーフィングを自動生成。Snowflakeのプラットフォーム内でデータ処理が完結するため、機密情報を安全に扱えます")

    if st.button("📊 ブリーフィングを生成", type="primary", key="btn_briefing"):
        with st.spinner(f"{selected_company['COMPANY_NAME']} の情報を収集・統合中..."):
            news_data = session.sql(f"""
                SELECT HEADLINE, EVENT_TYPE, NEWS_DATE, INSURANCE_RELEVANCE
                FROM LIFEINSURANCE_DEMO_DB.RAW.T_COMPANY_NEWS
                WHERE COMPANY_ID = '{selected_cid}'
                ORDER BY NEWS_DATE DESC LIMIT 5
            """).to_pandas()

            meetings_data = session.sql(f"""
                SELECT mt.TRANSCRIPT_TEXT, m.MEETING_DATE, m.MEETING_TYPE
                FROM LIFEINSURANCE_DEMO_DB.RAW.T_MEETING_TRANSCRIPTS mt
                JOIN LIFEINSURANCE_DEMO_DB.RAW.T_MEETINGS m ON mt.MEETING_ID = m.MEETING_ID
                WHERE m.COMPANY_ID = '{selected_cid}'
                ORDER BY m.MEETING_DATE DESC LIMIT 10
            """).to_pandas()

            fin_data = session.sql(f"""
                SELECT FISCAL_YEAR, REVENUE_JPY
                FROM LIFEINSURANCE_DEMO_DB.RAW.T_FINANCIAL_DATA
                WHERE COMPANY_ID = '{selected_cid}'
                ORDER BY FISCAL_YEAR DESC LIMIT 3
            """).to_pandas()

            news_text = "\n".join([f"・{r['NEWS_DATE']} [{r['EVENT_TYPE']}] {r['HEADLINE']}" for _, r in news_data.iterrows()]) if not news_data.empty else "なし"
            alert_text = "\n".join([f"・{r['EVENT_TYPE']}（{r['INSURANCE_RELEVANCE']}優先度）: {str(r['EVENT_SUMMARY'])[:80]}..." for _, r in alerts_data.iterrows()]) if not alerts_data.empty else "なし"
            meeting_text = "\n".join([str(r["TRANSCRIPT_TEXT"])[:100] for _, r in meetings_data.head(5).iterrows()]) if not meetings_data.empty else "なし"
            fin_text = "\n".join([f"・{r['FISCAL_YEAR']}年度: 売上{r['REVENUE_JPY']/1e12:.2f}兆円" for _, r in fin_data.iterrows()]) if not fin_data.empty else "なし"

            context = f"""企業名: {selected_company['COMPANY_NAME']}
業種: {selected_company['INDUSTRY_LARGE']}
従業員数: {selected_company['EMPLOYEE_COUNT']:,}名
年金制度: {selected_company['PENSION_TYPE'] or '未確認'}
最新ニュース: {news_text}
未読アラート: {alert_text}
過去面談抜粋: {meeting_text}
財務情報: {fin_text}"""
            c_sql = context.replace("'", "''").replace("\\", "")

            try:
                raw = session.sql(f"""
                    SELECT AI_COMPLETE('mistral-large2', CONCAT(
                        '以下の情報を元に、保険営業担当者向けの面談前ブリーフィングを作成してください。
                         マークダウン記法は使わないこと。各セクションは実際に改行を入れること。
                         以下の構成で日本語で出力:
                         【企業概要・直近トピック】（2-3文）
                         【保険提案の最重要イベント】（箇条書き2-3点）
                         【過去面談からの重要課題】（箇条書き）
                         【今回の面談の推奨アプローチ】（3ステップ）
                         【事前に確認すべき数字・情報】（2-3点）
                         企業情報:{c_sql}')) AS BRIEF
                """).collect()[0]["BRIEF"]
                brief = raw.replace('\\n', '\n').replace('\\t', ' ').strip('"').strip("'")
                brief = re.sub(r'^#{1,6}\s*', '', brief, flags=re.MULTILINE)
                brief = re.sub(r'\*\*(.+?)\*\*', r'\1', brief)
            except:
                brief = f"""【企業概要・直近トピック】
{selected_company['COMPANY_NAME']}は{selected_company['INDUSTRY_LARGE']}の大手企業（従業員{selected_company['EMPLOYEE_COUNT']:,}名）。
{news_data.iloc[0]['HEADLINE'] if not news_data.empty else '直近の主要ニュースを確認してください。'}

【保険提案の最重要イベント】
{alert_text if alert_text != "なし" else "・最新ニュースを確認してください"}

【過去面談からの重要課題】
・退職給付制度の見直し（DC移行検討）
・従業員の福利厚生充実（GLTD未整備）

【今回の面談の推奨アプローチ】
STEP1: 前回面談のフォローアップ（宿題確認）
STEP2: 最新事業イベントに基づく提案
STEP3: 次回面談日程の確定

【事前に確認すべき数字・情報】
・現在の団体保険の年間保険料と保険会社名
・DC加入率と運用商品の現状"""

            st.session_state[f"briefing_{selected_cid}"] = brief
            st.rerun()

    if f"briefing_{selected_cid}" in st.session_state:
        brief = st.session_state[f"briefing_{selected_cid}"]
        col_b1, col_b2 = st.columns(2)
        sections = brief.split("【")
        left_sections = [s for i, s in enumerate(sections) if i % 2 == 0 and s.strip()]
        right_sections = [s for i, s in enumerate(sections) if i % 2 == 1 and s.strip()]
        with col_b1:
            for s in left_sections[:3]:
                if s.strip() and "】" in s:
                    st.markdown(f"**【{s.split('】')[0]}】**")
                    st.markdown(s.split("】")[1].strip())
                    st.markdown("")
        with col_b2:
            for s in right_sections[:3]:
                if s.strip() and "】" in s:
                    st.markdown(f"**【{s.split('】')[0]}】**")
                    st.markdown(s.split("】")[1].strip())
                    st.markdown("")
        with st.expander("📄 全文テキスト（編集・コピー用）"):
            st.text_area("ブリーフィング全文", value=brief, height=250, key="brief_text")

    if not alerts_data.empty:
        st.markdown("---")
        st.markdown("#### 🚨 今週中に対応すべきアラート")
        for _, row in alerts_data.iterrows():
            icon = {"最高": "🔴", "高": "🟡", "中": "🟢"}.get(row["INSURANCE_RELEVANCE"], "⚪")
            st.markdown(f"{icon} **{row['EVENT_TYPE']}**（{row['INSURANCE_RELEVANCE']}優先度 / {row.get('URGENCY_DAYS', '?')}日以内）")
            st.caption(str(row["EVENT_SUMMARY"])[:120] + "...")

# ════════════════════════════════════════
# タブ2: 想定Q&A生成
# ════════════════════════════════════════
with tab_qa:
    st.subheader("💬 想定Q&A生成")
    st.caption("商品の保障内容・企業属性を組み合わせた根拠付きQ&Aを生成。保険業法に沿った表現でそのまま使えます。")

    products = session.sql("""
        SELECT PRODUCT_ID, PRODUCT_NAME, PRODUCT_CATEGORY, DESCRIPTION,
               TARGET_AUDIENCE, MIN_EMPLOYEES
        FROM LIFEINSURANCE_DEMO_DB.RAW.T_INSURANCE_PRODUCTS
        ORDER BY PRODUCT_CATEGORY, PRODUCT_ID
    """).to_pandas()

    selected_products = st.multiselect(
        "Q&Aを生成する商品を選択（複数可）",
        products["PRODUCT_NAME"].tolist(),
        default=products["PRODUCT_NAME"].head(2).tolist(),
    )
    qa_count = st.slider("生成するQ&A件数", min_value=3, max_value=8, value=5)

    if st.button("💬 想定Q&Aを生成", type="primary", key="btn_qa", disabled=not selected_products):
        with st.spinner("想定Q&Aを生成中..."):
            products_info = products[products["PRODUCT_NAME"].isin(selected_products)]
            products_text = ""
            for _, row in products_info.iterrows():
                desc = str(row["DESCRIPTION"])[:200] if row["DESCRIPTION"] else ""
                products_text += f"\n商品名: {row['PRODUCT_NAME']}\nカテゴリ: {row['PRODUCT_CATEGORY']}\n概要: {desc}\n"

            ctx_sql = f"""企業名: {selected_company['COMPANY_NAME']}
業種: {selected_company['INDUSTRY_LARGE']}
従業員数: {selected_company['EMPLOYEE_COUNT']:,}名
年金制度: {selected_company['PENSION_TYPE'] or '未確認'}
提案商品: {', '.join(selected_products)}
商品詳細: {products_text[:500]}""".replace("'", "''").replace("\\", "")

            try:
                raw_qa = session.sql(f"""
                    SELECT AI_COMPLETE('mistral-large2', CONCAT(
                        '以下の情報を元に、保険営業の面談で先方（人事部長・CFO等）が聞いてきそうな
                         質問と、営業担当者の回答例を{qa_count}件作成してください。
                         条件:
                         1. マークダウン記法（#、**、*）は一切使わないこと
                         2. 保険業法に沿った表現（断定的な利益提示をしない）
                         3. 企業の業種・規模・年金制度に応じた個別感のある回答
                         4. 必ず以下の形式で出力（各Q&Aを空行で区切る）:
                         Q: 質問内容
                         A: 回答内容（2-3文）
                         以下を必ず含めること: 保険料・保障範囲・他社との違い・導入期間
                         企業情報と商品情報: {ctx_sql}')) AS QA
                """).collect()[0]["QA"]
                qa_text = raw_qa.replace('\\n', '\n').replace('\\t', ' ').strip('"').strip("'")
                qa_text = re.sub(r'^#{1,6}\s*', '', qa_text, flags=re.MULTILINE)
                qa_text = re.sub(r'\*\*(.+?)\*\*', r'\1', qa_text)
            except:
                qa_text = f"""Q: 年間保険料の目安を教えてください。
A: 御社の従業員{selected_company['EMPLOYEE_COUNT']:,}名・{selected_company['INDUSTRY_LARGE']}業種を踏まえると、試算ベースで年間数百万円から数千万円の範囲となる場合が多いです。詳細は従業員構成や保障内容により変わりますので、正式な試算をご提供いたします。

Q: 保障範囲はどこまでですか？
A: 商品により異なりますが、死亡・高度障がい・就業不能等をカバーする設計です。詳細は約款をご確認いただくか、担当者にご相談ください。

Q: 他の生命保険会社と何が違いますか？
A: スノー生命は国内最大規模の生命保険会社として27万社以上の法人顧客との取引実績があります。Wellness-Star☆などの健康経営支援サービスや年金運用連携など、保険以外の総合サービスも提供できる点が特徴です。

Q: 導入にはどれくらいの時間がかかりますか？
A: 一般的に制度設計から保険開始まで3〜6ヶ月を目安としています。御社のスケジュールに合わせて柔軟に対応いたします。

Q: 健康経営優良法人の認定取得に活用できますか？
A: はい、GLTDや団体医療保険は健康経営優良法人の評価項目に直接関連しています。Wellness-Star☆と組み合わせることで認定要件の充足を体系的に支援できます。"""

            st.session_state[f"qa_{selected_cid}"] = qa_text

    if f"qa_{selected_cid}" in st.session_state:
        qa_text = st.session_state[f"qa_{selected_cid}"]
        st.markdown("---")
        qa_blocks = [b.strip() for b in qa_text.split("\n\n") if b.strip() and "Q:" in b]
        if not qa_blocks:
            qa_blocks = []
            current = []
            for line in qa_text.split("\n"):
                if line.startswith("Q:") and current:
                    qa_blocks.append("\n".join(current))
                    current = [line]
                else:
                    current.append(line)
            if current:
                qa_blocks.append("\n".join(current))

        if qa_blocks:
            for i, block in enumerate(qa_blocks):
                lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
                q_line = next((l for l in lines if l.startswith("Q:")), None)
                a_line = " ".join(l for l in lines if not l.startswith("Q:") and lines.index(l) > 0)
                if q_line:
                    with st.expander(f"❓ {q_line[2:].strip()}", expanded=i < 3):
                        a_text = a_line[2:].strip() if a_line.startswith("A:") else a_line
                        st.info(a_text)
                        st.caption("※ 実際の提案では最新の約款・試算をご確認ください。")
        else:
            st.text_area("生成されたQ&A", value=qa_text, height=300, key="qa_display")

        col_d1, col_d2 = st.columns(2)
        with col_d1:
            st.download_button(
                "📄 Q&Aをテキストでダウンロード",
                data=qa_text,
                file_name=f"QA_{selected_company['COMPANY_NAME']}_{meeting_date}.txt",
                mime="text/plain"
            )
        with col_d2:
            if st.button("📊 DPに反映 →", key="to_proposal"):
                st.session_state["proposal_company_name"] = selected_company["COMPANY_NAME"]
                st.switch_page("pages/06_proposal.py")

    st.markdown("---")
    st.subheader("✅ 面談前チェックリスト")
    checks = [
        "DP・試算資料を印刷（または PDF を用意）した",
        "前回面談の宿題・未回答事項を確認した",
        "最新ニュース・アラートを把握している",
        "先方の担当者名（部署・役職）を確認した",
        "競合他社の状況を確認した",
        "コンプライアンス上の注意事項を確認した",
    ]
    done = sum(1 for c in checks if st.checkbox(c, key=f"check_{hash(c)}"))
    st.progress(done / len(checks))
    if done == len(checks):
        st.success("✅ 面談準備完了！")
    else:
        st.caption(f"{done}/{len(checks)} 項目完了")
