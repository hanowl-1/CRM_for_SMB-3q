# 시스템 아키텍처 설계 문서 v2.0 (TDD)
## 카카오톡/문자 메시지 자동화 플랫폼 - 워크플로우 최적화

### 1. 개요

#### 1.1 문서 목적
본 문서는 **기존 운영중인 자영업자 구독 서비스(SaaS)의 보조 서비스**로 구축되는 카카오톡 알림톡 및 문자 메시지 자동화 플랫폼의 시스템 아키텍처를 정의합니다. **3단계 워크플로우 프로세스**에 최적화된 구조로 설계되었습니다.

#### 1.2 워크플로우 기반 시스템 범위
**3단계 최적화 워크플로우**
1. **알림톡 선택**: 템플릿 변수 동적 쿼리 설정
2. **대상 선정**: MySQL 동적 쿼리로 상황별 대상자 추출  
3. **대상-템플릿 매핑**: 개인화 메시지를 위한 변수-컬럼 매핑

**시스템 구성요소**
- **웹 애플리케이션**: Next.js 기반 관리 대시보드 (기존 SaaS 통합)
- **백엔드 API**: Node.js/Express 기반 REST API
- **메시지 발송**: 카카오 알림톡 및 SMS 통합 서비스
- **데이터베이스 통합**: 
  - 기존 MySQL (고객 데이터, 구독 정보) - 읽기 전용
  - Supabase PostgreSQL (메시지 플랫폼 전용) - 읽기/쓰기
- **스케줄러**: 크론잡 기반 워크플로우 실행
- **기존 시스템 연동**: 실시간 데이터 동기화 및 이벤트 처리

### 2. 시스템 아키텍처 개요

#### 2.1 워크플로우 기반 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                 Frontend Layer (워크플로우 UI)               │
├─────────────────────────────────────────────────────────────┤
│  Next.js Web Application (Port: 3000)                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│  │  1단계: 알림톡   │ │  2단계: 대상    │ │ 3단계: 매핑   │ │
│  │  선택 UI        │ │  선정 UI        │ │ 설정 UI       │ │
│  │                │ │                │ │              │ │
│  │ • 템플릿 선택   │ │ • 동적 쿼리     │ │ • 변수-컬럼   │ │
│  │ • 변수 쿼리     │ │ • 대상자 조회   │ │   매핑        │ │
│  │ • 미리보기      │ │ • 미리보기      │ │ • 매핑 템플릿 │ │
│  └─────────────────┘ └─────────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP/HTTPS
                                │
┌─────────────────────────────────────────────────────────────┐
│              API Gateway Layer (워크플로우 처리)             │
├─────────────────────────────────────────────────────────────┤
│  Express.js API Server (Port: 8000)                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│  │ Template API    │ │ Target API      │ │ Mapping API   │ │
│  │ /api/templates  │ │ /api/targets    │ │ /api/mappings │ │
│  │                │ │                │ │              │ │
│  │ • 알림톡 관리   │ │ • 쿼리 실행     │ │ • 매핑 관리   │ │
│  │ • 변수 추출     │ │ • 대상자 조회   │ │ • 템플릿 저장 │ │
│  └─────────────────┘ └─────────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
┌───────────────────────┐ ┌─────────────┐ ┌──────────────────┐
│   Workflow Engine     │ │   Scheduler │ │   Database       │
│   (3단계 처리)        │ │   System    │ │   Integration    │
├───────────────────────┤ ├─────────────┤ ├──────────────────┤
│ • Step 1: Template    │ │ Vercel Cron │ │ ┌──────────────┐ │
│   Selection           │ │ (스케줄러)   │ │ │ MySQL        │ │
│ • Step 2: Target      │ │             │ │ │ (Existing)   │ │
│   Selection           │ │ • DB-based  │ │ │ - Customers  │ │
│ • Step 3: Mapping     │ │   Queue     │ │ │ - Reviews    │ │
│   Configuration       │ │ • Monitor   │ │ │ - Companies  │ │
│ • Execution Engine    │ │ • Logging   │ │ │ (Read-Only)  │ │
│ • Variable Resolver   │ └─────────────┘ │ └──────────────┘ │
└───────────────────────┘                 │ ┌──────────────┐ │
                                          │ │ Supabase     │ │
                                          │ │ PostgreSQL   │ │
                                          │ │ - Workflows  │ │
                                          │ │ - Templates  │ │
                                          │ │ - Mappings   │ │
                                          │ │ - Logs       │ │
                                          │ └──────────────┘ │
                                          └──────────────────┘
                                │
                                │
