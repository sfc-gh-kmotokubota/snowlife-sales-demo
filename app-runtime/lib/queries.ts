import { querySnowflake } from "@/lib/snowflake"
import { ANALYTICS, RAW, AI_SCHEMA } from "@/lib/constants"
import { safeId, sqlStr, toArray, toBool, toDate, toIso, toNum, toObject, toStringArray } from "@/lib/format"

/**
 * Central SQL layer. Every page and API route reads Snowflake through the
 * functions in this file so that column normalisation (VARIANT parsing,
 * TIMESTAMP → ISO) happens in exactly one place.
 *
 * All queries run with owner's rights; the app scopes data to a sales rep via
 * an explicit `repId` filter rather than row-access policies, so the demo can
 * switch between reps in the UI.
 */

// ---------------------------------------------------------------------------
// Sales reps (used by the rep switcher)
// ---------------------------------------------------------------------------

export interface SalesRep {
  repId: string
  name: string
  department: string
  title: string
  skillTier: string
  winRate: number
  experienceYears: number
  companyCount: number
  strengthAreas: string[]
  behaviorProfile: string
}

export async function getSalesReps(): Promise<SalesRep[]> {
  const rows = await querySnowflake(`
    SELECT r.SALES_REP_ID, r.FULL_NAME, r.DEPARTMENT, r.TITLE, r.EXPERIENCE_YEARS,
           s.SKILL_TIER, s.WIN_RATE, s.STRENGTH_AREAS, s.BEHAVIOR_PROFILE,
           (SELECT COUNT(*) FROM ${RAW}.T_CUSTOMER_COMPANIES c WHERE c.SALES_REP_ID = r.SALES_REP_ID) AS COMPANY_COUNT
    FROM ${RAW}.T_SALES_REPS r
    LEFT JOIN ${RAW}.T_SALES_REP_SKILLS s ON s.SALES_REP_ID = r.SALES_REP_ID
    ORDER BY s.WIN_RATE DESC NULLS LAST
  `)
  return rows.map((r) => ({
    repId: String(r.SALES_REP_ID),
    name: String(r.FULL_NAME),
    department: String(r.DEPARTMENT ?? ""),
    title: String(r.TITLE ?? ""),
    skillTier: String(r.SKILL_TIER ?? "未設定"),
    winRate: toNum(r.WIN_RATE),
    experienceYears: toNum(r.EXPERIENCE_YEARS),
    companyCount: toNum(r.COMPANY_COUNT),
    strengthAreas: toArray<string>(r.STRENGTH_AREAS),
    behaviorProfile: String(r.BEHAVIOR_PROFILE ?? ""),
  }))
}

