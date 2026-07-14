"""
03_📊_見込み管理.py - 見込み管理ダッシュボード (F-03)
Pipedrive スタイルのカンバン + C→B昇格チェックリスト
"""
import streamlit as st
import pandas as pd
from snowflake.snowpark.context import get_active_session

st.set_page_config(page_title="見込み管理", layout="wide")
st.title("📊 見込み管理ダッシュボード")
st.caption("担当20社の見込みをランク別に管理。C→B昇格チェックリストで何が足りないかを一目で確認。")

session = get_active_session()

# データ取得
prospects_df = session.sql("""
    SELECT
        p.PROSPECT_ID, p.COMPANY_ID, c.COMPANY_NAME, c.INDUSTRY_LARGE,
        c.EMPLOYEE_COUNT, p.PRODUCT_ID, ip.PRODUCT_NAME,
        p.CURRENT_RANK, p.PROSPECT_AMOUNT, p.AI_SCORE,
        p.AI_SCORE_REASON, p.RANKUP_ACTIONS,
        p.LAST_EVENT_TRIGGER, p.DAYS_SINCE_CONTACT,
        ea.EVENT_TYPE AS LATEST_ALERT_TYPE,
        ea.INSURANCE_RELEVANCE AS LATEST_ALERT_REL
    FROM LIFEINSURANCE_DEMO_DB.RAW.T_PROSPECTS p
    JOIN LIFEINSURANCE_DEMO_DB.RAW.T_CUSTOMER_COMPANIES c ON p.COMPANY_ID = c.COMPANY_ID
    LEFT JOIN LIFEINSURANCE_DEMO_DB.RAW.T_INSURANCE_PRODUCTS ip ON p.PRODUCT_ID = ip.PRODUCT_ID
    LEFT JOIN (
        SELECT COMPANY_ID, EVENT_TYPE, INSURANCE_RELEVANCE,
               ROW_NUMBER() OVER (PARTITION BY COMPANY_ID ORDER BY DETECTED_AT DESC) AS RN
        FROM LIFEINSURANCE_DEMO_DB.RAW.T_EVENT_ALERTS WHERE STATUS = 'UNREAD'
    ) ea ON ea.COMPANY_ID = p.COMPANY_ID AND ea.RN = 1
    ORDER BY p.AI_SCORE DESC
""").to_pandas()

st.markdown("---")

# カンバンボード
col_labels = ["C ランク", "B ランク", "A ランク", "S ランク", "成約 ✅"]
rank_keys = ["C", "B", "A", "S", "DONE"]

st.subheader("📋 案件カンバンボード（Pipedrive スタイル）")
kanban_cols = st.columns(5)

for ci, (label, rkey) in enumerate(zip(col_labels, rank_keys)):
    with kanban_cols[ci]:
        subset = prospects_df[prospects_df["CURRENT_RANK"] == rkey] if rkey != "DONE" else pd.DataFrame()
        if not subset.empty:
            grouped = subset.groupby("COMPANY_NAME").agg(
                PROSPECT_AMOUNT=("PROSPECT_AMOUNT", "sum"),
                AI_SCORE=("AI_SCORE", "max"),
                DAYS_SINCE_CONTACT=("DAYS_SINCE_CONTACT", "min"),
                LATEST_ALERT_REL=("LATEST_ALERT_REL", "first"),
                CURRENT_RANK=("CURRENT_RANK", "first"),
                PRODUCT_COUNT=("PROSPECT_ID", "count"),
            ).reset_index().sort_values("AI_SCORE", ascending=False)
        else:
            grouped = pd.DataFrame()
        cnt = len(grouped)
        amt = grouped["PROSPECT_AMOUNT"].sum() / 1e8 if not grouped.empty else 0

        st.markdown(f"**{label}** &nbsp; <small>{cnt}件 / {amt:.1f}億円</small>", unsafe_allow_html=True)

        with st.container(height=400):
            for _, row in grouped.iterrows():
                alert_icon = {"最高": "🔴", "高": "🟡", "中": "🟢"}.get(row.get("LATEST_ALERT_REL"), "")
                score_color = "#E60012" if (row["AI_SCORE"] or 0) >= 75 else "#F5A623"
                days = row["DAYS_SINCE_CONTACT"] or 0
                contact_warn = "⚠" if days > 60 else ""
                rank = row["CURRENT_RANK"]
                rank_color = {"S": "#FFD700", "A": "#E60012", "B": "#F5A623", "C": "#4A90D9"}.get(rank, "#888")
                rank_badge = f'<span style="background:{rank_color};color:white;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:bold">{rank}</span>'
                cname = row['COMPANY_NAME'][:12]
                amt_str = f"{row['PROSPECT_AMOUNT']/1e8:.1f}"
                sc = f"{row['AI_SCORE']:.0f}"
                day_text = f"{days}日未接触" if days > 30 else ""
                prod_cnt = int(row.get("PRODUCT_COUNT", 1))
                prod_label = f" ({prod_cnt}商品)" if prod_cnt > 1 else ""
                card = f'<div style="background:white;border-radius:6px;padding:10px;box-shadow:0 1px 4px rgba(0,0,0,0.12);margin:4px 0;font-size:13px"><strong>{cname}</strong> {rank_badge} {alert_icon}{prod_label}<br/>💰 {amt_str}億円<br/>AI: <span style="color:{score_color};font-weight:bold">{sc}</span> {contact_warn} {day_text}</div>'
                st.markdown(card, unsafe_allow_html=True)

