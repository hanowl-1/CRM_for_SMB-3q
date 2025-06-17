# Database Schema Documentation

## Overview
This document describes the database schema for the SuperMembers CRM system, migrated from MySQL to PostgreSQL for use with Supabase.

## Database Information
- **Database Type**: PostgreSQL (Supabase)
- **Extensions Used**: uuid-ossp
- **Security**: Row Level Security (RLS) enabled on all tables
- **Total Tables**: 30

## Table Dependencies Graph
```
Ads_Local (independent)
Users (independent)
Keywords (independent)
Companies (self-referencing)
├── Ads
│   ├── AdKeywords
│   │   └── AdKeywordRankHistories
│   ├── Ads_Keyword
│   ├── AdNaverPlaceKeywords
│   │   └── NaverPlaceKeywordRankHistories
│   ├── Contracts
│   │   └── Packages_Log
│   ├── Channels
│   ├── Packages
│   ├── PremiumPackages
│   └── Ads_Termination_Log
├── AuthUsers_Card
└── MarketingLead
```

## Tables

### 1. Ads_Local
**Purpose**: Regional location codes and names
```sql
CREATE TABLE "Ads_Local" (
  "code" INTEGER PRIMARY KEY,
  "region" VARCHAR(50) NOT NULL,
  "local" VARCHAR(50) NOT NULL
);
```
- **Primary Key**: code
- **Dependencies**: None

### 2. Users
**Purpose**: End user information and profiles
```sql
CREATE TABLE "Users" (
  "uid" VARCHAR(32) PRIMARY KEY,
  "outerId" VARCHAR(32),
  "level" VARCHAR(32),
  "email" VARCHAR(64),
  "displayName" VARCHAR(32),
  "phone" VARCHAR(32),
  "phoneNumber" VARCHAR(32),
  "gender" VARCHAR(8),
  "birth" VARCHAR(8),
  "extensionCount" INTEGER,
  "token" VARCHAR(256),
  "type" VARCHAR(32),
  "group" VARCHAR(32),
  "appVersion" VARCHAR(32),
  "os" VARCHAR(32),
  "osVersion" VARCHAR(32),
  "delayed" INTEGER,
  "premium" INTEGER,
  "lastDestination" VARCHAR(36),
  "photoURL" VARCHAR(256),
  "preserved" INTEGER,
  "postQuality" INTEGER,
  "memo" JSONB,
  "local" JSONB,
  "membersLocal" JSONB,
  "blocked" JSONB,
  "naverHistory" JSONB,
  "instaHistory" JSONB,
  "youtubeChannel" JSONB,
  "penaltyHistory" JSONB,
  "agreement" BOOLEAN DEFAULT FALSE,
  "visitorCount" DECIMAL(10,2) DEFAULT 0.00,
  "visitorDate" TIMESTAMP,
  "lastLogin" TIMESTAMP,
  "anonymousUpdated" TIMESTAMP,
  "lastContractDate" TIMESTAMP,
  "installedAt" TIMESTAMP,
  "signupAt" TIMESTAMP,
  "requestedAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
);
```
- **Primary Key**: uid
- **Dependencies**: None
- **JSON Fields**: memo, local, membersLocal, blocked, naverHistory, instaHistory, youtubeChannel, penaltyHistory