/** Rep filter fragment. Empty string means "all reps". */
function repFilter(repId: string | null, column = "SALES_REP_ID"): string {
  const id = safeId(repId)
  return id ? `AND ${column} = '${sqlStr(id)}'` : ""
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardKpi {
  companyCount: number
  pipelineAmount: number
  expiring90d: number
  openActions: number
  overdueActions: number
  keyPersonGaps: number
  avgMeetingQuality: number
  strongSignalCompanies: number
}

export interface DashboardData {
  kpi: DashboardKpi
  topTargets: {
    companyId: string
    companyName: string
    grade: string
    totalScore: number
    primaryTrigger: string
    triggers: string[]
    topSignalType: string | null
    employeeCount: number
  }[]
  urgentActions: {
    actionId: string
    companyId: string
    companyName: string
    title: string
    priority: string
    dueDate: string | null
    status: string
    meetingId: string
  }[]
  expiringContracts: {
    contractId: string
    companyId: string
    companyName: string
    productName: string
    expiryDate: string | null
    annualPremium: number
    daysToExpiry: number
  }[]
  recentMeetings: {
    meetingId: string
    companyId: string
    companyName: string
    meetingDate: string | null
    agenda: string
    outcome: string | null
    qualityScore: number
    sentiment: string | null
  }[]
  qualityTrend: { month: string; qualityScore: number; meetings: number }[]
  signalMix: { signalType: string; companies: number; postings: number }[]
}

export async function getDashboard(repId: string | null): Promise<DashboardData> {
  const rf = repFilter(repId)

  const [kpiRows, targetRows, actionRows, expiryRows, meetingRows, trendRows, signalRows] =
    await Promise.all([
      querySnowflake(`
        SELECT
          COUNT(*) AS COMPANY_COUNT,
          SUM(PIPELINE_AMOUNT) AS PIPELINE_AMOUNT,
          SUM(EXPIRING_90D) AS EXPIRING_90D,
          SUM(OPEN_ACTIONS) AS OPEN_ACTIONS,
          SUM(OVERDUE_ACTIONS) AS OVERDUE_ACTIONS,
          ROUND(AVG(AVG_MEETING_QUALITY), 1) AS AVG_MEETING_QUALITY
        FROM ${ANALYTICS}.V_CUSTOMER_360
        WHERE 1=1 ${rf}
      `),
      querySnowflake(`
        SELECT COMPANY_ID, COMPANY_NAME, ATTACK_GRADE, TOTAL_SCORE, PRIMARY_TRIGGER,
               TRIGGERS, TOP_SIGNAL_TYPE, EMPLOYEE_COUNT
        FROM ${ANALYTICS}.V_ATTACK_LIST
        WHERE 1=1 ${rf}
        ORDER BY TOTAL_SCORE DESC
        LIMIT 6
      `),
      querySnowflake(`
        SELECT a.ACTION_ID, a.COMPANY_ID, c.COMPANY_NAME, a.ACTION_TITLE, a.PRIORITY,
               a.DUE_DATE, a.STATUS, a.MEETING_ID
        FROM ${RAW}.T_NEXT_ACTIONS a
        JOIN ${RAW}.T_CUSTOMER_COMPANIES c ON c.COMPANY_ID = a.COMPANY_ID
        WHERE a.STATUS IN ('未着手','遅延') ${repFilter(repId, "a.SALES_REP_ID")}
        ORDER BY IFF(a.STATUS='遅延',0,1), a.DUE_DATE
        LIMIT 8
      `),
      querySnowflake(`
        SELECT k.CONTRACT_ID, k.COMPANY_ID, c.COMPANY_NAME, p.PRODUCT_NAME,
               k.EXPIRY_DATE, k.ANNUAL_PREMIUM,
               DATEDIFF(day, CURRENT_DATE(), k.EXPIRY_DATE) AS DAYS_TO_EXPIRY
        FROM ${RAW}.T_CONTRACTS k
        JOIN ${RAW}.T_CUSTOMER_COMPANIES c ON c.COMPANY_ID = k.COMPANY_ID
        LEFT JOIN ${RAW}.T_INSURANCE_PRODUCTS p ON p.PRODUCT_ID = k.PRODUCT_ID
        WHERE k.EXPIRY_DATE BETWEEN CURRENT_DATE() AND DATEADD(day, 120, CURRENT_DATE())
          ${repFilter(repId, "c.SALES_REP_ID")}
        ORDER BY k.EXPIRY_DATE
        LIMIT 8
      `),
      querySnowflake(`
        SELECT MEETING_ID, COMPANY_ID, COMPANY_NAME, MEETING_DATE, AGENDA,
               OUTCOME, QUALITY_SCORE, SENTIMENT
        FROM ${ANALYTICS}.V_MEETING_QUALITY
        WHERE 1=1 ${rf}
        ORDER BY MEETING_DATE DESC
        LIMIT 8
      `),
      querySnowflake(`
        SELECT TO_CHAR(DATE_TRUNC('month', MEETING_DATE), 'YYYY-MM') AS MONTH,
               ROUND(AVG(QUALITY_SCORE), 1) AS QUALITY_SCORE, COUNT(*) AS MEETINGS
        FROM ${ANALYTICS}.V_MEETING_QUALITY
        WHERE MEETING_DATE >= DATEADD(month, -12, CURRENT_DATE()) ${rf}
        GROUP BY 1 ORDER BY 1
      `),
      querySnowflake(`
        SELECT j.INSURANCE_SIGNAL_TYPE AS SIGNAL_TYPE,
               COUNT(DISTINCT j.COMPANY_ID) AS COMPANIES, COUNT(*) AS POSTINGS
        FROM ${RAW}.T_JOB_POSTINGS j
        JOIN ${RAW}.T_CUSTOMER_COMPANIES c ON c.COMPANY_ID = j.COMPANY_ID
        WHERE j.POSTING_DATE >= DATEADD(day, -180, CURRENT_DATE())
          ${repFilter(repId, "c.SALES_REP_ID")}
        GROUP BY 1 ORDER BY POSTINGS DESC
      `),
    ])

  const k = kpiRows[0] ?? {}

  // Key-person gaps and strong-signal companies come from the attack list so
  // the definitions stay identical to the attack-list screen.
  const gapRows = await querySnowflake(`
    SELECT
      COUNT_IF(HAS_DM_CONTACT = 0) AS KEY_PERSON_GAPS,
      COUNT_IF(SCORE_HIRING_SIGNAL >= 85) AS STRONG_SIGNAL_COMPANIES
    FROM ${ANALYTICS}.V_ATTACK_LIST
    WHERE 1=1 ${rf}
  `)
  const g = gapRows[0] ?? {}

  return {
    kpi: {
      companyCount: toNum(k.COMPANY_COUNT),
      pipelineAmount: toNum(k.PIPELINE_AMOUNT),
      expiring90d: toNum(k.EXPIRING_90D),
      openActions: toNum(k.OPEN_ACTIONS),
      overdueActions: toNum(k.OVERDUE_ACTIONS),
      keyPersonGaps: toNum(g.KEY_PERSON_GAPS),
      avgMeetingQuality: toNum(k.AVG_MEETING_QUALITY),
      strongSignalCompanies: toNum(g.STRONG_SIGNAL_COMPANIES),
    },
    topTargets: targetRows.map((r) => ({
      companyId: String(r.COMPANY_ID),
      companyName: String(r.COMPANY_NAME),
      grade: String(r.ATTACK_GRADE),
      totalScore: toNum(r.TOTAL_SCORE),
      primaryTrigger: String(r.PRIMARY_TRIGGER),
      triggers: toArray<string>(r.TRIGGERS),
      topSignalType: r.TOP_SIGNAL_TYPE ? String(r.TOP_SIGNAL_TYPE) : null,
      employeeCount: toNum(r.EMPLOYEE_COUNT),
    })),
    urgentActions: actionRows.map((r) => ({
      actionId: String(r.ACTION_ID),
      companyId: String(r.COMPANY_ID),
      companyName: String(r.COMPANY_NAME),
      title: String(r.ACTION_TITLE),
      priority: String(r.PRIORITY ?? "中"),
      dueDate: toDate(r.DUE_DATE),
      status: String(r.STATUS),
      meetingId: String(r.MEETING_ID ?? ""),
    })),
    expiringContracts: expiryRows.map((r) => ({
      contractId: String(r.CONTRACT_ID),
      companyId: String(r.COMPANY_ID),
      companyName: String(r.COMPANY_NAME),
      productName: String(r.PRODUCT_NAME ?? "—"),
      expiryDate: toDate(r.EXPIRY_DATE),
      annualPremium: toNum(r.ANNUAL_PREMIUM),
      daysToExpiry: toNum(r.DAYS_TO_EXPIRY),
    })),
    recentMeetings: meetingRows.map((r) => ({
      meetingId: String(r.MEETING_ID),
      companyId: String(r.COMPANY_ID),
      companyName: String(r.COMPANY_NAME),
      meetingDate: toDate(r.MEETING_DATE),
      agenda: String(r.AGENDA ?? ""),
      outcome: r.OUTCOME ? String(r.OUTCOME) : null,
      qualityScore: toNum(r.QUALITY_SCORE),
      sentiment: r.SENTIMENT ? String(r.SENTIMENT) : null,
    })),
    qualityTrend: trendRows.map((r) => ({
      month: String(r.MONTH),
      qualityScore: toNum(r.QUALITY_SCORE),
      meetings: toNum(r.MEETINGS),
    })),
    signalMix: signalRows.map((r) => ({
      signalType: String(r.SIGNAL_TYPE),
      companies: toNum(r.COMPANIES),
      postings: toNum(r.POSTINGS),
    })),
  }
}

// ---------------------------------------------------------------------------
// Attack list
// ---------------------------------------------------------------------------

export interface AttackListFilters {
  repId: string | null
  industries: string[]
  signalTypes: string[]
  triggers: string[]
  minEmployees: number | null
  minScore: number | null
  grades: string[]
}

export interface AttackListRow {
  companyId: string
  companyName: string
  industryLarge: string
  industryDetail: string
  prefecture: string
  employeeCount: number
  prospectRank: string
  salesRepName: string
  grade: string
  totalScore: number
  primaryTrigger: string
  triggers: string[]
  topSignalType: string | null
  topSignalRationale: string | null
  topJobTitle: string | null
  scores: {
    hiring: number
    contractGap: number
    financial: number
    eventFresh: number
    contactGap: number
    scale: number
    renewal: number
  }
  weighted: {
    hiring: number
    contractGap: number
    financial: number
    eventFresh: number
    contactGap: number
    scale: number
    renewal: number
  }
  postingCount: number
  recentPostings90d: number
  recentOpenings90d: number
  signalTypeCount: number
  contractCount: number
  totalPremium: number
  expiring90d: number
  nearestExpiry: string | null
  daysSinceTouch: number
  hasDmContact: boolean
  contactCount: number
  alertCount: number
  pipelineAmount: number
  pensionType: string | null
  healthCertStatus: string | null
  turnoverRate: number
  opMargin: number | null
}

export async function getAttackList(f: AttackListFilters): Promise<AttackListRow[]> {
  const clauses: string[] = []
  const rid = safeId(f.repId)
  if (rid) clauses.push(`SALES_REP_ID = '${sqlStr(rid)}'`)
  if (f.industries.length) {
    clauses.push(`INDUSTRY_LARGE IN (${f.industries.map((i) => `'${sqlStr(i)}'`).join(",")})`)
  }
  if (f.signalTypes.length) {
    clauses.push(`TOP_SIGNAL_TYPE IN (${f.signalTypes.map((i) => `'${sqlStr(i)}'`).join(",")})`)
  }
  if (f.triggers.length) {
    // A company matches if any requested trigger appears in its TRIGGERS array.
    const ors = f.triggers.map((t) => `ARRAY_CONTAINS('${sqlStr(t)}'::VARIANT, TRIGGERS)`)
    clauses.push(`(${ors.join(" OR ")})`)
  }
  if (f.grades.length) {
    clauses.push(`ATTACK_GRADE IN (${f.grades.map((i) => `'${sqlStr(i)}'`).join(",")})`)
  }
  if (f.minEmployees !== null) clauses.push(`EMPLOYEE_COUNT >= ${Math.floor(f.minEmployees)}`)
  if (f.minScore !== null) clauses.push(`TOTAL_SCORE >= ${Number(f.minScore)}`)

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""

  const rows = await querySnowflake(`
    SELECT * FROM ${ANALYTICS}.V_ATTACK_LIST
    ${where}
    ORDER BY TOTAL_SCORE DESC
    LIMIT 200
  `)

  return rows.map((r) => ({
    companyId: String(r.COMPANY_ID),
    companyName: String(r.COMPANY_NAME),
    industryLarge: String(r.INDUSTRY_LARGE ?? ""),
    industryDetail: String(r.INDUSTRY_DETAIL ?? ""),
    prefecture: String(r.PREFECTURE ?? ""),
    employeeCount: toNum(r.EMPLOYEE_COUNT),
    prospectRank: String(r.PROSPECT_RANK ?? ""),
    salesRepName: String(r.SALES_REP_NAME ?? ""),
    grade: String(r.ATTACK_GRADE),
    totalScore: toNum(r.TOTAL_SCORE),
    primaryTrigger: String(r.PRIMARY_TRIGGER),
    triggers: toArray<string>(r.TRIGGERS),
    topSignalType: r.TOP_SIGNAL_TYPE ? String(r.TOP_SIGNAL_TYPE) : null,
    topSignalRationale: r.TOP_SIGNAL_RATIONALE ? String(r.TOP_SIGNAL_RATIONALE) : null,
    topJobTitle: r.TOP_JOB_TITLE ? String(r.TOP_JOB_TITLE) : null,
    scores: {
      hiring: toNum(r.SCORE_HIRING_SIGNAL),
      contractGap: toNum(r.SCORE_CONTRACT_GAP),
      financial: toNum(r.SCORE_FINANCIAL),
      eventFresh: toNum(r.SCORE_EVENT_FRESH),
      contactGap: toNum(r.SCORE_CONTACT_GAP),
      scale: toNum(r.SCORE_SCALE),
      renewal: toNum(r.SCORE_RENEWAL),
    },
    weighted: {
      hiring: toNum(r.W_HIRING),
      contractGap: toNum(r.W_GAP),
      financial: toNum(r.W_FIN),
      eventFresh: toNum(r.W_EVENT),
      contactGap: toNum(r.W_TOUCH),
      scale: toNum(r.W_SCALE),
      renewal: toNum(r.W_RENEWAL),
    },
    postingCount: toNum(r.POSTING_COUNT),
    recentPostings90d: toNum(r.RECENT_POSTINGS_90D),
    recentOpenings90d: toNum(r.RECENT_OPENINGS_90D),
    signalTypeCount: toNum(r.SIGNAL_TYPE_COUNT),
    contractCount: toNum(r.CONTRACT_COUNT),
    totalPremium: toNum(r.TOTAL_PREMIUM),
    expiring90d: toNum(r.EXPIRING_90D),
    nearestExpiry: toDate(r.NEAREST_EXPIRY),
    daysSinceTouch: toNum(r.DAYS_SINCE_TOUCH, 999),
    hasDmContact: toNum(r.HAS_DM_CONTACT) === 1,
    contactCount: toNum(r.CONTACT_COUNT),
    alertCount: toNum(r.ALERT_COUNT),
    pipelineAmount: toNum(r.PIPELINE_AMOUNT),
    pensionType: r.PENSION_TYPE ? String(r.PENSION_TYPE) : null,
    healthCertStatus: r.HEALTH_CERT_STATUS ? String(r.HEALTH_CERT_STATUS) : null,
    turnoverRate: toNum(r.TURNOVER_RATE),
    opMargin: r.OP_MARGIN === null || r.OP_MARGIN === undefined ? null : toNum(r.OP_MARGIN),
  }))
}

export async function getFilterOptions(): Promise<{ industries: string[] }> {
  const rows = await querySnowflake(`
    SELECT DISTINCT INDUSTRY_LARGE FROM ${RAW}.T_CUSTOMER_COMPANIES
    WHERE INDUSTRY_LARGE IS NOT NULL ORDER BY 1
  `)
  return { industries: rows.map((r) => String(r.INDUSTRY_LARGE)) }
}

// ---------------------------------------------------------------------------
// Customer 360
// ---------------------------------------------------------------------------

export async function getCustomerOverview(companyId: string) {
  const id = safeId(companyId)
  if (!id) return null
  const rows = await querySnowflake(`
    SELECT c.*, a.TOTAL_SCORE, a.ATTACK_GRADE, a.PRIMARY_TRIGGER, a.TRIGGERS,
           a.TOP_SIGNAL_TYPE, a.TOP_SIGNAL_RATIONALE, a.TOP_JOB_TITLE,
           a.SCORE_HIRING_SIGNAL, a.SCORE_CONTRACT_GAP, a.SCORE_FINANCIAL,
           a.SCORE_EVENT_FRESH, a.SCORE_CONTACT_GAP, a.SCORE_SCALE, a.SCORE_RENEWAL
    FROM ${ANALYTICS}.V_CUSTOMER_360 c
    LEFT JOIN ${ANALYTICS}.V_ATTACK_LIST a ON a.COMPANY_ID = c.COMPANY_ID
    WHERE c.COMPANY_ID = '${sqlStr(id)}'
  `)
  const r = rows[0]
  if (!r) return null
  return {
    companyId: String(r.COMPANY_ID),
    companyName: String(r.COMPANY_NAME),
    companyNameKana: String(r.COMPANY_NAME_KANA ?? ""),
    industryLarge: String(r.INDUSTRY_LARGE ?? ""),
    industryDetail: String(r.INDUSTRY_DETAIL ?? ""),
    employeeCount: toNum(r.EMPLOYEE_COUNT),
    employeeCountJapan: toNum(r.EMPLOYEE_COUNT_JAPAN),
    employeeCountOverseas: toNum(r.EMPLOYEE_COUNT_OVERSEAS),
    headquarters: String(r.HEADQUARTERS ?? ""),
    prefecture: String(r.PREFECTURE ?? ""),
    foundedYear: toNum(r.FOUNDED_YEAR),
    annualRevenue: toNum(r.ANNUAL_REVENUE_JPY),
    stockMarket: String(r.STOCK_MARKET ?? ""),
    stockTicker: String(r.STOCK_TICKER ?? ""),
    creditRating: String(r.CREDIT_RATING ?? ""),
    retentionRate: toNum(r.EMPLOYEE_RETENTION_RATE),
    averageAge: toNum(r.AVERAGE_AGE),
    averageSalary: toNum(r.AVERAGE_SALARY_JPY),
    welfareExpenseRatio: toNum(r.WELFARE_EXPENSE_RATIO),
    turnoverRate: toNum(r.TURNOVER_RATE),
    isListed: toBool(r.IS_LISTED),
    hasOverseas: toBool(r.HAS_OVERSEAS_SUBSIDIARY),
    pensionType: String(r.PENSION_TYPE ?? "—"),
    healthCertStatus: String(r.HEALTH_CERT_STATUS ?? "なし"),
    prospectRank: String(r.PROSPECT_RANK ?? ""),
    yearsInCharge: toNum(r.YEARS_IN_CHARGE),
    salesRepId: String(r.SALES_REP_ID ?? ""),
    salesRepName: String(r.SALES_REP_NAME ?? ""),
    repSkillTier: String(r.REP_SKILL_TIER ?? ""),
    latestFiscalYear: toNum(r.LATEST_FISCAL_YEAR),
    latestRevenue: toNum(r.LATEST_REVENUE),
    operatingProfit: toNum(r.OPERATING_PROFIT),
    netProfit: toNum(r.NET_PROFIT),
    totalAssets: toNum(r.TOTAL_ASSETS),
    opMargin: toNum(r.OP_MARGIN),
    employeeCountYoy: toNum(r.EMPLOYEE_COUNT_YOY),
    contractCount: toNum(r.CONTRACT_COUNT),
    totalPremium: toNum(r.TOTAL_PREMIUM),
    totalInsured: toNum(r.TOTAL_INSURED),
    nearestExpiry: toDate(r.NEAREST_EXPIRY),
    expiring90d: toNum(r.EXPIRING_90D),
    coveredCategories: toArray<string>(r.COVERED_CATEGORY_LIST),
    postingCount: toNum(r.POSTING_COUNT),
    recentPostings90d: toNum(r.RECENT_POSTINGS_90D),
    totalOpenings: toNum(r.TOTAL_OPENINGS),
    maxSignalStrength: toNum(r.MAX_SIGNAL_STRENGTH),
    signalTypes: toArray<string>(r.SIGNAL_TYPES),
    latestPostingDate: toDate(r.LATEST_POSTING_DATE),
    touchpointCount: toNum(r.TOUCHPOINT_COUNT),
    lastTouchDate: toDate(r.LAST_TOUCH_DATE),
    daysSinceTouch: toNum(r.DAYS_SINCE_TOUCH, 999),
    positiveTouches: toNum(r.POSITIVE_TOUCHES),
    contactedPeople: toNum(r.CONTACTED_PEOPLE),
    meetingCount: toNum(r.MEETING_COUNT),
    lastMeetingDate: toDate(r.LAST_MEETING_DATE),
    daysSinceMeeting: toNum(r.DAYS_SINCE_MEETING, 999),
    avgMeetingQuality: toNum(r.AVG_MEETING_QUALITY),
    wonMeetings: toNum(r.WON_MEETINGS),
    stalledMeetings: toNum(r.STALLED_MEETINGS),
    prospectCount: toNum(r.PROSPECT_COUNT),
    pipelineAmount: toNum(r.PIPELINE_AMOUNT),
    maxAiScore: toNum(r.MAX_AI_SCORE),
    nearestCloseDate: toDate(r.NEAREST_CLOSE_DATE),
    newsCount90d: toNum(r.NEWS_COUNT_90D),
    latestNewsDate: toDate(r.LATEST_NEWS_DATE),
    openAlertCount: toNum(r.OPEN_ALERT_COUNT),
    latestAlertAt: toIso(r.LATEST_ALERT_AT),
    openActions: toNum(r.OPEN_ACTIONS),
    overdueActions: toNum(r.OVERDUE_ACTIONS),
    nextDueDate: toDate(r.NEXT_DUE_DATE),
    attack: {
      totalScore: toNum(r.TOTAL_SCORE),
      grade: String(r.ATTACK_GRADE ?? "C"),
      primaryTrigger: String(r.PRIMARY_TRIGGER ?? ""),
      triggers: toArray<string>(r.TRIGGERS),
      topSignalType: r.TOP_SIGNAL_TYPE ? String(r.TOP_SIGNAL_TYPE) : null,
      topSignalRationale: r.TOP_SIGNAL_RATIONALE ? String(r.TOP_SIGNAL_RATIONALE) : null,
      topJobTitle: r.TOP_JOB_TITLE ? String(r.TOP_JOB_TITLE) : null,
      scores: {
        hiring: toNum(r.SCORE_HIRING_SIGNAL),
        contractGap: toNum(r.SCORE_CONTRACT_GAP),
        financial: toNum(r.SCORE_FINANCIAL),
        eventFresh: toNum(r.SCORE_EVENT_FRESH),
        contactGap: toNum(r.SCORE_CONTACT_GAP),
        scale: toNum(r.SCORE_SCALE),
        renewal: toNum(r.SCORE_RENEWAL),
      },
    },
  }
}

export type CustomerOverview = NonNullable<Awaited<ReturnType<typeof getCustomerOverview>>>

export async function getCustomerFinancials(companyId: string) {
  const id = safeId(companyId)
  if (!id) return []
  const rows = await querySnowflake(`
    SELECT FISCAL_YEAR, REVENUE_JPY, OPERATING_PROFIT, NET_PROFIT, TOTAL_ASSETS,
           EMPLOYEE_COUNT, EMPLOYEE_COUNT_YOY, AVERAGE_SALARY, WELFARE_EXPENSE_RATIO, TURNOVER_RATE
    FROM ${RAW}.T_FINANCIAL_DATA
    WHERE COMPANY_ID = '${sqlStr(id)}' ORDER BY FISCAL_YEAR
  `)
  return rows.map((r) => ({
    fiscalYear: toNum(r.FISCAL_YEAR),
    revenue: toNum(r.REVENUE_JPY),
    operatingProfit: toNum(r.OPERATING_PROFIT),
    netProfit: toNum(r.NET_PROFIT),
    totalAssets: toNum(r.TOTAL_ASSETS),
    employeeCount: toNum(r.EMPLOYEE_COUNT),
    employeeCountYoy: toNum(r.EMPLOYEE_COUNT_YOY),
    averageSalary: toNum(r.AVERAGE_SALARY),
    welfareExpenseRatio: toNum(r.WELFARE_EXPENSE_RATIO),
    turnoverRate: toNum(r.TURNOVER_RATE),
  }))
}

export async function getCustomerJobPostings(companyId: string) {
  const id = safeId(companyId)
  if (!id) return { postings: [], byMonth: [], bySignal: [] }
  const [postings, byMonth, bySignal] = await Promise.all([
    querySnowflake(`
      SELECT POSTING_ID, POSTING_DATE, JOB_TITLE, DEPARTMENT, JOB_CATEGORY, EMPLOYMENT_TYPE,
             OPENINGS, SALARY_MIN_JPY, SALARY_MAX_JPY, WORK_LOCATION, IS_OVERSEAS,
             REQUIRED_SKILLS, JOB_DESCRIPTION, SOURCE_SITE, INSURANCE_SIGNAL_TYPE,
             SIGNAL_STRENGTH, SIGNAL_RATIONALE
      FROM ${RAW}.T_JOB_POSTINGS
      WHERE COMPANY_ID = '${sqlStr(id)}'
      ORDER BY SIGNAL_STRENGTH DESC, POSTING_DATE DESC LIMIT 60
    `),
    querySnowflake(`
      SELECT TO_CHAR(DATE_TRUNC('month', POSTING_DATE), 'YYYY-MM') AS MONTH,
             COUNT(*) AS POSTINGS, SUM(OPENINGS) AS OPENINGS
      FROM ${RAW}.T_JOB_POSTINGS
      WHERE COMPANY_ID = '${sqlStr(id)}' GROUP BY 1 ORDER BY 1
    `),
    querySnowflake(`
      SELECT INSURANCE_SIGNAL_TYPE AS SIGNAL_TYPE, COUNT(*) AS POSTINGS,
             SUM(OPENINGS) AS OPENINGS, MAX(SIGNAL_STRENGTH) AS MAX_STRENGTH,
             ANY_VALUE(SIGNAL_RATIONALE) AS RATIONALE
      FROM ${RAW}.T_JOB_POSTINGS
      WHERE COMPANY_ID = '${sqlStr(id)}' GROUP BY 1 ORDER BY MAX_STRENGTH DESC, POSTINGS DESC
    `),
  ])
  return {
    postings: postings.map((r) => ({
      postingId: String(r.POSTING_ID),
      postingDate: toDate(r.POSTING_DATE),
      jobTitle: String(r.JOB_TITLE),
      department: String(r.DEPARTMENT ?? ""),
      jobCategory: String(r.JOB_CATEGORY ?? ""),
      employmentType: String(r.EMPLOYMENT_TYPE ?? ""),
      openings: toNum(r.OPENINGS),
      salaryMin: toNum(r.SALARY_MIN_JPY),
      salaryMax: toNum(r.SALARY_MAX_JPY),
      workLocation: String(r.WORK_LOCATION ?? ""),
      isOverseas: toBool(r.IS_OVERSEAS),
      requiredSkills: toArray<string>(r.REQUIRED_SKILLS),
      jobDescription: String(r.JOB_DESCRIPTION ?? ""),
      sourceSite: String(r.SOURCE_SITE ?? ""),
      signalType: String(r.INSURANCE_SIGNAL_TYPE ?? ""),
      signalStrength: toNum(r.SIGNAL_STRENGTH),
      signalRationale: String(r.SIGNAL_RATIONALE ?? ""),
    })),
    byMonth: byMonth.map((r) => ({
      month: String(r.MONTH),
      postings: toNum(r.POSTINGS),
      openings: toNum(r.OPENINGS),
    })),
    bySignal: bySignal.map((r) => ({
      signalType: String(r.SIGNAL_TYPE),
      postings: toNum(r.POSTINGS),
      openings: toNum(r.OPENINGS),
      maxStrength: toNum(r.MAX_STRENGTH),
      rationale: String(r.RATIONALE ?? ""),
    })),
  }
}

export async function getCustomerContacts(companyId: string) {
  const id = safeId(companyId)
  if (!id) return { contacts: [], touchpoints: [] }
  const [contacts, touchpoints] = await Promise.all([
    querySnowflake(`
      SELECT CONTACT_ID, CONTACT_NAME, TITLE, DEPARTMENT, CONTACT_ROLE,
             TOUCHPOINT_COUNT, LAST_TOUCHPOINT_DATE, DAYS_SINCE_TOUCH,
             POSITIVE_TOUCHES, FACE_TO_FACE_COUNT, COVERAGE_STATUS
      FROM ${ANALYTICS}.V_KEY_PERSON_COVERAGE
      WHERE COMPANY_ID = '${sqlStr(id)}'
      ORDER BY CASE CONTACT_ROLE WHEN 'DECISION_MAKER' THEN 1 WHEN 'INFLUENCER' THEN 2 ELSE 3 END
    `),
    querySnowflake(`
      SELECT t.TOUCHPOINT_ID, t.CONTACT_ID, ct.FULL_NAME AS CONTACT_NAME, ct.TITLE,
             t.TOUCHPOINT_DATE, t.TOUCHPOINT_TYPE, t.CHANNEL, t.SANSAN_REGISTERED,
             t.SANSAN_CARD_ID, t.NOTES, t.SENTIMENT
      FROM ${RAW}.T_CONTACT_TOUCHPOINTS t
      LEFT JOIN ${RAW}.T_CONTACTS ct ON ct.CONTACT_ID = t.CONTACT_ID
      WHERE t.COMPANY_ID = '${sqlStr(id)}'
      ORDER BY t.TOUCHPOINT_DATE DESC LIMIT 40
    `),
  ])
  return {
    contacts: contacts.map((r) => ({
      contactId: String(r.CONTACT_ID ?? ""),
      name: String(r.CONTACT_NAME ?? ""),
      title: String(r.TITLE ?? ""),
      department: String(r.DEPARTMENT ?? ""),
      role: String(r.CONTACT_ROLE ?? ""),
      touchpointCount: toNum(r.TOUCHPOINT_COUNT),
      lastTouchDate: toDate(r.LAST_TOUCHPOINT_DATE),
      daysSinceTouch: toNum(r.DAYS_SINCE_TOUCH, 999),
      positiveTouches: toNum(r.POSITIVE_TOUCHES),
      faceToFaceCount: toNum(r.FACE_TO_FACE_COUNT),
      coverageStatus: String(r.COVERAGE_STATUS ?? ""),
    })),
    touchpoints: touchpoints.map((r) => ({
      touchpointId: String(r.TOUCHPOINT_ID),
      contactId: String(r.CONTACT_ID),
      contactName: String(r.CONTACT_NAME ?? ""),
      title: String(r.TITLE ?? ""),
      date: toDate(r.TOUCHPOINT_DATE),
      type: String(r.TOUCHPOINT_TYPE ?? ""),
      channel: String(r.CHANNEL ?? ""),
      sansanRegistered: toBool(r.SANSAN_REGISTERED),
      sansanCardId: String(r.SANSAN_CARD_ID ?? ""),
      notes: String(r.NOTES ?? ""),
      sentiment: String(r.SENTIMENT ?? ""),
    })),
  }
}

export async function getCustomerContracts(companyId: string) {
  const id = safeId(companyId)
  if (!id) return { contracts: [], gaps: [] }
  const [contracts, gaps] = await Promise.all([
    querySnowflake(`
      SELECT k.CONTRACT_ID, k.PRODUCT_ID, p.PRODUCT_NAME, p.PRODUCT_CATEGORY, p.PRODUCT_TYPE,
             k.CONTRACT_DATE, k.EXPIRY_DATE, k.ANNUAL_PREMIUM, k.INSURED_COUNT, k.STATUS, k.NOTES,
             DATEDIFF(day, CURRENT_DATE(), k.EXPIRY_DATE) AS DAYS_TO_EXPIRY
      FROM ${RAW}.T_CONTRACTS k
      LEFT JOIN ${RAW}.T_INSURANCE_PRODUCTS p ON p.PRODUCT_ID = k.PRODUCT_ID
      WHERE k.COMPANY_ID = '${sqlStr(id)}' ORDER BY k.EXPIRY_DATE
    `),
    querySnowflake(`
      SELECT p.PRODUCT_CATEGORY, COUNT(DISTINCT p.PRODUCT_ID) AS PRODUCT_COUNT,
             ARRAY_AGG(DISTINCT p.PRODUCT_NAME) AS PRODUCTS
      FROM ${RAW}.T_INSURANCE_PRODUCTS p
      WHERE p.PRODUCT_CATEGORY NOT IN (
        SELECT DISTINCT p2.PRODUCT_CATEGORY FROM ${RAW}.T_CONTRACTS k2
        JOIN ${RAW}.T_INSURANCE_PRODUCTS p2 ON p2.PRODUCT_ID = k2.PRODUCT_ID
        WHERE k2.COMPANY_ID = '${sqlStr(id)}'
      )
      GROUP BY 1 ORDER BY 1
    `),
  ])
  return {
    contracts: contracts.map((r) => ({
      contractId: String(r.CONTRACT_ID),
      productId: String(r.PRODUCT_ID ?? ""),
      productName: String(r.PRODUCT_NAME ?? "—"),
      productCategory: String(r.PRODUCT_CATEGORY ?? ""),
      productType: String(r.PRODUCT_TYPE ?? ""),
      contractDate: toDate(r.CONTRACT_DATE),
      expiryDate: toDate(r.EXPIRY_DATE),
      annualPremium: toNum(r.ANNUAL_PREMIUM),
      insuredCount: toNum(r.INSURED_COUNT),
      status: String(r.STATUS ?? ""),
      notes: String(r.NOTES ?? ""),
      daysToExpiry: toNum(r.DAYS_TO_EXPIRY),
    })),
    gaps: gaps.map((r) => ({
      category: String(r.PRODUCT_CATEGORY),
      productCount: toNum(r.PRODUCT_COUNT),
      products: toArray<string>(r.PRODUCTS),
    })),
  }
}

export async function getCustomerNews(companyId: string) {
  const id = safeId(companyId)
  if (!id) return { news: [], alerts: [] }
  const [news, alerts] = await Promise.all([
    querySnowflake(`
      SELECT NEWS_ID, NEWS_DATE, NEWS_SOURCE, HEADLINE, BODY_TEXT, EVENT_TYPE,
             NEWS_CATEGORY, SENTIMENT, INSURANCE_RELEVANCE
      FROM ${RAW}.T_COMPANY_NEWS
      WHERE COMPANY_ID = '${sqlStr(id)}' ORDER BY NEWS_DATE DESC LIMIT 20
    `),
    querySnowflake(`
      SELECT ALERT_ID, DETECTED_AT, EVENT_TYPE, EVENT_SUMMARY, INSURANCE_RELEVANCE,
             ALERT_REASON, RECOMMENDED_PRODUCTS, RECOMMENDED_ACTION, URGENCY_DAYS, STATUS
      FROM ${RAW}.T_EVENT_ALERTS
      WHERE COMPANY_ID = '${sqlStr(id)}' ORDER BY DETECTED_AT DESC LIMIT 12
    `),
  ])
  return {
    news: news.map((r) => ({
      newsId: String(r.NEWS_ID),
      date: toDate(r.NEWS_DATE),
      source: String(r.NEWS_SOURCE ?? ""),
      headline: String(r.HEADLINE ?? ""),
      body: String(r.BODY_TEXT ?? ""),
      eventType: String(r.EVENT_TYPE ?? ""),
      category: String(r.NEWS_CATEGORY ?? ""),
      sentiment: String(r.SENTIMENT ?? ""),
      insuranceRelevance: String(r.INSURANCE_RELEVANCE ?? ""),
    })),
    alerts: alerts.map((r) => ({
      alertId: String(r.ALERT_ID),
      detectedAt: toIso(r.DETECTED_AT),
      eventType: String(r.EVENT_TYPE ?? ""),
      summary: String(r.EVENT_SUMMARY ?? ""),
      insuranceRelevance: String(r.INSURANCE_RELEVANCE ?? ""),
      reason: String(r.ALERT_REASON ?? ""),
      recommendedProducts: toArray<string>(r.RECOMMENDED_PRODUCTS),
      recommendedAction: String(r.RECOMMENDED_ACTION ?? ""),
      urgencyDays: toNum(r.URGENCY_DAYS),
      status: String(r.STATUS ?? ""),
    })),
  }
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

export async function getMeetings(repId: string | null, companyId?: string | null) {
  const cid = safeId(companyId ?? null)
  const rows = await querySnowflake(`
    SELECT MEETING_ID, COMPANY_ID, COMPANY_NAME, SALES_REP_NAME, SKILL_TIER,
           MEETING_DATE, MEETING_TYPE, AGENDA, DURATION_MINUTES, OUTCOME,
           NEXT_ACTION_AGREED, SENTIMENT, QUALITY_SCORE, HEARING_QUESTION_COUNT,
           NEED_COUNT, DEEP_NEED_COUNT, MISSED_COUNT, TURN_COUNT, COMPLIANCE_ISSUE_COUNT
    FROM ${ANALYTICS}.V_MEETING_QUALITY
    WHERE 1=1 ${repFilter(repId)} ${cid ? `AND COMPANY_ID = '${sqlStr(cid)}'` : ""}
    ORDER BY MEETING_DATE DESC LIMIT 200
  `)
  return rows.map((r) => ({
    meetingId: String(r.MEETING_ID),
    companyId: String(r.COMPANY_ID),
    companyName: String(r.COMPANY_NAME),
    salesRepName: String(r.SALES_REP_NAME ?? ""),
    skillTier: String(r.SKILL_TIER ?? ""),
    meetingDate: toDate(r.MEETING_DATE),
    meetingType: String(r.MEETING_TYPE ?? ""),
    agenda: String(r.AGENDA ?? ""),
    durationMinutes: toNum(r.DURATION_MINUTES),
    outcome: r.OUTCOME ? String(r.OUTCOME) : null,
    nextActionAgreed: toBool(r.NEXT_ACTION_AGREED),
    sentiment: r.SENTIMENT ? String(r.SENTIMENT) : null,
    qualityScore: toNum(r.QUALITY_SCORE),
    hearingQuestionCount: toNum(r.HEARING_QUESTION_COUNT),
    needCount: toNum(r.NEED_COUNT),
    deepNeedCount: toNum(r.DEEP_NEED_COUNT),
    missedCount: toNum(r.MISSED_COUNT),
    turnCount: toNum(r.TURN_COUNT),
    complianceIssueCount: toNum(r.COMPLIANCE_ISSUE_COUNT),
  }))
}

export type MeetingListItem = Awaited<ReturnType<typeof getMeetings>>[number]

export async function getMeetingDetail(meetingId: string) {
  const id = safeId(meetingId)
  if (!id) return null
  const [head, transcript, summary, actions, benchmark] = await Promise.all([
    querySnowflake(`
      SELECT q.*, c.INDUSTRY_DETAIL, c.EMPLOYEE_COUNT, c.PENSION_TYPE, c.HEALTH_CERT_STATUS
      FROM ${ANALYTICS}.V_MEETING_QUALITY q
      JOIN ${RAW}.T_CUSTOMER_COMPANIES c ON c.COMPANY_ID = q.COMPANY_ID
      WHERE q.MEETING_ID = '${sqlStr(id)}'
    `),
    querySnowflake(`
      SELECT TRANSCRIPT_ID, SPEAKER_LABEL, START_TIME_SEC, END_TIME_SEC,
             TRANSCRIPT_TEXT, CONFIDENCE_SCORE
      FROM ${RAW}.T_MEETING_TRANSCRIPTS
      WHERE MEETING_ID = '${sqlStr(id)}' ORDER BY START_TIME_SEC
    `),
    querySnowflake(`
      SELECT SUMMARY_ID, SUMMARY_TEXT, KEY_ISSUES, ACTION_ITEMS, CUSTOMER_NEEDS,
             OBJECTIONS, MISSED_OPPORTUNITIES, COMPLIANCE_ISSUES, SENTIMENT,
             HEARING_QUESTION_COUNT, MODEL_USED
      FROM ${RAW}.T_MEETING_SUMMARIES WHERE MEETING_ID = '${sqlStr(id)}'
    `),
    querySnowflake(`
      SELECT ACTION_ID, ACTION_TITLE, ACTION_DETAIL, PRIORITY, DUE_DATE, STATUS
      FROM ${RAW}.T_NEXT_ACTIONS WHERE MEETING_ID = '${sqlStr(id)}'
      ORDER BY CASE PRIORITY WHEN '高' THEN 1 WHEN '中' THEN 2 ELSE 3 END, DUE_DATE
    `),
    querySnowflake(`
      SELECT SKILL_TIER, ROUND(AVG(QUALITY_SCORE),1) AS AVG_QUALITY,
             ROUND(AVG(HEARING_QUESTION_COUNT),1) AS AVG_QUESTIONS,
             ROUND(AVG(DEEP_NEED_COUNT),2) AS AVG_DEEP_NEEDS,
             ROUND(AVG(MISSED_COUNT),1) AS AVG_MISSED
      FROM ${ANALYTICS}.V_MEETING_QUALITY GROUP BY 1
    `),
  ])

  const h = head[0]
  if (!h) return null
  const s = summary[0] ?? {}

  return {
    meetingId: String(h.MEETING_ID),
    companyId: String(h.COMPANY_ID),
    companyName: String(h.COMPANY_NAME),
    industryDetail: String(h.INDUSTRY_DETAIL ?? ""),
    employeeCount: toNum(h.EMPLOYEE_COUNT),
    pensionType: String(h.PENSION_TYPE ?? ""),
    healthCertStatus: String(h.HEALTH_CERT_STATUS ?? ""),
    salesRepId: String(h.SALES_REP_ID ?? ""),
    salesRepName: String(h.SALES_REP_NAME ?? ""),
    skillTier: String(h.SKILL_TIER ?? ""),
    meetingDate: toDate(h.MEETING_DATE),
    meetingType: String(h.MEETING_TYPE ?? ""),
    agenda: String(h.AGENDA ?? ""),
    durationMinutes: toNum(h.DURATION_MINUTES),
    outcome: h.OUTCOME ? String(h.OUTCOME) : null,
    nextActionAgreed: toBool(h.NEXT_ACTION_AGREED),
    qualityScore: toNum(h.QUALITY_SCORE),
    hearingQuestionCount: toNum(h.HEARING_QUESTION_COUNT),
    deepNeedCount: toNum(h.DEEP_NEED_COUNT),
    missedCount: toNum(h.MISSED_COUNT),
    objectionsHandled: toNum(h.OBJECTIONS_HANDLED),
    turnCount: toNum(h.TURN_COUNT),
    transcript: transcript.map((r) => ({
      transcriptId: String(r.TRANSCRIPT_ID),
      speaker: String(r.SPEAKER_LABEL ?? ""),
      startSec: toNum(r.START_TIME_SEC),
      endSec: toNum(r.END_TIME_SEC),
      text: String(r.TRANSCRIPT_TEXT ?? ""),
      confidence: toNum(r.CONFIDENCE_SCORE),
    })),
    summary: {
      summaryId: String(s.SUMMARY_ID ?? ""),
      text: String(s.SUMMARY_TEXT ?? ""),
      keyIssues: toStringArray(s.KEY_ISSUES),
      actionItems: toArray<Record<string, unknown>>(s.ACTION_ITEMS),
      customerNeeds: toArray<{ need: string; evidence: string; depth: string }>(s.CUSTOMER_NEEDS),
      objections: toArray<{ objection: string; handled: boolean }>(s.OBJECTIONS),
      missedOpportunities: toStringArray(s.MISSED_OPPORTUNITIES),
      complianceIssues: toStringArray(s.COMPLIANCE_ISSUES),
      sentiment: String(s.SENTIMENT ?? ""),
      modelUsed: String(s.MODEL_USED ?? ""),
    },
    actions: actions.map((r) => ({
      actionId: String(r.ACTION_ID),
      title: String(r.ACTION_TITLE),
      detail: String(r.ACTION_DETAIL ?? ""),
      priority: String(r.PRIORITY ?? "中"),
      dueDate: toDate(r.DUE_DATE),
      status: String(r.STATUS ?? ""),
    })),
    benchmark: benchmark.map((r) => ({
      skillTier: String(r.SKILL_TIER),
      avgQuality: toNum(r.AVG_QUALITY),
      avgQuestions: toNum(r.AVG_QUESTIONS),
      avgDeepNeeds: toNum(r.AVG_DEEP_NEEDS),
      avgMissed: toNum(r.AVG_MISSED),
    })),
  }
}

export type MeetingDetail = NonNullable<Awaited<ReturnType<typeof getMeetingDetail>>>

// ---------------------------------------------------------------------------
// Tacit knowledge
// ---------------------------------------------------------------------------

export interface TacitKnowledge {
  knowledgeId: string
  category: string
  patternTitle: string
  patternDetail: string
  whenToUse: string
  talkScript: string
  evidenceQuotes: string[]
  sourceMeetingIds: string[]
  sourceRepName: string
  applicableIndustry: string
  winRate: number
  usageCount: number
  confidence: number
  evidenceVerifiedPct: number
}

export async function getTacitKnowledge(category?: string | null): Promise<TacitKnowledge[]> {
  const cat = category && category !== "all" ? category : null
  const rows = await querySnowflake(`
    SELECT KNOWLEDGE_ID, CATEGORY, PATTERN_TITLE, PATTERN_DETAIL, WHEN_TO_USE, TALK_SCRIPT,
           EVIDENCE_QUOTES, SOURCE_MEETING_IDS, SOURCE_REP_NAME, APPLICABLE_INDUSTRY,
           WIN_RATE, USAGE_COUNT, CONFIDENCE, EVIDENCE_VERIFIED_PCT
    FROM ${AI_SCHEMA}.T_TACIT_KNOWLEDGE
    ${cat ? `WHERE CATEGORY = '${sqlStr(cat)}'` : ""}
    ORDER BY CATEGORY, CONFIDENCE DESC
  `)
  return rows.map((r) => ({
    knowledgeId: String(r.KNOWLEDGE_ID),
    category: String(r.CATEGORY),
    patternTitle: String(r.PATTERN_TITLE),
    patternDetail: String(r.PATTERN_DETAIL),
    whenToUse: String(r.WHEN_TO_USE ?? ""),
    talkScript: String(r.TALK_SCRIPT ?? ""),
    evidenceQuotes: toArray<string>(r.EVIDENCE_QUOTES),
    sourceMeetingIds: toArray<string>(r.SOURCE_MEETING_IDS),
    sourceRepName: String(r.SOURCE_REP_NAME ?? ""),
    applicableIndustry: String(r.APPLICABLE_INDUSTRY ?? "全業種"),
    winRate: toNum(r.WIN_RATE),
    usageCount: toNum(r.USAGE_COUNT),
    confidence: toNum(r.CONFIDENCE),
    evidenceVerifiedPct: toNum(r.EVIDENCE_VERIFIED_PCT),
  }))
}

export async function getKnowledgeStats() {
  const rows = await querySnowflake(`
    SELECT CATEGORY, COUNT(*) AS PATTERNS, ROUND(AVG(CONFIDENCE),2) AS AVG_CONFIDENCE,
           SUM(USAGE_COUNT) AS TOTAL_USAGE
    FROM ${AI_SCHEMA}.T_TACIT_KNOWLEDGE GROUP BY 1 ORDER BY PATTERNS DESC
  `)
  const tiers = await querySnowflake(`
    SELECT SKILL_TIER, ROUND(AVG(QUALITY_SCORE),1) AS AVG_QUALITY,
           ROUND(AVG(HEARING_QUESTION_COUNT),1) AS AVG_QUESTIONS,
           ROUND(AVG(DEEP_NEED_COUNT),2) AS AVG_DEEP_NEEDS,
           COUNT_IF(OUTCOME IN ('成約','ランクアップ')) / NULLIF(COUNT(*),0) AS WIN_RATE,
           COUNT(*) AS MEETINGS
    FROM ${ANALYTICS}.V_MEETING_QUALITY GROUP BY 1
  `)
  return {
    byCategory: rows.map((r) => ({
      category: String(r.CATEGORY),
      patterns: toNum(r.PATTERNS),
      avgConfidence: toNum(r.AVG_CONFIDENCE),
      totalUsage: toNum(r.TOTAL_USAGE),
    })),
    byTier: tiers.map((r) => ({
      skillTier: String(r.SKILL_TIER),
      avgQuality: toNum(r.AVG_QUALITY),
      avgQuestions: toNum(r.AVG_QUESTIONS),
      avgDeepNeeds: toNum(r.AVG_DEEP_NEEDS),
      winRate: toNum(r.WIN_RATE),
      meetings: toNum(r.MEETINGS),
    })),
  }
}

// ---------------------------------------------------------------------------
// Proposal stories & proposals
// ---------------------------------------------------------------------------

export async function getProposalStories(companyId: string | null, repId: string | null) {
  const cid = safeId(companyId)
  const rows = await querySnowflake(`
    SELECT s.STORY_ID, s.COMPANY_ID, c.COMPANY_NAME, s.SALES_REP_ID, s.TITLE, s.HYPOTHESIS,
           s.KEY_ISSUES, s.HEARING_QUESTIONS, s.EXPECTED_OBJECTIONS, s.RECOMMENDED_PRODUCTS,
           s.SIGNAL_EVIDENCE, s.APPLIED_KNOWLEDGE_IDS, s.STATUS, s.MODEL_USED, s.CREATED_AT
    FROM ${AI_SCHEMA}.T_PROPOSAL_STORIES s
    JOIN ${RAW}.T_CUSTOMER_COMPANIES c ON c.COMPANY_ID = s.COMPANY_ID
    WHERE 1=1
      ${cid ? `AND s.COMPANY_ID = '${sqlStr(cid)}'` : ""}
      ${repFilter(repId, "s.SALES_REP_ID")}
    ORDER BY s.CREATED_AT DESC LIMIT 50
  `)
  return rows.map((r) => ({
    storyId: String(r.STORY_ID),
    companyId: String(r.COMPANY_ID),
    companyName: String(r.COMPANY_NAME),
    salesRepId: String(r.SALES_REP_ID ?? ""),
    title: String(r.TITLE ?? ""),
    hypothesis: String(r.HYPOTHESIS ?? ""),
    keyIssues: toStringArray(r.KEY_ISSUES),
    hearingQuestions: toArray<{ question: string; intent: string }>(r.HEARING_QUESTIONS),
    expectedObjections: toArray<{ objection: string; response: string }>(
      toObject<{ items?: unknown }>(r.EXPECTED_OBJECTIONS)?.items ?? r.EXPECTED_OBJECTIONS,
    ),
    recommendedProducts: toArray<{ product: string; reason: string }>(r.RECOMMENDED_PRODUCTS).map(
      (p) => ({ product: String(p.product ?? ""), reason: String(p.reason ?? "") }),
    ),
    signalEvidence: toObject(r.SIGNAL_EVIDENCE),
    appliedKnowledgeIds: toArray<string>(r.APPLIED_KNOWLEDGE_IDS),
    status: String(r.STATUS ?? "DRAFT"),
    modelUsed: String(r.MODEL_USED ?? ""),
    createdAt: toIso(r.CREATED_AT),
  }))
}

export type ProposalStory = Awaited<ReturnType<typeof getProposalStories>>[number]

/** A recommended product as rendered by the UI. */
export interface RecommendedProduct {
  product: string
  reason: string
  estimatedPremium: number
}

/**
 * Normalise the recommended-product array stored in a VARIANT column.
 *
 * The generation prompt asks for `estimated_premium`, so the stored JSON keeps
 * that snake_case key. Map it to camelCase here so the UI has a single shape to
 * render, and tolerate either casing in case a future prompt revision changes.
 */
function toRecommendedProducts(val: unknown): RecommendedProduct[] {
  return toArray<Record<string, unknown>>(val)
    .map((p) => ({
      product: String(p.product ?? p.name ?? ""),
      reason: String(p.reason ?? ""),
      estimatedPremium: toNum(p.estimated_premium ?? p.estimatedPremium),
    }))
    .filter((p) => p.product !== "")
}

export async function getProposals(companyId: string | null, repId: string | null) {
  const cid = safeId(companyId)
  const rows = await querySnowflake(`
    SELECT p.PROPOSAL_ID, p.COMPANY_ID, c.COMPANY_NAME, p.STORY_ID, p.SALES_REP_ID, p.TITLE,
           p.EXECUTIVE_SUMMARY, p.SECTIONS, p.RECOMMENDED_PRODUCTS, p.ESTIMATED_PREMIUM,
           p.DATA_EVIDENCE, p.VERSION, p.STATUS, p.MODEL_USED, p.CREATED_AT
    FROM ${AI_SCHEMA}.T_PROPOSALS p
    JOIN ${RAW}.T_CUSTOMER_COMPANIES c ON c.COMPANY_ID = p.COMPANY_ID
    WHERE 1=1
      ${cid ? `AND p.COMPANY_ID = '${sqlStr(cid)}'` : ""}
      ${repFilter(repId, "p.SALES_REP_ID")}
    ORDER BY p.CREATED_AT DESC LIMIT 50
  `)
  return rows.map((r) => ({
    proposalId: String(r.PROPOSAL_ID),
    companyId: String(r.COMPANY_ID),
    companyName: String(r.COMPANY_NAME),
    storyId: String(r.STORY_ID ?? ""),
    salesRepId: String(r.SALES_REP_ID ?? ""),
    title: String(r.TITLE ?? ""),
    executiveSummary: String(r.EXECUTIVE_SUMMARY ?? ""),
    sections: toArray<{ heading: string; body: string; evidence?: string[] }>(r.SECTIONS),
    recommendedProducts: toRecommendedProducts(r.RECOMMENDED_PRODUCTS),
    estimatedPremium: toNum(r.ESTIMATED_PREMIUM),
    dataEvidence: toObject(r.DATA_EVIDENCE),
    version: toNum(r.VERSION, 1),
    status: String(r.STATUS ?? "DRAFT"),
    modelUsed: String(r.MODEL_USED ?? ""),
    createdAt: toIso(r.CREATED_AT),
  }))
}

export type Proposal = Awaited<ReturnType<typeof getProposals>>[number]

/** Company list for pickers. */
export async function getCompanyOptions(repId: string | null) {
  const rows = await querySnowflake(`
    SELECT COMPANY_ID, COMPANY_NAME, INDUSTRY_LARGE, EMPLOYEE_COUNT, PROSPECT_RANK,
           ATTACK_GRADE, TOTAL_SCORE
    FROM ${ANALYTICS}.V_ATTACK_LIST
    WHERE 1=1 ${repFilter(repId)}
    ORDER BY TOTAL_SCORE DESC
  `)
  return rows.map((r) => ({
    companyId: String(r.COMPANY_ID),
    companyName: String(r.COMPANY_NAME),
    industryLarge: String(r.INDUSTRY_LARGE ?? ""),
    employeeCount: toNum(r.EMPLOYEE_COUNT),
    prospectRank: String(r.PROSPECT_RANK ?? ""),
    grade: String(r.ATTACK_GRADE),
    totalScore: toNum(r.TOTAL_SCORE),
  }))
}

export type CompanyOption = Awaited<ReturnType<typeof getCompanyOptions>>[number]