┌─────────────────────────────────────────────────────────────┐
│              External Services Layer (메시지 발송)          │
├─────────────────────────────────────────────────────────────┤
│  Message Delivery Services                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   COOLSMS API       │    │     Alternative SMS         │ │
│  │   (Primary)         │    │     (Backup)                │ │
│  │                     │    │                             │ │
│  │ • Kakao Alimtalk    │    │ • SENS (Naver)              │ │
│  │ • SMS/LMS           │    │ • 알리고 (Aligo)             │ │
│  │ • Template Sync     │    │ • etc...                    │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 3단계 워크플로우 데이터 플로우

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   1단계: 알림톡  │    │   2단계: 대상    │    │   3단계: 매핑    │
│   선택          │    │   선정          │    │   설정          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ Template Selection    │ Target Query          │ Mapping Config
         │                       │                       │
┌─────────────────┐              │              ┌─────────────────┐
│ kakao_templates │◄─────────────┼──────────────┤ mapping_templates│
│                 │              │              │                 │
│ • template_code │              │              │ • field_mappings│
│ • variables     │              │              │ • reusable      │
│ • variable_     │              │              │ • categories    │
│   queries       │              │              └─────────────────┘
└─────────────────┘              │                       │
         │                       │                       │
         │ Variable Queries      │ Dynamic Queries       │ Mapping Rules
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    workflows 테이블                            │
├─────────────────────────────────────────────────────────────────┤
│ • message_config: 선택된 템플릿 + 변수 쿼리                     │
│ • target_config: 대상 선정 쿼리 + 그룹 정보                    │
│ • mapping_config: 변수-컬럼 매핑 + 템플릿 참조                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Workflow Execution
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    실행 엔진 (Execution Engine)                │
├─────────────────────────────────────────────────────────────────┤
│ 1. MySQL 쿼리 실행 → 대상자 데이터 조회                        │
│ 2. 변수 쿼리 실행 → 개인화 변수값 생성                         │
│ 3. 매핑 규칙 적용 → 템플릿 변수 치환                           │
│ 4. 메시지 생성 → 최종 개인화 메시지                            │
│ 5. CoolSMS 발송 → 실제 메시지 전송                            │
└─────────────────────────────────────────────────────────────────┘
```

### 3. 기술 스택 상세 (워크플로우 최적화)

#### 3.1 Frontend Stack (3단계 UI 최적화)
```typescript
// Next.js 15 + React 19 + TypeScript (워크플로우 UI)
{
  "framework": "Next.js 15",
  "runtime": "React 19",
  "language": "TypeScript",
  "workflow_components": {
    "step1": "알림톡 선택 컴포넌트",
    "step2": "대상 선정 컴포넌트", 
    "step3": "매핑 설정 컴포넌트",
    "preview": "통합 미리보기 컴포넌트"
  },
  "styling": {
    "primary": "Tailwind CSS",
    "components": "Radix UI",
    "workflow_ui": "Multi-step Form + Tab Navigation"
  },
  "forms": "React Hook Form + Zod",
  "state_management": {
    "workflow_state": "React Context",
    "form_state": "React Hook Form",
    "api_state": "SWR"
  }
}
```

#### 3.2 Backend Stack (워크플로우 처리 최적화)
```typescript
// Node.js + Express + TypeScript + Multi-DB Integration
{
  "runtime": "Node.js 18+",
  "framework": "Express.js",
  "language": "TypeScript",
  "workflow_apis": {
    "templates": "/api/templates/* (1단계 API)",
    "targets": "/api/targets/* (2단계 API)",
    "mappings": "/api/mappings/* (3단계 API)",
    "execution": "/api/workflow/execute (통합 실행)"
  },
  "database": {
    "existing": "MySQL (고객/구독 데이터) - 읽기 전용",
    "new": "Supabase PostgreSQL (워크플로우 데이터)",
    "orm": {
      "mysql": "mysql2 + custom query builder",
      "postgresql": "Supabase Client SDK"
    },
    "connection_pooling": "pg-pool, mysql2 pool"
  },
  "scheduler": {
    "engine": "Vercel Cron",
    "storage": "Supabase scheduled_jobs 테이블",
    "monitoring": "DB 기반 실시간 상태 추적"
  },
  "message_delivery": {
    "primary": "CoolSMS API",
    "backup": "SENS, 알리고",
    "queue": "In-memory queue with retry"
  }
}
```

#### 3.3 Database Architecture (워크플로우 중심)
```typescript
// 하이브리드 데이터베이스 아키텍처 (워크플로우 최적화)
{
  "mysql_integration": {
    "purpose": "2단계 대상 선정용 데이터 소스",
    "connection": "Read-only connection",
    "data_usage": [
      "동적 쿼리 실행 (대상자 조회)",
      "변수 쿼리 실행 (개인화 데이터)",
      "실시간 데이터 활용"
    ],
    "query_patterns": [
      "SELECT id, contacts, company_name FROM customers WHERE...",
      "SELECT COUNT(*) FROM reviews WHERE company_id = ?",
      "SELECT AVG(rating) FROM reviews WHERE..."
    ]
  },
  
  "supabase_native": {
    "purpose": "워크플로우 전용 데이터 관리",
    "connection": "Full read/write access",
    "workflow_tables": [
      "workflows (3단계 통합 데이터)",
      "kakao_templates (1단계: 알림톡 템플릿)",
      "target_query_templates (2단계: 대상 쿼리)",
      "mapping_templates (3단계: 매핑 설정)",
      "message_logs (실행 결과 로그)"
    ],
    "optimization": [
      "JSON 필드로 유연한 구조",
      "인덱스 최적화",
      "쿼리 성능 튜닝"
    ]
  }
}
```

### 4. 워크플로우 엔진 설계

#### 4.1 3단계 워크플로우 처리 엔진
```typescript
// 워크플로우 실행 엔진
class WorkflowExecutionEngine {
  // 1단계: 알림톡 템플릿 처리
  async processTemplateStep(workflow: Workflow): Promise<ProcessedTemplate[]> {
    const templates = workflow.message_config.templates;
    const processedTemplates = [];
    
    for (const template of templates) {
      // 템플릿 변수 추출
      const variables = this.extractVariables(template.content);
      
      // 변수별 쿼리 설정 확인
      const variableQueries = template.variable_queries || {};
      
      processedTemplates.push({
        ...template,
        variables,
        variableQueries
      });
    }
    
    return processedTemplates;
  }
  
