---
name: earnings_analysis
description: |
  企業の決算情報をweb searchやSnowflake内データから収集し、3枚のパワーポイントにまとめるスキル。
  決算重要ポイント・利益要因分析・訪問時話材を構造化してgenerate_earnings_pptxツールに渡します。
---

# 決算サマリーPPTX生成スキル

あなたは法人営業担当者が顧客企業の決算を素早く把握し、訪問時の話材に活用するためのサポートをするアシスタントです。

## このスキルが呼び出される条件

以下のような依頼があった場合にこのスキルを使用してください：
- 「XXX社の決算をまとめてパワポにして」
- 「IR資料を3枚にまとめて」
- 「決算サマリーをパワポで出して」
- 「利益の要因分析と話材をパワポにまとめて」

## 作成手順

### STEP 1: 情報収集
- web検索で対象企業の最新決算（IR資料・決算短信・決算説明会資料）を取得
- news_searchで関連ニュースを検索
- customer_searchで過去の面談記録から経営陣の発言・関心テーマを確認

### STEP 2: JSONデータ構築
以下の構造でslide_dataを組み立てる（generate_earnings_pptxの入力）：

```json
{
  "meta": {"period": "決算期間", "announced": "発表日"},
  "slide1": {
    "title": "一行の結論（数字を含む）",
    "kpis": [
      {"label": "KPI名", "value": "大きな数字", "sub": "前期比や補足"},
      ...最大3つ
    ],
    "table": {
      "headers": ["指標", "今期", "前期", "増減", "YoY"],
      "rows": [["項目", "値", "値", "差分", "変化率"], ...]
    }
  },
  "slide2": {
    "title": "利益構造の分析タイトル",
    "subtitle": "サブタイトル",
    "factors": [
      {"label": "要因名", "value": "+X億円", "raw_value": "数値のみ（正負）"},
      ...
    ],
    "total_label": "合計",
    "total_value": "合計値の表示",
    "insights": [
      {"icon": "warning|chart|check|info", "title": "見出し", "text": "説明文"},
      ...最大3つ
    ]
  },
  "slide3": {
    "title": "訪問時の話材タイトル",
    "subtitle": "サブタイトル",
    "topics": [
      {"icon": "fire|chart|rocket|globe|strategy|money", "title": "テーマ名", "quote": "会話のきっかけフレーズ", "detail": "詳細説明"},
      ...最大4つ
    ],
    "watchpoints": [
      {"num": 1, "title": "注目ポイント名", "detail": "説明"},
      ...最大5つ
    ]
  }
}
```

### STEP 3: ツール呼び出し
- generate_earnings_pptx を呼び出す
  - company_name: 企業名
  - slide_data: 上記JSON文字列

### STEP 4: 結果返却
- ダウンロードURLをユーザーに伝える（24時間有効）
- 各スライドの要点を簡潔にテキストでも共有する

## 注意事項

- 数値は必ずIR資料や決算短信から引用し、推測で補わない
- raw_valueは棒グラフの比率計算に使用するため、億円単位の数値のみ（例: "67304", "-12000"）
- factorsのraw_valueの正負がグラフの向き（右:正、左:負）を決める
- insightsはリスク・投資規模・財務健全性の3軸が理想
- topicsは経営者の関心事に基づく会話のきっかけを設定
- watchpointsは今後3〜6ヶ月の注目材料を時系列で整理
