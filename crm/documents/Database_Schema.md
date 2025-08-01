# 데이터베이스 스키마 문서 v2.0
## 메시지 자동화 플랫폼 - 최적화된 데이터베이스 스키마

### 1. 개요

#### 1.1 아키텍처
**하이브리드 데이터베이스 구조** - 기존 운영 DB 보존 + 신규 기능 확장

- **MySQL (기존 운영 DB)**: 고객 데이터, 구독 정보 (읽기 전용)
- **Supabase PostgreSQL**: 메시지 플랫폼 전용 데이터 (읽기/쓰기)

#### 1.2 워크플로우 기반 설계 원칙
**3단계 워크플로우 최적화**
1. **알림톡 선택**: 템플릿 변수 동적 쿼리 설정
2. **대상 선정**: MySQL 동적 쿼리로 상황별 대상자 추출  
3. **대상-템플릿 매핑**: 개인화 메시지를 위한 변수-컬럼 매핑

#### 1.3 설계 원칙
- **워크플로우 중심**: 3단계 프로세스에 최적화된 구조
- **안전한 분리**: 운영 DB와 플랫폼 DB 완전 분리
- **실시간 연동**: MySQL 데이터 실시간 조회 및 활용
- **매핑 효율성**: 변수-컬럼 매핑 정보의 재사용성 극대화
- **확장성**: 플랫폼 기능 확장에 유연한 구조
- **보안**: RLS(Row Level Security) 적용

### 2. ✅ Supabase 스키마 (플랫폼 전용)

#### 2.1 ✅ 워크플로우 관리 (핵심 테이블)

##### 2.1.1 ✅ workflows 테이블 (개선됨)
```sql
CREATE TABLE workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft' 
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  
  -- 트리거 설정
  trigger_type VARCHAR(100) NOT NULL 
    CHECK (trigger_type IN ('manual', 'schedule', 'event', 'webhook')),
  trigger_config JSONB DEFAULT '{}',
  
  -- 🔥 핵심: 3단계 워크플로우 데이터
  target_config JSONB DEFAULT '{}',    -- 대상 선정 (MySQL 쿼리 + 정적 그룹)
  message_config JSONB DEFAULT '{}',   -- 알림톡 템플릿 선택 정보
  mapping_config JSONB DEFAULT '{}',   -- 대상-템플릿 매핑 정보 (NEW)
  
  -- 실행 설정
  schedule_config JSONB DEFAULT '{}',  -- 스케줄 설정
  variables JSONB DEFAULT '{}',        -- 템플릿 변수 설정 (레거시 호환)
  
  -- 메타데이터
  statistics JSONB DEFAULT '{}',       -- 실행 통계
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**주요 개선사항:**
- `mapping_config`: 대상-템플릿 매핑 정보를 별도 필드로 분리
- `target_config`: 동적 쿼리 그룹과 정적 그룹을 통합 관리
- `message_config`: 선택된 알림톡 템플릿과 변수 쿼리 설정

**필드별 JSON 구조:**
```typescript
// target_config 구조
{
  "targetGroups": [
    {
      "id": "group_1",
      "name": "명덕가는 테스트",
      "type": "dynamic",
      "dynamicQuery": {
        "sql": "SELECT id, contacts, company_name FROM customers WHERE ...",
        "description": "특정 조건의 고객 조회"
      }
    }
  ]
}

// message_config 구조  
{
  "templates": [
    {
      "id": "template_1",
      "templateCode": "TK_001",
      "templateName": "성과 리포트",
      "variables": {
        "total_reviews": {
          "sourceType": "query",
          "sql": "SELECT COUNT(*) FROM reviews WHERE company_id = ?",
          "defaultValue": "0"
        }
      }
    }
  ]
}

// mapping_config 구조 (NEW)
{
  "targetTemplateMappings": [
    {
      "id": "mapping_1", 
      "targetGroupId": "group_1",
      "templateId": "template_1",
      "fieldMappings": [
        {
          "templateVariable": "company_name",
          "targetField": "company_name", 
          "formatter": "text"
        },
        {
          "templateVariable": "total_reviews",
          "targetField": "review_count",
          "formatter": "number"
        }
      ]
    }
  ]
}
```

##### 2.1.2 ✅ workflow_runs 테이블
```sql
CREATE TABLE workflow_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL 
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  trigger_type VARCHAR(100),
  target_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  error_message TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  logs JSONB DEFAULT '[]'
);
```

#### 2.2 ✅ 알림톡 템플릿 관리 (1단계: 알림톡 선택)

##### 2.2.1 ✅ kakao_templates 테이블 (개선됨)
```sql
CREATE TABLE kakao_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_code VARCHAR(100) NOT NULL UNIQUE, -- CoolSMS 템플릿 코드
  template_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) 
    CHECK (category IN ('welcome', 'reminder', 'promotion', 
                       'notification', 'alert', 'survey', 'thanks', 'performance')),
  
  -- 템플릿 내용
  template_content TEXT NOT NULL,
  template_extra TEXT,
  template_ad TEXT,
  
  -- 🔥 변수 정보 (동적 쿼리 포함)
  variables JSONB DEFAULT '[]',        -- 추출된 변수 목록
  variable_queries JSONB DEFAULT '{}', -- 각 변수별 동적 쿼리 설정
  
  -- 버튼 설정
  buttons JSONB DEFAULT '[]',
  
  -- 메타데이터
  status VARCHAR(50) DEFAULT 'active' 
    CHECK (status IN ('draft', 'active', 'archived')),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**variable_queries JSON 구조:**