  // 2단계: 대상 선정 처리
  async processTargetStep(workflow: Workflow): Promise<TargetData[]> {
    const targetGroups = workflow.target_config.targetGroups;
    const allTargets = [];
    
    for (const group of targetGroups) {
      if (group.type === 'dynamic' && group.dynamicQuery) {
        // MySQL 동적 쿼리 실행
        const targets = await this.executeMySQLQuery(group.dynamicQuery.sql);
        allTargets.push(...targets);
      }
    }
    
    return allTargets;
  }
  
  // 3단계: 매핑 설정 처리
  async processMappingStep(
    workflow: Workflow, 
    targets: TargetData[], 
    templates: ProcessedTemplate[]
  ): Promise<MappedMessage[]> {
    const mappings = workflow.mapping_config.targetTemplateMappings;
    const mappedMessages = [];
    
    for (const mapping of mappings) {
      const template = templates.find(t => t.id === mapping.templateId);
      const relevantTargets = targets; // 필터링 로직 추가 가능
      
      for (const target of relevantTargets) {
        // 변수-컬럼 매핑 적용
        const variableValues = await this.resolveVariables(
          mapping.fieldMappings,
          target,
          template.variableQueries
        );
        
        // 최종 메시지 생성
        const finalMessage = this.renderTemplate(template.content, variableValues);
        
        mappedMessages.push({
          target,
          template,
          message: finalMessage,
          variables: variableValues
        });
      }
    }
    
    return mappedMessages;
  }
  
