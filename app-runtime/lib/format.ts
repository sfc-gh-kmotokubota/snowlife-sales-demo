/**
 * Shared helpers for normalising values that come back from the Snowflake
 * Node.js SDK before they cross the API boundary.
 *
 * Two SDK behaviours require normalisation on every route:
 *  1. TIMESTAMP_* columns arrive as JS `Date` objects, not ISO strings.
 *     `String(date)` yields "Tue Jun 03 2026 …" which breaks both display
 *     (`.slice(0,10)`) and sorting (month names compare alphabetically).
 *  2. ARRAY / VARIANT / OBJECT columns arrive as JSON *strings*, so they must
 *     be parsed before the client can index into them.
 */

/** Normalise a DATE/TIMESTAMP value to an ISO string. */
export function toIso(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null
  if (val instanceof Date) return val.toISOString()
  return String(val)
}

/** Normalise a DATE/TIMESTAMP value to `YYYY-MM-DD` for display. */
export function toDate(val: unknown): string | null {
  return toIso(val)?.slice(0, 10) ?? null
}

/** Parse an ARRAY / VARIANT column into a typed array. Never throws. */
export function toArray<T = unknown>(val: unknown): T[] {
  if (val === null || val === undefined) return []
  if (Array.isArray(val)) return val as T[]
  if (typeof val === "string") {
    const trimmed = val.trim()
    if (trimmed === "" || trimmed === "null") return []
    try {
      const parsed = JSON.parse(trimmed)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }
  return []
}

/** Parse an OBJECT / VARIANT column into a plain object. Never throws. */
export function toObject<T = Record<string, unknown>>(val: unknown): T | null {
  if (val === null || val === undefined) return null
  if (typeof val === "object" && !Array.isArray(val)) return val as T
  if (typeof val === "string") {
    const trimmed = val.trim()
    if (trimmed === "" || trimmed === "null") return null
    try {
      const parsed = JSON.parse(trimmed)
      return typeof parsed === "object" && parsed !== null ? (parsed as T) : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * Parse an ARRAY column whose elements are supposed to be plain strings.
 *
 * The generative steps that populate these columns are told to emit strings,
 * but the model sometimes wraps each item in an object instead (e.g.
 * `{"detail": "…", "opportunity": "…"}`). The mix is real in the stored data,
 * so flatten object elements down to a single display string here rather than
 * letting a `{}` reach React and crash the render.
 */
export function toStringArray(val: unknown): string[] {
  const preferredKeys = [
    "text",
    "detail",
    "description",
    "issue",
    "opportunity",
    "missed",
    "need",
    "objection",
    "title",
    "name",
    "value",
  ]

  return toArray<unknown>(val)
    .map((item) => {
      if (typeof item === "string") return item.trim()
      if (typeof item === "number" || typeof item === "boolean") return String(item)
      const obj = toObject<Record<string, unknown>>(item)
      if (!obj) return ""
      for (const k of preferredKeys) {
        const v = obj[k]
        if (typeof v === "string" && v.trim() !== "") return v.trim()
      }
      // Fall back to joining whatever string values the object does carry.
      const parts = Object.values(obj).filter(
        (v): v is string => typeof v === "string" && v.trim() !== "",
      )
      return parts.join(" — ")
    })
    .filter((s) => s !== "")
}

/** Coerce a NUMBER column to a JS number, defaulting rather than yielding NaN. */
export function toNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "") return fallback
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

/** Coerce a BOOLEAN column, tolerating the string forms the SDK may return. */
export function toBool(val: unknown): boolean {
  if (typeof val === "boolean") return val
  if (typeof val === "string") return val.toLowerCase() === "true"
  return Boolean(val)
}

/**
 * Escape a string for safe interpolation into a single-quoted SQL literal.
 *
 * The Snowflake SDK helper in this template takes a plain SQL string rather than
 * bind parameters, so every user-supplied value that reaches SQL must pass
 * through here. Identifiers (rep ids, company ids) are additionally validated
 * with `safeId` below.
 */
export function sqlStr(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/'/g, "''")
}

/**
 * Validate an identifier-like value (company id, rep id, meeting id, …).
 * Returns null when the value contains anything other than alphanumerics,
 * underscore or hyphen, so callers can reject the request outright instead of
 * interpolating attacker-controlled text into SQL.
 */
export function safeId(val: string | null | undefined): string | null {
  if (!val) return null
  return /^[A-Za-z0-9_-]{1,64}$/.test(val) ? val : null
}

/** Format a JPY amount as 億円 / 万円 for dense table display. */
export function formatJpy(val: unknown): string {
  const n = toNum(val)
  if (n === 0) return "—"
  if (Math.abs(n) >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}億円`
  if (Math.abs(n) >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString("ja-JP")}万円`
  return `${Math.round(n).toLocaleString("ja-JP")}円`
}

/** Format an integer with Japanese thousands separators. */
export function formatNum(val: unknown): string {
  return toNum(val).toLocaleString("ja-JP")
}

/** Relative-day label, e.g. 「3日前」「本日」. */
export function daysAgoLabel(days: unknown): string {
  const n = toNum(days, -1)
  if (n < 0 || n >= 999) return "記録なし"
  if (n === 0) return "本日"
  if (n < 31) return `${n}日前`
  if (n < 365) return `${Math.floor(n / 30)}ヶ月前`
  return `${Math.floor(n / 365)}年以上前`
}
