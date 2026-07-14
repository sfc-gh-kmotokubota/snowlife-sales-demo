-- ============================================================
-- スノー生命 法人営業DXデモ
-- setup.sql: ワンクリックデプロイ
-- Snowsight の SQL ワークシートに貼り付けて実行してください
-- ============================================================

USE ROLE ACCOUNTADMIN;

-- ウェアハウス作成（既存の COCO_WORKSHOP_WH を使用可。必要に応じて専用WH作成）
CREATE WAREHOUSE IF NOT EXISTS LIFEINSURANCE_DEMO_WH
  WAREHOUSE_SIZE = 'MEDIUM'
  AUTO_SUSPEND = 120
  AUTO_RESUME = TRUE
  COMMENT = 'スノー生命法人営業デモ用ウェアハウス';

-- データベース作成
CREATE DATABASE IF NOT EXISTS LIFEINSURANCE_DEMO_DB
  COMMENT = 'スノー生命 法人営業DXデモ データベース';

-- スキーマ作成
CREATE SCHEMA IF NOT EXISTS LIFEINSURANCE_DEMO_DB.RAW
  COMMENT = '生データ（テーブル・マスタ）';

CREATE SCHEMA IF NOT EXISTS LIFEINSURANCE_DEMO_DB.ANALYTICS
  COMMENT = '分析ビュー・Semantic View';

CREATE SCHEMA IF NOT EXISTS LIFEINSURANCE_DEMO_DB.SEARCH
  COMMENT = 'Cortex Search サービス';

CREATE SCHEMA IF NOT EXISTS LIFEINSURANCE_DEMO_DB.AI
  COMMENT = 'UDF・AI 関連オブジェクト';

-- デモ用ロール
CREATE ROLE IF NOT EXISTS LIFEINSURANCE_DEMO_ROLE
  COMMENT = '法人営業デモ実行ロール';

GRANT USAGE ON WAREHOUSE LIFEINSURANCE_DEMO_WH TO ROLE LIFEINSURANCE_DEMO_ROLE;
GRANT USAGE ON DATABASE LIFEINSURANCE_DEMO_DB TO ROLE LIFEINSURANCE_DEMO_ROLE;
GRANT USAGE ON ALL SCHEMAS IN DATABASE LIFEINSURANCE_DEMO_DB TO ROLE LIFEINSURANCE_DEMO_ROLE;
GRANT ALL PRIVILEGES ON ALL TABLES IN DATABASE LIFEINSURANCE_DEMO_DB TO ROLE LIFEINSURANCE_DEMO_ROLE;
GRANT ALL PRIVILEGES ON FUTURE TABLES IN DATABASE LIFEINSURANCE_DEMO_DB TO ROLE LIFEINSURANCE_DEMO_ROLE;
GRANT ALL PRIVILEGES ON ALL VIEWS IN DATABASE LIFEINSURANCE_DEMO_DB TO ROLE LIFEINSURANCE_DEMO_ROLE;
GRANT ALL PRIVILEGES ON FUTURE VIEWS IN DATABASE LIFEINSURANCE_DEMO_DB TO ROLE LIFEINSURANCE_DEMO_ROLE;
GRANT ROLE LIFEINSURANCE_DEMO_ROLE TO ROLE ACCOUNTADMIN;

-- デフォルトコンテキスト設定
USE WAREHOUSE LIFEINSURANCE_DEMO_WH;
USE DATABASE LIFEINSURANCE_DEMO_DB;
USE SCHEMA RAW;

SELECT 'Setup completed successfully!' AS STATUS;
-- ============================================================
-- 01_ddl.sql: 全テーブル定義 (16 テーブル)
-- ============================================================
USE DATABASE LIFEINSURANCE_DEMO_DB;
USE SCHEMA RAW;
USE WAREHOUSE LIFEINSURANCE_DEMO_WH;