  // 통합 실행
  async executeWorkflow(workflowId: string): Promise<ExecutionResult> {
    const workflow = await this.loadWorkflow(workflowId);
    
    // 1단계: 템플릿 처리
    const templates = await this.processTemplateStep(workflow);
    
    // 2단계: 대상 선정
    const targets = await this.processTargetStep(workflow);
    
    // 3단계: 매핑 및 메시지 생성
    const messages = await this.processMappingStep(workflow, targets, templates);
    
    // 4단계: 메시지 발송
    const results = await this.sendMessages(messages);
    
    // 5단계: 결과 로깅
    await this.logResults(workflowId, results);
    
    return {
      success: true,
      totalMessages: messages.length,
      sentCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length
    };
  }
}
```

#### 4.2 변수 해결 엔진
```typescript
// 변수 해결 및 개인화 엔진
class VariableResolver {
  async resolveVariables(
    fieldMappings: FieldMapping[],
    targetData: TargetData,
    variableQueries: Record<string, VariableQuery>
  ): Promise<Record<string, string>> {
    const resolvedVariables: Record<string, string> = {};
    
    for (const mapping of fieldMappings) {
      const { templateVariable, targetField, formatter } = mapping;
      
      // 1. 대상 데이터에서 직접 값 가져오기
      if (targetData[targetField]) {
        resolvedVariables[templateVariable] = this.formatValue(
          targetData[targetField], 
          formatter
        );
        continue;
      }
      
      // 2. 변수 쿼리 실행
      const variableQuery = variableQueries[templateVariable];
      if (variableQuery && variableQuery.sourceType === 'query') {
        const queryResult = await this.executeMySQLQuery(
          variableQuery.sql,
          [targetData.id] // 파라미터 바인딩
        );
        
        resolvedVariables[templateVariable] = this.formatValue(
          queryResult[0]?.[variableQuery.selectedColumn] || variableQuery.defaultValue,
          formatter
        );
        continue;
      }
      
      // 3. 기본값 사용
      resolvedVariables[templateVariable] = mapping.defaultValue || `[${templateVariable}]`;
    }
    
    return resolvedVariables;
  }
  
  private formatValue(value: any, formatter?: string): string {
    switch (formatter) {
      case 'number':
        return Number(value).toLocaleString();
      case 'currency':
        return `${Number(value).toLocaleString()}원`;
      case 'date':
        return new Date(value).toLocaleDateString('ko-KR');
      default:
        return String(value);
}
  }
}
```

### 5. API 설계 (워크플로우 중심)

#### 5.1 1단계: 알림톡 선택 API
```typescript
// 알림톡 템플릿 관리 API
GET    /api/templates                    // 템플릿 목록 조회
GET    /api/templates/:id                // 템플릿 상세 조회
POST   /api/templates/:id/variables      // 템플릿 변수 추출
PUT    /api/templates/:id/queries        // 변수 쿼리 설정
GET    /api/templates/:id/preview        // 템플릿 미리보기

// 변수 쿼리 관리 API
GET    /api/variable-queries             // 변수 쿼리 템플릿 목록
POST   /api/variable-queries             // 새 쿼리 템플릿 생성
PUT    /api/variable-queries/:id         // 쿼리 템플릿 수정
POST   /api/variable-queries/test        // 쿼리 테스트 실행
```

#### 5.2 2단계: 대상 선정 API
```typescript
// 대상 선정 관리 API
GET    /api/targets/queries              // 대상 쿼리 템플릿 목록
POST   /api/targets/queries              // 새 대상 쿼리 생성
POST   /api/targets/preview              // 대상 쿼리 미리보기
GET    /api/targets/schema               // MySQL 스키마 정보
POST   /api/targets/validate             // 쿼리 유효성 검사

// MySQL 연동 API
GET    /api/mysql/tables                 // 테이블 목록 조회
GET    /api/mysql/columns/:table         // 테이블 컬럼 정보
POST   /api/mysql/query                  // 커스텀 쿼리 실행
POST   /api/mysql/test-connection        // 연결 테스트
```

#### 5.3 3단계: 매핑 설정 API
```typescript
// 매핑 템플릿 관리 API
GET    /api/mappings/templates           // 매핑 템플릿 목록
POST   /api/mappings/templates           // 새 매핑 템플릿 생성
PUT    /api/mappings/templates/:id       // 매핑 템플릿 수정
DELETE /api/mappings/templates/:id       // 매핑 템플릿 삭제
POST   /api/mappings/templates/:id/use   // 매핑 템플릿 사용

