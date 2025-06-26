# 로컬 스케줄러 테스트 가이드

## 📋 개요

개발 환경에서 스케줄러 시스템을 테스트하고 디버깅하는 방법을 설명합니다.

## 🔧 환경 설정

### 1. 환경 변수 확인 (`.env.local` 또는 `dev.env`)

```bash
# 개발 환경 설정
NODE_ENV=development

# 스케줄러 인증 토큰
CRON_SECRET_TOKEN=c7f3c323144444ca876786803871097a

# Vercel 프로젝트 URL (프로덕션용)
VERCEL_PROJECT_URL=v0-kakao-beryl.vercel.app

# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### 2. 환경별 URL 우선순위

스케줄러는 다음 순서로 베이스 URL을 결정합니다:

1. **개발 환경** (`NODE_ENV=development`): `http://localhost:3000`
2. **프로덕션 환경**: 
   - `VERCEL_PROJECT_URL` 환경 변수
   - `VERCEL_URL` 환경 변수 (Vercel 자동 설정)
   - 요청 헤더의 호스트 정보
   - 기본값: `http://localhost:3000`

## 🧪 로컬 테스트 방법

### 1. 개발 서버 시작

```bash
npm run dev
# 또는
yarn dev
```

### 2. 스케줄러 API 수동 테스트

#### 2.1 스케줄 등록 테스트
```bash
curl -X GET "http://localhost:3000/api/scheduler/register"
```

#### 2.2 스케줄 실행 테스트
```bash
curl -X GET "http://localhost:3000/api/scheduler/execute" \
  -H "x-scheduler-internal: true"
```

#### 2.3 크론 스케줄러 테스트
```bash
# GET 방식 (직접 실행)
curl -X GET "http://localhost:3000/api/scheduler/cron"

# POST 방식 (Vercel Cron 시뮬레이션)
curl -X POST "http://localhost:3000/api/scheduler/cron"
```

### 3. 테스트 스케줄 생성

```bash
curl -X POST "http://localhost:3000/api/scheduler/test-schedule" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowName": "로컬 테스트",
    "scheduledTime": "'$(date -v+1M +%Y-%m-%dT%H:%M:%S)'"
  }'
```

## 🔍 디버깅 방법

### 1. 콘솔 로그 확인

개발 서버 실행 시 콘솔에서 다음 로그를 확인할 수 있습니다:

```
🔄 === 크론 스케줄러 실행 ===
현재 한국 시간: 2025-01-10 14:30:00
환경: development
베이스 URL: http://localhost:3000
```

### 2. API 응답에서 디버깅 정보 확인

```json
{
  "success": true,
  "data": {
    "executedCount": 1,
    "results": [...],
    "debugInfo": [...],
    "environment": "development",
    "baseUrl": "http://localhost:3000"
  }
}
```

### 3. 데이터베이스 직접 확인

```sql
-- Supabase SQL Editor에서 실행
SELECT * FROM scheduled_jobs_korea 
WHERE status = 'pending'
ORDER BY scheduled_time_kst DESC;
```

## 🚨 일반적인 문제 해결

### 1. "권한이 없습니다" 오류

**증상**: `401 Unauthorized` 응답
**원인**: 인증 헤더 누락
**해결**: 요청에 인증 헤더 추가

```bash
curl -X GET "http://localhost:3000/api/scheduler/execute" \
  -H "x-scheduler-internal: true" \
  -H "x-cron-secret: c7f3c323144444ca876786803871097a"
```

### 2. "스케줄러 실행 API 호출 실패" 오류

**증상**: 크론 스케줄러에서 execute API 호출 실패
**원인**: 베이스 URL 설정 오류
**해결**: 환경 변수 확인 및 로그에서 사용된 URL 확인

```javascript
// 로그에서 확인할 내용
🌐 사용할 베이스 URL: http://localhost:3000
📡 워크플로우 실행 API 호출: http://localhost:3000/api/scheduler/execute
```

### 3. 시간대 관련 문제

**증상**: 스케줄된 시간과 실행 시간 불일치
**원인**: 시간대 변환 오류
**해결**: 디버그 정보에서 시간 확인

```json
{
  "debugInfo": [
    {
      "id": "job-id",
      "scheduled_time_utc": "2025-01-10T05:30:00.000Z",
      "scheduled_time_kst": "2025-01-10 14:30:00",
      "timeDiffSeconds": -60,
      "isTimeToExecute": false
    }
  ]
}
```

## 📊 모니터링 및 로그

### 1. 스케줄러 상태 모니터링

```bash
curl -X GET "http://localhost:3000/api/scheduler/monitor"
```

### 2. 로그 레벨별 확인

- **🔄**: 스케줄러 시작
- **📋**: 데이터 조회 결과
- **✅**: 성공 작업
- **❌**: 실패 작업
- **⚠️**: 경고 메시지

### 3. 실시간 로그 모니터링

개발 서버 터미널에서 실시간으로 스케줄러 동작을 확인할 수 있습니다:

```
🕐 === 스케줄 실행기 시작 ===
현재 한국 시간: 2025-01-10 14:30:00
환경: development
베이스 URL: http://localhost:3000
📋 대기 중인 작업 수: 2개
작업 abc123: 예정시간=2025-01-10 14:30:00, 현재시간=2025-01-10 14:30:00, 차이=0초, 실행가능=true, 상태=pending
✅ 실행 대상: 테스트 워크플로우 (abc123)
🎯 실행할 작업 수: 1개
```

## 🔄 개발 워크플로우

### 1. 스케줄 생성 → 실행 테스트

```bash
# 1. 테스트 스케줄 생성 (1분 후)
curl -X POST "http://localhost:3000/api/scheduler/test-schedule" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowName": "개발 테스트",
    "scheduledTime": "'$(date -v+1M +%Y-%m-%dT%H:%M:%S)'"
  }'

# 2. 1분 후 수동 실행
curl -X GET "http://localhost:3000/api/scheduler/execute" \
  -H "x-scheduler-internal: true"
```

### 2. 자동 스케줄러 시뮬레이션

```bash
# 크론 스케줄러 POST 방식으로 전체 플로우 테스트
curl -X POST "http://localhost:3000/api/scheduler/cron"
```

## ✅ 테스트 체크리스트

- [ ] 개발 서버가 localhost:3000에서 실행 중
- [ ] 환경 변수 `NODE_ENV=development` 설정
- [ ] Supabase 연결 정상
- [ ] 스케줄 등록 API 정상 작동
- [ ] 스케줄 실행 API 정상 작동
- [ ] 크론 스케줄러 API 정상 작동
- [ ] 시간대 변환 정상 작동
- [ ] 로그에서 올바른 베이스 URL 확인

## 🚀 배포 전 검증

로컬 테스트가 완료되면 다음을 확인하세요:

1. **환경 변수**: 프로덕션 환경 변수 설정 확인
2. **URL 설정**: `VERCEL_PROJECT_URL` 정확성 확인
3. **인증 토큰**: `CRON_SECRET_TOKEN` 동일성 확인
4. **시간대**: 한국 시간 기준 스케줄 정상 작동 확인 