### 3. Companies
**Purpose**: Company information and user accounts
```sql
CREATE TABLE "Companies" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER,
  "contacts" VARCHAR(255),
  "recommended" VARCHAR(255),
  "route" VARCHAR(255),
  "email" VARCHAR(255) NOT NULL,
  "name" VARCHAR(255),
  "charger" VARCHAR(255),
  "agree_to_mail" BOOLEAN,
  "email2" VARCHAR(255),
  "last_login" TIMESTAMP,
  "date_joined" TIMESTAMP,
  "is_active" INTEGER,
  "is_superuser" INTEGER,
  "first_name" VARCHAR(255),
  "registration" VARCHAR(255),
  "username" VARCHAR(255),
  "password" VARCHAR(255),
  "last_name" VARCHAR(255),
  "is_staff" INTEGER,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "memo" TEXT,
  "last_login_matching" TIMESTAMP,
  "contacts2" TEXT,
  "email3" TEXT,
  "route2" VARCHAR(255),
  "manager" VARCHAR(255),
  FOREIGN KEY ("companyId") REFERENCES "Companies"("id") ON DELETE RESTRICT
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: companyId → Companies(id) (self-referencing)
- **Indexes**: idx_companies_email
- **Dependencies**: Self-referencing

### 4. Keywords
**Purpose**: SEO keywords and their metadata
```sql
CREATE TABLE "Keywords" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "mmqccnt" INTEGER,
  "cat1" VARCHAR(255),
  "cat2" VARCHAR(255),
  "ids" TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "difficulty" REAL,
  "efficiency" REAL,
  "duration" INTEGER
);
```
- **Primary Key**: id (SERIAL)
- **Unique Constraints**: name
- **Dependencies**: None

### 5. Propositions
**Purpose**: Placeholder table for propositions (referenced but not in original dumps)
```sql
CREATE TABLE "Propositions" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```
- **Primary Key**: id (SERIAL)
- **Dependencies**: None
- **Note**: Placeholder table

### 6. CampaignKeywords
**Purpose**: Placeholder table for campaign keywords (referenced but not in original dumps)
```sql
CREATE TABLE "CampaignKeywords" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```
- **Primary Key**: id (SERIAL)
- **Dependencies**: None
- **Note**: Placeholder table

### 7. Charges
**Purpose**: Placeholder table for charges (referenced but not in original dumps)
```sql
CREATE TABLE "Charges" (
  "id" SERIAL PRIMARY KEY,
  "amount" INTEGER,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```
- **Primary Key**: id (SERIAL)
- **Dependencies**: None
- **Note**: Placeholder table

### 8. Ads_Group
**Purpose**: Advertisement grouping (referenced but not in original dumps)
```sql
CREATE TABLE "Ads_Group" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" VARCHAR(255),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```
- **Primary Key**: id (UUID)
- **Dependencies**: None
- **Note**: Placeholder table

### 9. NaverPlaceKeywords
**Purpose**: Naver Place keywords (referenced but not in original dumps)
```sql
CREATE TABLE "NaverPlaceKeywords" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```
- **Primary Key**: id (SERIAL)
- **Dependencies**: None
- **Note**: Placeholder table

### 10. MarketingLead_Assignees
**Purpose**: Marketing lead assignees
```sql
CREATE TABLE "MarketingLead_Assignees" (
  "nickname" VARCHAR(36) PRIMARY KEY,
  "name" VARCHAR(255),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```
- **Primary Key**: nickname
- **Dependencies**: None

### 11. Ads
**Purpose**: Advertisement campaigns and listings
```sql
CREATE TABLE "Ads" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER,
  "liked" INTEGER,
  "reservationComment" TEXT,
  "contacts" VARCHAR(255),
  "deadline" INTEGER,
  "abstraction" TEXT,
  "question" TEXT,
  "lastContractDateInsta" TIMESTAMP,
  "address" VARCHAR(255),
  "name" VARCHAR(255),
  "is_verified" INTEGER,
  "category" TEXT,
  "categoryCode" INTEGER,
  "unavailable" TEXT,
  "hashtags" TEXT,
  "verified" BOOLEAN,
  "lon" DOUBLE PRECISION,
  "rKey" VARCHAR(255),
  "step" INTEGER,
  "local" TEXT,
  "localCode" INTEGER,
  "operationType" VARCHAR(32),
  "time" TEXT,
  "thumbnails" TEXT,
  "thumbnail" VARCHAR(255),
  "lastContractDate" TIMESTAMP,
  "lat" DOUBLE PRECISION,
  "code" VARCHAR(255),
  "delivery" TEXT,
  "isReservationRequired" BOOLEAN,
  "keywords" TEXT,
  "email" VARCHAR(255),
  "menu" TEXT,
  "addressDetail" VARCHAR(255),
  "user_id" INTEGER,
  "introduction" TEXT,
  "instaOfficial" VARCHAR(255),
  "additionalInfo" TEXT,
  "csNumber" VARCHAR(255),
  "deliveryMethod" VARCHAR(255),
  "companyName" VARCHAR(255),
  "site" VARCHAR(255),
  "registerLink" VARCHAR(255),
  "shipping" TEXT,
  "images" TEXT,
  "registerAlert" TEXT,
  "manual" TEXT,
  "key" INTEGER,
  "memo" TEXT,
  "purchaseLink" VARCHAR(255),
  "image" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "receiptReviewRequired" BOOLEAN,
  "ftcRequired" BOOLEAN,
  "ftcText" VARCHAR(255),
  "naverPlaceUrl" VARCHAR(255),
  "requiredKeywords" TEXT,
  "priority" INTEGER,
  "requirement" TEXT,
  "type" VARCHAR(255),
  "diamondPoint" INTEGER,
  "nt" TEXT,
  "utm" TEXT,
  "periodApply" INTEGER DEFAULT 10,
  "periodAccept" INTEGER DEFAULT 2,
  "periodReview" INTEGER DEFAULT 14,
  "bannerImg" VARCHAR(255),
  "blackPoint" INTEGER,
  "redPoint" INTEGER,
  "yellowPoint" INTEGER,
  "storeId" VARCHAR(255),
  "disableAutoSelection" BOOLEAN,
  "adsGroupId" UUID,
  "weekdayReport" INTEGER,
  FOREIGN KEY ("companyId") REFERENCES "Companies"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("adsGroupId") REFERENCES "Ads_Group"("id") ON DELETE SET NULL
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: 
  - companyId → Companies(id)
  - adsGroupId → Ads_Group(id)
- **Indexes**: idx_ads_companyId, idx_ads_email, idx_ads_companyId_createdAt
- **Dependencies**: Companies, Ads_Group

### 12. AdKeywords
**Purpose**: Keywords associated with advertisements
```sql
CREATE TABLE "AdKeywords" (
  "id" SERIAL PRIMARY KEY,
  "adId" INTEGER,
  "info" TEXT,
  "name" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  FOREIGN KEY ("adId") REFERENCES "Ads"("id")
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: adId → Ads(id)
- **Indexes**: idx_adkeywords_adId
- **Dependencies**: Ads

### 13. Ads_Keyword
**Purpose**: Alternative keyword structure for ads
```sql
CREATE TABLE "Ads_Keyword" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "adId" INTEGER NOT NULL,
  "name" VARCHAR(64),
  "info" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW()
);
```
- **Primary Key**: id (UUID)
- **Dependencies**: Ads (implicit reference)

### 14. AdNaverPlaceKeywords
**Purpose**: Naver Place keywords for advertisements
```sql
CREATE TABLE "AdNaverPlaceKeywords" (
  "id" SERIAL PRIMARY KEY,
  "adId" INTEGER,
  "naverPlaceKeywordId" INTEGER,
  "storeId" VARCHAR(255),
  "name" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  FOREIGN KEY ("adId") REFERENCES "Ads"("id"),
  FOREIGN KEY ("naverPlaceKeywordId") REFERENCES "NaverPlaceKeywords"("id")
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: 
  - adId → Ads(id)
  - naverPlaceKeywordId → NaverPlaceKeywords(id)
- **Dependencies**: Ads, NaverPlaceKeywords

### 15. Contracts
**Purpose**: User contracts and agreements
```sql
CREATE TABLE "Contracts" (
  "id" VARCHAR(255) PRIMARY KEY,
  "company" INTEGER,
  "companyName" VARCHAR(255),
  "currentState" INTEGER,
  "review" VARCHAR(255),
  "date0" TIMESTAMP,
  "reward" VARCHAR(255),
  "link" VARCHAR(255),
  "feedback" BOOLEAN,
  "push" BOOLEAN,
  "level" VARCHAR(255),
  "user" VARCHAR(255),
  "userEmail" VARCHAR(255),
  "date1" TIMESTAMP,
  "second" VARCHAR(255),
  "first" VARCHAR(255),
  "group" VARCHAR(255),
  "username" VARCHAR(255),
  "type" VARCHAR(255),
  "used" INTEGER,
  "third" VARCHAR(255),
  "payment" INTEGER,
  "deadline" INTEGER,
  "purchaseDeadline" INTEGER,
  "discount" INTEGER,
  "mark" INTEGER,
  "date2" TIMESTAMP,
  "private" BOOLEAN,
  "extended" BOOLEAN,
  "deliveryState" INTEGER,
  "deliveryHistory" TEXT,
  "payPrice" INTEGER,
  "deliveryDate" TIMESTAMP,
  "paidAt" TIMESTAMP,
  "gender" VARCHAR(255),
  "delivery" TEXT,
  "payState" INTEGER,
  "deliveryMethod" VARCHAR(255),
  "pay" VARCHAR(255),
  "birth" INTEGER,
  "userOuterId" VARCHAR(255),
  "quality" INTEGER,
  "tags" TEXT,
  "follower" INTEGER,
  "like" INTEGER,
  "play" INTEGER,
  "rKey" VARCHAR(255),
  "reply" INTEGER,
  "canceledReason" VARCHAR(255),
  "canceledAt" TIMESTAMP,
  "memo" TEXT,
  "usercode" VARCHAR(255),
  "outerId" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "receiptReview" VARCHAR(255),
  "receiptOnly" BOOLEAN,
  "rewardStatus" INTEGER,
  "rewardCompletedAt" TIMESTAMP,
  "rewardFees" REAL,
  "rewardFeeAmount" INTEGER,
  "withdrawalRequestAt" TIMESTAMP,
  "withdrawalAt" TIMESTAMP,
  "bankName" VARCHAR(255),
  "accountNumber" VARCHAR(255),
  "accountHolder" VARCHAR(255),
  "copyBankbook" VARCHAR(255),
  "authName" VARCHAR(255),
  "authID" VARCHAR(255),
  "authCategory" VARCHAR(255),
  "authAddr" VARCHAR(255),
  "authBusiness" VARCHAR(255),
  "purchaseThumbnail" VARCHAR(255),
  "views" INTEGER,
  "appliedAt" TIMESTAMP,
  "point" INTEGER,
  "pointStatus" INTEGER,
  "periodWaitingPoint" INTEGER,
  "pendingAt" TIMESTAMP,
  "fees" REAL,
  "earnedAt" TIMESTAMP,
  "settlementAmount" INTEGER,
  "feeAmount" INTEGER,
  "selectedAt" TIMESTAMP,
  "isAutoSelected" BOOLEAN DEFAULT FALSE,
  "usedAt" TIMESTAMP,
  "purchaseLink" VARCHAR(255),
  FOREIGN KEY ("company") REFERENCES "Ads"("id") ON DELETE RESTRICT
);
```
- **Primary Key**: id (VARCHAR)
- **Foreign Keys**: company → Ads(id)
- **Indexes**: idx_contracts_company, idx_contracts_user, idx_contracts_company_createdAt
- **Dependencies**: Ads

### 16. Channels
**Purpose**: Advertisement channels and pricing
```sql
CREATE TABLE "Channels" (
  "id" SERIAL PRIMARY KEY,
  "adId" INTEGER,
  "currentAdsOrder" INTEGER,
  "channel" VARCHAR(255),
  "yellowPrice" INTEGER,
  "blackPrice" INTEGER,
  "available" INTEGER,
  "blackPayment" INTEGER,
  "stopRequest" BOOLEAN,
  "yellow" VARCHAR(255),
  "revisitPeriod" INTEGER,
  "redPayment" INTEGER,
  "redPrice" INTEGER,
  "black" VARCHAR(255),
  "yellowPayment" INTEGER,
  "current" INTEGER,
  "red" VARCHAR(255),
  "startDate" VARCHAR(255),
  "mission" TEXT,
  "limitation" TEXT,
  "type" VARCHAR(255),
  "number" INTEGER,
  "blackFullPrice" INTEGER,
  "yellowFullPrice" INTEGER,
  "redFullPrice" INTEGER,
  "deliveryCharge" INTEGER,
  "paid" BOOLEAN,
  "finished" BOOLEAN,
  "payInfo_dayOfMonth" VARCHAR(255),
  "payInfo_checkBlogger" BOOLEAN,
  "payInfo_lastPaidAt" VARCHAR(255),
  "payInfo_startPaidAt" VARCHAR(255),
  "payInfo_checkBloggerCnt" INTEGER,
  "payInfo_endPaidAt" VARCHAR(255),
  "payInfo_amount" INTEGER,
  "payInfo_payMethod" VARCHAR(255),
  "payInfo_extended" BOOLEAN,
  "payInfo_card" INTEGER,
  "payInfo_plan" INTEGER,
  "payInfo_memo" TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "payInfo_checkPeriod" BOOLEAN,
  "payInfo_nextPaidAt" VARCHAR(255),
  "payInfo_prePayCnt" INTEGER,
  "whitePrice" INTEGER,
  "white" VARCHAR(255),
  "whitePayment" INTEGER,
  "whiteFullPrice" INTEGER,
  "enableWhite" BOOLEAN,
  "diamond" VARCHAR(255),
  "diamondPrice" INTEGER,
  "diamondPayment" INTEGER,
  "diamondFullPrice" INTEGER,
  "payInfo_installmentAmount" INTEGER,
  "payInfo_installmentNumber" INTEGER,
  UNIQUE ("adId", "channel")
);
```
- **Primary Key**: id (SERIAL)
- **Unique Constraints**: (adId, channel)
- **Indexes**: idx_channels_adId
- **Dependencies**: Ads (implicit reference)

### 17. AuthUsers_Card
**Purpose**: User payment card information
```sql
CREATE TABLE "AuthUsers_Card" (
  "cardId" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "companyId" INTEGER NOT NULL,
  "id" INTEGER NOT NULL,
  "cardName" VARCHAR(32),
  "customerName" VARCHAR(32),
  "customerUid" VARCHAR(64),
  "last4" VARCHAR(32),
  "status" VARCHAR(32),
  "main" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP,
  UNIQUE ("companyId", "id"),
  FOREIGN KEY ("companyId") REFERENCES "Companies"("id")
);
```
- **Primary Key**: cardId (UUID)
- **Foreign Keys**: companyId → Companies(id)
- **Unique Constraints**: (companyId, id)
- **Dependencies**: Companies

### 18. App_Inquiry
**Purpose**: Customer support inquiries
```sql
CREATE TABLE "App_Inquiry" (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(36) NOT NULL,
  "category" VARCHAR(255) NOT NULL,
  "subCategory" VARCHAR(255),
  "contentText" TEXT,
  "contentImages" JSONB,
  "adId" INTEGER,
  "additionalInfo" JSONB,
  "os" VARCHAR(50),
  "osVersion" VARCHAR(50),
  "appVersion" VARCHAR(50),
  "device" VARCHAR(255),
  "isAnswered" BOOLEAN DEFAULT FALSE,
  "answeredAt" TIMESTAMP,
  "updatedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
```
- **Primary Key**: id (SERIAL)
- **Indexes**: idx_app_inquiry_uid
- **JSON Fields**: contentImages, additionalInfo
- **Dependencies**: None

### 19. App_Inquiry_Answer
**Purpose**: Answers to customer inquiries
```sql
CREATE TABLE "App_Inquiry_Answer" (
  "id" SERIAL PRIMARY KEY,
  "inquiryId" INTEGER,
  "contentText" TEXT NOT NULL,
  "contentImages" JSONB,
  "isRead" BOOLEAN DEFAULT FALSE,
  "readAt" TIMESTAMP,
  "updatedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("inquiryId") REFERENCES "App_Inquiry"("id") ON DELETE CASCADE
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: inquiryId → App_Inquiry(id) CASCADE
- **JSON Fields**: contentImages
- **Dependencies**: App_Inquiry

### 20. App_Inquiry_Answer_AutoGenerated
**Purpose**: Auto-generated answers to inquiries
```sql
CREATE TABLE "App_Inquiry_Answer_AutoGenerated" (
  "id" SERIAL PRIMARY KEY,
  "inquiryId" INTEGER NOT NULL,
  "generatedAnswer" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("inquiryId") REFERENCES "App_Inquiry"("id") ON DELETE CASCADE
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: inquiryId → App_Inquiry(id) CASCADE
- **Dependencies**: App_Inquiry

### 21. MarketingLead
**Purpose**: Marketing leads and prospects
```sql
CREATE TABLE "MarketingLead" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER,
  "assignee" VARCHAR(36),
  "companyName" VARCHAR(255) NOT NULL,
  "adCategory" VARCHAR(36) NOT NULL,
  "contact" VARCHAR(36) NOT NULL,
  "x" DOUBLE PRECISION,
  "y" DOUBLE PRECISION,
  "localCode" INTEGER,
  "naverPlaceId" VARCHAR(256),
  "crawlFailReason" VARCHAR(64),
  "callTemperature" INTEGER,
  "agreeToMarketing" BOOLEAN NOT NULL DEFAULT FALSE,
  "isInquirySkipped" BOOLEAN DEFAULT FALSE,
  "kakaoRegistered" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("companyId") REFERENCES "Companies"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("assignee") REFERENCES "MarketingLead_Assignees"("nickname") ON DELETE RESTRICT
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: 
  - companyId → Companies(id)
  - assignee → MarketingLead_Assignees(nickname)
- **Indexes**: idx_marketing_lead_companyId
- **Dependencies**: Companies, MarketingLead_Assignees

### 22. Packages
**Purpose**: Service packages and pricing
```sql
CREATE TABLE "Packages" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER,
  "adId" INTEGER,
  "name" VARCHAR(255),
  "period" INTEGER,
  "number" INTEGER,
  "price" INTEGER,
  "balance" INTEGER,
  "total" INTEGER,
  "notes" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "chargeId" INTEGER,
  "adsPaymentId" VARCHAR(36),
  "contractId" VARCHAR(36),
  "order" INTEGER,
  FOREIGN KEY ("companyId") REFERENCES "Companies"("id"),
  FOREIGN KEY ("adId") REFERENCES "Ads"("id"),
  FOREIGN KEY ("chargeId") REFERENCES "Charges"("id")
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: 
  - companyId → Companies(id)
  - adId → Ads(id)
  - chargeId → Charges(id)
- **Dependencies**: Companies, Ads, Charges

### 23. Packages_Log
**Purpose**: Package transaction logs
```sql
CREATE TABLE "Packages_Log" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "adId" INTEGER,
  "contractId" VARCHAR(255),
  "amount" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  FOREIGN KEY ("companyId") REFERENCES "Companies"("id"),
  FOREIGN KEY ("adId") REFERENCES "Ads"("id"),
  FOREIGN KEY ("contractId") REFERENCES "Contracts"("id")
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: 
  - companyId → Companies(id)
  - adId → Ads(id)
  - contractId → Contracts(id)
- **Dependencies**: Companies, Ads, Contracts

### 24. PremiumPackages
**Purpose**: Premium service packages
```sql
CREATE TABLE "PremiumPackages" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER,
  "adId" INTEGER,
  "chargeId" INTEGER,
  "name" VARCHAR(255),
  "period" INTEGER,
  "number" INTEGER,
  "price" INTEGER,
  "balance" INTEGER,
  "total" INTEGER,
  "notes" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "order" INTEGER,
  FOREIGN KEY ("companyId") REFERENCES "Companies"("id"),
  FOREIGN KEY ("adId") REFERENCES "Ads"("id"),
  FOREIGN KEY ("chargeId") REFERENCES "Charges"("id")
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: 
  - companyId → Companies(id)
  - adId → Ads(id)
  - chargeId → Charges(id)
- **Dependencies**: Companies, Ads, Charges

### 25. SumemPoints
**Purpose**: Point system transactions
```sql
CREATE TABLE "SumemPoints" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER,
  "contractId" VARCHAR(255),
  "amount" INTEGER,
  "balance" INTEGER,
  "total" INTEGER,
  "pointType" VARCHAR(16),
  "notes" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "chargeId" INTEGER,
  FOREIGN KEY ("chargeId") REFERENCES "Charges"("id")
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: chargeId → Charges(id)
- **Dependencies**: Charges

### 26. Ads_Payment
**Purpose**: Advertisement payment information
```sql
CREATE TABLE "Ads_Payment" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "adId" INTEGER NOT NULL,
  "adsStart" VARCHAR(10),
  "amount" INTEGER,
  "contractCount" INTEGER,
  "plan" INTEGER,
  "order" INTEGER,
  "checkBlogger" BOOLEAN,
  "checkBloggerCnt" INTEGER,
  "checkPeriod" BOOLEAN,
  "extend1st" BOOLEAN,
  "extend2nd" BOOLEAN,
  "extended" BOOLEAN,
  "alarm1st" BOOLEAN,
  "alarm2nd" BOOLEAN,
  "prePayCnt" INTEGER,
  "discount" INTEGER,
  "qtyDiscount" INTEGER,
  "feedback" BOOLEAN,
  "payState" INTEGER,
  "card_name" VARCHAR(255),
  "payMethod" VARCHAR(255),
  "dayOfMonth" VARCHAR(255),
  "type" VARCHAR(255),
  "installmentAmount" INTEGER,
  "installmentNumber" INTEGER,
  "installmentTotal" INTEGER,
  "receipt" VARCHAR(255),
  "channel" VARCHAR(255) NOT NULL,
  "imp_uid" VARCHAR(255),
  "memo" TEXT,
  "nextPaidAt" VARCHAR(10),
  "paidAt" TIMESTAMP,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP,
  "endReason" INTEGER,
  "number" INTEGER,
  "periodApply" INTEGER,
  "periodAccept" INTEGER,
  "periodReview" INTEGER,
  "disableAutoSelection" BOOLEAN DEFAULT FALSE,
  "refundedPackageId" INTEGER
);
```
- **Primary Key**: id (UUID)
- **Indexes**: idx_ads_payment_adId
- **Dependencies**: Ads (implicit reference)

### 27. Ads_Termination_Log
**Purpose**: Advertisement termination logs
```sql
CREATE TABLE "Ads_Termination_Log" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "adId" INTEGER NOT NULL,
  "previousAvailable" INTEGER,
  "currentAvailable" INTEGER,
  "updatedAt" TIMESTAMP
);
```
- **Primary Key**: id (SERIAL)
- **Dependencies**: Companies, Ads (implicit references)

### 28. AdKeywordRankHistories
**Purpose**: Keyword ranking history for advertisements
```sql
CREATE TABLE "AdKeywordRankHistories" (
  "id" SERIAL PRIMARY KEY,
  "adKeywordId" INTEGER,
  "contractId" VARCHAR(255),
  "date" TIMESTAMP,
  "level" VARCHAR(255),
  "rank" INTEGER,
  "screenshot" VARCHAR(255),
  "username" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);
```
- **Primary Key**: id (SERIAL)
- **Indexes**: 
  - idx_adkeywordrankhistories_contractid_date
  - idx_adkeywordrankhistories_adkeywordid_date
- **Dependencies**: AdKeywords (implicit reference)

### 29. KeywordRankHistories
**Purpose**: General keyword ranking history
```sql
CREATE TABLE "KeywordRankHistories" (
  "id" SERIAL PRIMARY KEY,
  "keywordId" INTEGER,
  "propositionId" INTEGER,
  "date" TIMESTAMP,
  "level" VARCHAR(255),
  "rank" INTEGER,
  "screenshot" VARCHAR(255),
  "username" VARCHAR(255),
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "campaignKeywordId" INTEGER,
  FOREIGN KEY ("keywordId") REFERENCES "Keywords"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("propositionId") REFERENCES "Propositions"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("campaignKeywordId") REFERENCES "CampaignKeywords"("id") ON DELETE RESTRICT
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: 
  - keywordId → Keywords(id)
  - propositionId → Propositions(id)
  - campaignKeywordId → CampaignKeywords(id)
- **Dependencies**: Keywords, Propositions, CampaignKeywords

### 30. NaverPlaceKeywordRankHistories
**Purpose**: Naver Place keyword ranking history
```sql
CREATE TABLE "NaverPlaceKeywordRankHistories" (
  "id" SERIAL PRIMARY KEY,
  "adNaverPlaceKeywordId" INTEGER,
  "date" TIMESTAMP,
  "rank" INTEGER,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  FOREIGN KEY ("adNaverPlaceKeywordId") REFERENCES "AdNaverPlaceKeywords"("id")
);
```
- **Primary Key**: id (SERIAL)
- **Foreign Keys**: adNaverPlaceKeywordId → AdNaverPlaceKeywords(id)
- **Dependencies**: AdNaverPlaceKeywords

## Security Features

### Row Level Security (RLS)
All tables have RLS enabled for enhanced security. Basic policies are provided as examples:

```sql
-- Example policies for Companies table
CREATE POLICY "Enable read access for all users" ON "Companies" FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON "Companies" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON "Companies" FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON "Companies" FOR DELETE USING (auth.role() = 'authenticated');
```

## Performance Optimizations

### Indexes
- **Primary Indexes**: All tables have primary key indexes
- **Foreign Key Indexes**: All foreign key columns are indexed
- **Composite Indexes**: 
  - `idx_ads_companyId_createdAt` on Ads(companyId, createdAt DESC)
  - `idx_contracts_company_createdAt` on Contracts(company, createdAt DESC)
  - `idx_adkeywordrankhistories_contractid_date` on AdKeywordRankHistories(contractId, date DESC)
  - `idx_adkeywordrankhistories_adkeywordid_date` on AdKeywordRankHistories(adKeywordId, date DESC)

### Data Types
- **JSONB**: Used for flexible JSON storage with better performance than JSON
- **UUID**: Used for globally unique identifiers
- **TIMESTAMP**: Used for all datetime fields
- **SERIAL**: Used for auto-incrementing primary keys
- **DOUBLE PRECISION**: Used for geographic coordinates

## Migration Notes

1. **Placeholder Tables**: Some tables (Propositions, CampaignKeywords, Charges, Ads_Group, NaverPlaceKeywords) are placeholders for referenced but missing tables
2. **Data Import**: Actual data needs to be imported separately using COPY commands or INSERT statements
3. **Sequence Updates**: If importing data with specific IDs, sequences need to be updated
4. **RLS Policies**: Need to be customized based on actual authentication requirements
5. **Testing**: All foreign key relationships should be tested after data import

## Extensions Required
- `uuid-ossp`: For UUID generation functions

## Total Storage Estimate
Based on the schema complexity and expected data volume, this database is designed to handle:
- **Companies**: Thousands of records
- **Ads**: Tens of thousands of records
- **Contracts**: Hundreds of thousands of records
- **Users**: Hundreds of thousands of records
- **History Tables**: Millions of records

This schema supports a comprehensive CRM system with advertising management, user tracking, payment processing, and analytics capabilities. 