// 매핑 검증 API
POST   /api/mappings/validate            // 매핑 설정 검증
POST   /api/mappings/preview             // 매핑 결과 미리보기
GET    /api/mappings/suggestions         // 자동 매핑 제안
```

#### 5.4 통합 워크플로우 API
```typescript
// 워크플로우 관리 API
GET    /api/workflows                    // 워크플로우 목록
POST   /api/workflows                    // 새 워크플로우 생성
GET    /api/workflows/:id                // 워크플로우 상세 조회
PUT    /api/workflows/:id                // 워크플로우 수정
DELETE /api/workflows/:id                // 워크플로우 삭제

// 워크플로우 실행 API
POST   /api/workflows/:id/execute        // 워크플로우 실행
POST   /api/workflows/:id/test           // 워크플로우 테스트
GET    /api/workflows/:id/preview        // 실행 미리보기
GET    /api/workflows/:id/status         // 실행 상태 조회

// 스케줄러 API
GET    /api/scheduler/jobs               // 스케줄된 작업 목록
POST   /api/scheduler/jobs               // 새 스케줄 작업 생성
PUT    /api/scheduler/jobs/:id           // 스케줄 작업 수정
DELETE /api/scheduler/jobs/:id           // 스케줄 작업 삭제
GET    /api/scheduler/monitor            // 스케줄러 모니터링
```

### 6. 성능 최적화 전략

#### 6.1 데이터베이스 최적화
```sql
-- 워크플로우 실행 최적화 인덱스
CREATE INDEX idx_workflows_status_next_run ON workflows(status, next_run_at);
CREATE INDEX idx_mapping_templates_category_usage ON mapping_templates(category, usage_count DESC);
CREATE INDEX idx_message_logs_workflow_created ON message_logs(workflow_id, created_at DESC);

-- 자주 사용되는 쿼리 최적화
CREATE INDEX idx_workflows_active_scheduled ON workflows(status, next_run_at) 
WHERE status = 'active' AND next_run_at IS NOT NULL;
```

#### 6.2 캐싱 전략
```typescript
// 다단계 캐싱 전략
{
  "template_cache": {
    "type": "Memory Cache",
    "ttl": "1 hour",
    "purpose": "자주 사용되는 알림톡 템플릿"
  },
  "mapping_cache": {
    "type": "Memory Cache", 
    "ttl": "30 minutes",
    "purpose": "매핑 템플릿 설정"
  },
  "query_result_cache": {
    "type": "Redis Cache",
    "ttl": "5 minutes", 
    "purpose": "MySQL 쿼리 결과 (대상자 데이터)"
  },
  "schema_cache": {
    "type": "Memory Cache",
    "ttl": "24 hours",
    "purpose": "MySQL 스키마 정보"
  }
}
```

#### 6.3 비동기 처리
```typescript
// 워크플로우 비동기 실행
class AsyncWorkflowProcessor {
  async executeWorkflowAsync(workflowId: string): Promise<string> {
    // 1. 작업 큐에 추가
    const jobId = await this.addToQueue({
      type: 'workflow_execution',
      workflowId,
      priority: 'normal'
    });
    
    // 2. 백그라운드에서 실행
    this.processInBackground(jobId);
    
    return jobId;
}

  private async processInBackground(jobId: string): Promise<void> {
    try {
      // 워크플로우 실행
      const result = await this.workflowEngine.executeWorkflow(workflowId);
      
      // 결과 업데이트
      await this.updateJobStatus(jobId, 'completed', result);
      
    } catch (error) {
      await this.updateJobStatus(jobId, 'failed', { error: error.message });
    }
  }
}
```

### 7. 모니터링 및 로깅

#### 7.1 워크플로우 모니터링
```typescript
// 실시간 모니터링 대시보드
{
  "workflow_metrics": [
    "실행 중인 워크플로우 수",
    "성공/실패 비율",
    "평균 실행 시간",
    "메시지 발송 성과 실행 성과"
  ],
  "step_metrics": [
    "1단계: 템플릿 선택 시간",
    "2단계: 대상 조회 시간", 
    "3단계: 매핑 처리 시간",
    "메시지 발송 시간"
  ],
  "error_tracking": [
    "MySQL 연결 오류",
    "변수 해결 실패",
    "매핑 오류",
    "메시지 발송 실패"
  ]
}
```

#### 7.2 성능 분석
```sql
-- 워크플로우 성능 분석 쿼리
SELECT 
  w.id,
  w.name,
  COUNT(wr.id) as execution_count,
  AVG(wr.execution_time_ms) as avg_execution_time,
  AVG(wr.target_count) as avg_target_count,
  (COUNT(CASE WHEN wr.status = 'completed' THEN 1 END) * 100.0 / COUNT(wr.id)) as success_rate
