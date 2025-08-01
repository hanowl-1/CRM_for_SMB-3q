# CRM 시스템 API 명세서

## 🏗️ 시스템 개요

**마케팅 자동화 CRM 시스템**의 백엔드 API 명세서입니다. 이 문서는 실제 구현된 코드를 기반으로 작성되었습니다.

### 기술 스택
- **프레임워크**: Next.js 15 (App Router)
- **데이터베이스**: Supabase (메타데이터), MySQL (비즈니스 데이터)
- **메시징**: CoolSMS API
- **스케줄링**: AWS Lambda + Vercel Cron

---

## 📋 공통 응답 형식

### 표준 성공 응답
```json
{
  "success": true,
  "message": "작업 완료 메시지",
  "data": {},
  "timestamp": "2025-07-29T09:06:32.946Z"
}
```

### 표준 에러 응답
```json
{
  "success": false,
  "message": "에러 메시지",
  "error": "상세 에러 정보"
}
```

---

## 📡 API 엔드포인트

## 1. 🚀 워크플로우 관리

### 1.1 워크플로우 목록 조회
```http
GET /api/supabase/workflows?action=list
```

**응답:**
```json
{
  "success": true,
  "data": [
    {
      "id": "workflow_123",
      "name": "워크플로우명",
      "description": "설명",
      "status": "active",
      "trigger_type": "webhook",
      "created_at": "2025-07-29T00:00:00Z"
    }
  ]
}
```

### 1.2 특정 워크플로우 조회
```http
GET /api/supabase/workflows?action=get&id={workflow_id}
```

### 1.3 워크플로우 생성
```http
POST /api/supabase/workflows
```

**요청 본문 (실제 구현 기준):**
```json
{
  "action": "create",
  "name": "워크플로우명",
  "description": "설명",
  "selectedTemplates": [],
  "targetGroups": [],
  "templatePersonalizations": {},
  "targetTemplateMappings": [],
  "scheduleSettings": {},
  "schedule_config": {},
  "testSettings": {},
  "steps": [],
  "createdBy": "user",
  "trigger_type": "manual",
  "trigger_config": {},
  "status": "draft"
}
```

### 1.4 워크플로우 실행
```http
POST /api/workflow/execute
```

**요청 본문 (실제 인터페이스):**
```json
{
  "workflow": {},
  "workflowId": "workflow_123",
  "scheduledExecution": false,
  "jobId": "job_123",
  "scheduledJobId": "scheduled_123",
  "enableRealSending": false
}
```

### 1.5 워크플로우 미리보기
```http
POST /api/workflow/preview
```

### 1.6 워크플로우 테스트
```http
POST /api/workflow/test
```

---

## 2. 📱 메시징 서비스

### 2.1 SMS 발송
```http
POST /api/sms/send
```

**요청 본문 (실제 인터페이스):**
```json
{
  "to": "010-1234-5678",
  "message": "메시지 내용",
  "from": "발신번호",
  "enableRealSending": false,
  "variables": {
    "변수명": "값"
  }
}
```

**응답:**
```json
{
  "success": true,
  "message": "SMS 발송 완료 (테스트 모드)",
  "messageId": "test_sms_1753779972569",
  "messageType": "SMS",
  "processedMessage": "처리된 메시지",
  "timestamp": "2025-07-29T09:06:12.569Z",
  "testMode": true,
  "actualSending": false,
  "variables": {}
}
```

### 2.2 통합 메시지 발송
```http
POST /api/send-message
```

---

## 3. 🗄️ 데이터베이스 연동

### 3.1 MySQL 쿼리 실행
```http
POST /api/mysql/query
```

**요청 본문:**
```json
{
  "query": "SELECT * FROM table_name LIMIT 10",
  "limit": 1000
}
```

**응답:**
```json
{
  "success": true,
  "message": "쿼리 실행 완료",
  "data": {
    "rows": [],
    "rowCount": 0
  },
  "timestamp": "2025-07-29T08:59:02.669Z"
}
```

**제한사항:**
- SELECT 문만 허용
- 위험한 키워드 차단: `drop`, `delete`, `update`, `insert`, `alter`, `create`, `truncate`
- 최대 50,000 행 제한

### 3.2 MySQL 쿼리 테스트 (GET)
```http
GET /api/mysql/query
```

### 3.3 데이터베이스 스키마 조회
```http
GET /api/mysql/schema
```

### 3.4 데이터베이스 통계
```http
GET /api/mysql/statistics
```

### 3.5 회사 데이터 조회
```http
GET /api/mysql/companies
```

### 3.6 변수 매핑 조회
```http
GET /api/mysql/variables?action=tables
GET /api/mysql/variables?action=variables&table={table_name}
```