```typescript
{
  "total_reviews": {
    "sourceType": "query",
    "sql": "SELECT COUNT(*) FROM reviews WHERE company_id = ?",
    "description": "총 리뷰 수 조회",
    "defaultValue": "0",
    "formatter": "number"
  },
  "company_name": {
    "sourceType": "field",
    "field": "company_name", 
    "description": "회사명",
    "defaultValue": "회사명",
    "formatter": "text"
  }
}
```

#### 2.3 ✅ 대상 선정 관리 (2단계: 대상 선정)

##### 2.3.1 ✅ target_query_templates 테이블 (NEW)
```sql
CREATE TABLE target_query_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  
  -- 🔥 MySQL 동적 쿼리
  query_sql TEXT NOT NULL,
  query_description TEXT,
  expected_columns JSONB DEFAULT '[]', -- 예상 결과 컬럼 정보
  
  -- 메타데이터
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT false,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**expected_columns JSON 구조:**
```typescript
{
  "columns": [
    {
      "name": "id",
      "type": "number",
      "description": "고객 ID"
    },
    {
      "name": "contacts", 
      "type": "string",
      "description": "연락처"
    },
    {
      "name": "company_name",
      "type": "string", 
      "description": "회사명"
    }
  ]
}
```

#### 2.4 ✅ 대상-템플릿 매핑 관리 (3단계: 매핑)

##### 2.4.1 ✅ mapping_templates 테이블 (핵심 개선)
```sql
CREATE TABLE mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  
  -- 🔥 핵심: 재사용 가능한 매핑 정보
  target_template_mappings JSONB NOT NULL DEFAULT '[]',
  
  -- 사용 패턴 분석
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- 공유 설정
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  
  -- 메타데이터
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**target_template_mappings JSON 구조:**
```typescript
[
  {
    "id": "mapping_1",
    "targetGroupId": "group_1", 
    "templateId": "template_1",
    "fieldMappings": [
      {
        "templateVariable": "company_name",
        "targetField": "company_name",
        "formatter": "text",
        "defaultValue": "회사명"
      },
      {
        "templateVariable": "total_reviews", 
        "targetField": "review_count",
        "formatter": "number",
        "defaultValue": "0"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

##### 2.4.2 ✅ variable_mapping_templates 테이블 (개별 변수 매핑)
```sql
CREATE TABLE variable_mapping_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  
  -- 🔥 개별 변수 매핑 정보
  variable_mappings JSONB NOT NULL DEFAULT '[]',
  
  -- 메타데이터
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2.5 ✅ 실행 및 로그 관리

##### 2.5.1 ✅ message_logs 테이블
```sql
CREATE TABLE message_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  template_id UUID,  -- kakao_templates 참조 (FK 제약 없음)
  
  -- 수신자 정보
  recipient_phone VARCHAR(20),
  recipient_name VARCHAR(255),
  recipient_data JSONB DEFAULT '{}', -- 대상자 원본 데이터
  
  -- 메시지 정보
  message_type VARCHAR(50) NOT NULL 
    CHECK (message_type IN ('sms', 'lms', 'kakao')),
  message_content TEXT,
  variables_used JSONB DEFAULT '{}',  -- 실제 사용된 변수값
  
  -- 발송 상태
  status VARCHAR(50) NOT NULL 
    CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
  provider VARCHAR(50),           -- CoolSMS
  provider_message_id VARCHAR(255),
  cost DECIMAL(8,2) DEFAULT 0,
  
  -- 타임스탬프
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_code VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

##### 2.5.2 ✅ scheduled_jobs 테이블 (스케줄러)
```sql
CREATE TABLE scheduled_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  job_name VARCHAR(255) NOT NULL,
  job_type VARCHAR(50) NOT NULL 
    CHECK (job_type IN ('immediate', 'delay', 'scheduled', 'recurring')),
  
  -- 스케줄 설정
  schedule_config JSONB NOT NULL,
  
  -- 실행 상태
  status VARCHAR(50) DEFAULT 'pending' 
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  
  -- 실행 시간
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- 결과
  execution_result JSONB DEFAULT '{}',
  error_message TEXT,
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. 📊 효율성 분석 및 개선사항

#### 3.1 ✅ 현재 구조의 강점
1. **워크플로우 중심 설계**: 3단계 프로세스에 최적화
2. **매핑 재사용성**: `mapping_templates`로 설정 재사용 가능
3. **동적 쿼리 지원**: MySQL 실시간 데이터 활용
4. **확장성**: JSON 필드로 유연한 데이터 구조

