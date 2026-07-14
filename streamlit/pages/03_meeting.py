"""
02_meeting.py - 面談録音・会話ログ読み込み・AI要約・コンプライアンス検知・Salesforce登録
"""
import streamlit as st
import pandas as pd
import json
from datetime import date
from snowflake.snowpark.context import get_active_session

st.set_page_config(page_title="面談録音・要約", layout="wide")
st.title("🎙 面談録音・AI要約・コンプライアンス検知")
st.caption("音声ファイルまたは会話ログを読み込んで、要約・コンプライアンスチェック・ネクストアクション提案を自動化。")

session = get_active_session()

# 企業選択
companies = session.sql("""
    SELECT COMPANY_ID, COMPANY_NAME FROM LIFEINSURANCE_DEMO_DB.RAW.T_CUSTOMER_COMPANIES ORDER BY COMPANY_NAME
""").to_pandas()

col1, col2, col3 = st.columns(3)
with col1:
    company_options = {r["COMPANY_NAME"]: r["COMPANY_ID"] for _, r in companies.iterrows()}
    selected_company_name = st.selectbox("対象企業", list(company_options.keys()))
    selected_cid = company_options[selected_company_name]
with col2:
    meeting_date = st.date_input("面談日", value=date.today())
with col3:
    meeting_type = st.selectbox("面談種別", ["訪問", "オンライン", "電話"])

# ────────────────────────────────────────
# ダミー会話ログデータ（企業別）
# ────────────────────────────────────────
DUMMY_LOGS = {
    "C014": """\
山田（スノー生命）: 本日はお時間をいただきありがとうございます。先日のKDDI様のプレスリリースを拝見しまして、IT・DX人材の採用強化をされているとのことで、従業員への福利厚生についてご提案があってまいりました。
前田CHRO（KDDI）: ありがとうございます。実は最近、IT人材の採用競争が非常に激しくて、処遇面での差別化が課題になっているんです。
山田（スノー生命）: そのような課題に対して、GLTDという団体長期障害所得補償保険が非常に有効です。外資系IT企業が標準的に提供している制度で、長期就業不能時に給与の最大80%を補償できます。
前田CHRO（KDDI）: それは確かに魅力的ですね。でも保険料はどの程度になるんでしょうか。それと現在のDC年金制度も見直したいと思っています。
山田（スノー生命）: DC年金については、現在の金利環境（10年金利1.45%）を考えると、マッチング拠出の上限引き上げや運用商品の見直しが非常に効果的なタイミングです。GLTDとセットでご提案できると思います。
野沢部長（KDDI人事）: 保険料の試算と、DC見直しの具体案を次回持ってきていただけますか？経営会議への説明資料も必要です。
山田（スノー生命）: 承知しました。来週中に試算と提案書を送付いたします。GLTD導入で採用競争力が向上することは、実際に他社の導入事例でも証明されています。確実に差別化につながると思いますので、ぜひ前向きにご検討ください。
前田CHRO（KDDI）: はい、期待しています。次回は役員も同席させますので、2週間後の木曜日はどうでしょうか？
""",
    "C002": """\
山田（スノー生命）: パナソニック様の買収完了のニュースを拝見しました。統合後の福利厚生制度についてご相談させていただければと思います。
中村専務（パナソニックHD）: そうなんです。被買収企業の従業員が約2800名いて、保険制度の統合が急務になっています。現在バラバラな制度をどう一本化するか悩んでいます。
山田（スノー生命）: 制度統合のお手伝いができると思います。まず総合福祉団体定期保険で死亡保障を統合し、次に企業年金（DB/DC）の移行計画を策定するのがセオリーです。
松本課長（パナソニック人事）: 年金について言うと、旧来のDBをDCに移行したいというのがCFOの意向です。積立不足も少し出ていますが、金利が上がっているので今がチャンスと思っています。
山田（スノー生命）: まさにその通りです。現在の金利水準だとDB積立が改善傾向にありますので、DC移行のタイミングとして最適です。CFOには退職給付費用の安定化という観点でご提案できます。
中村専務（パナソニックHD）: 分かりました。来月のCFOとのミーティングに同席してもらえますか？資料を準備してきてください。
山田（スノー生命）: はい、ぜひお願いします。DC移行の試算シミュレーションと、統合スケジュール案を準備いたします。
""",
    "DEFAULT": """\
山田（スノー生命）: 本日はよろしくお願いいたします。御社の従業員向け保険制度についてお伺いできればと思います。
人事部長（先方）: こちらこそよろしくお願いします。実は健康経営の取り組みを強化したいと考えていまして、従業員の休業補償を厚くしたいと思っています。
山田（スノー生命）: GLTDという所得補償保険がございまして、長期休業時に給与の最大80%を補償できます。健康経営優良法人の認定にも貢献できます。
人事部長（先方）: それは興味深いです。保険料はどの程度になりますか？また来年の健康経営優良法人の申請にも活用できますか？
山田（スノー生命）: はい、健康経営の文脈でご提案できます。具体的な試算を来週中にお持ちします。Wellness-Star☆という健康増進サービスとセットにすると認定取得の支援も可能です。
人事部長（先方）: それはいいですね。次回の商談には予算担当のCFOも同席させます。来月の第2週でいかがでしょうか。
山田（スノー生命）: ありがとうございます。ぜひよろしくお願いします。提案書と試算を事前にお送りします。
""",
}

