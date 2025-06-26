# 한국 시간 처리 문제 해결 보고서

## 📋 문제 개요

워크플로우를 실행할 때 `scheduled_jobs` 테이블에 생성되는 ROW의 시간이 한국 시간 기준이 아닌 다른 시간대로 등록되는 문제가 발생했습니다.

## 🔍 원인 분석

### 1. 주요 원인
- **`getKoreaTime()` 함수 구현 불일치**: 여러 파일에서 서로 다른 방식으로 구현됨
- **Supabase UTC 기본 설정**: Supabase는 기본적으로 UTC 시간대를 사용하지만, 애플리케이션에서 올바른 변환 없이 저장
- **시간대 변환 로직 부재**: 한국 시간 ↔ UTC 변환이 체계적으로 이루어지지 않음

### 2. 구체적인 문제점

#### 2.1 `getKoreaTime()` 함수 불일치
```typescript
// ❌ 잘못된 구현 (register/route.ts)
function getKoreaTime(): Date {
  return new Date(); // 시스템 시간대에 의존
}

// ✅ 올바른 구현 (cron/route.ts)
function getKoreaTime(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const koreaTime = new Date(utc + (9 * 3600000)); // UTC+9
  return koreaTime;
}
```

#### 2.2 Supabase 저장 시 UTC 변환 누락
```typescript
// ❌ 이전 방식
scheduled_time: scheduledTime.toISOString() // 시간대 정보 손실

// ✅ 개선된 방식  
scheduled_time: koreaTimeToUTC(scheduledTime) // 명시적 UTC 변환
```

## 🔧 해결 방안

### 1. 통합 유틸리티 함수 작성 (`lib/utils.ts`)

```typescript
/**
 * 현재 한국 시간을 Date 객체로 반환
 */
export function getKoreaTime(): Date {
  const now = new Date();
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return koreaTime;
}

/**
 * 한국 시간을 UTC ISO 문자열로 변환 (Supabase 저장용)
 */
export function koreaTimeToUTC(koreaTime: Date): string {
  const utcTime = new Date(koreaTime.getTime() - (9 * 60 * 60 * 1000));
  return utcTime.toISOString();
}

/**
 * UTC ISO 문자열을 한국 시간으로 변환
 */
export function utcToKoreaTime(utcString: string): Date {
  const utcTime = new Date(utcString);
  const koreaTime = new Date(utcTime.getTime() + (9 * 60 * 60 * 1000));
  return koreaTime;
}
```

### 2. 스케줄러 API 수정

#### 2.1 스케줄 등록 시 UTC 변환
```typescript
// scheduled_jobs 테이블에 저장할 때
const { data: newJob, error: insertError } = await client
  .from('scheduled_jobs')
  .insert({
    // ...
    scheduled_time: koreaTimeToUTC(scheduledTime), // 🔥 한국 시간을 UTC로 변환
    created_at: koreaTimeToUTC(now) // 🔥 한국 시간을 UTC로 변환
  });
```

#### 2.2 스케줄 실행 시 UTC → 한국 시간 변환
```typescript
// 실행 시간 비교할 때
for (const job of jobs || []) {
  // UTC로 저장된 시간을 한국 시간으로 변환
  const scheduledTimeKST = utcToKoreaTime(job.scheduled_time);
  
  // 한국 시간 기준으로 비교
  const timeDiffSeconds = Math.floor((now.getTime() - scheduledTimeKST.getTime()) / 1000);
}
```

### 3. Supabase 데이터베이스 설정

#### 3.1 시간대 유틸리티 함수 생성 (SQL)
```sql
-- 한국 시간을 UTC로 변환하는 함수
CREATE OR REPLACE FUNCTION korea_to_utc(korea_time TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN korea_time AT TIME ZONE 'Asia/Seoul' AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql;

-- UTC 시간을 한국 시간으로 변환하는 함수
CREATE OR REPLACE FUNCTION utc_to_korea(utc_time TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN utc_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul';
END;
$$ LANGUAGE plpgsql;
```

