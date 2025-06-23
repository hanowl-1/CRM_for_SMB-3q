# 스케줄러 시스템 기능 PRD
## 메시지 자동화 플랫폼 - 스케줄러 시스템

### 1. 기능 개요

#### 1.1 기능명
**스케줄러 시스템 (Scheduler System)**

#### 1.2 기능 목적
워크플로우의 다양한 실행 모드(즉시/지연/예약/반복)를 지원하는 완전한 백그라운드 작업 스케줄링 엔진 제공

#### 1.3 핵심 가치
- **완전한 자동화**: 백그라운드에서 독립적으로 작업 실행
- **다양한 실행 모드**: 즉시, 지연, 예약, 반복 실행 지원
- **실시간 모니터링**: 홈페이지에서 스케줄러 상태 실시간 확인
- **안정성**: 메모리 기반 작업 관리로 빠른 응답성 보장

### 2. ✅ 구현 완료된 기능

#### 2.1 ✅ 스케줄러 엔진 (Scheduler Engine)

##### 2.1.1 ✅ 인메모리 작업 관리
- **✅ 구현된 기능:**
  - 메모리 기반 작업 큐 시스템
  - 작업 상태 추적 (대기/실행중/완료/실패)
  - 고유 작업 ID 관리
  - 작업 타입별 분류 관리

- **✅ 작업 상태 관리:**
  ```typescript
  interface ScheduledJob {
    id: string;
    workflowId: string;
    workflowName: string;
    type: 'immediate' | 'delayed' | 'scheduled' | 'recurring';
    status: 'pending' | 'running' | 'completed' | 'failed';
    scheduledTime: Date;
    createdAt: Date;
    executedAt?: Date;
    completedAt?: Date;
    error?: string;
  }
  ```

##### 2.1.2 ✅ 다양한 실행 모드 지원
- **✅ 즉시 실행 (Immediate):**
  - 워크플로우 저장 즉시 실행
  - 테스트 모드 지원
  - 실시간 결과 반환

- **✅ 지연 실행 (Delayed):**
  - 분/시간/일 단위 지연 설정
  - 정확한 시간 계산
  - 지연 시간 동안 대기 상태 유지

- **✅ 예약 실행 (Scheduled):**
  - 특정 날짜/시간 예약
  - **한국시간(KST) 기준 실행**: Asia/Seoul 타임존 적용
  - 미래 시점 정확한 실행
  - 서버 시간과 관계없이 한국시간 기준 동작

- **✅ 반복 실행 (Recurring):**
  - 일간/주간/월간 반복 패턴
  - **한국시간 기준 스케줄링**: 모든 반복 시간은 KST 기준
  - 반복 종료 조건 설정
  - 다음 실행 시간 자동 계산 (한국시간)

#### 2.2 ✅ 스케줄러 서비스 (Scheduler Service)

##### 2.2.1 ✅ 작업 등록 및 관리
- **✅ 구현된 기능:**
  - 워크플로우 저장 시 자동 작업 등록
  - 작업 타입별 스케줄링 로직
  - 중복 작업 방지
  - 작업 취소 및 수정

- **✅ 자동 등록 시스템:**
  - 워크플로우 생성/수정 시 자동 등록
  - 스케줄 설정에 따른 작업 타입 자동 결정
  - 기존 작업 자동 업데이트

##### 2.2.2 ✅ 백그라운드 실행 엔진
- **✅ 구현된 기능:**
  - 매분마다 작업 확인 및 실행
  - 동시 실행 작업 수 제한
  - 실행 실패 시 재시도 로직
  - 작업 실행 로그 기록

- **✅ 실행 프로세스:**
  1. 매분 실행 대상 작업 스캔
  2. 실행 조건 확인 (시간, 상태 등)
  3. 워크플로우 실행 엔진 호출
  4. 실행 결과 기록 및 상태 업데이트
  5. 반복 작업의 경우 다음 실행 시간 설정

#### 2.3 ✅ API 엔드포인트

##### 2.3.1 ✅ 스케줄러 상태 API
- **✅ GET `/api/scheduler`:**
  - 스케줄러 전체 상태 조회
  - 작업 통계 정보 제공
  - 다음 실행 예정 작업 정보

- **✅ 응답 데이터 구조:**
  ```typescript
  interface SchedulerStatus {
    isRunning: boolean;
    totalJobs: number;
    pendingJobs: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
    nextJob?: {
      id: string;
      workflowName: string;
      scheduledTime: string;
      type: string;
    };
  }
  ```

##### 2.3.2 ✅ 작업 관리 API (향후 확장 예정)
- 🔄 개별 작업 조회/수정/삭제
- 🔄 작업 실행 이력 조회
- 🔄 작업 강제 실행/중단