st.markdown("---")

# C→B昇格チェックリスト
st.subheader("📋 ランクアップ候補 - 昇格チェックリスト")

c_rank = prospects_df[prospects_df["CURRENT_RANK"].isin(["C", "B"])].drop_duplicates("COMPANY_ID")
c_rank_sorted = c_rank.sort_values(["CURRENT_RANK", "AI_SCORE"], ascending=[True, False])

if c_rank_sorted.empty:
    st.info("昇格候補の企業はありません")
else:
    selected_c = st.selectbox(
        "分析する企業を選択",
        c_rank_sorted.apply(lambda r: f"{r['COMPANY_NAME']} [{r['CURRENT_RANK']}→{'B' if r['CURRENT_RANK']=='C' else 'A'}]", axis=1).tolist()
    )
    selected_name = selected_c.split(" [")[0]
    selected_row = c_rank_sorted[c_rank_sorted["COMPANY_NAME"] == selected_name].iloc[0]

    col_score, col_check = st.columns([1, 2])

    with col_score:
        score = selected_row["AI_SCORE"] or 0
        st.markdown(f"**AI スコア: {score:.0f}/100**")
        st.progress(int(score) / 100)
        st.markdown(f"**最新イベント**: {selected_row.get('LATEST_ALERT_TYPE') or 'なし'}")
        st.markdown(f"**接触間隔**: {selected_row.get('DAYS_SINCE_CONTACT') or '?'}日")

        if selected_row.get("RANKUP_ACTIONS"):
            st.markdown("**AI 推奨アクション**:")
            for action in str(selected_row["RANKUP_ACTIONS"]).split("①"):
                if action.strip():
                    st.markdown(f"- ①{action.strip()[:80]}")

    with col_check:
        from_rank = selected_row["CURRENT_RANK"]
        to_rank = "B" if from_rank == "C" else "A"
        st.markdown(f"**{from_rank} → {to_rank} 昇格チェックリスト**")

        checklist = session.sql(f"""
            SELECT CHECK_ITEM, CHECK_CATEGORY, IS_REQUIRED
            FROM LIFEINSURANCE_DEMO_DB.RAW.T_PROSPECT_CHECKLIST_MASTER
            WHERE FROM_RANK = '{from_rank}' AND TO_RANK = '{to_rank}'
            ORDER BY DISPLAY_ORDER
        """).to_pandas()

        import random
        random.seed(hash(selected_c))
        done_count = 0
        total_required = checklist["IS_REQUIRED"].sum()

        for _, item in checklist.iterrows():
            # デモ用: AI スコアに基づいて完了状況を決定
            is_done = score > (40 + random.randint(0, 40))
            if is_done:
                done_count += 1
            check_icon = "✅" if is_done else "❌"
            req_badge = "**必須**" if item["IS_REQUIRED"] else "推奨"
            st.markdown(f"{check_icon} {item['CHECK_ITEM']} &nbsp; <small>{req_badge}</small>", unsafe_allow_html=True)

        progress_pct = done_count / len(checklist)
        st.markdown(f"\n**進捗: {done_count}/{len(checklist)}項目完了**")
        st.progress(progress_pct)

        if done_count >= total_required:
            st.success(f"✅ 必須項目をクリア！{to_rank}ランクに昇格可能です")
            st.markdown("---")
            st.markdown(f"**🏆 {from_rank} → {to_rank} ランク昇格の実行**")
            confirm = st.checkbox(f"「{selected_name}」を {from_rank} から {to_rank} に昇格させることを確認しました", key="confirm_rankup")
            if st.button(f"🏆 {to_rank}ランクに昇格する", type="primary", disabled=not confirm, key="btn_rankup"):
                try:
                    session.sql(f"""
                        UPDATE LIFEINSURANCE_DEMO_DB.RAW.T_PROSPECTS
                        SET CURRENT_RANK = '{to_rank}',
                            PREVIOUS_RANK = '{from_rank}',
                            UPDATED_AT = CURRENT_TIMESTAMP()
                        WHERE COMPANY_ID = '{selected_row['COMPANY_ID']}'
                          AND CURRENT_RANK = '{from_rank}'
                    """).collect()
                    st.success(f"🎉 {selected_name} を {from_rank} → {to_rank} ランクに昇格しました！")
                    st.balloons()
                    st.rerun()
                except Exception as e:
                    st.error(f"昇格処理エラー: {e}")
        else:
            remaining = int(total_required) - done_count
            st.warning(f"⚠ 残り{remaining}項目の必須確認が必要です")