#### 3.2 🔥 주요 개선사항

##### 3.2.1 workflows 테이블 구조 개선
**AS-IS (문제점):**
```sql
-- 모든 설정이 하나의 JSON 필드에 혼재
target_config JSONB DEFAULT '{}',    -- 대상 + 매핑 + 기타 모든 정보
```

**TO-BE (개선됨):**
```sql
-- 단계별로 명확히 분리
target_config JSONB DEFAULT '{}',    -- 2단계: 대상 선정만
message_config JSONB DEFAULT '{}',   -- 1단계: 알림톡 선택만  
mapping_config JSONB DEFAULT '{}',   -- 3단계: 매핑 정보만
```

##### 3.2.2 매핑 정보 정규화
**AS-IS (문제점):**
- 매핑 정보가 워크플로우에만 저장되어 재사용 불가
- 동일한 매핑 설정을 반복해서 입력해야 함

**TO-BE (개선됨):**
- `mapping_templates` 테이블로 매핑 설정 재사용
- 워크플로우에서는 매핑 템플릿 ID만 참조
- 매핑 히스토리 및 사용 패턴 분석 가능

##### 3.2.3 변수 쿼리 관리 개선
**AS-IS (문제점):**
- 알림톡 템플릿과 변수 쿼리가 분리되어 관리 복잡

**TO-BE (개선됨):**
- `kakao_templates.variable_queries`에 변수별 쿼리 통합
- 템플릿 선택 시 변수 쿼리도 함께 설정 가능

#### 3.3 📈 성능 최적화

##### 3.3.1 인덱스 전략
```sql
-- workflows 테이블
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_next_run_at ON workflows(next_run_at) WHERE status = 'active';
CREATE INDEX idx_workflows_created_at ON workflows(created_at DESC);

-- mapping_templates 테이블  
CREATE INDEX idx_mapping_templates_category ON mapping_templates(category);
CREATE INDEX idx_mapping_templates_usage_count ON mapping_templates(usage_count DESC);
CREATE INDEX idx_mapping_templates_is_public ON mapping_templates(is_public);

-- message_logs 테이블
CREATE INDEX idx_message_logs_workflow_id ON message_logs(workflow_id);
CREATE INDEX idx_message_logs_status ON message_logs(status);
CREATE INDEX idx_message_logs_created_at ON message_logs(created_at DESC);
CREATE INDEX idx_message_logs_recipient_phone ON message_logs(recipient_phone);
```

##### 3.3.2 쿼리 최적화
```sql
-- 워크플로우 실행 시 필요한 모든 정보를 한 번에 조회
SELECT 
  w.id,
  w.name,
  w.target_config,
  w.message_config, 
  w.mapping_config,
  w.schedule_config,
  kt.template_content,
  kt.variable_queries
FROM workflows w
LEFT JOIN kakao_templates kt ON (w.message_config->>'templateId')::text = kt.id::text
WHERE w.status = 'active' 
  AND w.next_run_at <= NOW();
```

### 4. 🚀 마이그레이션 가이드

#### 4.1 기존 데이터 마이그레이션
```sql
-- 1. workflows 테이블 컬럼 추가
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS mapping_config JSONB DEFAULT '{}';

-- 2. 기존 target_config에서 매핑 정보 분리
UPDATE workflows 
SET mapping_config = target_config->'targetTemplateMappings',
    target_config = target_config - 'targetTemplateMappings'
WHERE target_config ? 'targetTemplateMappings';

-- 3. mapping_templates 테이블 생성 (이미 생성됨)
-- 4. 기존 매핑 정보를 mapping_templates로 이관
```

#### 4.2 API 업데이트 가이드
```typescript
// 워크플로우 저장 시 구조 변경
const workflowData = {
  // 기존 방식
  target_config: {
    targetGroups: [...],
    targetTemplateMappings: [...] // ❌ 제거
  },
  
  // 새로운 방식  
  target_config: {
    targetGroups: [...] // ✅ 대상 선정만
  },
  mapping_config: {
    targetTemplateMappings: [...] // ✅ 매핑 정보 분리
  }
};
```

### 5. 📋 결론

#### 5.1 개선 효과
1. **명확한 구조**: 3단계 워크플로우에 맞는 데이터 구조
2. **재사용성 향상**: 매핑 템플릿으로 설정 재사용 가능
3. **성능 최적화**: 적절한 인덱스와 쿼리 최적화
4. **확장성**: 새로운 기능 추가 시 유연한 대응

#### 5.2 다음 단계
1. **테이블 마이그레이션**: `mapping_config` 컬럼 추가
2. **API 업데이트**: 새로운 구조에 맞는 API 수정
3. **UI 개선**: 매핑 템플릿 재사용 기능 추가
4. **모니터링**: 성능 및 사용 패턴 분석

이 구조는 현재 워크플로우(알림톡 선택 → 대상 선정 → 매핑)에 최적화되어 있으며, 향후 확장성도 고려한 설계입니다. 