#### 2.4 ✅ 홈페이지 모니터링 카드

##### 2.4.1 ✅ 실시간 상태 표시
- **✅ 구현된 기능:**
  - 스케줄러 실행 상태 (실행 중/중지됨)
  - 작업 통계 (총 작업, 대기, 실행, 완료)
  - 다음 실행 예정 작업 정보
  - 30초마다 자동 상태 갱신

- **✅ UI/UX 특징:**
  - 직관적인 상태 아이콘 (Clock, CheckCircle, AlertCircle)
  - 색상 코딩 (성공: 초록, 경고: 노랑, 오류: 빨강)
  - 반응형 카드 레이아웃
  - 실시간 업데이트 애니메이션

##### 2.4.2 ✅ 상태 정보 상세
- **✅ 표시 정보:**
  - **실행 상태**: "실행 중" / "중지됨"
  - **총 작업 수**: 전체 등록된 작업 수
  - **대기 중**: 실행 대기 상태 작업 수
  - **실행 중**: 현재 실행 중인 작업 수
  - **완료**: 성공적으로 완료된 작업 수
  - **다음 실행**: 가장 빨리 실행될 작업 정보

### 3. 기술 구현 상세

#### 3.1 ✅ 스케줄러 아키텍처

##### 3.1.1 ✅ 시스템 구조
```
📊 스케줄러 시스템 아키텍처
├── SchedulerService (싱글톤)
│   ├── jobs: Map<string, ScheduledJob>
│   ├── addJob(job): 작업 등록
│   ├── removeJob(id): 작업 제거
│   ├── executeJobs(): 작업 실행
│   └── getStatus(): 상태 조회
├── WorkflowExecutionEngine
│   ├── executeWorkflow(id): 워크플로우 실행
│   └── 실행 결과 반환
└── API Routes
    ├── /api/scheduler (GET)
    └── /api/workflow/execute (POST)
```

##### 3.1.2 ✅ 메모리 관리
- **✅ 효율적인 메모리 사용:**
  - Map 기반 작업 저장으로 빠른 조회
  - 완료된 작업 자동 정리 (24시간 후)
  - 메모리 누수 방지 로직

#### 3.2 ✅ 실행 로직

##### 3.2.1 ✅ 한국시간 기준 처리
```typescript
// 한국시간 유틸리티 함수
const getKoreaTime = (): Date => {
  const now = new Date();
  // UTC 시간에 9시간을 더해서 한국시간으로 변환
  return new Date(now.getTime() + (9 * 60 * 60 * 1000));
};

const parseKoreaTimeString = (timeString: string): Date => {
  // ISO 문자열을 한국시간으로 파싱
  const date = new Date(timeString);
  return date;
};
```

##### 3.2.2 ✅ 작업 스케줄링
```typescript
// 작업 등록 로직 (한국시간 기준)
const scheduleWorkflow = (workflow: Workflow) => {
  const job: ScheduledJob = {
    id: generateJobId(),
    workflowId: workflow.id,
    workflowName: workflow.name,
    type: determineJobType(workflow.scheduleSettings),
    status: 'pending',
    scheduledTime: calculateScheduledTime(workflow.scheduleSettings), // 한국시간 기준
    createdAt: getKoreaTime() // 한국시간으로 생성 시간 기록
  };
  
  schedulerService.addJob(job);
};
```

##### 3.2.3 ✅ 실행 확인 로직
```typescript
// 매분 실행되는 작업 확인 (한국시간 기준)
const checkAndExecuteJobs = () => {
  const now = getKoreaTime(); // 한국시간 기준 현재 시간
  const pendingJobs = schedulerService.getPendingJobs();
  
  pendingJobs.forEach(job => {
    if (job.scheduledTime <= now) { // 한국시간 기준 비교
      executeJob(job);
    }
  });
};
```

#### 3.3 ✅ 오류 처리 및 복구

##### 3.3.1 ✅ 오류 처리
- **✅ 구현된 기능:**
  - 작업 실행 실패 시 상태 업데이트
  - 오류 메시지 저장 및 로깅
  - 재시도 로직 (최대 3회)
  - 실패한 작업 알림

##### 3.3.2 ✅ 시스템 복구
- **✅ 구현된 기능:**
  - 서버 재시작 시 작업 상태 복구
  - 메모리 기반이므로 빠른 초기화
  - 실행 중이던 작업 재스케줄링

### 4. ✅ 최신 구현 기능 (2025.06.23 업데이트)

#### 4.1 ✅ 영구 스케줄러 시스템 (Persistent Scheduler)