# ────────────────────────────────────────
# 入力タブ
# ────────────────────────────────────────
st.markdown("---")
tab_audio, tab_log, tab_file = st.tabs(["🎤 音声ファイル", "📝 会話ログ貼り付け", "📂 ファイル読み込み（CSV/TXT）"])

transcript = ""
input_mode = None

with tab_audio:
    st.caption("音声ファイルをアップロードすると文字起こし（デモ: サンプルテキストを使用）")
    uploaded_audio = st.file_uploader(
        "音声ファイルをドラッグ＆ドロップ またはクリックしてアップロード",
        type=["wav", "mp3", "m4a", "mp4"],
        key="audio_upload",
        help="対応フォーマット: WAV / MP3 / M4A / MP4（最大100MB）"
    )
    if st.button("▶ 文字起こし・AI分析を実行", type="primary", key="btn_audio"):
        t = DUMMY_LOGS.get(selected_cid, DUMMY_LOGS["DEFAULT"])
        if uploaded_audio:
            t = f"（音声ファイル: {uploaded_audio.name}）\n" + t
        st.session_state["meeting_transcript"] = t
        st.session_state["meeting_company"] = selected_cid
        st.session_state["meeting_trigger"] = True
        st.rerun()

with tab_log:
    st.caption("面談後の会話メモや録音文字起こし結果をそのまま貼り付けてください")

    col_btn_dummy, col_spacer = st.columns([1, 3])
    with col_btn_dummy:
        if st.button("📋 ダミーデータで試す", key="btn_dummy"):
            dummy = DUMMY_LOGS.get(selected_cid, DUMMY_LOGS["DEFAULT"])
            st.session_state["log_text"] = dummy
            st.session_state["log_textarea"] = dummy  # widgetのコンテンツも直接更新
            st.rerun()

    log_text = st.text_area(
        "会話ログ（発言者名: テキスト の形式）",
        height=220,
        placeholder="例）\n山田（スノー生命）: 本日はご訪問ありがとうございます。\n担当者（先方）: こちらこそよろしくお願いします。",
        key="log_textarea"
    )
    if st.button("▶ 会話ログを AI 分析", type="primary", key="btn_log", disabled=not log_text.strip()):
        st.session_state["meeting_transcript"] = log_text
        st.session_state["meeting_company"] = selected_cid
        st.session_state["meeting_trigger"] = True
        st.rerun()

with tab_file:
    st.caption("CSV（speaker,text 形式）または TXT ファイルをアップロードしてください")
    uploaded_log = st.file_uploader(
        "会話ログファイルをアップロード",
        type=["csv", "txt"],
        key="log_upload"
    )
    if uploaded_log:
        try:
            if uploaded_log.name.endswith(".csv"):
                df_log = pd.read_csv(uploaded_log)
                if "speaker" in df_log.columns and "text" in df_log.columns:
                    log_from_file = "\n".join([f"{r['speaker']}: {r['text']}" for _, r in df_log.iterrows()])
                else:
                    log_from_file = uploaded_log.read().decode("utf-8")
            else:
                log_from_file = uploaded_log.read().decode("utf-8")
            st.text_area("読み込んだ内容（確認）", value=log_from_file[:500] + ("..." if len(log_from_file) > 500 else ""), height=150, disabled=True)
            if st.button("▶ このログを AI 分析", type="primary", key="btn_file"):
                st.session_state["meeting_transcript"] = log_from_file
                st.session_state["meeting_company"] = selected_cid
                st.session_state["meeting_trigger"] = True
                st.rerun()
        except Exception as e:
            st.error(f"ファイル読み込みエラー: {e}")

