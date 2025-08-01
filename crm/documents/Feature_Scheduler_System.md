# 스케줄러 시스템 기능 명세서
## 메시지 자동화 플랫폼 - DB 기반 스케줄러 시스템

### 1. 기능 개요

#### 1.1 기능명
**DB 기반 영구 스케줄러 시스템 (Database-driven Persistent Scheduler System)**

#### 1.2 기능 목적
워크플로우의 다양한 실행 모드(즉시/지연/예약/반복)를 지원하는 안정적이고 영구적인 백그라운드 작업 스케줄링 엔진 제공

#### 1.3 핵심 가치
- **완전한 자동화**: Vercel Cron과 API를 통해 독립적으로 작업 실행
- **영속성 및 안정성**: Supabase DB에 모든 스케줄을 저장하여 서버 재시작이나 배포에도 작업이 유실되지 않음
- **다양한 실행 모드**: 즉시, 예약, 반복 실행 지원
- **실시간 모니터링**: 홈페이지에서 DB 기반의 스케줄러 상태 실시간 확인

### 2. ✅ 구현 완료된 기능

#### 2.1 ✅ 스케줄러 엔진 (Scheduler Engine)

##### 2.1.1 ✅ Supabase DB 기반 작업 관리
- **✅ 구현된 기능:**
  - `scheduled_jobs` 테이블을 사용한 영구적인 작업 저장 및 관리
  - 작업 상태 추적 (`pending`, `running`, `completed`, `failed`)
  - 고유 작업 ID (UUID) 관리
  - 모든 작업 정보는 DB에 저장되어 영속성 보장

- **✅ `scheduled_jobs` 테이블 구조:**
  ```sql
  CREATE TABLE scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id),
    workflow_data JSONB,
    scheduled_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    retry_count INT DEFAULT 0
  );
  ```

##### 2.1.2 ✅ 다양한 실행 모드 지원
- **✅ 즉시 실행 (Immediate):**
  - 워크플로우 저장 즉시 실행 (테스트 실행)
  - 실시간 결과 반환

- **✅ 예약 실행 (Scheduled):**
  - 특정 날짜/시간 예약
  - **한국시간(KST) 기준 실행**: Asia/Seoul 타임존 적용

- **✅ 반복 실행 (Recurring):**
  - 일간/주간/월간 반복 패턴
  - **한국시간 기준 스케줄링**: 모든 반복 시간은 KST 기준
  - 다음 실행 시간 자동 계산 (한국시간)

#### 2.2 ✅ 스케줄러 서비스 (Scheduler Service)

##### 2.2.1 ✅ 크론잡을 이용한 자동 스케줄링
- **✅ 구현된 기능:**
  - `active` 상태의 워크플로우에 대해 크론잡이 다음 실행 작업을 `scheduled_jobs` 테이블에 자동 등록
  - **스케줄 시간 변경 자동 감지 및 업데이트**
  - 기존 `pending` 작업과 시간 비교 후, 변경된 경우에만 기존 작업 삭제 및 신규 등록

- **✅ 자동 등록 시스템:**
  - Vercel Cron이 주기적으로 `/api/scheduler/cron`을 호출하여 실행
  - 워크플로우의 스케줄 설정이 변경되면, 다음 크론잡 실행 시 자동으로 DB에 반영

##### 2.2.2 ✅ 백그라운드 실행 엔진
- **✅ 구현된 기능:**
  - Vercel Cron이 매분 `/api/scheduler/execute`를 호출하여 실행
  - DB에서 현재 시간에 실행할 작업을 조회
  - 동시 실행 작업 수 제한 (향후 확장)
  - 작업 실행 로그 기록 (`workflow_run_history`)

- **✅ 실행 프로세스:**
  1. 매분 실행기가 `scheduled_jobs` 테이블에서 `status`가 `pending`이고 `scheduled_time`이 현재 시간 이전인 작업을 스캔
  2. 실행 대상 작업을 `running` 상태로 변경
  3. 워크플로우 실행 API (`/api/workflow/execute`) 호출
  4. 실행 결과에 따라 `completed` 또는 `failed`로 상태 업데이트
  5. 반복 작업의 경우, 다음 실행 스케줄은 다음 날 크론잡에 의해 다시 등록됨

#### 2.3 ✅ API 엔드포인트

##### 2.3.1 ✅ 스케줄러 관리 API
- **✅ POST `/api/scheduler/cron`:**
  - 모든 활성 워크플로우를 기반으로 다음 실행 작업을 `scheduled_jobs` 테이블에 등록/업데이트
  - 워크플로우 활성화 시 자동으로 호출되어 즉시 스케줄링