##### 4.1.1 ✅ Supabase 기반 작업 저장
- **✅ 구현된 기능:**
  - scheduled_jobs 테이블을 통한 영구 작업 저장
  - 서버 재시작에도 작업 유지
  - 데이터베이스 기반 상태 관리
  - 작업 이력 및 로그 영구 보존

- **✅ 테이블 구조:**
  ```sql
  CREATE TABLE scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    workflow_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3
  );
  ```

##### 4.1.2 ✅ 고급 재시도 로직
- **✅ 지수 백오프 (Exponential Backoff):**
  - 첫 번째 재시도: 5분 후
  - 두 번째 재시도: 10분 후
  - 세 번째 재시도: 20분 후
  - 최대 재시도: 30분 간격

- **✅ 재시도 관리:**
  ```typescript
  const retryDelay = Math.min(5 * Math.pow(2, job.retry_count), 30);
  const retryTime = new Date(Date.now() + retryDelay * 60 * 1000);
  ```

##### 4.1.3 ✅ 상세 로그 시스템
- **✅ 실행 과정 추적:**
  - 작업 시작/종료 시간 기록
  - API 호출 상세 로그
  - 오류 메시지 및 스택 트레이스
  - 실행 시간 측정 (밀리초 단위)

- **✅ 로그 예시:**
  ```
  [JOB:18f75d27] 🚀 워크플로우 실행 시작: 테스트_스케줄러
  [JOB:18f75d27] 📡 API 호출 시작: http://localhost:3000/api/workflow/test
  [JOB:18f75d27] 📊 API 응답 받음: 200 OK (1,234ms)
  [JOB:18f75d27] ✅ 워크플로우 실행 완료 (1,234ms)
  ```

#### 4.2 ✅ 클라우드 배포 지원 (Vercel Cron Jobs)

##### 4.2.1 ✅ Vercel Cron Jobs 통합
- **✅ 구현된 기능:**
  - vercel.json 설정으로 자동 스케줄링
  - 매일 자정: 하루 스케줄 생성
  - 매분: 대기 중인 작업 실행
  - 로컬 의존성 완전 제거

- **✅ 설정 파일:**
  ```json
  {
    "crons": [
      {
        "path": "/api/scheduler/cron",
        "schedule": "0 0 * * *"
      },
      {
        "path": "/api/scheduler/execute", 
        "schedule": "* * * * *"
      }
    ]
  }
  ```

##### 4.2.2 ✅ 서버리스 최적화
- **✅ 배치 처리:**
  - 환경변수로 조정 가능한 배치 크기 (기본: 50개)
  - 메모리 효율적인 작업 처리
  - Cold Start 최소화

- **✅ 무상태 실행:**
  - 각 실행이 독립적으로 동작
  - 데이터베이스 상태만 참조
  - 서버 재시작에 영향받지 않음

#### 4.3 ✅ 모니터링 및 관리 API

##### 4.3.1 ✅ 실시간 모니터링 API
- **✅ `/api/scheduler/monitor`:**
  - `?action=status`: 전체 상태 및 최근 로그
  - `?action=upcoming`: 다가오는 작업들 (24시간)
  - `?action=failed`: 실패한 작업들
  - `?action=health`: 시스템 건강 상태

- **✅ 상태 응답 예시:**
  ```json
  {
    "success": true,
    "data": {
      "scheduler": {
        "isRunning": false,
        "totalJobs": 5,
        "pendingJobs": 2,
        "nextJob": {
          "scheduledTime": "2025-06-23T11:22:00+09:00",
          "workflow": { "name": "테스트_스케줄러" }
        }
      },
      "recentLogs": [...],
      "todayStats": {
        "total": 10,
        "completed": 8,
        "failed": 1,
        "pending": 1
      }
    }
  }
  ```

##### 4.3.2 ✅ 로그 조회 API
- **✅ `/api/scheduler/logs`:**
  - 필터링: 상태별, 워크플로우별
  - 페이지네이션 지원
  - 통계 정보 포함
  - 지연된 작업 식별

##### 4.3.3 ✅ 즉시 실행 API
- **✅ `/api/scheduler/execute`:**
  - 수동 트리거 지원
  - 인증 키 기반 보안
  - 배치 실행 결과 반환

#### 4.4 ✅ 한국시간 완전 지원

##### 4.4.1 ✅ 시간 처리 개선
- **✅ 문제 해결:**
  - 이전: timeZone 변환으로 인한 시간 오류
  - 현재: DB의 한국시간 데이터 직접 사용
  - 결과: 정확한 한국시간 표시

- **✅ 수정된 코드:**
  ```typescript
  // 이전 (문제 있던 코드)
  new Date(time).toLocaleString('ko-KR', { 
    timeZone: 'Asia/Seoul' 
  })

  // 현재 (수정된 코드)
  new Date(time).toLocaleString('ko-KR')
  ```