### 3.7 테이블 매핑 관리
```http
GET /api/mysql/table-mappings
POST /api/mysql/table-mappings
```

**POST 요청 본문:**
```json
{
  "action": "save|delete|toggle",
  "tableName": "테이블명",
  "mapping": {}
}
```

### 3.8 대상 미리보기
```http
POST /api/mysql/targets/preview
```

---

## 4. 📅 스케줄러 시스템

### 4.1 스케줄러 상태 조회
```http
GET /api/scheduler
```

### 4.2 스케줄러 상태 관리
```http
POST /api/scheduler
```

**요청 본문:**
```json
{
  "action": "cancel_workflow_schedule",
  "workflowId": "workflow_123"
}
```

### 4.3 스케줄러 헬스체크
```http
GET /api/scheduler/health
```

**응답:**
```json
{
  "success": true,
  "data": {
    "health_check": {
      "timestamp": "2025-07-29T09:00:51.423Z",
      "korea_time": "2025-07-29 18:00:51",
      "check_type": "scheduler_health",
      "environment": "development",
      "aws_lambda_enabled": true
    },
    "cron_status": {
      "has_signals": true,
      "last_aws_signal": {},
      "minutes_since_last_signal": 0,
      "is_healthy": true,
      "health_status": "healthy"
    },
    "lambda_status": {
      "is_working": true,
      "last_execution": null,
      "pending_overdue_count": 0,
      "recent_execution_count": 0
    },
    "statistics": {
      "total": 58,
      "pending": 1,
      "running": 0,
      "completed": 0,
      "failed": 13
    }
  },
  "message": "스케줄러가 정상 작동 중입니다."
}
```

### 4.4 크론 신호 관리
```http
GET /api/scheduler/cron-signals
POST /api/scheduler/cron-signals
```

### 4.5 크론 작업
```http
GET /api/scheduler/cron
POST /api/scheduler/cron
```

### 4.6 스케줄 실행
```http
GET /api/scheduler/execute
POST /api/scheduler/execute
```

### 4.7 실행 로그
```http
GET /api/scheduler/execution-logs
POST /api/scheduler/execution-logs
```

### 4.8 강제 정리
```http
POST /api/scheduler/force-cleanup
```

### 4.9 로그 조회
```http
GET /api/scheduler/logs
```

### 4.10 모니터링
```http
GET /api/scheduler/monitor
```

### 4.11 작업 등록
```http
GET /api/scheduler/register
POST /api/scheduler/register
```

**API 목적:**
- 활성화된 워크플로우들의 스케줄을 `scheduled_jobs` 테이블에 등록
- Manual 워크플로우가 `active` 상태로 변경될 때 자동 호출
- 즉시 실행(`immediate`) 타입을 제외한 모든 스케줄 타입 지원

**처리 대상:**
- `status = 'active'`인 모든 워크플로우
- `schedule_config.type`이 `delay`, `scheduled`, `recurring`인 워크플로우
- `immediate` 타입은 **제외** (수동 실행만 지원)

**스케줄 타입별 동작:**
- **`delay`**: 워크플로우 활성화 시점부터 N분 후 실행으로 등록
- **`scheduled`**: 지정된 날짜/시간에 실행으로 등록  
- **`recurring`**: 반복 패턴에 따른 다음 실행 시간으로 등록

**응답:**
```json
{
  "success": true,
  "data": {
    "scheduledCount": 3,
    "scheduledJobs": [
      {
        "workflowName": "신규 회원 환영",
        "scheduledTime": "2024-01-15 09:00:00",
        "jobId": "uuid-123"
      }
    ],
    "processedWorkflows": 5
  },
  "message": "3개의 작업이 스케줄에 등록되었습니다."
}
```

**주의사항:**
- GET/POST 모두 지원하지만 **GET 메서드 권장**
- 기존 활성 작업과의 중복을 자동으로 처리
- 반복 워크플로우는 기존 작업을 취소하고 새로 등록

### 4.12 테스트 스케줄
```http
POST /api/scheduler/test-schedule
```

---

## 5. 🔗 웹훅 시스템

### 5.1 동적 웹훅 처리
```http
POST /api/webhook/{eventType}
```

**지원하는 이벤트 타입:** `lead_created`, `signup`, `purchase`, `cancel`, `payment_failed`

**요청 본문:**
```json
{
  "name": "홍길동",
  "company": "회사명",
  "phone": "010-1234-5678",
  "email": "test@example.com",
  "source": "출처",
  "message": "메시지"
}
```

**응답:**
```json
{
  "success": true,
  "message": "이벤트 처리 완료",
  "triggered_workflows": [],
  "event_data": {}
}
```

---

## 6. 📋 템플릿 관리

