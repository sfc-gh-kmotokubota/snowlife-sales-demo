/** App title — displayed in the nav header and browser tab */
export const APP_TITLE = "法人営業支援AI"

/** Sub-label shown next to the title in the header */
export const APP_SUBTITLE = "スノー生命 法人営業部"

/** Path to the logo in /public (used in the header and as favicon) */
export const LOGO_SRC = "/icon.svg"

/** Snowflake objects this app reads from */
export const DB = "LIFEINSURANCE_DEMO_DB"
export const RAW = `${DB}.RAW`
export const ANALYTICS = `${DB}.ANALYTICS`
export const AI_SCHEMA = `${DB}.AI`
export const SEARCH_SCHEMA = `${DB}.SEARCH`

/** Cortex model used for all generative features */
export const CORTEX_MODEL = "claude-sonnet-5"

/**
 * The five stages of the corporate sales workflow. Rendered as a stepper on
 * every page so the user always knows where in the process they are.
 */
export const WORKFLOW_STAGES = [
  { id: "select", no: "1", label: "お客様選定", href: "/attack-list", tasks: ["求人シグナルの確認", "条件の設定", "アタックリスト"] },
  { id: "prepare", no: "2", label: "事前準備", href: "/customers", tasks: ["企業基本情報把握", "課題・ニーズの仮説構築", "ヒアリング内容とアプローチの検討"] },
  { id: "meeting", no: "3", label: "商談", href: "/meetings", tasks: ["録音", "要約", "書き起こし"] },
  { id: "review", no: "4", label: "振り返り", href: "/meetings?stage=review", tasks: ["フィードバック", "課題・ニーズ精緻化"] },
  { id: "revisit", no: "5", label: "再訪問", href: "/proposals", tasks: ["提案ストーリー・提案書作成"] },
] as const

export type WorkflowStageId = (typeof WORKFLOW_STAGES)[number]["id"]

/** Attack grade → badge colour class */
export const GRADE_STYLES: Record<string, string> = {
  S: "bg-rose-600 text-white",
  A: "bg-amber-500 text-white",
  B: "bg-sky-600 text-white",
  C: "bg-slate-400 text-white",
}

/** Trigger label → badge colour class */
export const TRIGGER_STYLES: Record<string, string> = {
  満期接近: "bg-rose-50 text-rose-700 border-rose-200",
  キーマン未接触: "bg-orange-50 text-orange-700 border-orange-200",
  接点劣化: "bg-amber-50 text-amber-700 border-amber-200",
  求人シグナル強: "bg-sky-50 text-sky-700 border-sky-200",
  事業イベント: "bg-violet-50 text-violet-700 border-violet-200",
  契約空白大: "bg-emerald-50 text-emerald-700 border-emerald-200",
  離職率高: "bg-pink-50 text-pink-700 border-pink-200",
  健康経営未着手: "bg-teal-50 text-teal-700 border-teal-200",
  DC移行検討: "bg-indigo-50 text-indigo-700 border-indigo-200",
  定期フォロー: "bg-slate-50 text-slate-600 border-slate-200",
}

/** The seven insurance-need signals derived from job postings */
export const SIGNAL_TYPES = [
  "大量採用",
  "制度見直し",
  "健康経営",
  "年金制度",
  "海外展開",
  "高齢化対応",
  "組織再編",
] as const

/** Tacit-knowledge categories */
export const KNOWLEDGE_CATEGORIES = [
  "課題の引き出し方",
  "反論への切り返し",
  "数値と事例の使い方",
  "キーマン攻略",
  "クロージングと次アクション設計",
] as const