##### 4.4.2 ✅ 스케줄 계산 정확성
- **✅ 다음 실행 시간 계산:**
  - 현재 한국시간 기준 정확한 계산
  - 당일/익일 구분 로직 개선
  - 시간 검증 및 로그 추가

#### 4.5 ✅ 테스트 및 디버깅 도구

##### 4.5.1 ✅ 테스트 스케줄 API
- **✅ `/api/scheduler/test-schedule`:**
  - 빠른 시간 변경으로 테스트 지원
  - 워크플로우 스케줄 설정 업데이트
  - 기존 작업 취소 및 새 작업 생성

##### 4.5.2 ✅ 디버깅 명령어
- **✅ 모니터링 명령어 세트:**
  ```bash
  # 전체 상태 확인
  curl -s 'http://localhost:3000/api/scheduler/monitor?action=status' | jq .
  
  # 다가오는 작업들
  curl -s 'http://localhost:3000/api/scheduler/monitor?action=upcoming' | jq .
  
  # 실패한 작업들
  curl -s 'http://localhost:3000/api/scheduler/monitor?action=failed' | jq .
  
  # 즉시 실행 (테스트용)
  curl -s 'http://localhost:3000/api/scheduler/execute?key=secret' | jq .
  ```

### 5. 🚀 배포 및 운영

#### 5.1 ✅ 배포 프로세스

##### 5.1.1 ✅ Vercel 배포
- **✅ 자동 배포:**
  1. GitHub 푸시 시 자동 배포
  2. 환경변수 자동 적용
  3. Cron Jobs 자동 활성화
  4. 24/7 자동 운영 시작

##### 5.1.2 ✅ 환경변수 설정
```bash
CRON_SECRET=your-secure-secret-key-2024
COOLSMS_API_KEY=your-coolsms-key
COOLSMS_API_SECRET=your-coolsms-secret
KAKAO_SENDER_KEY=your-kakao-sender-key
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
```

#### 5.2 ✅ 운영 모니터링

##### 5.2.1 ✅ 건강 상태 체크
- **✅ 자동 건강 상태 판단:**
  - `healthy`: 정상 동작
  - `warning`: 지연된 작업 1-5개
  - `critical`: 지연된 작업 5개 이상

##### 5.2.2 ✅ 데이터 정리
- **✅ 자동 정리 함수:**
  ```sql
  -- 30일 이상 된 완료/실패 작업 정리
  SELECT cleanup_old_scheduled_jobs(30);
  ```

### 6. 📈 성능 및 확장성

#### 6.1 ✅ 성능 최적화

##### 6.1.1 ✅ 데이터베이스 인덱스
```sql
-- 성능 최적화 인덱스
CREATE INDEX idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX idx_scheduled_jobs_scheduled_time ON scheduled_jobs(scheduled_time);
CREATE INDEX idx_scheduled_jobs_status_time ON scheduled_jobs(status, scheduled_time);
```

##### 6.1.2 ✅ 쿼리 최적화
- 복합 인덱스로 WHERE 절 최적화
- LIMIT을 통한 배치 크기 제어
- 불필요한 데이터 조회 최소화

#### 6.2 ✅ 확장성 고려사항

##### 6.2.1 ✅ 수평 확장
- 여러 Vercel 인스턴스에서 동시 실행 가능
- 데이터베이스 기반 상태 동기화
- 중복 실행 방지 로직

##### 6.2.2 ✅ 제한사항 및 대응
- **Vercel Hobby 제한**: 10초 실행 시간 제한
- **대응 방안**: 배치 크기 조정, 타임아웃 처리

### 7. 🔒 보안 및 안정성

#### 7.1 ✅ 보안 기능

##### 7.1.1 ✅ API 인증
- CRON_SECRET 환경변수 기반 인증
- Bearer 토큰 또는 URL 파라미터 지원
- 무단 접근 차단

##### 7.1.2 ✅ 데이터 보안
- Supabase RLS (Row Level Security) 적용
- 민감한 데이터 암호화
- 로그에서 개인정보 제외

#### 7.2 ✅ 안정성 보장

##### 7.2.1 ✅ 오류 처리
- 상세한 오류 로그 기록
- 자동 재시도 메커니즘
- 실패 시 알림 시스템

##### 7.2.2 ✅ 복구 메커니즘
- 서버 재시작 후 자동 복구
- 누락된 작업 자동 감지
- 수동 복구 도구 제공

---

> **📝 참고**: 스케줄러 시스템은 2024년 6월에 새롭게 구축된 완전한 백그라운드 작업 관리 시스템입니다. 안정적이고 효율적인 메시지 자동화를 위해 설계되었습니다. 