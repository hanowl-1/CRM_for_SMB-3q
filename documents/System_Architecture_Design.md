# 시스템 아키텍처 설계 문서 (TDD)
## 카카오톡/문자 메시지 자동화 플랫폼

### 1. 개요

#### 1.1 문서 목적
본 문서는 **기존 운영중인 자영업자 구독 서비스(SaaS)의 보조 서비스**로 구축되는 카카오톡 알림톡 및 문자 메시지 자동화 플랫폼의 시스템 아키텍처, 기술 스택, 데이터 구조 및 API 설계를 정의합니다.

#### 1.2 시스템 범위
- **웹 애플리케이션**: Next.js 기반 관리 대시보드 (기존 SaaS 통합)
- **백엔드 API**: Node.js/Express 기반 REST API
- **메시지 발송**: 카카오 알림톡 및 SMS 통합 서비스
- **데이터베이스 통합**: 
  - 기존 SQL Server (고객 데이터, 구독 정보) - 읽기 전용
  - PostgreSQL (메시지 플랫폼 전용) - 읽기/쓰기
- **메시지 큐**: Redis 기반 비동기 처리
- **기존 시스템 연동**: 실시간 데이터 동기화 및 이벤트 처리

### 2. 시스템 아키텍처 개요

#### 2.1 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Next.js Web Application (Port: 3000)                      │
│  - Integrated with Existing SaaS Dashboard                 │
│  - Message Campaign Management                              │
│  - Subscription-based Workflow Management                   │
│  - Customer Analytics & Reporting                          │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP/HTTPS
                                │
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Express.js API Server (Port: 8000)                        │
│  - Authentication & Authorization                           │
│  - Rate Limiting & Validation                              │
│  - Request/Response Logging                                │
│  - Error Handling & Circuit Breaker                        │
└─────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
┌───────────────────────┐ ┌─────────────┐ ┌──────────────────┐
│   Business Logic      │ │   Message   │ │   Database       │
│   Layer               │ │   Queue     │ │   Integration    │
├───────────────────────┤ ├─────────────┤ ├──────────────────┤
│ • Workflow Engine     │ │ Redis       │ │ ┌──────────────┐ │
│ • Campaign Manager    │ │ (Port:6379) │ │ │ SQL Server   │ │
│ • Customer Segment    │ │             │ │ │ (Existing)   │ │
│ • Template Manager    │ │ • Job Queue │ │ │ - Customers  │ │
│ • Analytics Engine    │ │ • Scheduler │ │ │ - Subscript. │ │
│ • DB Sync Manager     │ │ • Retry     │ │ │ - Billing    │ │
└───────────────────────┘ │ • CDC Event │ │ │ (Read-Only)  │ │
                          │ • Logging   │ │ └──────────────┘ │
                          └─────────────┘ │ ┌──────────────┐ │
                                          │ │ PostgreSQL   │ │
                                          │ │ (Message)    │ │
                                          │ │ - Templates  │ │
                                          │ │ - Workflows  │ │
                                          │ │ - Campaigns  │ │
                                          │ │ - Logs       │ │
                                          │ └──────────────┘ │
                                          └──────────────────┘
                                │
                                │
┌─────────────────────────────────────────────────────────────┐
│                External Services Layer                      │
├─────────────────────────────────────────────────────────────┤
│  Message Delivery Services                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   COOLSMS API       │    │     Alternative SMS         │ │
│  │   (Primary)         │    │     (Backup)                │ │
│  │                     │    │                             │ │
│  │ • Kakao Alimtalk    │    │ • SENS (Naver)              │ │
│  │ • SMS/LMS           │    │ • 알리고 (Aligo)             │ │
│  │ • Rate Limiting     │    │ • etc...                    │ │
│  │ • Template Sync     │    │                             │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 데이터 플로우 (기존 시스템 연동)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Existing      │    │   Message       │    │   External      │
│   SaaS System   │    │   Platform      │    │   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ Event/CDC             │ API Call              │
         ├─ Subscription Change  ├─ Template Management  │
         ├─ Customer Update      ├─ Workflow Execution   │
         ├─ Payment Event        ├─ Campaign Launch      │
         │                       │                       │