-- ────────────────────────────────────────
-- 1. 顧客企業マスタ（20社）
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_CUSTOMER_COMPANIES (
    COMPANY_ID              VARCHAR(10)   NOT NULL PRIMARY KEY,
    COMPANY_NAME            VARCHAR(100)  NOT NULL,
    COMPANY_NAME_KANA       VARCHAR(100),
    INDUSTRY_LARGE          VARCHAR(50),
    INDUSTRY_DETAIL         VARCHAR(50),
    EMPLOYEE_COUNT          INTEGER,
    EMPLOYEE_COUNT_JAPAN    INTEGER,
    EMPLOYEE_COUNT_OVERSEAS INTEGER,
    HEADQUARTERS            VARCHAR(200),
    PREFECTURE              VARCHAR(20),
    FOUNDED_YEAR            INTEGER,
    ANNUAL_REVENUE_JPY      FLOAT,
    STOCK_MARKET            VARCHAR(30),
    CREDIT_RATING           VARCHAR(10),
    EMPLOYEE_RETENTION_RATE FLOAT,
    AVERAGE_AGE             FLOAT,
    AVERAGE_SALARY_JPY      INTEGER,
    WELFARE_EXPENSE_RATIO   FLOAT,
    TURNOVER_RATE           FLOAT,
    IS_LISTED               BOOLEAN,
    HAS_OVERSEAS_SUBSIDIARY BOOLEAN,
    PENSION_TYPE            VARCHAR(20),
    HEALTH_CERT_STATUS      VARCHAR(100),
    SALES_REP_ID            VARCHAR(10),
    STOCK_TICKER            VARCHAR(20),
    PROSPECT_RANK           CHAR(1),
    YEARS_IN_CHARGE         INTEGER,
    CREATED_AT              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 2. 先方担当者マスタ（60名）
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_CONTACTS (
    CONTACT_ID      VARCHAR(15) NOT NULL PRIMARY KEY,
    COMPANY_ID      VARCHAR(10) NOT NULL,
    FULL_NAME       VARCHAR(100) NOT NULL,
    DEPARTMENT      VARCHAR(100),
    TITLE           VARCHAR(100),
    CONTACT_ROLE    VARCHAR(30),  -- 'DECISION_MAKER' / 'INFLUENCER' / 'WINDOW'
    EMAIL           VARCHAR(200),
    PHONE           VARCHAR(30),
    IS_PRIMARY      BOOLEAN DEFAULT FALSE,
    CREATED_AT      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 3. スノー生命 営業担当者マスタ
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_SALES_REPS (
    SALES_REP_ID    VARCHAR(10) NOT NULL PRIMARY KEY,
    FULL_NAME       VARCHAR(100) NOT NULL,
    DEPARTMENT      VARCHAR(100),
    TITLE           VARCHAR(100),
    EMAIL           VARCHAR(200),
    EXPERIENCE_YEARS INTEGER,
    CREATED_AT      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 4. 面談ヘッダ
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_MEETINGS (
    MEETING_ID          VARCHAR(20) NOT NULL PRIMARY KEY,
    COMPANY_ID          VARCHAR(10) NOT NULL,
    SALES_REP_ID        VARCHAR(10) NOT NULL,
    MEETING_DATE        DATE        NOT NULL,
    MEETING_TYPE        VARCHAR(20),  -- '訪問' / 'オンライン' / '電話'
    DURATION_MINUTES    INTEGER,
    LOCATION            VARCHAR(500),
    AGENDA              TEXT,
    AUDIO_FILE_PATH     VARCHAR(500),
    TRANSCRIPT_STATUS   VARCHAR(20) DEFAULT 'COMPLETED',
    SUMMARY_STATUS      VARCHAR(20) DEFAULT 'COMPLETED',
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 5. 面談文字起こし
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_MEETING_TRANSCRIPTS (
    TRANSCRIPT_ID       VARCHAR(20) NOT NULL PRIMARY KEY,
    MEETING_ID          VARCHAR(20) NOT NULL,
    SPEAKER_LABEL       VARCHAR(100),
    START_TIME_SEC      FLOAT,
    END_TIME_SEC        FLOAT,
    TRANSCRIPT_TEXT     TEXT NOT NULL,
    CONFIDENCE_SCORE    FLOAT,
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 6. AI生成済み面談要約
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_MEETING_SUMMARIES (
    SUMMARY_ID          VARCHAR(20) NOT NULL PRIMARY KEY,
    MEETING_ID          VARCHAR(20) NOT NULL,
    SUMMARY_TEXT        TEXT,
    KEY_ISSUES          ARRAY,       -- 先方の主な関心事項
    ACTION_ITEMS        VARIANT,     -- アクションアイテム（JSON）
    EVENT_MENTIONS      ARRAY,       -- 事業イベント関連発言
    COMPLIANCE_ISSUES   ARRAY,       -- コンプライアンス注意事項
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 7. 見込み管理
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_PROSPECTS (
    PROSPECT_ID         VARCHAR(20) NOT NULL PRIMARY KEY,
    COMPANY_ID          VARCHAR(10) NOT NULL,
    PRODUCT_ID          VARCHAR(10),
    CURRENT_RANK        CHAR(1)     NOT NULL,  -- S / A / B / C
    PREVIOUS_RANK       CHAR(1),
    PROSPECT_AMOUNT     FLOAT,
    PROBABILITY         FLOAT,
    AI_SCORE            FLOAT,
    AI_SCORE_REASON     TEXT,
    RANKUP_ACTIONS      TEXT,
    LAST_EVENT_TRIGGER  VARCHAR(100),
    LAST_EVENT_DATE     DATE,
    EXPECTED_CLOSE_DATE DATE,
    LAST_CONTACT_DATE   DATE,
    DAYS_SINCE_CONTACT  INTEGER,
    SALES_REP_ID        VARCHAR(10),
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 8. 見込みランク昇格チェックリストマスタ
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_PROSPECT_CHECKLIST_MASTER (
    CHECKLIST_ID        VARCHAR(10) NOT NULL PRIMARY KEY,
    FROM_RANK           CHAR(1),
    TO_RANK             CHAR(1),
    CHECK_ITEM          VARCHAR(500),
    CHECK_CATEGORY      VARCHAR(50),
    DISPLAY_ORDER       INTEGER,
    IS_REQUIRED         BOOLEAN DEFAULT TRUE
);

-- ────────────────────────────────────────
-- 9. 保険商品マスタ（14商品）
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_INSURANCE_PRODUCTS (
    PRODUCT_ID          VARCHAR(10) NOT NULL PRIMARY KEY,
    PRODUCT_NAME        VARCHAR(200) NOT NULL,
    PRODUCT_CATEGORY    VARCHAR(50),
    PRODUCT_TYPE        VARCHAR(30),  -- '経営者向け' / '福利厚生'
    EXPENSE_TYPE        VARCHAR(30),  -- '企業保障型' / '自助努力型' / '混合'
    TARGET_AUDIENCE     VARCHAR(200),
    MIN_EMPLOYEES       INTEGER,
    DESCRIPTION         TEXT,
    KEY_BENEFITS        ARRAY,
    TRIGGER_EVENTS      ARRAY,
    RENEWAL_CYCLE       VARCHAR(30),
    INDUSTRY_FIT_SCORE  VARIANT,      -- 業種別適合スコア（JSON）
    SOURCE_URL          VARCHAR(500),
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 10. 非保険サービスマスタ（5サービス）
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_SNOWLIFE_SERVICES (
    SERVICE_ID          VARCHAR(10) NOT NULL PRIMARY KEY,
    SERVICE_NAME        VARCHAR(200) NOT NULL,
    SERVICE_CATEGORY    VARCHAR(50),
    DESCRIPTION         TEXT NOT NULL,
    KEY_FEATURES        ARRAY,
    TARGET_AUDIENCE     VARCHAR(200),
    TRIGGER_EVENTS      ARRAY,
    CROSS_SELL_PRODUCTS ARRAY,
    EXTERNAL_URL        VARCHAR(500),
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 11. 既存契約
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_CONTRACTS (
    CONTRACT_ID         VARCHAR(20) NOT NULL PRIMARY KEY,
    COMPANY_ID          VARCHAR(10) NOT NULL,
    PRODUCT_ID          VARCHAR(10) NOT NULL,
    CONTRACT_DATE       DATE,
    EXPIRY_DATE         DATE,
    ANNUAL_PREMIUM      FLOAT,
    INSURED_COUNT       INTEGER,
    STATUS              VARCHAR(20) DEFAULT 'ACTIVE',
    SALES_REP_ID        VARCHAR(10),
    NOTES               TEXT,
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 12. 次回アクション管理
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_NEXT_ACTIONS (
    ACTION_ID           VARCHAR(20) NOT NULL PRIMARY KEY,
    COMPANY_ID          VARCHAR(10) NOT NULL,
    MEETING_ID          VARCHAR(20),
    ACTION_TITLE        VARCHAR(500) NOT NULL,
    ACTION_DETAIL       TEXT,
    PRIORITY            VARCHAR(10),  -- '高' / '中' / '低'
    DUE_DATE            DATE,
    STATUS              VARCHAR(20) DEFAULT 'OPEN',  -- 'OPEN' / 'DONE' / 'CANCELLED'
    SALES_REP_ID        VARCHAR(10),
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 13. 企業ニュース（400件）
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_COMPANY_NEWS (
    NEWS_ID             VARCHAR(20) NOT NULL PRIMARY KEY,
    COMPANY_ID          VARCHAR(10) NOT NULL,
    NEWS_DATE           DATE        NOT NULL,
    NEWS_SOURCE         VARCHAR(100),
    HEADLINE            VARCHAR(1000) NOT NULL,
    BODY_TEXT           TEXT,
    EVENT_TYPE          VARCHAR(100),
    NEWS_CATEGORY       VARCHAR(50),
    SENTIMENT           VARCHAR(20),  -- 'POSITIVE' / 'NEUTRAL' / 'NEGATIVE'
    INSURANCE_RELEVANCE VARCHAR(10),  -- '最高' / '高' / '中' / '低'
    ALERT_GENERATED     BOOLEAN DEFAULT FALSE,
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 14. 事業イベントアラート
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_EVENT_ALERTS (
    ALERT_ID            VARCHAR(20) NOT NULL PRIMARY KEY,
    COMPANY_ID          VARCHAR(10) NOT NULL,
    DETECTED_AT         TIMESTAMP_NTZ NOT NULL,
    NEWS_ID             VARCHAR(20),
    EVENT_TYPE          VARCHAR(100) NOT NULL,
    EVENT_SUMMARY       TEXT         NOT NULL,
    INSURANCE_RELEVANCE VARCHAR(10),
    ALERT_REASON        TEXT,
    RECOMMENDED_PRODUCTS ARRAY,
    RECOMMENDED_ACTION  TEXT,
    URGENCY_DAYS        INTEGER,
    STATUS              VARCHAR(20) DEFAULT 'UNREAD',
    SALES_REP_ID        VARCHAR(10),
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 15. 企業財務情報（100件：20社×5年）
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_FINANCIAL_DATA (
    FINANCIAL_ID        VARCHAR(20) NOT NULL PRIMARY KEY,
    COMPANY_ID          VARCHAR(10) NOT NULL,
    FISCAL_YEAR         INTEGER     NOT NULL,
    REVENUE_JPY         FLOAT,
    OPERATING_PROFIT    FLOAT,
    NET_PROFIT          FLOAT,
    TOTAL_ASSETS        FLOAT,
    EMPLOYEE_COUNT      INTEGER,
    EMPLOYEE_COUNT_YOY  FLOAT,
    AVERAGE_SALARY      INTEGER,
    WELFARE_EXPENSE_RATIO FLOAT,
    TURNOVER_RATE       FLOAT,
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────
-- 16. 企業拠点情報（地図用）
-- ────────────────────────────────────────
CREATE OR REPLACE TABLE T_COMPANY_LOCATIONS (
    LOCATION_ID         VARCHAR(20) NOT NULL PRIMARY KEY,
    COMPANY_ID          VARCHAR(10) NOT NULL,
    LOCATION_TYPE       VARCHAR(30),
    LOCATION_NAME       VARCHAR(200),
    ADDRESS             VARCHAR(500),
    PREFECTURE          VARCHAR(30),
    CITY                VARCHAR(100),
    LATITUDE            FLOAT        NOT NULL,
    LONGITUDE           FLOAT        NOT NULL,
    EMPLOYEE_COUNT      INTEGER,
    IS_HEADQUARTERS     BOOLEAN DEFAULT FALSE,
    CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

SELECT 'DDL completed: 16 tables created' AS STATUS;
-- ============================================================
-- 02_master_data.sql: マスタデータ INSERT
-- - 20社（顧客企業）
-- - 14保険商品
-- - 5非保険サービス
-- - C→B昇格チェックリスト
-- ============================================================
USE DATABASE LIFEINSURANCE_DEMO_DB;
USE SCHEMA RAW;
USE WAREHOUSE LIFEINSURANCE_DEMO_WH;

-- ────────────────────────────────────────
-- 営業担当者
-- ────────────────────────────────────────
INSERT INTO T_SALES_REPS VALUES
('SR001', '山田 太郎', '法人部 第三営業課', 'シニア営業担当', 'yamada.taro@snowlife-demo.example.com', 12, CURRENT_TIMESTAMP()),
('SR002', '鈴木 花子', '法人部 第三営業課', '営業担当', 'suzuki.hanako@snowlife-demo.example.com', 7, CURRENT_TIMESTAMP()),
('SR003', '田中 次郎', '法人部 第三営業課', '営業担当', 'tanaka.jiro@snowlife-demo.example.com', 5, CURRENT_TIMESTAMP());

-- ────────────────────────────────────────
-- 顧客企業マスタ（20社）
-- ────────────────────────────────────────
INSERT INTO T_CUSTOMER_COMPANIES VALUES
-- C001: トヨタ自動車
('C001','トヨタ自動車(株)','トヨタジドウシャ','製造業','自動車',72700,55000,17700,
 '愛知県豊田市トヨタ町1番地','愛知県',1937,29.3e12,'東証プライム','AA+',
 97.2,41.8,8920000,3.8,2.1,TRUE,TRUE,'DB/DC混合','健康経営優良法人ホワイト500',
 'SR001','7203.T','B',8,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C002: パナソニック HD
('C002','パナソニック ホールディングス(株)','パナソニックホールディングス','製造業','電機・電子',63400,45000,18400,
 '大阪府門真市大字門真1006番地','大阪府',1918,8.2e12,'東証プライム','AA',
 96.5,42.3,7850000,3.6,2.8,TRUE,TRUE,'DB','健康経営優良法人',
 'SR001','6752.T','A',5,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C003: 伊藤忠商事
('C003','伊藤忠商事(株)','イトウチュウショウジ','商社','総合商社',44500,28000,16500,
 '東京都港区北青山2-5-1','東京都',1858,14.5e12,'東証プライム','AA',
 98.1,42.9,12800000,4.2,1.5,TRUE,TRUE,'DC','健康経営優良法人ホワイト500',
 'SR001','8001.T','A',10,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C004: NTTデータグループ
('C004','NTTデータグループ(株)','エヌティティデータグループ','IT・情報','IT・デジタル',190000,140000,50000,
 '東京都江東区豊洲3-3-9','東京都',1988,3.8e12,'東証プライム','AA-',
 95.3,39.8,7650000,3.5,3.2,TRUE,TRUE,'DB/DC混合','健康経営優良法人ホワイト500',
 'SR002','9613.T','B',3,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C005: 野村HD
('C005','野村ホールディングス(株)','ノムラホールディングス','金融業','金融・証券',26000,18000,8000,
 '東京都中央区日本橋1-9-1','東京都',1925,2.1e12,'東証プライム','AA',
 96.8,43.1,15200000,3.9,3.8,TRUE,TRUE,'DB','なし',
 'SR001','8604.T','B',7,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C006: JERA
('C006','JERA(株)','ジェラ','エネルギー','電力・ガス',5100,4800,300,
 '東京都中央区銀座6-19-21','東京都',2015,2.9e12,'非上場','A+',
 94.2,42.6,9500000,4.1,2.3,FALSE,TRUE,'DC','なし',
 'SR002','','C',2,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C007: イオン
('C007','イオン(株)','イオン','小売業','小売・流通',306000,290000,16000,
 '千葉県千葉市美浜区中瀬1-5-1','千葉県',1926,9.6e12,'東証プライム','A+',
 88.3,39.2,5200000,3.3,5.8,TRUE,TRUE,'DC','健康経営優良法人',
 'SR001','8267.T','B',6,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C008: 住友商事
('C008','住友商事(株)','スミトモショウジ','商社','総合商社',48200,30000,18200,
 '東京都千代田区大手町2-3-2','東京都',1919,6.8e12,'東証プライム','AA',
 97.4,43.5,13100000,4.3,1.8,TRUE,TRUE,'DB','なし',
 'SR002','8053.T','C',1,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C009: 鹿島建設
('C009','鹿島建設(株)','カジマケンセツ','建設業','インフラ・建設',21800,18000,3800,
 '東京都港区元赤坂1-3-1','東京都',1840,2.3e12,'東証プライム','AA-',
 95.1,43.8,8450000,3.8,2.6,TRUE,TRUE,'DB','健康経営優良法人',
 'SR003','1812.T','C',4,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C010: 日本郵船
('C010','日本郵船(株)','ニッポンユウセン','輸送業','物流・海運',36000,24000,12000,
 '東京都千代田区丸の内2-3-2','東京都',1885,2.4e12,'東証プライム','A+',
 94.8,44.2,9100000,3.7,3.1,TRUE,TRUE,'DB','なし',
 'SR001','9101.T','B',5,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C011: 武田薬品工業
('C011','武田薬品工業(株)','タケダヤッキンコウギョウ','製造業','製薬・ライフサイエンス',14000,8500,5500,
 '東京都中央区日本橋本町2-1-1','東京都',1781,4.4e12,'東証プライム','A+',
 92.1,42.7,11500000,4.5,4.2,TRUE,TRUE,'DC','健康経営優良法人',
 'SR002','4502.T','B',2,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C012: ANAホールディングス
('C012','ANAホールディングス(株)','エーエヌエーホールディングス','運輸業','航空・旅行',44000,40000,4000,
 '東京都港区東新橋1-5-2','東京都',1952,1.8e12,'東証プライム','BBB+',
 91.5,38.9,6800000,3.4,4.5,TRUE,TRUE,'DC','健康経営優良法人',
 'SR003','9202.T','C',0,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C013: セブン＆アイHD
('C013','セブン＆アイ・ホールディングス(株)','セブンアンドアイホールディングス','小売業','流通・コンビニ',130000,105000,25000,
 '東京都千代田区二番町8-8','東京都',1920,11.4e12,'東証プライム','AA-',
 89.7,38.4,6200000,3.2,5.2,TRUE,TRUE,'DC','健康経営優良法人',
 'SR001','3382.T','B',3,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C014: KDDI
('C014','KDDI(株)','ケーディーディーアイ','情報通信業','通信・IT',48000,43000,5000,
 '東京都千代田区飯田橋3-10-10','東京都',2000,5.8e12,'東証プライム','AA',
 96.2,40.1,8950000,3.9,2.9,TRUE,TRUE,'DC','健康経営優良法人ホワイト500',
 'SR002','9433.T','A',6,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C015: 三菱地所
('C015','三菱地所(株)','ミツビシジショ','不動産業','不動産・開発',10000,9200,800,
 '東京都千代田区大手町1-1-1','東京都',1937,1.4e12,'東証プライム','AA+',
 97.8,43.2,10200000,4.1,1.7,TRUE,TRUE,'DB','なし',
 'SR003','8802.T','C',1,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C016: 日本製鉄
('C016','日本製鉄(株)','ニッポンセイテツ','製造業','鉄鋼・素材',51000,42000,9000,
 '東京都千代田区丸の内2-6-1','東京都',1950,7.6e12,'東証プライム','A+',
 94.3,44.8,8100000,3.6,2.4,TRUE,TRUE,'DB','なし',
 'SR001','5401.T','B',4,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C017: 三井住友FG
('C017','三井住友フィナンシャルグループ(株)','ミツイスミトモフィナンシャルグループ','金融業','銀行・金融',40000,32000,8000,
 '東京都千代田区丸の内1-1-2','東京都',2002,3.9e12,'東証プライム','AA',
 96.9,43.7,12600000,4.0,2.2,TRUE,TRUE,'DB','なし',
 'SR002','8316.T','B',8,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C018: サントリーHD（非上場・IPO準備中）
('C018','サントリーホールディングス(株)','サントリーホールディングス','製造業','飲料・食品',40000,32000,8000,
 '東京都港区台場2-3-3','東京都',1899,4.6e12,'非上場（IPO準備中）','AA',
 95.6,41.3,8800000,3.8,2.9,FALSE,TRUE,'DB','健康経営優良法人',
 'SR003','','C',0,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C019: JR東日本
('C019','東日本旅客鉄道(株)','ヒガシニホンリョカクテツドウ','運輸業','鉄道・インフラ',70000,68000,2000,
 '東京都渋谷区代々木2-2-2','東京都',1987,3.1e12,'東証プライム','AA+',
 97.1,42.8,7850000,3.7,2.0,TRUE,TRUE,'DB','健康経営優良法人',
 'SR001','9020.T','B',5,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP()),

-- C020: 旭化成
('C020','旭化成(株)','アサヒカセイ','製造業','化学・素材・電子',45000,38000,7000,
 '東京都千代田区有楽町1-1-2','東京都',1922,2.8e12,'東証プライム','AA-',
 95.8,42.1,8300000,3.6,2.7,TRUE,TRUE,'DB/DC混合','健康経営優良法人',
 'SR002','3407.T','B',3,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP());

-- ────────────────────────────────────────
-- 担当者マスタ（各社3名：60名）
-- ────────────────────────────────────────
INSERT INTO T_CONTACTS VALUES
-- C001 トヨタ自動車
('CT001','C001','佐藤 一郎','人事本部','常務執行役員 CHRO','DECISION_MAKER','sato.ichiro@toyota.co.jp','052-853-1111',TRUE,CURRENT_TIMESTAMP()),
('CT002','C001','田村 恵子','人事本部 人材戦略部','部長','INFLUENCER','tamura.keiko@toyota.co.jp','052-853-1112',FALSE,CURRENT_TIMESTAMP()),
('CT003','C001','伊藤 健司','人事本部 年金・福利厚生部','課長','WINDOW','ito.kenji@toyota.co.jp','052-853-1113',FALSE,CURRENT_TIMESTAMP()),
-- C002 パナソニック HD
('CT004','C002','中村 正雄','グループ人事部','専務執行役員','DECISION_MAKER','nakamura.masao@panasonic.com','06-6908-1121',TRUE,CURRENT_TIMESTAMP()),
('CT005','C002','松本 由美','グループ人事部 総合厚生課','課長','WINDOW','matsumoto.yumi@panasonic.com','06-6908-1122',FALSE,CURRENT_TIMESTAMP()),
('CT006','C002','橋本 浩二','財務部 年金管理グループ','部長代理','INFLUENCER','hashimoto.koji@panasonic.com','06-6908-1123',FALSE,CURRENT_TIMESTAMP()),
-- C003 伊藤忠商事
('CT007','C003','高橋 誠二','コーポレート本部','常務執行役員 CFO','DECISION_MAKER','takahashi.seiji@itochu.co.jp','03-3497-2121',TRUE,CURRENT_TIMESTAMP()),
('CT008','C003','渡辺 明美','コーポレート本部 人事部','部長','INFLUENCER','watanabe.akemi@itochu.co.jp','03-3497-2122',FALSE,CURRENT_TIMESTAMP()),
('CT009','C003','小林 洋一','コーポレート本部 人事部 福利厚生室','室長','WINDOW','kobayashi.yoichi@itochu.co.jp','03-3497-2123',FALSE,CURRENT_TIMESTAMP()),
-- C004 NTTデータグループ
('CT010','C004','加藤 真一','人事統括本部','執行役員 CHRO','DECISION_MAKER','kato.shinichi@nttdata.com','03-5546-8121',TRUE,CURRENT_TIMESTAMP()),
('CT011','C004','山口 美佳','人事統括本部 総合人事部','課長','WINDOW','yamaguchi.mika@nttdata.com','03-5546-8122',FALSE,CURRENT_TIMESTAMP()),
('CT012','C004','斎藤 大介','財務部','部長','INFLUENCER','saito.daisuke@nttdata.com','03-5546-8123',FALSE,CURRENT_TIMESTAMP()),
-- C005 野村HD
('CT013','C005','松田 浩司','グループ人事部','常務執行役員','DECISION_MAKER','matsuda.koji@nomura.co.jp','03-3278-1021',TRUE,CURRENT_TIMESTAMP()),
('CT014','C005','福田 清美','グループ人事部 福利厚生課','課長','WINDOW','fukuda.kiyomi@nomura.co.jp','03-3278-1022',FALSE,CURRENT_TIMESTAMP()),
('CT015','C005','坂本 隆','財務企画部','部長','INFLUENCER','sakamoto.takashi@nomura.co.jp','03-3278-1023',FALSE,CURRENT_TIMESTAMP()),
-- C006 JERA
('CT016','C006','西田 晃','人事部','部長','DECISION_MAKER','nishida.akira@jera.co.jp','03-6263-7001',TRUE,CURRENT_TIMESTAMP()),
('CT017','C006','村田 幸子','人事部 福利厚生担当','担当リーダー','WINDOW','murata.sachiko@jera.co.jp','03-6263-7002',FALSE,CURRENT_TIMESTAMP()),
('CT018','C006','大野 賢治','経営企画部','課長','INFLUENCER','ohno.kenji@jera.co.jp','03-6263-7003',FALSE,CURRENT_TIMESTAMP()),
-- C007 イオン
('CT019','C007','岡田 浩子','グループ人事部','上席執行役員 CHRO','DECISION_MAKER','okada.hiroko@aeon.info','043-212-6001',TRUE,CURRENT_TIMESTAMP()),
('CT020','C007','三浦 隆之','グループ人事部 給与・福利厚生部','部長','INFLUENCER','miura.takayuki@aeon.info','043-212-6002',FALSE,CURRENT_TIMESTAMP()),
('CT021','C007','池田 美穂','グループ人事部 給与・福利厚生部','課長','WINDOW','ikeda.miho@aeon.info','043-212-6003',FALSE,CURRENT_TIMESTAMP());

-- C014 KDDI（デモメイン企業のひとつ）
INSERT INTO T_CONTACTS VALUES
('CT040','C014','前田 義雄','パーソナル・スマートライフ本部','専務執行役員 CHRO','DECISION_MAKER','maeda.yoshio@kddi.com','03-3347-0077',TRUE,CURRENT_TIMESTAMP()),
('CT041','C014','野沢 裕子','コーポレート統括本部 人事部','部長','INFLUENCER','nozawa.hiroko@kddi.com','03-3347-0078',FALSE,CURRENT_TIMESTAMP()),
('CT042','C014','浜田 光雄','コーポレート統括本部 人事部 厚生課','課長','WINDOW','hamada.mitsuo@kddi.com','03-3347-0079',FALSE,CURRENT_TIMESTAMP());

-- C018 サントリーHD（IPO準備中）
INSERT INTO T_CONTACTS VALUES
('CT052','C018','新浪 文博','経営企画本部','専務執行役員 CFO','DECISION_MAKER','niinami.fumihiro@suntory.com','03-3477-1122',TRUE,CURRENT_TIMESTAMP()),
('CT053','C018','岩田 利恵','人事本部','人事部長','INFLUENCER','iwata.rie@suntory.com','03-3477-1123',FALSE,CURRENT_TIMESTAMP()),
('CT054','C018','川口 健二','人事本部 福利厚生部','課長','WINDOW','kawaguchi.kenji@suntory.com','03-3477-1124',FALSE,CURRENT_TIMESTAMP());

-- ────────────────────────────────────────
-- 保険商品マスタ（14商品・スノー生命公式サイト準拠）
-- ────────────────────────────────────────
-- T_INSURANCE_PRODUCTS: INSERT SELECT 形式（ARRAY/VARIANT対応）
-- カテゴリA: 経営者向け（4商品）
INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P001','長期定期保険','経営者向け','経営者向け','企業保障型','役員・経営者',NULL, '保険期間が長期にわたる定期保険です。長期にわたる死亡保障が確保でき、契約者様が法人の場合には、退職慰労金等の財源として活用もできます。', PARSE_JSON('["長期死亡保障","役員退職慰労金の財源確保","事業保障・緊急運転資金"]'), PARSE_JSON('["経営陣交代","IPO","業績好調","後継者問題"]'), '長期',PARSE_JSON('{"製造業":80,"商社":75,"IT":70,"金融":85,"エネルギー":70,"小売":65,"建設":72,"物流":68,"製薬":75,"航空":65}'), 'https://www.snowlife-demo.example.com/hojin/shohin/keiei/chokiteiki/',CURRENT_TIMESTAMP();

INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P002','傷害保障重点期間設定型長期定期保険','経営者向け','経営者向け','企業保障型','役員・経営者',NULL, '保険期間が長期にわたる経営者様向けの商品です。長期にわたる（傷害）死亡保障が確保でき、退職慰労金等の財源として活用もできます。', PARSE_JSON('["傷害死亡を重点保障","退職慰労金財源","経営者の業務リスクに対応"]'), PARSE_JSON('["経営陣交代","IPO"]'), '長期',PARSE_JSON('{"製造業":75,"商社":72,"IT":65,"金融":80,"エネルギー":68,"小売":60,"建設":78,"物流":65,"製薬":70,"航空":72}'), 'https://www.snowlife-demo.example.com/hojin/shohin/keiei/zyutenkikan_chokiteiki/',CURRENT_TIMESTAMP();

INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P003','傷害死亡重点期間設定型介護保障保険','経営者向け','経営者向け','企業保障型','役員・経営者',NULL, '保険期間が長期にわたる経営者様向けの商品です。長期にわたる（傷害）死亡保障と要介護状態に備える保障が確保でき、退職慰労金等の財源として活用もできます。', PARSE_JSON('["傷害死亡保障","要介護保障","長期的な経営者保護"]'), PARSE_JSON('["経営陣交代","経営者の高齢化"]'), '長期',PARSE_JSON('{"製造業":70,"商社":68,"IT":60,"金融":75,"エネルギー":65,"小売":58,"建設":70,"物流":62,"製薬":68,"航空":65}'), 'https://www.snowlife-demo.example.com/hojin/shohin/keiei/jutenkikan-kaigo/index.html',CURRENT_TIMESTAMP();

INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P004','逓増定期保険','経営者向け','経営者向け','企業保障型','役員・経営者',NULL, '事業の発展とともに重くなる経営者様の責任にあわせ、保険料は一定で保険金額が増加する経営者様向けの商品です。退職慰労金等の財源として活用もできます。', PARSE_JSON('["保険料一定・保険金額段階的増加","事業成長に合わせた保障","退職慰労金財源"]'), PARSE_JSON('["業績拡大","新規上場","設備投資"]'), '長期',PARSE_JSON('{"製造業":75,"商社":72,"IT":70,"金融":78,"エネルギー":65,"小売":62,"建設":70,"物流":65,"製薬":72,"航空":68}'), 'https://www.snowlife-demo.example.com/hojin/shohin/keiei/teizoteiki/',CURRENT_TIMESTAMP();

-- カテゴリB: 従業員の死亡保障（3商品）
INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P005','総合福祉団体定期保険','福利厚生（死亡保障）','福利厚生','企業保障型','全従業員',100, '従業員に万一のことがあった場合、企業が定める福利厚生規程（死亡退職金規程など）の円滑な運営を目的とするものであり、従業員が死亡または所定の高度障がい状態になった場合に、死亡退職金規程などの諸規程に基づいて支給される金額を、設定保険金額の範囲内で、死亡保険金または高度障がい保険金としてお支払いします。', PARSE_JSON('["死亡退職金規程の財源準備","高度障がい保障も付帯可","企業の福利厚生充実"]'), PARSE_JSON('["M&A後統合","グループ再編","中計発表（人材投資）","大規模採用"]'), '年次',PARSE_JSON('{"製造業":90,"商社":88,"IT":85,"金融":82,"エネルギー":85,"小売":88,"建設":87,"物流":86,"製薬":83,"航空":85}'), 'https://www.snowlife-demo.example.com/hojin/shohin/fukuri/shibo/',CURRENT_TIMESTAMP();

INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P006','みんなの団体定期保険（新無配当扱特約付団体定期保険）','福利厚生（死亡保障）','福利厚生','企業保障型・自助努力型混合','全従業員（100名〜）',100, 'この保険は、従業員負担の任意加入部分に企業負担の全員加入部分を付加した死亡保障制度です。当商品は加入申込や諸事務等を原則デジタル完結とすることで、これまで一般的に従業員数1,000名以上の企業様ではないと導入が難しかったところ、100名以上の企業様にも導入いただきやすくなりました。', PARSE_JSON('["デジタル完結で事務軽減","100名以上から導入可","企業負担+従業員任意のハイブリッド"]'), PARSE_JSON('["大規模採用","100名超の中堅企業"]'), '年次',PARSE_JSON('{"製造業":80,"商社":75,"IT":85,"金融":78,"エネルギー":82,"小売":88,"建設":78,"物流":80,"製薬":82,"航空":80}'), 'https://www.snowlife-demo.example.com/hojin/shohin/fukuri/shibo/',CURRENT_TIMESTAMP();

INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P007','希望者グループ保険（団体定期保険）','福利厚生（死亡保障）','福利厚生','自助努力型','全従業員（任意加入）',NULL, 'この保険は、従業員が任意に加入し、企業が選定した保険金額ランク内で従業員各人が選択した保険金額を、死亡または所定の高度障がい状態になった場合に、死亡保険金または高度障がい保険金としてお支払いする任意加入団体定期保険です。', PARSE_JSON('["従業員がライフステージに合わせ保障額を選択","費用負担のスケールメリット","任意加入で柔軟"]'), PARSE_JSON('["採用強化（福利厚生アピール）","健康経営認定"]'), '年次',PARSE_JSON('{"製造業":78,"商社":75,"IT":82,"金融":75,"エネルギー":78,"小売":80,"建設":75,"物流":75,"製薬":80,"航空":78}'), 'https://www.snowlife-demo.example.com/hojin/shohin/fukuri/shibo/',CURRENT_TIMESTAMP();

-- カテゴリC: 従業員の医療保障（3商品）
INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P008','総合医療保険（団体型）','福利厚生（医療保障）','福利厚生','企業保障型・自助努力型','全従業員',NULL, 'この保険は、企業・団体を対象とする団体保険で、企業の役員・従業員や団体の所属員のうち被保険者となられた方が所定の入院をした場合に入院給付金を、所定の手術等を受けた場合に手術給付金等をお受取りになれる保険です。', PARSE_JSON('["入院・手術保障","女性特定疾病の倍額設定可","入院療養給付金も設定可能"]'), PARSE_JSON('["健康経営申請","採用競争激化","CHRO交代"]'), '年次',PARSE_JSON('{"製造業":85,"商社":82,"IT":88,"金融":80,"エネルギー":82,"小売":87,"建設":80,"物流":82,"製薬":88,"航空":85}'), 'https://www.snowlife-demo.example.com/hojin/shohin/fukuri/iryo/',CURRENT_TIMESTAMP();

INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P009','3大疾病保障保険（団体型）','福利厚生（医療保障）','福利厚生','企業保障型・自助努力型','全従業員',NULL, 'この保険は、企業・団体を対象とする団体保険で、企業の役員・従業員や団体の所属員のうち被保険者となられた方が所定の3大疾病〔がん（悪性新生物）・急性心筋梗塞・脳卒中〕になられた場合に3大疾病保険金を支払います。', PARSE_JSON('["がん・急性心筋梗塞・脳卒中に対する一時金","就労不能補完にも活用","上皮内新生物診断保険金も支払可"]'), PARSE_JSON('["健康経営強化","平均年齢高い企業","メンタルヘルス対策"]'), '年次',PARSE_JSON('{"製造業":82,"商社":80,"IT":85,"金融":78,"エネルギー":80,"小売":83,"建設":78,"物流":80,"製薬":85,"航空":80}'), 'https://www.snowlife-demo.example.com/hojin/shohin/fukuri/iryo/',CURRENT_TIMESTAMP();

INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P010','無配当扱特約付介護保障保険（団体型）','福利厚生（医療保障）','福利厚生','企業保障型・自助努力型','全従業員',NULL, 'この保険は、企業・団体を対象とする団体保険で、企業の役員・従業員や団体の所属員のうち、被保険者となられた方が所定の要介護状態になられた場合に介護保険金をお受取りになれる保険です。', PARSE_JSON('["要介護状態になった場合の一時金","介護離職防止に貢献","企業の介護支援制度の財源"]'), PARSE_JSON('["高齢化対策","介護離職防止の経営課題"]'), '年次',PARSE_JSON('{"製造業":78,"商社":75,"IT":72,"金融":75,"エネルギー":78,"小売":80,"建設":75,"物流":75,"製薬":78,"航空":72}'), 'https://www.snowlife-demo.example.com/hojin/shohin/fukuri/iryo/',CURRENT_TIMESTAMP();

-- カテゴリD: 従業員の休業補償（2商品）
INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P011','新団体就業不能保障保険','福利厚生（休業補償）','福利厚生','企業保障型','全従業員',NULL, 'この保険は、企業・団体を対象とする団体保険で、企業の役員・従業員や、団体の所属員が所定の就業不能状態となった場合に休業補償規程などに基づき支給される金額を設定金額・期間の範囲内で就業不能保険金としてお支払いします。', PARSE_JSON('["就業不能時の休業補償給付財源","健康保険の傷病手当金を補完","企業の福利厚生制度充実"]'), PARSE_JSON('["健康経営強化","離職防止","メンタルヘルス対策"]'), '年次',PARSE_JSON('{"製造業":82,"商社":80,"IT":85,"金融":78,"エネルギー":80,"小売":82,"建設":80,"物流":80,"製薬":85,"航空":82}'), 'https://www.snowlife-demo.example.com/hojin/shohin/fukuri/kyugyo/',CURRENT_TIMESTAMP();

INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P012','団体長期障害所得補償保険（GLTD）','福利厚生（休業補償）','福利厚生','企業保障型・自助努力型','全従業員（任意加入）',NULL, '団体長期障害所得補償保険は、英語名称GLTD（Group Long Term Disability）と称されます。この保険は、病気やケガで従業員の方が長期にわたり働けなくなった場合に、所得の「一定額」または「一定率」を補償する所得補償型の保険です。', PARSE_JSON('["長期就業不能時に所得の一定額・率を補償","親介護一時金支払特約付帯可能","高スキル人材の長期的な所得保護"]'), PARSE_JSON('["健康経営申請（優良法人ホワイト500）","採用強化","CHRO交代"]'), '年次',PARSE_JSON('{"製造業":85,"商社":82,"IT":90,"金融":82,"エネルギー":82,"小売":80,"建設":78,"物流":78,"製薬":90,"航空":83}'), 'https://www.snowlife-demo.example.com/hojin/shohin/fukuri/kyugyo/',CURRENT_TIMESTAMP();

-- カテゴリE: 退職後保障・年金（2商品）
INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P013','確定給付企業年金（DB）','福利厚生（年金）','福利厚生','企業保障型','全従業員',NULL, '確定給付企業年金は、確定給付企業年金法に基づき、あらかじめ定めた算定式に基づく給付を受取る年金制度です。事業主が掛金を拠出し、年金資産に積立不足が発生した場合、一定期間内に解消されるように掛金を追加拠出しなければならない「積立義務」が定められています。', PARSE_JSON('["確定給付による安定した老後保障","会社が全額拠出","長期勤続従業員への充実した退職給付"]'), PARSE_JSON('["退職給付制度改定","積立不足","M&A後統合"]'), '確定給付',PARSE_JSON('{"製造業":88,"商社":85,"IT":78,"金融":90,"エネルギー":88,"小売":82,"建設":85,"物流":82,"製薬":82,"航空":85}'), 'https://www.snowlife-demo.example.com/hojin/shohin/fukuri/taishoku/',CURRENT_TIMESTAMP();

INSERT INTO T_INSURANCE_PRODUCTS SELECT 'P014','確定拠出年金（企業型・DC）','福利厚生（年金）','福利厚生','企業保障型','全従業員',NULL, '確定拠出年金は、確定拠出年金法に基づき、あらかじめ定めた掛金を事業主が年1回以上定期的に拠出し、従業員自身が行った運用の結果を60歳以降に給付として受取る年金制度です。', PARSE_JSON('["掛金確定で企業の財務負担が明確","従業員が自ら資産形成","ポータブルで転職時も継続可能"]'), PARSE_JSON('["DB→DC移行","新規DC導入","中計発表（人材投資）"]'), '確定拠出',PARSE_JSON('{"製造業":85,"商社":88,"IT":95,"金融":82,"エネルギー":85,"小売":85,"建設":80,"物流":80,"製薬":90,"航空":85}'), 'https://www.snowlife-demo.example.com/hojin/shohin/fukuri/taishoku/',CURRENT_TIMESTAMP();

-- ────────────────────────────────────────
-- 非保険サービスマスタ（5サービス）
-- ────────────────────────────────────────
-- T_SNOWLIFE_SERVICES: INSERT SELECT 形式（ARRAY/VARIANT対応）
INSERT INTO T_SNOWLIFE_SERVICES SELECT 'S001','Wellness-Star☆（スノー生命健康増進コンサルティングサービス）','ヘルスケア', '従業員の健診・医療データを活用したデータヘルス計画の策定支援。保険だけでなく「リスクを軽減する」ヘルスケアサービスを提供し、健康経営優良法人の認定取得を支援する。', PARSE_JSON('["健康診断データの分析・可視化","データヘルス計画策定支援","保健事業PDCA支援","健康経営優良法人申請サポート","労働生産性向上施策提案"]'), '人事部長・健康保険組合担当者・CHRO', PARSE_JSON('["健康経営認定取得・申請","大規模採用（健康管理の重要性増大）","CHRO交代"]'), PARSE_JSON('["P008","P011","P012"]'), 'https://www.snowlife-demo.example.com/hojin/wellness_star/',CURRENT_TIMESTAMP();

INSERT INTO T_SNOWLIFE_SERVICES SELECT 'S002','Biz-Create® by Snow Life（ビジネスマッチングサービス）','ビジネス支援', '全国約1,500の営業網・約27.9万社ネットワークを活かしたビジネスマッチング。Web上でビジネスパートナーを探し、スノー生命の営業担当者がサポートして商談実現まで支援する。', PARSE_JSON('["27.9万社ネットワークへのアクセス","Web上でのニーズ登録・商談申込","営業担当者によるマッチングサポート","定期的な企業交流会・商談会への参加"]'), '経営企画部長・事業開発部長・経営者', PARSE_JSON('["M&A後統合（新たなビジネスパートナー探し）","海外展開（国内販路の再構築）","新規事業立上げ","中計発表（新規事業・販路拡大）"]'), PARSE_JSON('["P001","P004"]'), 'https://www.snowlife-demo.example.com/hojin/businessmatching/',CURRENT_TIMESTAMP();

INSERT INTO T_SNOWLIFE_SERVICES SELECT 'S003','私募債（特定投資家向け直接金融）','資金調達', '株式会社が比較的長期の資金調達を目的として、特定の投資家（スノー生命）に対して発行する債券。直接金融への足がかりとなり、金融機関からの借入に依存しない資金調達多様化を実現する。', PARSE_JSON('["直接金融比率の向上","借入依存からの脱却","取締役会決議で発行可能","長期安定資金の確保"]'), 'CFO・財務部長', PARSE_JSON('["IPO準備","M&A・買収資金調達","大型設備投資・新工場建設","海外展開資金"]'), PARSE_JSON('["P001","P002"]'), 'https://www.snowlife-demo.example.com/hojin/shikin/shibosai/',CURRENT_TIMESTAMP();

INSERT INTO T_SNOWLIFE_SERVICES SELECT 'S004','資産運用サービス（スノーアセットマネジメント）','資産運用', 'スノーアセットマネジメントが提供する投資一任・投資信託商品。企業年金（DB・DC）の年金資産運用に最適化されたサービス。退職給付債務の安定化に貢献する。', PARSE_JSON('["DB年金の積立不足解消支援","DC年金の運用商品選定アドバイス","投資一任契約による専門運用","年金ポートフォリオの最適化"]'), '財務部長・CFO・年金委員会', PARSE_JSON('["退職給付制度改定","DB→DC移行","積立不足の深刻化","金利変動リスク対応"]'), PARSE_JSON('["P013","P014"]'), 'https://www.snowlife-am.example.com/',CURRENT_TIMESTAMP();

INSERT INTO T_SNOWLIFE_SERVICES SELECT 'S005','損害保険（スノー損害保険との業務提携）','損害保険', 'スノー損害保険との業務提携により、生命保険と損害保険を組み合わせた総合的なリスクマネジメントサービスを提供。法人の多様なリスクをワンストップでカバーする。', PARSE_JSON('["生保+損保のワンストップ提案","海外勤務者の総合保護（生保+損保）","事業用財産の損害保険","企業向け賠償責任保険"]'), '総務部長・リスク管理部長・CFO', PARSE_JSON('["海外展開・現地法人設立","大型設備投資・新工場建設","M&A後リスク統合管理"]'), PARSE_JSON('["P005","P006"]'), 'https://www.snowlife-sonpo.example.com/',CURRENT_TIMESTAMP();

-- ────────────────────────────────────────
-- C→B 昇格チェックリストマスタ
-- ────────────────────────────────────────
INSERT INTO T_PROSPECT_CHECKLIST_MASTER VALUES
('CK001','C','B','キーパーソン（人事部長/CHRO）との面談を実施した','関係構築',1,TRUE),
('CK002','C','B','企業の主要課題（退職給付・健康経営等）を確認した','課題把握',2,TRUE),
('CK003','C','B','現在の保険契約状況・競合会社を把握した','競合確認',3,TRUE),
('CK004','C','B','予算規模（年間保険料の概算）を確認した','予算確認',4,TRUE),
('CK005','C','B','決裁者（CFO/取締役）へのアクセスを確認した','予算確認',5,TRUE),
('CK006','C','B','少なくとも1商品の具体的な提案書を提示した','提案',6,FALSE),
('CK007','C','B','次回商談日時に合意した','関係構築',7,FALSE),
('CK008','B','A','経営層（役員/取締役）との複数回の面談を実施した','関係構築',1,TRUE),
('CK009','B','A','具体的な保険料・保障額の試算を提示した','提案',2,TRUE),
('CK010','B','A','競合との差別化ポイントを明確に説明した','競合確認',3,TRUE),
('CK011','B','A','稟議・予算承認のスケジュールを確認した','予算確認',4,TRUE),
('CK012','B','A','全商品ラインアップの提案書を提示した','提案',5,FALSE);

SELECT 'Master data loaded: 20 companies, 14 products, 5 services' AS STATUS;

-- ============================================================
-- SECTION 4: Cortex 有効化
-- ============================================================
ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';

-- ============================================================
-- SECTION 5: ダミーデータ生成 (JavaScript SP)
-- ============================================================
USE DATABASE LIFEINSURANCE_DEMO_DB;
USE SCHEMA RAW;
USE WAREHOUSE LIFEINSURANCE_DEMO_WH;

CREATE OR REPLACE PROCEDURE GENERATE_DEMO_DATA()
RETURNS STRING
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS $$
var companies=[{id:'C001',name:'トヨタ自動車(株)',ind:'製造業',rank:'B',emp:72700,lat:35.0459,lon:137.1587},{id:'C002',name:'パナソニック ホールディングス(株)',ind:'製造業',rank:'A',emp:63400,lat:34.7860,lon:135.5641},{id:'C003',name:'伊藤忠商事(株)',ind:'商社',rank:'A',emp:44500,lat:35.6756,lon:139.7640},{id:'C004',name:'NTTデータグループ(株)',ind:'IT',rank:'B',emp:190000,lat:35.6818,lon:139.7636},{id:'C005',name:'野村ホールディングス(株)',ind:'金融',rank:'B',emp:26000,lat:35.6685,lon:139.7658},{id:'C006',name:'JERA(株)',ind:'エネルギー',rank:'C',emp:5100,lat:35.4437,lon:139.6380},{id:'C007',name:'イオン(株)',ind:'小売',rank:'B',emp:306000,lat:35.6285,lon:140.1129},{id:'C008',name:'住友商事(株)',ind:'商社',rank:'C',emp:48200,lat:34.6802,lon:135.4950},{id:'C009',name:'鹿島建設(株)',ind:'建設',rank:'C',emp:21800,lat:35.6656,lon:139.7458},{id:'C010',name:'日本郵船(株)',ind:'物流',rank:'B',emp:36000,lat:35.4489,lon:139.6500},{id:'C011',name:'武田薬品工業(株)',ind:'製薬',rank:'B',emp:14000,lat:34.6852,lon:135.5100},{id:'C012',name:'ANAホールディングス(株)',ind:'航空',rank:'C',emp:44000,lat:35.5441,lon:139.7800},{id:'C013',name:'セブン＆アイ・ホールディングス(株)',ind:'小売',rank:'B',emp:130000,lat:35.6915,lon:139.7002},{id:'C014',name:'KDDI(株)',ind:'IT通信',rank:'A',emp:48000,lat:35.6564,lon:139.7366},{id:'C015',name:'三菱地所(株)',ind:'不動産',rank:'C',emp:10000,lat:35.6826,lon:139.7639},{id:'C016',name:'日本製鉄(株)',ind:'鉄鋼',rank:'B',emp:51000,lat:35.6712,lon:139.7630},{id:'C017',name:'三井住友フィナンシャルグループ(株)',ind:'金融',rank:'B',emp:40000,lat:34.6859,lon:135.4965},{id:'C018',name:'サントリーホールディングス(株)',ind:'食品',rank:'C',emp:40000,lat:34.6911,lon:135.4966},{id:'C019',name:'東日本旅客鉄道(株)',ind:'鉄道',rank:'B',emp:70000,lat:35.6812,lon:139.7671},{id:'C020',name:'旭化成(株)',ind:'化学',rank:'B',emp:45000,lat:35.6611,lon:139.7291}];
var evTypes=['M&A','経営陣交代','大規模採用','健康経営','退職給付制度改定','中期経営計画','IPO','設備投資'];
var rels=['最高','高','高','中','高','中','最高','中'];
var targets=['子会社#1','子会社#2','子会社#3','子会社#4','子会社#5','子会社#6','子会社#7'];
var persons=['佐藤氏','田中氏','鈴木氏','高橋氏','伊藤氏','渡辺氏'];
var mTypes=['訪問','オンライン','電話'];
var spkrs=['担当者（顧客）','部長（顧客）','山田（スノー生命）','鈴木（スノー生命）'];
var pIds=['P001','P002','P003','P004','P005','P006','P007','P008','P009','P010','P011','P012','P013','P014'];
var q=function(s){return s.replace(/'/g,"''");};
var nid=1,aid=1,mid=1,trid=1,pid=1,coid=1;
for(var ci=0;ci<companies.length;ci++){var c=companies[ci];
for(var ni=0;ni<20;ni++){var nidS='NW'+String(nid).padStart(4,'0');nid++;var eti=ni%evTypes.length;var et=evTypes[eti];var rel=rels[eti];var da=Math.floor(Math.random()*365)+1;var d=new Date();d.setDate(d.getDate()-da);var ds=d.toISOString().split('T')[0];var tgt=targets[Math.floor(Math.random()*targets.length)];var per=persons[Math.floor(Math.random()*persons.length)];var amt=Math.floor(Math.random()*500)+50;var emps=Math.floor(Math.random()*3000)+500;
var hl=q(c.name+'が'+et+'に関する動き: '+tgt);var bd=q(c.name+'の'+et+'関連ニュース。'+per+'が関与。影響額'+amt+'億円規模。従業員'+emps+'名に影響。');var act=q(c.name+'の人事部長・CFOへ今週中にアポを設定。'+et+'に関連する提案書を準備する。');
snowflake.execute({sqlText:"INSERT INTO T_COMPANY_NEWS(NEWS_ID,COMPANY_ID,HEADLINE,BODY_TEXT,NEWS_DATE,EVENT_TYPE,INSURANCE_RELEVANCE,NEWS_SOURCE)VALUES('"+nidS+"','"+c.id+"','"+q(hl)+"','"+q(bd)+"','"+ds+"','"+et+"','"+rel+"','日経新聞')"});
if(ni<2&&(rel==='最高'||rel==='高')){var aidS='AL'+String(aid).padStart(4,'0');aid++;snowflake.execute({sqlText:"INSERT INTO T_EVENT_ALERTS(ALERT_ID,COMPANY_ID,DETECTED_AT,EVENT_TYPE,EVENT_SUMMARY,INSURANCE_RELEVANCE,ALERT_REASON,RECOMMENDED_ACTION,URGENCY_DAYS,STATUS)VALUES('"+aidS+"','"+c.id+"',CURRENT_TIMESTAMP(),'"+et+"','"+q(bd)+"','"+rel+"','最高優先度','"+q(act)+"',3,'UNREAD')"});}}}

var topics=['退職給付制度','福利厚生','DC移行','GLTD導入','健康経営','保険見直し','新商品提案','契約更新'];
var txts=['の{t}について議論しました。現在の制度の課題と改善案を検討中です。','としては、{c}様の従業員{e}名の保障充実を最優先に提案いたします。','競合他社の提案も受けているが、スノー生命の商品ラインナップが最も充実していると評価いただいている。','DC移行に関しては、従業員説明会のサポートも含めた包括提案をお願いしたい。','次回は具体的な試算結果を持って再訪問させていただきます。'];
for(var ci=0;ci<companies.length;ci++){var c=companies[ci];for(var mi=0;mi<8;mi++){var midS='MT'+String(mid).padStart(4,'0');mid++;var da=Math.floor(Math.random()*300)+1;var d=new Date();d.setDate(d.getDate()-da);var ds=d.toISOString().split('T')[0];var mt=mTypes[mi%3];var att=Math.floor(Math.random()*4)+2;var dur=(Math.floor(Math.random()*4)+2)*15;var tp=topics[mi];
snowflake.execute({sqlText:"INSERT INTO T_MEETINGS(MEETING_ID,COMPANY_ID,SALES_REP_ID,MEETING_DATE,MEETING_TYPE,DURATION_MINUTES,AGENDA,CREATED_AT)VALUES('"+midS+"','"+c.id+"','SR001','"+ds+"','"+mt+"',"+dur+",'"+q(tp)+"',CURRENT_TIMESTAMP())"});
for(var ti=0;ti<5;ti++){var tridS='TR'+String(trid).padStart(5,'0');trid++;var spk=spkrs[ti%spkrs.length];var tx=q(txts[ti].replace('{t}',tp).replace('{c}',c.name).replace('{e}',String(c.emp)));
snowflake.execute({sqlText:"INSERT INTO T_MEETING_TRANSCRIPTS(TRANSCRIPT_ID,MEETING_ID,START_TIME_SEC,SPEAKER_LABEL,TRANSCRIPT_TEXT,CREATED_AT)VALUES('"+tridS+"','"+midS+"',"+(ti*30)+",'"+spk+"','"+q(tx)+"',CURRENT_TIMESTAMP())"});}}}

for(var ci=0;ci<companies.length;ci++){var c=companies[ci];for(var yr=2021;yr<=2025;yr++){var fid='FIN'+String(ci*5+(yr-2021)+1).padStart(4,'0');var rev=Math.floor(Math.random()*5e12)+1e11;var op=Math.floor(rev*(Math.random()*0.15+0.03));var net=Math.floor(op*(Math.random()*0.4+0.4));var ta=Math.floor(rev*(Math.random()*3+1));var eq=Math.floor(ta*(Math.random()*0.3+0.2));var ec=c.emp+Math.floor(Math.random()*2000-1000);var rb=Math.floor(Math.random()*500e8)+10e8;
snowflake.execute({sqlText:"INSERT INTO T_FINANCIAL_DATA(FINANCIAL_ID,COMPANY_ID,FISCAL_YEAR,REVENUE_JPY,OPERATING_PROFIT,NET_PROFIT,TOTAL_ASSETS,EMPLOYEE_COUNT,CREATED_AT)VALUES('"+fid+"','"+c.id+"',"+yr+","+rev+","+op+","+net+","+ta+","+ec+",CURRENT_TIMESTAMP())"});}}
for(var ci=0;ci<companies.length;ci++){var c=companies[ci];var np=c.rank==='A'?4:c.rank==='B'?3:2;for(var pi2=0;pi2<np;pi2++){var pidS='PR'+String(pid).padStart(4,'0');pid++;var pIdx=(ci*3+pi2)%pIds.length;var am=Math.floor(Math.random()*2e9)+1e7;var sc=Math.floor(Math.random()*50)+(c.rank==='A'?50:c.rank==='B'?30:20);if(sc>100)sc=100;var ds2=Math.floor(Math.random()*120);
snowflake.execute({sqlText:"INSERT INTO T_PROSPECTS(PROSPECT_ID,COMPANY_ID,PRODUCT_ID,CURRENT_RANK,PROSPECT_AMOUNT,AI_SCORE,AI_SCORE_REASON,DAYS_SINCE_CONTACT,LAST_EVENT_TRIGGER,RANKUP_ACTIONS,CREATED_AT,UPDATED_AT)VALUES('"+pidS+"','"+c.id+"','"+pIds[pIdx]+"','"+c.rank+"',"+am+","+sc+",'AIスコア: 事業イベント・面談履歴・市場環境を総合評価',"+ds2+",'事業イベント検知','①詳細ヒアリング ②試算提示 ③提案書作成',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP())"});}}
for(var ci=0;ci<companies.length;ci++){var c=companies[ci];var lid='LOC'+String(ci+1).padStart(3,'0');snowflake.execute({sqlText:"INSERT INTO T_COMPANY_LOCATIONS(LOCATION_ID,COMPANY_ID,LOCATION_TYPE,ADDRESS,LATITUDE,LONGITUDE,IS_HEADQUARTERS,CREATED_AT)VALUES('"+lid+"','"+c.id+"','本社','"+q(c.name)+" 本社',"+c.lat+","+c.lon+",TRUE,CURRENT_TIMESTAMP())"});}
for(var ci=0;ci<companies.length;ci++){var c=companies[ci];var nc=c.rank==='A'?3:c.rank==='B'?2:1;for(var ki=0;ki<nc;ki++){var coidS='CON'+String(coid).padStart(4,'0');coid++;var pIdx2=(ci*2+ki)%pIds.length;var prem=Math.floor(Math.random()*5e8)+1e7;var sy=2020+Math.floor(Math.random()*4);
snowflake.execute({sqlText:"INSERT INTO T_CONTRACTS(CONTRACT_ID,COMPANY_ID,PRODUCT_ID,CONTRACT_DATE,EXPIRY_DATE,ANNUAL_PREMIUM,STATUS,CREATED_AT)VALUES('"+coidS+"','"+c.id+"','"+pIds[pIdx2]+"','"+sy+"-04-01','"+(sy+3)+"-03-31',"+prem+",'ACTIVE',CURRENT_TIMESTAMP())"});}}
return 'デモデータ生成完了: ニュース'+(nid-1)+'件, アラート'+(aid-1)+'件, 面談'+(mid-1)+'件, 文字起こし'+(trid-1)+'件, 財務100件, 見込み'+(pid-1)+'件, 座標20件, 契約'+(coid-1)+'件';
$$;

CALL LIFEINSURANCE_DEMO_DB.RAW.GENERATE_DEMO_DATA();

SELECT 'Section 5: ダミーデータ生成完了' AS STATUS;
-- ============================================================
-- 08_views.sql: 分析ビュー + V_MARKET_INSIGHT
-- ============================================================
USE DATABASE LIFEINSURANCE_DEMO_DB;
USE SCHEMA ANALYTICS;
USE WAREHOUSE LIFEINSURANCE_DEMO_WH;

-- ────────────────────────────────────────
-- 見込み管理ダッシュボードビュー
-- ────────────────────────────────────────
CREATE OR REPLACE VIEW V_PROSPECT_DASHBOARD AS
SELECT
    p.PROSPECT_ID,
    c.COMPANY_ID,
    c.COMPANY_NAME,
    c.INDUSTRY_LARGE,
    c.EMPLOYEE_COUNT,
    c.PREFECTURE,
    c.STOCK_TICKER,
    p.PRODUCT_ID,
    ip.PRODUCT_NAME,
    p.CURRENT_RANK,
    p.PREVIOUS_RANK,
    p.PROSPECT_AMOUNT,
    p.PROBABILITY,
    p.AI_SCORE,
    p.AI_SCORE_REASON,
    p.RANKUP_ACTIONS,
    p.LAST_EVENT_TRIGGER,
    p.LAST_EVENT_DATE,
    p.EXPECTED_CLOSE_DATE,
    p.LAST_CONTACT_DATE,
    p.DAYS_SINCE_CONTACT,
    p.SALES_REP_ID,
    -- アクティブアラート数
    (SELECT COUNT(*) FROM RAW.T_EVENT_ALERTS ea
     WHERE ea.COMPANY_ID = c.COMPANY_ID AND ea.STATUS = 'UNREAD') AS UNREAD_ALERTS,
    -- 最新アラートのイベント種別
    (SELECT ea.EVENT_TYPE FROM RAW.T_EVENT_ALERTS ea
     WHERE ea.COMPANY_ID = c.COMPANY_ID AND ea.STATUS = 'UNREAD'
     ORDER BY ea.DETECTED_AT DESC LIMIT 1) AS LATEST_ALERT_TYPE,
    -- 最新アラートの優先度
    (SELECT ea.INSURANCE_RELEVANCE FROM RAW.T_EVENT_ALERTS ea
     WHERE ea.COMPANY_ID = c.COMPANY_ID AND ea.STATUS = 'UNREAD'
     ORDER BY ea.DETECTED_AT DESC LIMIT 1) AS LATEST_ALERT_RELEVANCE
FROM RAW.T_PROSPECTS p
JOIN RAW.T_CUSTOMER_COMPANIES c ON p.COMPANY_ID = c.COMPANY_ID
LEFT JOIN RAW.T_INSURANCE_PRODUCTS ip ON p.PRODUCT_ID = ip.PRODUCT_ID;

-- ────────────────────────────────────────
-- 顧客360度ビュー
-- ────────────────────────────────────────
CREATE OR REPLACE VIEW V_CUSTOMER_360 AS
SELECT
    c.*,
    -- 面談統計
    (SELECT COUNT(*) FROM RAW.T_MEETINGS m WHERE m.COMPANY_ID = c.COMPANY_ID) AS TOTAL_MEETINGS,
    (SELECT MAX(m.MEETING_DATE) FROM RAW.T_MEETINGS m WHERE m.COMPANY_ID = c.COMPANY_ID) AS LAST_MEETING_DATE,
    -- 既存契約件数
    (SELECT COUNT(*) FROM RAW.T_CONTRACTS ct WHERE ct.COMPANY_ID = c.COMPANY_ID AND ct.STATUS = 'ACTIVE') AS ACTIVE_CONTRACTS,
    -- 既存契約年間保険料合計
    (SELECT SUM(ct.ANNUAL_PREMIUM) FROM RAW.T_CONTRACTS ct WHERE ct.COMPANY_ID = c.COMPANY_ID AND ct.STATUS = 'ACTIVE') AS TOTAL_ANNUAL_PREMIUM,
    -- 未対応アラート
    (SELECT COUNT(*) FROM RAW.T_EVENT_ALERTS ea WHERE ea.COMPANY_ID = c.COMPANY_ID AND ea.STATUS = 'UNREAD') AS UNREAD_ALERT_COUNT,
    -- 見込み合計金額
    (SELECT SUM(p.PROSPECT_AMOUNT) FROM RAW.T_PROSPECTS p WHERE p.COMPANY_ID = c.COMPANY_ID) AS TOTAL_PROSPECT_AMOUNT,
    -- 最高見込みランク
    (SELECT MIN(p.CURRENT_RANK) FROM RAW.T_PROSPECTS p WHERE p.COMPANY_ID = c.COMPANY_ID) AS BEST_PROSPECT_RANK
FROM RAW.T_CUSTOMER_COMPANIES c;

-- ────────────────────────────────────────
-- アラート優先度ビュー
-- ────────────────────────────────────────
CREATE OR REPLACE VIEW V_EVENT_ALERT_PRIORITY AS
SELECT
    ea.ALERT_ID,
    ea.COMPANY_ID,
    c.COMPANY_NAME,
    c.INDUSTRY_LARGE,
    c.PREFECTURE,
    ea.EVENT_TYPE,
    ea.EVENT_SUMMARY,
    ea.INSURANCE_RELEVANCE,
    ea.ALERT_REASON,
    ea.RECOMMENDED_PRODUCTS,
    ea.RECOMMENDED_ACTION,
    ea.URGENCY_DAYS,
    ea.STATUS,
    ea.DETECTED_AT,
    ea.SALES_REP_ID,
    -- 優先度スコア（数値）
    CASE ea.INSURANCE_RELEVANCE
        WHEN '最高' THEN 100
        WHEN '高'   THEN 75
        WHEN '中'   THEN 50
        ELSE 25
    END AS PRIORITY_SCORE,
    -- 緊急度
    CASE
        WHEN ea.URGENCY_DAYS <= 3  THEN '🔴 今すぐ'
        WHEN ea.URGENCY_DAYS <= 14 THEN '🟡 今週中'
        WHEN ea.URGENCY_DAYS <= 30 THEN '🟢 今月中'
        ELSE '⚪ 通常'
    END AS URGENCY_LABEL
FROM RAW.T_EVENT_ALERTS ea
JOIN RAW.T_CUSTOMER_COMPANIES c ON ea.COMPANY_ID = c.COMPANY_ID
ORDER BY PRIORITY_SCORE DESC, ea.URGENCY_DAYS ASC;

-- ────────────────────────────────────────
-- マーケットインサイトビュー（市場データ連携用）
-- ※ 実際の市場データは財務企画部共有 MARKET_DATA_SHARED を参照
-- ※ デモ環境では固定値を使用
-- ────────────────────────────────────────
CREATE OR REPLACE VIEW V_MARKET_INSIGHT AS
SELECT
    c.COMPANY_ID,
    c.COMPANY_NAME,
    c.INDUSTRY_LARGE,
    c.PENSION_TYPE,
    c.STOCK_TICKER,
    c.EMPLOYEE_COUNT,
    -- デモ用固定市場データ（本番では MARKET_DATA_SHARED から取得）
    CASE c.COMPANY_ID
        WHEN 'C001' THEN 2850.0 WHEN 'C002' THEN  1420.0 WHEN 'C003' THEN 7280.0
        WHEN 'C004' THEN 4520.0 WHEN 'C005' THEN  680.0  WHEN 'C007' THEN 3350.0
        WHEN 'C008' THEN 4890.0 WHEN 'C009' THEN  4250.0 WHEN 'C010' THEN 4830.0
        WHEN 'C011' THEN 4120.0 WHEN 'C012' THEN  3450.0 WHEN 'C013' THEN 1820.0
        WHEN 'C014' THEN 5240.0 WHEN 'C015' THEN  2180.0 WHEN 'C016' THEN 3820.0
        WHEN 'C017' THEN 9450.0 WHEN 'C019' THEN  2640.0 WHEN 'C020' THEN 1180.0
        ELSE NULL
    END AS LATEST_STOCK_PRICE,
    CASE c.COMPANY_ID
        WHEN 'C002' THEN -4.1 WHEN 'C005' THEN -7.5 WHEN 'C006' THEN  3.2
        WHEN 'C010' THEN -2.8 WHEN 'C012' THEN  8.5 WHEN 'C016' THEN  5.8
        WHEN 'C018' THEN NULL ELSE ROUND(UNIFORM(-8, 12, RANDOM()), 1)
    END AS STOCK_1M_CHANGE_PCT,
    -- 現在の10年国債利回り（デモ固定値）
    1.45 AS CURRENT_10Y_RATE,
    0.35 AS RATE_CHANGE_1Y,
    -- DB年金への金利影響評価
    CASE
        WHEN c.PENSION_TYPE LIKE '%DB%' AND 1.45 > 1.0 THEN 'DB積立改善傾向 → DC移行の好機'
        WHEN c.PENSION_TYPE = 'DC' THEN 'DC制度のため金利影響軽微'
        ELSE 'DB積立影響確認推奨'
    END AS PENSION_RATE_SIGNAL,
    -- 見込み情報
    p.CURRENT_RANK AS PROSPECT_RANK,
    p.AI_SCORE     AS PROSPECT_AI_SCORE,
    p.PROSPECT_AMOUNT,
    -- 未対応アラート数
    (SELECT COUNT(*) FROM RAW.T_EVENT_ALERTS ea
     WHERE ea.COMPANY_ID = c.COMPANY_ID AND ea.STATUS = 'UNREAD') AS UNREAD_ALERTS
FROM RAW.T_CUSTOMER_COMPANIES c
LEFT JOIN RAW.T_PROSPECTS p
    ON p.COMPANY_ID = c.COMPANY_ID
    AND p.UPDATED_AT = (
        SELECT MAX(p2.UPDATED_AT) FROM RAW.T_PROSPECTS p2
        WHERE p2.COMPANY_ID = c.COMPANY_ID);

SELECT 'Views created: V_PROSPECT_DASHBOARD, V_CUSTOMER_360, V_EVENT_ALERT_PRIORITY, V_MARKET_INSIGHT' AS STATUS;
-- ============================================================
-- 09_cortex_search.sql: Cortex Search サービス × 3
-- ============================================================
USE DATABASE LIFEINSURANCE_DEMO_DB;
USE SCHEMA SEARCH;
USE WAREHOUSE LIFEINSURANCE_DEMO_WH;

-- ────────────────────────────────────────
-- 1. 顧客情報・面談内容 Cortex Search
-- ────────────────────────────────────────
CREATE OR REPLACE CORTEX SEARCH SERVICE CUSTOMER_INFO_SEARCH
  ON TRANSCRIPT_TEXT
  ATTRIBUTES COMPANY_ID, MEETING_DATE, MEETING_TYPE, SPEAKER_LABEL
  WAREHOUSE = LIFEINSURANCE_DEMO_WH
  TARGET_LAG = '1 hour'
AS (
    SELECT
        mt.TRANSCRIPT_TEXT,
        mt.SPEAKER_LABEL,
        m.COMPANY_ID,
        m.MEETING_DATE::VARCHAR AS MEETING_DATE,
        m.MEETING_TYPE,
        c.COMPANY_NAME,
        m.MEETING_ID
    FROM RAW.T_MEETING_TRANSCRIPTS mt
    JOIN RAW.T_MEETINGS m ON mt.MEETING_ID = m.MEETING_ID
    JOIN RAW.T_CUSTOMER_COMPANIES c ON m.COMPANY_ID = c.COMPANY_ID
);

-- ────────────────────────────────────────
-- 2. 企業ニュース・イベント Cortex Search
-- ────────────────────────────────────────
CREATE OR REPLACE CORTEX SEARCH SERVICE NEWS_SEARCH
  ON SEARCH_TEXT
  ATTRIBUTES COMPANY_ID, NEWS_DATE, EVENT_TYPE, INSURANCE_RELEVANCE
  WAREHOUSE = LIFEINSURANCE_DEMO_WH
  TARGET_LAG = '1 hour'
AS (
    SELECT
        n.HEADLINE || ' ' || COALESCE(n.BODY_TEXT, '') AS SEARCH_TEXT,
        n.HEADLINE,
        n.BODY_TEXT,
        n.COMPANY_ID,
        n.NEWS_DATE::VARCHAR AS NEWS_DATE,
        n.EVENT_TYPE,
        n.INSURANCE_RELEVANCE,
        n.NEWS_SOURCE,
        c.COMPANY_NAME
    FROM RAW.T_COMPANY_NEWS n
    JOIN RAW.T_CUSTOMER_COMPANIES c ON n.COMPANY_ID = c.COMPANY_ID
);

-- ────────────────────────────────────────
-- 3. 保険商品・サービス Cortex Search
-- ────────────────────────────────────────
CREATE OR REPLACE CORTEX SEARCH SERVICE PRODUCT_SEARCH
  ON SEARCH_TEXT
  ATTRIBUTES PRODUCT_ID, PRODUCT_CATEGORY, PRODUCT_TYPE
  WAREHOUSE = LIFEINSURANCE_DEMO_WH
  TARGET_LAG = '24 hours'
AS (
    -- 保険商品
    SELECT
        ip.PRODUCT_NAME || ' ' || COALESCE(ip.DESCRIPTION, '') AS SEARCH_TEXT,
        ip.PRODUCT_ID,
        ip.PRODUCT_NAME,
        ip.DESCRIPTION,
        ip.PRODUCT_CATEGORY,
        ip.PRODUCT_TYPE,
        ip.TARGET_AUDIENCE,
        '保険商品' AS CONTENT_TYPE
    FROM RAW.T_INSURANCE_PRODUCTS ip

    UNION ALL

    -- 非保険サービス
    SELECT
        ns.SERVICE_NAME || ' ' || COALESCE(ns.DESCRIPTION, '') AS SEARCH_TEXT,
        ns.SERVICE_ID AS PRODUCT_ID,
        ns.SERVICE_NAME AS PRODUCT_NAME,
        ns.DESCRIPTION,
        ns.SERVICE_CATEGORY AS PRODUCT_CATEGORY,
        '非保険サービス' AS PRODUCT_TYPE,
        ns.TARGET_AUDIENCE,
        '非保険サービス' AS CONTENT_TYPE
    FROM RAW.T_SNOWLIFE_SERVICES ns
);

SELECT 'Cortex Search services created: CUSTOMER_INFO_SEARCH, NEWS_SEARCH, PRODUCT_SEARCH' AS STATUS;

-- ============================================================
-- SECTION 7: Semantic View
-- ============================================================
USE DATABASE LIFEINSURANCE_DEMO_DB;
USE SCHEMA ANALYTICS;

CALL SYSTEM$CREATE_SEMANTIC_VIEW_FROM_YAML(
  'LIFEINSURANCE_DEMO_DB.ANALYTICS',
  $$
name: SV_SALES_ANALYTICS
description: スノー生命 法人営業 KPI・見込み・アラート分析用セマンティックビュー
tables:
  - name: ALERTS
    base_table:
      database: LIFEINSURANCE_DEMO_DB
      schema: RAW
      table: T_EVENT_ALERTS
    dimensions:
      - name: ALERT_PRIORITY
        synonyms:
          - アラート優先度
          - 重要度
        description: 最高・高・中・低
        expr: alerts.INSURANCE_RELEVANCE
        data_type: VARCHAR(10)
      - name: EVENT_TYPE
        synonyms:
          - イベント種別
          - 事業イベント種別
        description: M&A・経営陣交代・大規模採用・健康経営等
        expr: alerts.EVENT_TYPE
        data_type: VARCHAR(100)
    primary_key:
      columns:
        - ALERT_ID
  - name: COMPANIES
    base_table:
      database: LIFEINSURANCE_DEMO_DB
      schema: RAW
      table: T_CUSTOMER_COMPANIES
    dimensions:
      - name: COMPANY_NAME
        synonyms:
          - 企業名
          - 会社名
        description: 顧客企業名
        expr: companies.COMPANY_NAME
        data_type: VARCHAR(100)
      - name: INDUSTRY
        synonyms:
          - 業種
          - 産業
        description: 業種（大分類）
        expr: companies.INDUSTRY_LARGE
        data_type: VARCHAR(50)
      - name: PREFECTURE
        description: 本社所在都道府県
        expr: companies.PREFECTURE
        data_type: VARCHAR(20)
    primary_key:
      columns:
        - COMPANY_ID
  - name: MEETINGS
    base_table:
      database: LIFEINSURANCE_DEMO_DB
      schema: RAW
      table: T_MEETINGS
    metrics:
      - name: MEETING_COUNT
        synonyms:
          - 接触回数
          - 面談件数
        description: 面談・接触の総件数
        expr: COUNT(meetings.MEETING_ID)
        access_modifier: public_access
    primary_key:
      columns:
        - MEETING_ID
  - name: PRODUCTS
    base_table:
      database: LIFEINSURANCE_DEMO_DB
      schema: RAW
      table: T_INSURANCE_PRODUCTS
    dimensions:
      - name: PRODUCT_CATEGORY
        description: 商品カテゴリ
        expr: products.PRODUCT_CATEGORY
        data_type: VARCHAR(50)
    primary_key:
      columns:
        - PRODUCT_ID
  - name: PROSPECTS
    base_table:
      database: LIFEINSURANCE_DEMO_DB
      schema: RAW
      table: T_PROSPECTS
    dimensions:
      - name: PROSPECT_RANK
        synonyms:
          - ランク
          - 見込みランク
        description: '見込みランク: S / A / B / C'
        expr: prospects.CURRENT_RANK
        data_type: VARCHAR(1)
    metrics:
      - name: AVG_AI_SCORE
        synonyms:
          - 平均AIスコア
        description: 見込みAIスコアの平均値（0-100）
        expr: AVG(prospects.AI_SCORE)
        access_modifier: public_access
      - name: PROSPECT_AMOUNT_TOTAL
        synonyms:
          - 見込み保険料合計
          - 見込み金額合計
        description: 見込み保険料の合計金額（年額）
        expr: SUM(prospects.PROSPECT_AMOUNT)
        access_modifier: public_access
      - name: PROSPECT_COUNT
        synonyms:
          - 案件数
          - 見込み件数
        description: 見込み管理の件数
        expr: COUNT(prospects.PROSPECT_ID)
        access_modifier: public_access
    primary_key:
      columns:
        - PROSPECT_ID
relationships:
  - name: ALERTS_TO_COMPANIES
    left_table: ALERTS
    right_table: COMPANIES
    relationship_columns:
      - left_column: COMPANY_ID
        right_column: COMPANY_ID
  - name: MEETINGS_TO_COMPANIES
    left_table: MEETINGS
    right_table: COMPANIES
    relationship_columns:
      - left_column: COMPANY_ID
        right_column: COMPANY_ID
  - name: PROSPECTS_TO_COMPANIES
    left_table: PROSPECTS
    right_table: COMPANIES
    relationship_columns:
      - left_column: COMPANY_ID
        right_column: COMPANY_ID
  - name: PROSPECTS_TO_PRODUCTS
    left_table: PROSPECTS
    right_table: PRODUCTS
    relationship_columns:
      - left_column: PRODUCT_ID
        right_column: PRODUCT_ID
  $$
);

-- ============================================================
-- SECTION 8: Git Integration + Streamlit
-- ============================================================
USE ROLE ACCOUNTADMIN;

CREATE OR REPLACE API INTEGRATION GITHUB_INTEGRATION_LIFEINSURANCE
  API_PROVIDER = git_https_api
  API_ALLOWED_PREFIXES = ('https://github.com/sfc-gh-kmotokubota/')
  ENABLED = TRUE
  COMMENT = 'Git integration for Snow Life demo repository';

CREATE SCHEMA IF NOT EXISTS LIFEINSURANCE_DEMO_DB.PUBLIC;

CREATE OR REPLACE GIT REPOSITORY LIFEINSURANCE_DEMO_DB.PUBLIC.LIFEINSURANCE_REPO
  API_INTEGRATION = GITHUB_INTEGRATION_LIFEINSURANCE
  ORIGIN = 'https://github.com/sfc-gh-kmotokubota/lifeinsurance-sales-demo.git'
  COMMENT = 'Git repository for Snow Life demo';

ALTER GIT REPOSITORY LIFEINSURANCE_DEMO_DB.PUBLIC.LIFEINSURANCE_REPO FETCH;

CREATE OR REPLACE STREAMLIT LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SALES_DEMO
  ROOT_LOCATION = '@LIFEINSURANCE_DEMO_DB.PUBLIC.LIFEINSURANCE_REPO/branches/main/streamlit'
  MAIN_FILE = 'main.py'
  QUERY_WAREHOUSE = LIFEINSURANCE_DEMO_WH
  COMMENT = 'スノー生命 法人営業AIアシスタント Streamlit アプリ';

SELECT 'Section 8: Streamlit デプロイ完了' AS STATUS;

-- ============================================================
-- SECTION 9: Cortex Agent
-- ============================================================
USE DATABASE LIFEINSURANCE_DEMO_DB;
USE SCHEMA RAW;
USE WAREHOUSE LIFEINSURANCE_DEMO_WH;

CREATE STAGE IF NOT EXISTS LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SKILLS
  DIRECTORY = (ENABLE = TRUE)
  COMMENT = 'Cortex Agent Skills';

CREATE OR REPLACE PROCEDURE LIFEINSURANCE_DEMO_DB.RAW.UPLOAD_SKILL_FILES()
RETURNS VARCHAR LANGUAGE PYTHON RUNTIME_VERSION = '3.11'
PACKAGES = ('snowflake-snowpark-python')
HANDLER = 'main' EXECUTE AS CALLER
AS $$
def main(session):
    import os
    skills = {
        "proposal_generation": """---
name: proposal_generation
description: |
  スノー生命 法人向け提案書の構成を生成するスキル。
  企業名・商品・背景情報をもとに、PPTX/Word提案書の章立てと各セクションの内容案を作成します。
---

# 提案書生成スキル

あなたはスノー生命保険の法人営業担当者の提案書作成を支援するアシスタントです。

## このスキルが呼び出される条件

以下のような依頼があった場合にこのスキルを使用してください：
- 「提案書を作って」
- 「XXX社向けの提案書」
- 「PPTX/Wordを作成して」
- 「提案内容をまとめて」

## 提案書の標準構成

必ず以下の5セクション構成で提案書を作成してください：

### 1. ご提案の背景
- 企業の直近の事業イベント（M&A・IPO・経営陣交代・大規模採用等）を明示
- 現在の市場環境（金利水準・業界動向）との関連
- 「なぜ今この企業にこの提案をするのか」を2〜3文で明確に

### 2. 御社の現状課題
- 企業の業種・規模・年金制度から推定される課題
- 過去の面談で確認された具体的な懸念事項
- 定量的なリスク（従業員数・財務データ等）を含める

### 3. スノー生命のご提案内容
- 各商品について：保障内容・導入メリット・御社への適合理由を2〜3文
- 非保険サービス（Wellness-Star・Biz-Create等）との組み合わせ提案も検討

### 4. 期待される効果
- CFO視点：財務・コスト削減効果（損金算入・退職給付費用安定化等）
- CHRO視点：採用競争力・従業員満足度・離職率改善
- 経営視点：ESG・健康経営優良法人認定取得等

### 5. 今後のスケジュール案
- STEP1: 詳細ヒアリング（来月第1週）
- STEP2: 制度設計案の提示（来月末）
- STEP3: 最終合意・契約（再来月）

## 文体・表現ルール

1. マークダウン記法は使わない
2. 保険業法に違反する断定表現は使わない（確実に/絶対に/元本保証 等は禁止）
3. 箇条書きは「・」を使用
4. 丁寧語・敬語を使用
5. 金額・従業員数等の数値は具体的に記載する

## 出力フォーマット

ユーザーに対して以下を提供してください：
1. 提案書の全文テキスト（上記5セクション）
2. 「このままStreamlitの提案書ページからPPTX/Wordにエクスポートできます」という案内
""",
        "compliance_guidelines": """---
name: compliance_guidelines
description: |
  保険業法・金融商品取引法に基づくコンプライアンスチェックスキル。
  営業トーク・提案書・メール文面の禁止表現を検出し、適切な修正例を提示します。
---

# コンプライアンスチェックスキル

あなたはスノー生命保険の法人営業におけるコンプライアンス遵守を支援するアシスタントです。

## このスキルが呼び出される条件

以下のような依頼があった場合にこのスキルを使用してください：
- 「この文章はコンプライアンス上問題ないか確認して」
- 「この表現は大丈夫？」
- 「保険業法に違反しないか確認」
- 「提案書の文言チェック」

## 保険業法・金融商品取引法の主な禁止事項

### カテゴリA: 断定的判断の提供（最重要・絶対禁止）
- 「確実に」「必ず」「絶対に」＋ 利益・運用成果の断定
- 「元本保証」「損はしない」「損失が出ない」
- 「リスクはありません」

修正パターン:
- NG「確実に年金が増えます」
- OK「過去の実績では積立が増える傾向にありますが、将来の運用成果を保証するものではございません」

### カテゴリB: 不当な比較・誤解を招く表現
- 他社商品との根拠のない比較
- 保障内容の過大表現

### カテゴリC: 不当な勧誘
- 過度なプレッシャーをかける表現
- 顧客の利益を顧みない押し売り的表現

### カテゴリD: 重要事項の不告知・誤告知
- 保険料や保障内容に関する不正確な情報提供
- 解約時のデメリットを隠す表現

## 重要な注意事項
このチェックはAIによる参考チェックです。最終的な判断は必ず法令遵守部門にご確認ください。
""",
        "earnings_analysis": """---
name: earnings_analysis
description: |
  企業の決算情報をweb searchやSnowflake内データから収集し、3枚のPPTXにまとめるスキル。
---

# 決算サマリーPPTX生成スキル

企業の決算を3枚スライド（決算重要ポイント・利益要因分析・訪問時話材）にまとめます。

## このスキルが呼び出される条件
- 「XXX社の決算をまとめてパワポにして」
- 「IR資料を3枚にまとめて」
- 「決算サマリーをパワポで」
- 「利益の要因分析と話材をパワポに」

## 手順
1. web検索でIR資料・決算短信を取得
2. news_searchで関連ニュース確認
3. 以下のJSON構造でslide_dataを組み立てる
4. generate_earnings_pptxツールを呼び出す
5. ダウンロードURLをユーザーに返す

## slide_data JSON構造
```
{
  "meta": {"period": "決算期間", "announced": "発表日"},
  "slide1": {"title": "結論", "kpis": [{"label":"","value":"","sub":""}], "table": {"headers":[], "rows":[]}},
  "slide2": {"title": "要因分析", "subtitle": "", "factors": [{"label":"","value":"","raw_value":"数値"}], "total_label":"", "total_value":"", "insights": [{"icon":"warning|chart|check","title":"","text":""}]},
  "slide3": {"title": "話材", "subtitle": "", "topics": [{"icon":"fire|chart|rocket|globe","title":"","quote":"","detail":""}], "watchpoints": [{"num":1,"title":"","detail":""}]}
}
```

## 注意
- 数値はIR資料から引用（推測しない）
- raw_valueは億円単位の数値のみ（棒グラフ比率計算用）
- insightsは3つ（リスク・規模・健全性）
- topicsは経営者の関心に基づく会話きっかけ
- watchpointsは今後3-6ヶ月の注目材料
"""
    }
    stage = '@LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SKILLS'
    for skill_name, content in skills.items():
        local_path = f'/tmp/SKILL.md'
        with open(local_path, 'w', encoding='utf-8') as f:
            f.write(content)
        session.file.put(local_path, f'{stage}/{skill_name}', auto_compress=False, overwrite=True)
        os.remove(local_path)
    return 'Skills uploaded: proposal_generation, compliance_guidelines, earnings_analysis'
$$;

CALL LIFEINSURANCE_DEMO_DB.RAW.UPLOAD_SKILL_FILES();
DROP PROCEDURE IF EXISTS LIFEINSURANCE_DEMO_DB.RAW.UPLOAD_SKILL_FILES();

CREATE OR REPLACE AGENT LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SALES_AGENT
FROM SPECIFICATION $$
{
  "models": {"orchestration": "auto"},
  "orchestration": {"budget": {"seconds": 900, "tokens": 400000}},
  "skills": [
    {"name": "proposal_generation", "source": {"type": "STAGE", "path": "@LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SKILLS/proposal_generation"}},
    {"name": "compliance_guidelines", "source": {"type": "STAGE", "path": "@LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SKILLS/compliance_guidelines"}},
    {"name": "earnings_analysis", "source": {"type": "STAGE", "path": "@LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SKILLS/earnings_analysis"}}
  ],
  "instructions": {
    "orchestration": "あなたはスノー生命保険相互会社の法人営業部に所属するAIアシスタントです。担当営業担当者が大企業の法人顧客に対して保険提案・営業活動を行う際に支援します。\n\n## ツールの使い分け\n- customer_search: 顧客企業の面談記録・文字起こしを検索\n- news_search: 企業ニュース・事業イベントを検索\n- product_search: 保険商品・非保険サービスの詳細を検索\n- sales_analytics: 見込み管理・KPIの数値分析\n- generate_proposal_pptx: PowerPoint提案書を生成してダウンロードURL返却\n- generate_proposal_docx: Word提案書を生成してダウンロードURL返却\n- generate_earnings_pptx: 決算サマリーPPTX3枚を生成してダウンロードURL返却\n\n## 提案書生成の手順\n1. news_search・customer_search・product_searchで情報収集\n2. 5セクション構成でproposal_contentを作成\n3. generate_proposal_pptxまたはgenerate_proposal_docxを呼び出す\n4. ダウンロードURLをユーザーに伝える（24時間有効）\n\n## 回答スタイル\n- 日本語で回答\n- 提案根拠を明示\n- 具体的なアクションを提示\n- コンプライアンス上問題のある表現を検出した場合は指摘",
    "response": "回答は必ず日本語で行ってください。提案する場合は根拠を明示し、具体的な次のアクションを示してください。"
  },
  "tools": [
    {"tool_spec": {"type": "cortex_search", "name": "customer_search", "description": "担当先顧客企業との面談記録・文字起こしを全文検索します。"}},
    {"tool_spec": {"type": "cortex_search", "name": "news_search", "description": "担当先企業に関するニュース・事業イベント情報を全文検索します。"}},
    {"tool_spec": {"type": "cortex_search", "name": "product_search", "description": "スノー生命の保険商品および非保険サービスの詳細情報を検索します。"}},
    {"tool_spec": {"type": "cortex_analyst_text_to_sql", "name": "sales_analytics", "description": "法人営業のKPI・見込み管理・アラート情報をSQLで分析します。"}},
    {"tool_spec": {"type": "generic", "name": "generate_proposal_pptx", "description": "法人向け提案書をPowerPoint形式で生成しダウンロードURLを返します。", "input_schema": {"type": "object", "properties": {"company_name": {"type": "string"}, "product_names": {"type": "string"}, "proposal_content": {"type": "string"}}, "required": ["company_name", "product_names", "proposal_content"]}}},
    {"tool_spec": {"type": "generic", "name": "generate_proposal_docx", "description": "法人向け提案書をWord形式で生成しダウンロードURLを返します。", "input_schema": {"type": "object", "properties": {"company_name": {"type": "string"}, "product_names": {"type": "string"}, "proposal_content": {"type": "string"}}, "required": ["company_name", "product_names", "proposal_content"]}}},
    {"tool_spec": {"type": "generic", "name": "generate_earnings_pptx", "description": "企業の決算サマリーをPowerPoint3枚（決算重要ポイント・利益要因分析・訪問時話材）で生成しダウンロードURLを返します。", "input_schema": {"type": "object", "properties": {"company_name": {"type": "string", "description": "企業名"}, "slide_data": {"type": "string", "description": "3スライド分のJSONデータ（meta, slide1, slide2, slide3）"}}, "required": ["company_name", "slide_data"]}}}
  ],
  "tool_resources": {
    "customer_search": {"execution_environment": {"query_timeout": 299, "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH"}, "search_service": "LIFEINSURANCE_DEMO_DB.SEARCH.CUSTOMER_INFO_SEARCH"},
    "news_search": {"execution_environment": {"query_timeout": 299, "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH"}, "search_service": "LIFEINSURANCE_DEMO_DB.SEARCH.NEWS_SEARCH"},
    "product_search": {"execution_environment": {"query_timeout": 299, "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH"}, "search_service": "LIFEINSURANCE_DEMO_DB.SEARCH.PRODUCT_SEARCH"},
    "sales_analytics": {"execution_environment": {"query_timeout": 299, "type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH"}, "semantic_view": "LIFEINSURANCE_DEMO_DB.ANALYTICS.SV_SALES_ANALYTICS"},
    "generate_proposal_pptx": {"type": "procedure", "identifier": "LIFEINSURANCE_DEMO_DB.RAW.GENERATE_PROPOSAL_PPTX", "execution_environment": {"type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH", "query_timeout": 300}},
    "generate_proposal_docx": {"type": "procedure", "identifier": "LIFEINSURANCE_DEMO_DB.RAW.GENERATE_PROPOSAL_DOCX", "execution_environment": {"type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH", "query_timeout": 300}},
    "generate_earnings_pptx": {"type": "procedure", "identifier": "LIFEINSURANCE_DEMO_DB.RAW.GENERATE_EARNINGS_PPTX", "execution_environment": {"type": "warehouse", "warehouse": "LIFEINSURANCE_DEMO_WH", "query_timeout": 300}}
  }
}
$$;

ALTER AGENT LIFEINSURANCE_DEMO_DB.RAW.LIFEINSURANCE_SALES_AGENT SET COMMENT = 'スノー生命保険 法人営業AIアシスタント | 担当先企業の事業イベント検知・商品マッチング・DP作成・コンプライアンスチェックを自然言語でサポート';

SELECT 'Section 9: Cortex Agent 作成完了' AS STATUS;

-- ============================================================
-- SECTION 10: PPTX/Word 生成 SP + ステージ
-- ============================================================
CREATE OR REPLACE STAGE LIFEINSURANCE_DEMO_DB.RAW.PROPOSAL_EXPORT_STAGE
  DIRECTORY = (ENABLE = TRUE)
  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');

CREATE OR REPLACE PROCEDURE LIFEINSURANCE_DEMO_DB.RAW.GENERATE_PROPOSAL_PPTX(COMPANY_NAME VARCHAR, PRODUCT_NAMES VARCHAR, PROPOSAL_CONTENT VARCHAR)
RETURNS VARCHAR LANGUAGE PYTHON RUNTIME_VERSION = '3.11'
PACKAGES = ('snowflake-snowpark-python', 'python-pptx')
HANDLER = 'main' EXECUTE AS CALLER
AS $$
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from datetime import datetime
import os, re
def main(session, company_name: str, product_names: str, proposal_content: str) -> str:
    RED = RGBColor(0xE6, 0x00, 0x12)
    DARK = RGBColor(0x1A, 0x1A, 0x1A)
    GRAY = RGBColor(0x55, 0x55, 0x55)
    WHITE = RGBColor(0xFF, 0xFF, 0xFF)
    BLUE = RGBColor(0x1A, 0x3A, 0x6B)
    prs = Presentation()
    prs.slide_width = Emu(12192000)
    prs.slide_height = Emu(6858000)
    SW = 13.33
    SH = 7.5
    def tb(slide, l, t, w, h, text, sz=12, bold=False, color=DARK, align=PP_ALIGN.LEFT):
        box = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
        tf = box.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.TOP
        p = tf.paragraphs[0]
        p.alignment = align
        r = p.add_run()
        r.text = text
        r.font.size = Pt(sz)
        r.font.bold = bold
        r.font.color.rgb = color
        r.font.name = 'Meiryo UI'
        return tf
    def rect(slide, l, t, w, h, fill):
        s = slide.shapes.add_shape(1, Inches(l), Inches(t), Inches(w), Inches(h))
        s.fill.solid()
        s.fill.fore_color.rgb = fill
        s.line.fill.background()
    def hdr(slide, title, color=RED):
        rect(slide, 0, 0, SW, 0.65, color)
        tb(slide, 0.4, 0.1, SW-0.8, 0.5, title, 16, True, WHITE, PP_ALIGN.LEFT)
    NL = chr(10)
    # ── Slide 1: 表紙 ──
    s1 = prs.slides.add_slide(prs.slide_layouts[6])
    rect(s1, 0, 0, SW, 1.2, RED)
    tb(s1, 0.5, 0.25, SW-1, 0.75, 'ご提案書', 22, True, WHITE)
    tb(s1, 0.5, 1.6, SW-1, 1.0, company_name + ' 御中', 32, True, BLUE)
    tb(s1, 0.5, 2.9, SW-1, 0.6, '退職給付・福利厚生制度の最適化に向けたご提案', 18, True)
    tb(s1, 0.5, 3.8, SW-1, 0.5, '提案商品: ' + product_names, 12, False, GRAY)
    tb(s1, 0.5, 4.5, SW-1, 0.5, 'スノー生命保険相互会社 法人部 | ' + datetime.now().strftime('%Y年%m月%d日'), 11, False, GRAY)
    # ── Slide 2: 提案内容（全文） ──
    s2 = prs.slides.add_slide(prs.slide_layouts[6])
    hdr(s2, '提案内容')
    lines = proposal_content.replace('\r','').split(NL)
    y = 0.75
    gap = 0.0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            y += 0.18
            continue
        is_head = stripped.startswith('【') or stripped.startswith('#')
        sz = 13 if is_head else 11
        bold = is_head
        col = BLUE if is_head else DARK
        h_pt = 0.38 if is_head else 0.3
        if y + h_pt > SH - 0.2:
            break
        tb(s2, 0.4, y, SW-0.8, h_pt + 0.1, stripped, sz, bold, col)
        y += h_pt + gap
    # ── Slide 3: 次のステップ ──
    s3 = prs.slides.add_slide(prs.slide_layouts[6])
    hdr(s3, '今後のご提案ステップ')
    steps = [
        ('STEP 1', '詳細ヒアリング', '貴社の現行制度・課題・ご要望を詳しくお聞かせください。'),
        ('STEP 2', '制度設計案の提示', '最適な保険商品の組み合わせと試算をご提示します。'),
        ('STEP 3', '最終合意・契約締結', 'ご納得いただいた上で手続きを進めてまいります。'),
    ]
    for i, (num, title_s, desc) in enumerate(steps):
        y = 1.2 + i * 1.9
        rect(s3, 0.4, y, 1.1, 1.5, RED)
        tb(s3, 0.4, y+0.3, 1.1, 0.9, num, 18, True, WHITE, PP_ALIGN.CENTER)
        tb(s3, 1.7, y+0.15, SW-2.2, 0.45, title_s, 16, True, BLUE)
        tb(s3, 1.7, y+0.65, SW-2.2, 0.75, desc, 12, False, DARK)
    tb(s3, 0.4, 7.0, SW-0.8, 0.4, 'スノー生命保険相互会社 法人部 | ' + datetime.now().strftime('%Y年%m月%d日'), 10, False, GRAY)
    safe_name = re.sub(r'[^\w\-.]', '_', company_name + '_' + datetime.now().strftime('%Y%m%d'))
    if not safe_name.endswith('.pptx'):
        safe_name = safe_name + '.pptx'
    local_path = '/tmp/' + safe_name
    prs.save(local_path)
    stage_path = '@LIFEINSURANCE_DEMO_DB.RAW.PROPOSAL_EXPORT_STAGE'
    session.file.put(local_path, stage_path, auto_compress=False, overwrite=True)
    os.remove(local_path)
    session.sql("ALTER STAGE LIFEINSURANCE_DEMO_DB.RAW.PROPOSAL_EXPORT_STAGE REFRESH").collect()
    url = session.sql(f"SELECT GET_PRESIGNED_URL({stage_path}, '{safe_name}', 3600) AS URL").collect()[0]['URL']
    return f'[{company_name}_提案書.pptxをダウンロード]({url})'
$$;

CREATE OR REPLACE PROCEDURE LIFEINSURANCE_DEMO_DB.RAW.GENERATE_PROPOSAL_DOCX(COMPANY_NAME VARCHAR, PRODUCT_NAMES VARCHAR, PROPOSAL_CONTENT VARCHAR)
RETURNS VARCHAR LANGUAGE PYTHON RUNTIME_VERSION = '3.11'
PACKAGES = ('snowflake-snowpark-python', 'python-docx')
HANDLER = 'main' EXECUTE AS CALLER
AS $$
from docx import Document
from docx.shared import Pt, RGBColor
from datetime import datetime
import os, re
def main(session, company_name: str, product_names: str, proposal_content: str) -> str:
    doc = Document()
    NL2 = chr(10) + chr(10)
    NL = chr(10)
    h0 = doc.add_paragraph()
    run0 = h0.add_run(company_name + '  御中')
    run0.font.size = Pt(20)
    run0.font.bold = True
    run0.font.color.rgb = RGBColor(0xE6, 0x00, 0x12)
    h1 = doc.add_paragraph()
    run1 = h1.add_run('退職給付・福利厚生制度の最適化に向けたご提案')
    run1.font.size = Pt(14)
    run1.font.bold = True
    doc.add_paragraph('提案日: ' + datetime.now().strftime('%Y年%m月%d日'))
    doc.add_paragraph('提案商品: ' + product_names)
    doc.add_paragraph('スノー生命保険相互会社 法人部')
    doc.add_paragraph('')
    sections = [s.strip() for s in proposal_content.split(NL2) if s.strip()]
    for sec in sections:
        lines = sec.strip().split(NL)
        if not lines:
            continue
        tp = doc.add_paragraph()
        tr = tp.add_run(lines[0])
        tr.font.size = Pt(13)
        tr.font.bold = True
        for line in lines[1:]:
            if line.strip():
                bp = doc.add_paragraph()
                br2 = bp.add_run(line.strip())
                br2.font.size = Pt(11)
        doc.add_paragraph('')
    safe_name = re.sub(r'[^\w\-.]', '_', company_name + '_' + datetime.now().strftime('%Y%m%d'))
    if not safe_name.endswith('.docx'):
        safe_name = safe_name + '.docx'
    local_path = '/tmp/' + safe_name
    doc.save(local_path)
    stage_path = '@LIFEINSURANCE_DEMO_DB.RAW.PROPOSAL_EXPORT_STAGE'
    session.file.put(local_path, stage_path, auto_compress=False, overwrite=True)
    os.remove(local_path)
    session.sql("ALTER STAGE LIFEINSURANCE_DEMO_DB.RAW.PROPOSAL_EXPORT_STAGE REFRESH").collect()
    url = session.sql(f"SELECT GET_PRESIGNED_URL({stage_path}, '{safe_name}', 3600) AS URL").collect()[0]['URL']
    return f'[{company_name}_提案書.docxをダウンロード]({url})'
$$;

-- 決算サマリーPPTX生成SP
CREATE OR REPLACE PROCEDURE LIFEINSURANCE_DEMO_DB.RAW.GENERATE_EARNINGS_PPTX(COMPANY_NAME VARCHAR, SLIDE_DATA VARCHAR)
RETURNS VARCHAR LANGUAGE PYTHON RUNTIME_VERSION = '3.11'
PACKAGES = ('snowflake-snowpark-python', 'python-pptx')
HANDLER = 'main' EXECUTE AS CALLER
AS $$
import json, os, re
from datetime import datetime
from pptx import Presentation
from pptx.util import Pt, Emu, Cm
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

BLUE_DARK = RGBColor(0x1A, 0x3A, 0x6B)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BLACK = RGBColor(0x1A, 0x1A, 0x1A)
GRAY = RGBColor(0x66, 0x66, 0x66)
GRAY_LIGHT = RGBColor(0xF5, 0xF5, 0xF5)
RED = RGBColor(0xE0, 0x3E, 0x3E)
GREEN = RGBColor(0x1B, 0x8C, 0x5A)
BORDER_GRAY = RGBColor(0xDD, 0xDD, 0xDD)
BAR_BLUE = RGBColor(0x3B, 0x7D, 0xDD)
BAR_RED = RGBColor(0xE0, 0x5E, 0x5E)
SLIDE_W = Emu(12192000)
SLIDE_H = Emu(6858000)

def add_tb(slide, left, top, width, height, text, sz=11, bold=False, color=BLACK, align=PP_ALIGN.LEFT, va=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(Cm(left), Cm(top), Cm(width), Cm(height))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = va
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = text
    r.font.size = Pt(sz)
    r.font.bold = bold
    r.font.color.rgb = color
    r.font.name = 'Meiryo UI'
    return tf

def add_box(slide, left, top, width, height, fill=None, border=None):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Cm(left), Cm(top), Cm(width), Cm(height))
    if fill:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    else:
        s.fill.background()
    if border:
        s.line.color.rgb = border
        s.line.width = Pt(1)
    else:
        s.line.fill.background()
    return s

def header_band(slide, title, num=None):
    add_box(slide, 0, 0, 33.87, 1.5, fill=BLUE_DARK)
    if num:
        ns = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Cm(0.5), Cm(0.3), Cm(0.9), Cm(0.9))
        ns.fill.solid()
        ns.fill.fore_color.rgb = WHITE
        ns.line.fill.background()
        tf = ns.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = str(num)
        r.font.size = Pt(14)
        r.font.bold = True
        r.font.color.rgb = BLUE_DARK
    add_tb(slide, 2.0, 0.2, 30, 1.2, title, sz=16, bold=True, color=WHITE, va=MSO_ANCHOR.MIDDLE)

def slide1(prs, data, company, meta):
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    s1 = data.get('slide1', {})
    header_band(sl, s1.get('title', company + ' 決算サマリー'), num=1)
    add_tb(sl, 1.0, 1.8, 30, 0.8, f"{company} | {meta.get('period','')} ({meta.get('announced','')}発表)", sz=10, color=GRAY)
    for i, kpi in enumerate(s1.get('kpis', [])[:3]):
        x = 1.0 + i * 10.2
        add_box(sl, x, 2.8, 9.5, 3.8, border=BORDER_GRAY)
        add_tb(sl, x+0.3, 3.0, 8.9, 0.6, kpi.get('label',''), sz=9, color=GRAY)
        add_tb(sl, x+0.3, 3.6, 8.9, 1.4, kpi.get('value',''), sz=24, bold=True, color=BLUE_DARK, align=PP_ALIGN.CENTER, va=MSO_ANCHOR.MIDDLE)
        add_tb(sl, x+0.3, 5.2, 8.9, 1.2, kpi.get('sub','').replace('\\n','\n'), sz=8, color=GRAY, align=PP_ALIGN.CENTER)
    tbl_d = s1.get('table', {})
    hdrs = tbl_d.get('headers', [])
    rows = tbl_d.get('rows', [])
    if hdrs and rows:
        nr = len(rows)+1
        nc = len(hdrs)
        ts = sl.shapes.add_table(nr, nc, Cm(1), Cm(7.2), Cm(31.5), Cm(nr*0.8+0.5))
        t = ts.table
        for ci, h in enumerate(hdrs):
            c = t.cell(0, ci)
            c.text = h
            c.fill.solid()
            c.fill.fore_color.rgb = BLUE_DARK
            p = c.text_frame.paragraphs[0]
            p.font.size = Pt(9)
            p.font.bold = True
            p.font.color.rgb = WHITE
            p.font.name = 'Meiryo UI'
            p.alignment = PP_ALIGN.CENTER
        for ri, row in enumerate(rows):
            for ci, val in enumerate(row):
                c = t.cell(ri+1, ci)
                c.text = str(val)
                p = c.text_frame.paragraphs[0]
                p.font.size = Pt(9)
                p.font.name = 'Meiryo UI'
                p.alignment = PP_ALIGN.CENTER if ci > 0 else PP_ALIGN.LEFT
                if ci >= 3 and ('+' in str(val) or '倍' in str(val)):
                    p.font.color.rgb = GREEN
                    p.font.bold = True
                elif ci >= 3 and '-' in str(val) and '—' not in str(val):
                    p.font.color.rgb = RED
                    p.font.bold = True

def slide2(prs, data, company):
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    s2 = data.get('slide2', {})
    header_band(sl, s2.get('title', '利益の要因分析'), num=2)
    st = s2.get('subtitle', '')
    if st:
        add_tb(sl, 1.0, 1.8, 30, 0.7, st, sz=9, color=GRAY)
    factors = s2.get('factors', [])
    mx = max((abs(float(re.sub(r'[^\d.\-]','',f.get('raw_value','1')))) for f in factors), default=1)
    for i, f in enumerate(factors):
        y = 3.0 + i * 1.5
        add_tb(sl, 1.0, y, 8, 0.7, f.get('label',''), sz=9, color=BLACK)
        try:
            raw = float(re.sub(r'[^\d.\-]','',f.get('raw_value','0')))
        except:
            raw = 0
        bw = max(0.3, abs(raw)/mx*10.0)
        add_box(sl, 9.5, y+0.1, bw, 0.5, fill=BAR_BLUE if raw>=0 else BAR_RED)
        add_tb(sl, 9.5+bw+0.3, y, 5, 0.7, f.get('value',''), sz=9, bold=True, color=GREEN if raw>=0 else RED)
    tl = s2.get('total_label','')
    if tl:
        add_tb(sl, 1.0, 3.0+len(factors)*1.5+0.3, 18, 0.6, f"{tl}  ≒  {s2.get('total_value','')}", sz=10, bold=True, color=BLACK)
    icons_map = {'warning':'⚠','chart':'📊','check':'✅','info':'ℹ️'}
    for i, ins in enumerate(s2.get('insights',[])[:3]):
        y = 2.8 + i * 3.5
        add_box(sl, 20.5, y, 12.5, 3.0, fill=GRAY_LIGHT, border=BORDER_GRAY)
        ic = icons_map.get(ins.get('icon',''),'•')
        add_tb(sl, 20.9, y+0.3, 11.5, 0.7, f"{ic}  {ins.get('title','')}", sz=10, bold=True, color=BLUE_DARK)
        add_tb(sl, 20.9, y+1.1, 11.5, 1.8, ins.get('text',''), sz=8, color=GRAY)

def slide3(prs, data, company):
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    s3 = data.get('slide3', {})
    header_band(sl, s3.get('title', '訪問時の話材'), num=3)
    st = s3.get('subtitle', '')
    if st:
        add_tb(sl, 1.0, 1.8, 30, 0.7, st, sz=9, color=GRAY)
    add_tb(sl, 1.0, 2.6, 15, 0.6, '● 経営陣との会話を深掘りする話材', sz=10, bold=True, color=BLACK)
    tic = {'fire':'🔥','chart':'📈','rocket':'🚀','globe':'🌏','strategy':'🎯','money':'💰'}
    for i, t in enumerate(s3.get('topics',[])[:4]):
        col = i % 2
        row = i // 2
        x = 1.0 + col * 8.2
        y = 3.4 + row * 3.5
        add_box(sl, x, y, 7.8, 3.0, fill=GRAY_LIGHT, border=BORDER_GRAY)
        add_tb(sl, x+0.3, y+0.2, 7.0, 0.5, f"{tic.get(t.get('icon',''),'•')} {t.get('title','')}", sz=9, bold=True, color=BLUE_DARK)
        q = t.get('quote','')
        if q:
            add_tb(sl, x+0.3, y+0.8, 7.0, 0.7, f"「{q}」", sz=10, bold=True, color=BLACK)
        add_tb(sl, x+0.3, y+1.6, 7.0, 1.3, t.get('detail',''), sz=8, color=GRAY)
    add_tb(sl, 17.5, 2.6, 15, 0.6, '● 今後の注目ポイント', sz=10, bold=True, color=BLACK)
    for i, wp in enumerate(s3.get('watchpoints',[])[:5]):
        y = 3.4 + i * 1.9
        ns = sl.shapes.add_shape(MSO_SHAPE.OVAL, Cm(17.5), Cm(y+0.1), Cm(0.7), Cm(0.7))
        ns.fill.solid()
        ns.fill.fore_color.rgb = BLUE_DARK
        ns.line.fill.background()
        tf = ns.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = str(wp.get('num', i+1))
        r.font.size = Pt(8)
        r.font.bold = True
        r.font.color.rgb = WHITE
        add_tb(sl, 18.5, y, 14, 0.6, wp.get('title',''), sz=10, bold=True, color=BLACK)
        add_tb(sl, 18.5, y+0.7, 14, 1.0, wp.get('detail',''), sz=8, color=GRAY)

def main(session, company_name: str, slide_data: str) -> str:
    data = json.loads(slide_data)
    meta = data.get('meta', {})
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    slide1(prs, data, company_name, meta)
    slide2(prs, data, company_name)
    slide3(prs, data, company_name)
    safe_name = re.sub(r'[^\w\-.]', '_', company_name + '_earnings_' + datetime.now().strftime('%Y%m%d')) + '.pptx'
    local_path = '/tmp/' + safe_name
    prs.save(local_path)
    stage_path = '@LIFEINSURANCE_DEMO_DB.RAW.PROPOSAL_EXPORT_STAGE'
    session.file.put(local_path, stage_path, auto_compress=False, overwrite=True)
    os.remove(local_path)
    session.sql("ALTER STAGE LIFEINSURANCE_DEMO_DB.RAW.PROPOSAL_EXPORT_STAGE REFRESH").collect()
    url = session.sql(f"SELECT GET_PRESIGNED_URL({stage_path}, '{safe_name}', 3600) AS URL").collect()[0]['URL']
    return f'[{company_name}_決算サマリー.pptxをダウンロード]({url})'
$$;

SELECT 'Section 10: PPTX/Word/決算 SP 作成完了' AS STATUS;

-- ============================================================
-- SECTION 11: 完了
-- ============================================================
SELECT 'セットアップ完了！Streamlit と Snowflake Intelligence でデモを開始できます。' AS STATUS;