- **✅ GET `/api/scheduler/execute`:**
  - `scheduled_jobs` 테이블을 확인하여 실행 시간이 된 작업을 찾아 실행

- **✅ GET `/api/scheduler/monitor`:**
  - 대시보드 UI에 필요한 스케줄러 현황 데이터를 DB에서 조회하여 제공 (pending, running, completed, failed 등)

#### 2.4 ✅ 홈페이지 모니터링 카드

##### 2.4.1 ✅ 실시간 상태 표시
- **✅ 구현된 기능:**
  - `/api/scheduler/monitor` API를 주기적으로 호출하여 최신 DB 상태 표시
  - 작업 통계 (대기, 실행, 완료, 실패)
  - 지연된 작업 경고 표시
  - 10초마다 자동 상태 갱신

### 3. 기술 구현 상세

#### 3.1 ✅ 스케줄러 아키텍처

##### 3.1.1 ✅ 시스템 구조
```
🏗️ DB 기반 스케줄러 아키텍처
├── Vercel Cron (스케줄 트리거)
│   ├── 매일 00:00 (KST) → 📞 POST /api/scheduler/cron (스케줄 등록/갱신)
│   └── 매분 * * * * * → 📞 GET /api/scheduler/execute (스케줄 실행)
│
├── API Routes
│   ├── /api/scheduler/cron (스케줄 등록기)
│   │   └── 💾 Supabase: `workflows` 읽기 → `scheduled_jobs` 쓰기/수정
│   ├── /api/scheduler/execute (스케줄 실행기)
│   │   └── 💾 Supabase: `scheduled_jobs` 읽기/수정 → 📞 /api/workflow/execute 호출
│   └── /api/scheduler/monitor (모니터링)
│       └── 💾 Supabase: `scheduled_jobs` 읽기
│
└── Supabase (PostgreSQL DB)
    ├── workflows 테이블: 워크플로우 설정 저장
    └── scheduled_jobs 테이블: 모든 스케줄 작업의 상태와 시간 저장 (Source of Truth)
```

##### 3.1.2 ✅ DB 기반 영속성
- **✅ 데이터 무결성:**
  - 모든 스케줄 정보는 `scheduled_jobs` 테이블에 트랜잭션으로 관리
  - 서버가 재시작되거나, 서비스가 중단되어도 스케줄 정보는 DB에 안전하게 보관됨

#### 3.2 ✅ 실행 로직

##### 3.2.1 ✅ 한국시간 기준 처리
- 모든 서버 로직에서 시간 계산 및 비교는 **한국 시간(Asia/Seoul)**을 기준으로 처리하여 사용자 혼란을 방지합니다.

##### 3.2.2 ✅ 스케줄 자동 업데이트 로직 (핵심)
```typescript
// /api/scheduler/cron

// 1. 다음 실행 시간 계산
const scheduledTime = calculateNextRecurringTime(workflow.schedule_config);

// 2. DB에서 기존 pending 작업 조회
const { data: existingJobs } = await client.from('scheduled_jobs')...

// 3. 정확한 시간 비교
let shouldCreateNew = true;
if (existingJobs && existingJobs.length > 0) {
  if (scheduledTime.getTime() === new Date(existingJobs[0].scheduled_time).getTime()) {
    // 3-1. 시간이 같다면? -> 아무것도 안 함 (기존 작업 유지)
    shouldCreateNew = false;
  }
}

// 4. 시간이 다르다면? -> 기존 작업 삭제 후 새로 등록
if (shouldCreateNew) {
  // 4-1. 기존 pending 작업 모두 삭제
  await client.from('scheduled_jobs').delete().eq('workflow_id', ...);

  // 4-2. 새로운 시간으로 작업 등록
  await client.from('scheduled_jobs').insert(...);
}
```

#### 3.3 ✅ 오류 처리 및 복구

##### 3.3.1 ✅ 오류 처리
- **✅ 구현된 기능:**
  - 작업 실행 실패 시 `scheduled_jobs`의 `status`를 `failed`로 업데이트
  - 오류 메시지를 `error_message` 필드에 저장
  - 재시도 로직 (`retry_count`)
  - 실패한 작업은 모니터링 UI에서 확인 가능

##### 3.3.2 ✅ 시스템 복구
- **✅ 구현된 기능:**
  - 모든 상태가 DB에 저장되므로 별도의 복구 로직이 필요 없음
  - 서버가 재시작되어도, 다음 스케줄 실행 시간에 Vercel Cron이 API를 호출하여 중단된 지점부터 자동으로 작업을 이어감

---

> **📝 참고**: 스케줄러 시스템은 2024년 6월에 새롭게 구축된 완전한 백그라운드 작업 관리 시스템입니다. 안정적이고 효율적인 메시지 자동화를 위해 설계되었습니다. 