### 6.1 CoolSMS 템플릿 목록
```http
GET /api/templates/coolsms/list
```

### 6.2 CoolSMS SDK 목록
```http
GET /api/templates/coolsms/sdk-list
```

### 6.3 CoolSMS 실제 템플릿
```http
GET /api/templates/coolsms/real
```

### 6.4 CoolSMS 테스트
```http
GET /api/templates/coolsms/test
```

### 6.5 CoolSMS 동기화
```http
GET /api/templates/coolsms/sync
```

### 6.6 특정 템플릿 조회
```http
GET /api/templates/coolsms/{templateId}
```

### 6.7 템플릿 상세 정보
```http
GET /api/templates/{templateId}/details
```

### 6.8 템플릿 동기화
```http
GET /api/templates/sync
POST /api/templates/sync
```

### 6.9 템플릿 사용량
```http
GET /api/templates/usage
```

---

## 7. 🗄️ Supabase 데이터 관리

### 7.1 개별 변수 관리
```http
GET /api/supabase/individual-variables
POST /api/supabase/individual-variables
DELETE /api/supabase/individual-variables
```

### 7.2 초기화
```http
GET /api/supabase/init
POST /api/supabase/init
```

### 7.3 메시지 로그
```http
GET /api/supabase/message-logs
POST /api/supabase/message-logs
```

### 7.4 마이그레이션
```http
POST /api/supabase/migrate
```

### 7.5 템플릿 관리
```http
GET /api/supabase/templates
POST /api/supabase/templates
```

**POST 요청 본문:**
```json
{
  "action": "create|update|delete",
  "name": "템플릿명",
  "description": "설명",
  "category": "카테고리",
  "messageType": "타입",
  "templateCode": "코드",
  "subject": "제목",
  "content": "내용",
  "variables": [],
  "status": "draft",
  "createdBy": "user"
}
```

### 7.6 테스트
```http
GET /api/supabase/test
```

### 7.7 변수 매핑 템플릿
```http
GET /api/supabase/variable-mapping-templates
POST /api/supabase/variable-mapping-templates
DELETE /api/supabase/variable-mapping-templates
```

### 7.8 워크플로우 관리 (ID별)
```http
GET /api/supabase/workflows/{id}
PUT /api/supabase/workflows/{id}
DELETE /api/supabase/workflows/{id}
```

---

## 8. 🎯 캠페인 관리

### 8.1 캠페인 조회/생성
```http
GET /api/campaigns
POST /api/campaigns
```

---

## 9. 🔧 시스템 관리

### 9.1 환경 변수 확인
```http
GET /api/test-env
```

### 9.2 데이터베이스 필드 조회
```http
GET /api/db-fields
```

**응답:**
```json
[
  {
    "name": "user_name",
    "label": "고객명",
    "type": "string",
    "table": "users"
  }
]
```

### 9.3 시스템 정리
```http
GET /api/system/cleanup
POST /api/system/cleanup
```

### 9.4 Supabase 테스트
```http
GET /api/test-supabase
```

### 9.5 매핑 테스트
```http
GET /api/test-mapping
```

### 9.6 매핑 테이블 테스트
```http
POST /api/test-mapping-table
```

### 9.7 작업 업데이트 테스트
```http
POST /api/test-update-job
```

---

## 10. 📊 쿼리 및 매핑

### 10.1 쿼리 라이브러리
```http
GET /api/queries/library
```

### 10.2 매핑 템플릿
```http
GET /api/mapping-templates
POST /api/mapping-templates
```

### 10.3 매핑 템플릿 사용
```http
POST /api/mapping-templates/{id}/use
```

---

## 11. 🔄 크론 작업

### 11.1 메인 크론
```http
GET /api/cron
POST /api/cron
```

### 11.2 템플릿 동기화 크론
```http
GET /api/cron/sync-templates
```

---

## 12. 🔐 인증

### 12.1 회원가입
```http
POST /api/auth/signup
```

---

## 13. 📋 워크플로우 (별도)

### 13.1 워크플로우 조회/생성
```http
GET /api/workflows
POST /api/workflows
```

---

## 🚨 HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 |
| 500 | 서버 내부 오류 |

---

## 🔧 환경 변수

```env
# 필수 환경 변수
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
COOLSMS_API_KEY=
COOLSMS_API_SECRET=
MYSQL_HOST=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
```

---

## 📝 참고사항

- 모든 API는 실제 구현된 코드를 기반으로 작성됨
- JSON 형식의 요청/응답 사용
- 표준화된 에러 처리 적용
- 개발 환경에서 테스트 모드 지원

---

*최종 업데이트: 2025-07-29*  
*기준 코드: 실제 구현된 Next.js API Routes* 