┌─────────────────┐              │              ┌─────────────────┐
│   SQL Server    │◄─────────────┼──────────────┤   Redis Queue   │
│   (Existing)    │              │              │   (New)         │
│                 │              │              └─────────────────┘
│ • Customer Data │              │                       │
│ • Subscription  │              │                       │
│ • Billing Info  │              │              ┌─────────────────┐
│ • Usage Data    │              │              │   PostgreSQL    │
└─────────────────┘              │              │   (Message)     │
         │                       │              │                 │
         │ Real-time Sync        │              │ • Templates     │
         │                       │              │ • Workflows     │
         ▼                       │              │ • Campaigns     │
User Action → Frontend → API Gateway → Business Logic → Message Queue → External API
     ↓            ↓         ↓              ↓               ↓              ↓
Analytics ← PostgreSQL ← PostgreSQL ← SQL Server ← PostgreSQL ← Response Status
```

### 3. 기술 스택 상세

#### 3.1 Frontend Stack
```typescript
// Next.js 15 + React 19 + TypeScript
{
  "framework": "Next.js 15",
  "runtime": "React 19",
  "language": "TypeScript",
  "styling": {
    "primary": "Tailwind CSS",
    "components": "Radix UI"
  },
  "forms": "React Hook Form + Zod",
  "charts": "Recharts",
  "icons": "Lucide React",
  "state": "React Context + useState"
}
```

#### 3.2 Backend Stack
```typescript
// Node.js + Express + TypeScript + Multi-DB Integration
{
  "runtime": "Node.js 18+",
  "framework": "Express.js",
  "language": "TypeScript",
  "database": {
    "existing": "SQL Server (고객/구독 데이터)",
    "new": "PostgreSQL 15+ (메시지 플랫폼)",
    "orm": {
      "sql_server": "Prisma 또는 TypeORM",
      "postgresql": "Prisma"
    },
    "connection_pooling": "pg-pool, mssql pool"
  },
  "cache": "Redis 7+",
  "queue": "Bull Queue (Redis-based)",
  "auth": "JWT + bcrypt",
  "validation": "Zod",
  "data_sync": {
    "cdc": "SQL Server Change Data Capture",
    "event_driven": "Custom Event Handlers",
    "real_time": "WebSocket or SSE for live updates"
  }
}
```

#### 3.3 Database Integration Strategy
```typescript
// 하이브리드 데이터베이스 아키텍처
{
  "sql_server_integration": {
    "purpose": "기존 SaaS 고객/구독 데이터 읽기",
    "connection": "Read-only connection",
    "data_sources": [
      "고객 정보 (이름, 연락처, 회사정보)",
      "구독 상태 (활성, 취소, 일시정지, 만료)",
      "결제 정보 (결제일, 실패 이력)",
      "사용 패턴 (로그인, 기능 사용량)",
      "커스텀 필드 (업종, 규모, 특성)"
    ],
    "sync_strategy": "CDC + Polling hybrid",
    "error_handling": "Circuit breaker pattern"
  },
  
  "postgresql_native": {
    "purpose": "메시지 플랫폼 전용 데이터",
    "connection": "Full read/write access",
    "data_sources": [
      "메시지 템플릿 및 변수 정의",
      "워크플로우 설정 및 실행 이력",
      "캠페인 관리 및 스케줄링",
      "발송 로그 및 성과 분석",
      "시스템 설정 및 API 키 관리"
    ]
  }
}
```

### 4. 데이터베이스 설계 (하이브리드 구조)

#### 4.1 SQL Server Integration (기존 데이터)

```sql
-- 기존 SQL Server 스키마 예시 (읽기 전용 접근)
-- 실제 스키마는 기존 SaaS 구조에 따라 조정 필요

-- 고객 정보 (기존 테이블 참조)
CREATE VIEW vw_customers_for_messaging AS
SELECT 
    customer_id,
    company_name,
    contact_name,
    phone_number,
    email,
    subscription_status, -- 'active', 'cancelled', 'paused', 'expired'
    subscription_plan,
    subscription_start_date,
    subscription_end_date,
    last_login_date,
    created_date,
    -- 커스텀 필드들 (JSON 또는 별도 컬럼)
    industry_type,
    company_size,
    monthly_usage