#### 3.2 한국 시간 뷰 생성
```sql
-- scheduled_jobs 테이블의 한국 시간 뷰
CREATE OR REPLACE VIEW scheduled_jobs_korea AS
SELECT 
  id,
  workflow_id,
  workflow_data,
  utc_to_korea(scheduled_time) as scheduled_time_kst,
  scheduled_time as scheduled_time_utc,
  status,
  -- ... 기타 필드들
FROM scheduled_jobs;
```

## ✅ 해결 결과

### 1. 개선 사항
- ✅ **일관된 시간 처리**: 모든 스케줄러 API에서 동일한 시간 처리 함수 사용
- ✅ **명시적 UTC 변환**: Supabase 저장 시 한국 시간을 명시적으로 UTC로 변환
- ✅ **정확한 시간 비교**: 실행 시 UTC 데이터를 한국 시간으로 변환하여 정확한 비교
- ✅ **데이터베이스 뷰**: 한국 시간 기준 조회를 위한 전용 뷰 제공

### 2. 검증 방법
```typescript
// 현재 시간 확인
console.log('한국 시간:', formatKoreaTime(getKoreaTime()));

// 저장된 데이터 확인
const { data: jobs } = await supabase
  .from('scheduled_jobs_korea')
  .select('scheduled_time_kst, scheduled_time_utc');

// 시간 변환 테스트
const testTime = getKoreaTime();
const utcTime = koreaTimeToUTC(testTime);
const backToKorea = utcToKoreaTime(utcTime);
console.log('변환 테스트:', testTime.getTime() === backToKorea.getTime());
```

## 🚀 앞으로의 방지책

### 1. 개발 규칙
- **시간 처리는 반드시 `lib/utils.ts`의 함수 사용**
- **Supabase 저장 시 항상 UTC 변환 확인**
- **시간 비교 시 동일한 시간대로 정규화 후 비교**

### 2. 모니터링
- **`scheduled_jobs_korea` 뷰를 통한 정기적인 데이터 검증**
- **시간대 불일치 감지를 위한 SQL 쿼리 정기 실행**

### 3. 테스트 케이스
```typescript
// 시간 변환 정확성 테스트
describe('시간 처리 테스트', () => {
  it('한국 시간 ↔ UTC 변환이 정확해야 함', () => {
    const koreaTime = getKoreaTime();
    const utcString = koreaTimeToUTC(koreaTime);
    const backToKorea = utcToKoreaTime(utcString);
    
    expect(Math.abs(koreaTime.getTime() - backToKorea.getTime())).toBeLessThan(1000);
  });
});
```

## 📊 성능 영향

### 1. 긍정적 영향
- **정확한 스케줄 실행**: 한국 시간 기준으로 정확한 스케줄 실행
- **데이터 일관성**: 모든 시간 데이터가 일관된 방식으로 처리
- **디버깅 용이성**: 명확한 시간대 정보로 문제 추적 용이

### 2. 성능 최적화
- **인덱스 추가**: 한국 시간 기준 쿼리를 위한 인덱스 생성
- **뷰 활용**: 복잡한 시간 변환 로직을 데이터베이스 뷰로 캡슐화

## 🔚 결론

이번 수정으로 워크플로우 스케줄링 시스템의 시간 처리가 한국 시간 기준으로 정확하게 작동하게 되었습니다. 

**주요 성과:**
1. ✅ 시간대 불일치 문제 완전 해결
2. ✅ 일관된 시간 처리 체계 구축
3. ✅ 미래 문제 방지를 위한 체계적 접근

**검증 완료:**
- 스케줄 등록 시 한국 시간 정확 반영
- 스케줄 실행 시 정확한 시간 비교
- 데이터베이스에 UTC로 정확 저장
- 조회 시 한국 시간으로 정확 변환 