FROM workflows w
LEFT JOIN workflow_runs wr ON w.id = wr.workflow_id
WHERE w.status = 'active'
  AND wr.started_at >= NOW() - INTERVAL '7 days'
GROUP BY w.id, w.name
ORDER BY execution_count DESC;
```

### 8. 보안 및 권한 관리

#### 8.1 API 보안
```typescript
// 워크플로우 권한 관리
{
  "authentication": "JWT 기반 인증",
  "authorization": {
    "workflow_read": "워크플로우 조회 권한",
    "workflow_write": "워크플로우 생성/수정 권한", 
    "workflow_execute": "워크플로우 실행 권한",
    "template_manage": "템플릿 관리 권한",
    "mapping_manage": "매핑 관리 권한"
  },
  "rate_limiting": {
    "workflow_execution": "사용자당 시간당 100회",
    "query_execution": "사용자당 분당 50회",
    "template_access": "사용자당 분당 200회"
  }
}
```

#### 8.2 데이터 보안
```sql
-- Supabase RLS 정책 (워크플로우)
CREATE POLICY "Users can manage their workflows" ON workflows
  FOR ALL TO authenticated
  USING (created_by = auth.uid()::text);

CREATE POLICY "Users can view public mapping templates" ON mapping_templates
  FOR SELECT TO authenticated
  USING (is_public = true OR created_by = auth.uid()::text);
```

### 9. 배포 및 운영

#### 9.1 배포 전략
```yaml
# Docker Compose (개발/테스트)
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MYSQL_HOST=${MYSQL_HOST}
      - SUPABASE_URL=${SUPABASE_URL}
      - COOLSMS_API_KEY=${COOLSMS_API_KEY}
    depends_on:
      - redis
      
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
      
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

#### 9.2 모니터링 설정
```typescript
// 운영 모니터링
{
  "health_checks": [
    "GET /api/health (전체 시스템)",
    "GET /api/health/mysql (MySQL 연결)",
    "GET /api/health/supabase (Supabase 연결)",
    "GET /api/health/scheduler (스케줄러 상태)"
  ],
  "alerts": [
    "워크플로우 실행 실패율 > 10%",
    "MySQL 연결 실패",
    "메시지 발송 실패율 > 5%",
    "시스템 응답 시간 > 5초"
  ],
  "logging": {
    "level": "info",
    "format": "JSON",
    "targets": ["console", "file", "external_service"]
  }
}
```

### 10. 결론

#### 10.1 아키텍처 장점
1. **워크플로우 중심 설계**: 3단계 프로세스에 최적화된 구조
2. **모듈화**: 각 단계별 독립적인 처리 가능
3. **재사용성**: 매핑 템플릿과 쿼리 템플릿 재사용
4. **확장성**: 새로운 메시지 채널 추가 용이
5. **성능**: 캐싱과 비동기 처리로 최적화
6. **안정성**: 오류 처리와 재시도 메커니즘

#### 10.2 향후 확장 계획
1. **AI 기반 매핑 제안**: 자동 변수-컬럼 매핑 제안
2. **A/B 테스트**: 템플릿 성과 비교 분석
3. **실시간 분석**: 메시지 성과 실시간 대시보드
4. **다채널 확장**: 이메일, 푸시 알림 추가
5. **고급 스케줄링**: 조건부 실행, 복잡한 트리거

이 아키텍처는 현재 3단계 워크플로우에 최적화되어 있으며, 향후 확장성과 유지보수성을 모두 고려한 설계입니다. 