FROM customers c
JOIN subscriptions s ON c.customer_id = s.customer_id
WHERE c.is_active = 1;

-- 구독 이벤트 이력 (기존 테이블 참조)
CREATE VIEW vw_subscription_events AS
SELECT 
    event_id,
    customer_id,
    event_type, -- 'signup', 'cancel', 'pause', 'resume', 'payment_failed'
    event_date,
    previous_status,
    current_status,
    event_metadata -- JSON 형태의 추가 정보
FROM subscription_events
WHERE event_date >= DATEADD(day, -30, GETDATE()); -- 최근 30일
```

#### 4.2 PostgreSQL Schema (메시지 플랫폼 전용)

```sql
-- 고객 데이터 동기화 테이블
CREATE TABLE customer_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sql_server_customer_id VARCHAR(50) NOT NULL UNIQUE,
    company_name VARCHAR(200),
    contact_name VARCHAR(100),
    phone_number VARCHAR(20),
    email VARCHAR(255),
    subscription_status VARCHAR(20),
    subscription_plan VARCHAR(50),
    custom_fields JSONB DEFAULT '{}',
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 메시지 템플릿 (변수 매핑 포함)
CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- alimtalk, sms, lms
    category VARCHAR(50),
    content TEXT NOT NULL,
    -- SQL Server 필드와의 변수 매핑
    variable_mappings JSONB DEFAULT '{}', -- { "{{고객명}}": "contact_name", "{{회사명}}": "company_name" }
    subscription_status_filter JSONB DEFAULT '[]', -- ["active", "cancelled"] 등
    kakao_template_id VARCHAR(100),
    kakao_channel_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 워크플로우 (구독 이벤트 기반)
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    -- 기존 SaaS 시스템의 이벤트와 연동
    trigger_event VARCHAR(50) NOT NULL, -- 'subscription_signup', 'subscription_cancel', 'payment_failed' 등
    trigger_conditions JSONB DEFAULT '{}',
    -- SQL Server 데이터 기반 타겟팅
    target_conditions JSONB DEFAULT '{}', -- { "subscription_plan": ["premium"], "company_size": ["medium", "large"] }
    message_template_id UUID REFERENCES message_templates(id),
    delay_settings JSONB DEFAULT '{}',
    schedule_settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 메시지 발송 로그 (SQL Server 고객 ID 연결)
CREATE TABLE message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sql_server_customer_id VARCHAR(50) NOT NULL,
    customer_sync_id UUID REFERENCES customer_sync(id),
    campaign_id UUID,
    workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
    template_id UUID REFERENCES message_templates(id),
    message_type VARCHAR(20) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    -- 실제 발송 시 사용된 변수 값들
    resolved_variables JSONB DEFAULT '{}',
    external_message_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 이벤트 처리 큐 (SQL Server 이벤트 추적)
CREATE TABLE sync_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- 'customer_update', 'subscription_change', 'payment_event'
    sql_server_event_id VARCHAR(100),
    customer_id VARCHAR(50),
    event_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. API 설계 (기존 시스템 연동)

#### 5.1 Customer Data Integration API
```typescript
// GET /api/customers/sync
// SQL Server 고객 데이터 동기화
interface SyncCustomersRequest {
  last_sync_timestamp?: string;
  customer_ids?: string[];
  force_full_sync?: boolean;
}

// GET /api/customers/:customerId/variables
// 특정 고객의 사용 가능한 변수 조회
interface CustomerVariablesResponse {
  success: boolean;
  data: {
    customer_id: string;
    available_variables: {
      [key: string]: {
        value: string;
        type: 'string' | 'number' | 'date' | 'boolean';
        description: string;
      };
    };
    subscription_info: {
      status: string;
      plan: string;
      start_date: string;
      end_date?: string;
    };
  } | null;
}
```