# ────────────────────────────────────────
# AI 分析（要約・コンプラ・ネクストアクション）
# ────────────────────────────────────────
if st.session_state.get("meeting_trigger") and st.session_state.get("meeting_company") == selected_cid:
    st.session_state.pop("meeting_trigger", None)

    transcript_for_ai = st.session_state.get("meeting_transcript", "")
    with st.spinner("AI が面談内容を分析中..."):
        t_sql = transcript_for_ai[:2000].replace("'", "''").replace("\\", "")

        def clean_ai(text):
            import re
            t = text.replace('\\n', '\n').replace('\\t', ' ')
            t = re.sub(r'^#{1,6}\s*', '', t, flags=re.MULTILINE)
            t = re.sub(r'\*\*(.+?)\*\*', r'\1', t)
            t = re.sub(r'\*(.+?)\*', r'\1', t)
            t = t.strip('"').strip("'").strip()
            return t

        # 要約
        try:
            raw_summary = session.sql(f"""
                SELECT AI_COMPLETE('mistral-large2', CONCAT(
                    '以下の保険営業の面談内容を要約してください。マークダウン記法は一切使わないこと。
                     以下の形式で日本語で出力してください（各セクションは実際に改行を入れること）:
                     【面談概要】（2-3文）
                     【先方の主な関心事項】（箇条書き3点、各行頭に「・」）
                     【事業イベント関連の発言】（あれば。なければ「なし」）
                     【合意事項・ペンディング】（各 1-2 点）
                     面談内容：{t_sql}')) AS SUMMARY
            """).collect()[0]["SUMMARY"]
            summary_result = clean_ai(raw_summary)
        except:
            summary_result = f"""【面談概要】
{selected_company_name}との面談を実施。保険制度の見直しについて詳細なヒアリングを行った。

【先方の主な関心事項】
・従業員の休業補償制度の強化（GLTD導入検討）
・健康経営優良法人認定取得に向けた支援
・退職給付制度の見直し（DC移行検討）

【事業イベント関連の発言】
なし

【合意事項・ペンディング】
・合意: 来月中に具体的な試算と提案書を提示
・ペンディング: 予算規模の確認（次回商談時）"""

        # ネクストアクション
        try:
            raw_actions = session.sql(f"""
                SELECT AI_COMPLETE('mistral-large2', CONCAT(
                    '以下の保険営業の面談内容から、営業担当者が次回までに取るべきアクションを3〜5件提案してください。
                     マークダウン記法は一切使わないこと。必ず以下の形式で出力（各行1アクション）:
                     「【優先度: 高/中/低】期限: XX | 内容」
                     面談内容：{t_sql}')) AS ACTIONS
            """).collect()[0]["ACTIONS"]
            next_actions_raw = clean_ai(raw_actions)
        except:
            next_actions_raw = """【優先度: 高】期限: 今週中 | GLTD・DC試算シミュレーション資料を作成する
【優先度: 高】期限: 来週中 | 試算と提案書を担当者にメール送付する
【優先度: 中】期限: 今月中 | 役員同席の次回商談日程を確定する
【優先度: 中】期限: 来月第2週 | CFO向けの退職給付費用削減シミュレーションを準備する
【優先度: 低】期限: 随時 | 他社GLTD導入事例を収集してまとめる"""

        st.session_state["meeting_summary"] = summary_result
        st.session_state["meeting_next_actions"] = next_actions_raw

# ────────────────────────────────────────
# 分析結果表示
# ────────────────────────────────────────
if "meeting_summary" in st.session_state and st.session_state.get("meeting_company") == selected_cid:
    st.markdown("---")
    transcript_for_check = st.session_state.get("meeting_transcript", "")

    col_summary, col_right = st.columns([1, 1])

    with col_summary:
        st.subheader("📋 AI 面談要約")
        st.text_area("面談要約（編集可）", value=st.session_state["meeting_summary"], height=220, key="summary_edit")

        st.subheader("✅ AI 推奨ネクストアクション")
        next_actions = st.session_state.get("meeting_next_actions", "")
        for line in next_actions.strip().split("\n"):
            if line.strip():
                if "高" in line:
                    st.markdown(f"🔴 {line.strip()}")
                elif "中" in line:
                    st.markdown(f"🟡 {line.strip()}")
                else:
                    st.markdown(f"🟢 {line.strip()}")

    with col_right:
        st.subheader("🛡 コンプライアンスチェック")
        try:
            tc_sql = transcript_for_check[:1500].replace("'", "''").replace("\\", "")
            comp_result = session.sql(f"""
                SELECT AI_CLASSIFY(
                    '{tc_sql}',
                    ARRAY_CONSTRUCT('問題なし', '注意表現あり（確認推奨）', '違反リスクあり（要修正）'),
                    OBJECT_CONSTRUCT(
                        'task_description',
                        '保険業法・金融商品取引法の観点から断定的判断の提供・不当勧誘・虚偽説明に該当する表現がないか分類してください。禁止表現例: 確実に/絶対に/元本保証/損はしない/今だけの条件/必ず上がります'
                    )
                ) AS RESULT
            """).collect()[0]["RESULT"]
            result_dict = json.loads(comp_result) if isinstance(comp_result, str) else comp_result
            label = (result_dict.get("label")
                     or (result_dict.get("labels") or ["問題なし"])[0]
                     or "問題なし")
        except:
            # "確実に" が含まれているかでデモ判定
            label = "注意表現あり（確認推奨）" if "確実に" in transcript_for_check else "問題なし"

        if label == "問題なし":
            st.success("🟢 コンプライアンス問題なし")
            st.markdown("今回の面談内容にコンプライアンス上の問題は検出されませんでした。")
        elif label == "注意表現あり（確認推奨）":
            st.warning("⚠️ 注意表現が検出されました")
            st.markdown("""
**検出された可能性がある表現例**:
- 「確実に〜」「必ず〜」→ 将来を断定する表現は禁止
- 「絶対に損しない」→ 元本保証の示唆

**修正例**: 「過去実績では〜の傾向にありますが、将来の運用を保証するものではございません」
            """)
        else:
            st.error("🔴 コンプライアンス違反リスクがあります。上司への報告と表現修正が必要です。")

        st.markdown("---")
        st.subheader("📊 会話ログ（確認用）")
        with st.expander("テキスト表示", expanded=False):
            st.text(transcript_for_check[:1000] + ("..." if len(transcript_for_check) > 1000 else ""))

    # 保存・SF登録ボタン
    st.markdown("---")
    btn_col1, btn_col2, btn_col3 = st.columns(3)

    with btn_col1:
        if st.button("💾 面談記録を保存", type="primary"):
            meet_id = f"MTG_NEW_{selected_cid}_{meeting_date}"
            try:
                session.sql(f"""
                    INSERT INTO LIFEINSURANCE_DEMO_DB.RAW.T_MEETINGS VALUES (
                        '{meet_id}', '{selected_cid}', 'SR001', '{meeting_date}',
                        '{meeting_type}', 60, '{selected_company_name} 本社',
                        '面談録音・会話ログからの自動生成', NULL, 'COMPLETED', 'COMPLETED', CURRENT_TIMESTAMP())
                """).collect()
                st.success("✅ 面談記録を保存しました")
            except Exception as e:
                st.warning(f"保存: {e}")

    with btn_col2:
        if st.button("📤 Snowflake CoWork に送信"):
            st.info(f"💡 SI で「{selected_company_name}の今日の面談を振り返り、次回アクションを提案して」と入力してください")

    with btn_col3:
        if st.button("🔗 Salesforce に登録", type="secondary"):
            st.success(f"✅ Salesforce に面談記録を登録しました（デモ）\n活動記録: 「面談 - {selected_company_name} / {meeting_date}」")