#### 5.2 Message Templates API (변수 매핑 포함)
```typescript
// POST /api/templates
interface CreateTemplateRequest {
  name: string;
  type: 'alimtalk' | 'sms' | 'lms';
  category: string;
  content: string;
  variable_mappings: { [templateVar: string]: string };
  subscription_status_filter: string[];
}

// POST /api/templates/:id/preview
// 실제 고객 데이터로 템플릿 미리보기
interface PreviewTemplateRequest {
  customer_id: string; // SQL Server customer ID
  test_variables?: { [key: string]: string };
}
```

#### 5.3 Message Sending API (SQL Server 데이터 활용)
```typescript
// POST /api/messages/send-to-customers
interface SendToCustomersRequest {
  template_id: string;
  customer_ids: string[]; // SQL Server customer IDs
  override_variables?: { [customerId: string]: { [varName: string]: string } };
  send_immediately?: boolean;
  scheduled_at?: string;
  dry_run?: boolean;
}

// 기존 COOLSMS 패키지 활용 구조 (확장)
interface MessageSendingService {
  sendAlimtalkWithSqlData(params: {
    template_id: string;
    customer_id: string;
    sql_data: CustomerSqlData;
  }): Promise<ApiResponse>;
  
  sendBulkMessages(params: {
    template_id: string;
    customers: CustomerSqlData[];
    batch_size?: number;
  }): Promise<ApiResponse>;
}
```

### 6. 메시지 큐 아키텍처

#### 6.1 Job Queue 구조
```typescript
// Redis Bull Queue 기반
interface JobQueues {
  'message-sending': {
    data: MessageSendJob;
    options: {
      delay?: number;
      attempts: 3;
      backoff: 'exponential';
    };
  };
  
  'sql-server-sync': {
    data: SqlServerSyncJob;
    options: {
      repeat: { cron: '*/5 * * * *' }; // 5분마다
    };
  };
  
  'subscription-event': {
    data: SubscriptionEventJob;
    options: {
      priority: 'high';
      attempts: 5;
    };
  };
}

interface MessageSendJob {
  templateId: string;
  sqlServerCustomerId: string;
  customerData: CustomerSqlData;
  workflowId?: string;
}
```

### 7. 보안 및 인증

#### 7.1 데이터 보안
- **SQL Server 연결**: Read-only 계정, VPN/방화벽 보호
- **API 키 암호화**: COOLSMS API 키 AES-256 암호화
- **개인정보 보호**: 고객 전화번호 마스킹 처리
- **데이터 전송**: 모든 DB 연결 TLS 암호화

### 8. 기존 카카오 알림톡 패키지 통합

#### 8.1 패키지 구조 활용
```typescript
// 기존 패키지를 SQL Server 데이터와 통합
import { 
  sendAlimtalkByTemplateNumber,
  fetchTemplates,
  KakaoChannels 
} from '@repo/kakao-alimtalk';

class MessageService {
  async sendSubscriptionMessage(params: {
    customerId: string;
    templateType: 'signup' | 'cancel' | 'payment_failed';
    sqlData: CustomerSqlData;
  }) {
    // SQL Server 데이터를 변수로 변환
    const variables = this.mapSqlDataToVariables(params.sqlData);
    
    // 기존 패키지의 sendAlimtalkByTemplateNumber 활용
    return await sendAlimtalkByTemplateNumber(
      this.getTemplateNumber(params.templateType),
      params.sqlData.phone_number,
      variables
    );
  }
  
  private mapSqlDataToVariables(sqlData: CustomerSqlData): Record<string, string> {
    return {
      고객명: sqlData.contact_name,
      회사명: sqlData.company_name,
      구독상태: sqlData.subscription_status,
      요금제: sqlData.subscription_plan,
      // ... 기타 필드 매핑
    };
  }
}
```

이 시스템 아키텍처 설계를 바탕으로 기존 운영중인 SaaS 플랫폼과 완벽하게 연동되는 메시지 자동화 서비스를 구축할 수 있습니다. 기존 SQL Server의 고객 데이터를 실시간으로 활용하여 구독 상태별 맞춤형 메시지를 자동으로 발송하는 강력한 플랫폼이 될 것입니다. 