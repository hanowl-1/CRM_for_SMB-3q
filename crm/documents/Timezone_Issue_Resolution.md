# 시간대 처리 원칙 및 구현 가이드

## 🌏 **핵심 원칙: "저장은 KST, 스마트 해석"**

한국 서비스에서 **"시간대 혼란(Timezone Hell)"**을 방지하기 위한 하이브리드 접근 방법입니다. 기존 데이터와의 호환성을 유지하면서 새로운 데이터는 한국시간으로 저장하는 방식입니다.

### ✅ **시간대 처리 원칙**

| 항목 | 원칙 | 설명 |
|------|------|------|
| 💾 **DB 저장** | 한국시간 문자열로 저장 | 새로운 스케줄은 "2025-07-01 11:45:00" 형식으로 저장 |
| 🔄 **기존 데이터** | 스마트 해석으로 호환성 유지 | UTC/KST 자동 감지하여 올바른 시간으로 해석 |
| 🖥 **사용자 입력/표시** | 항상 KST로 처리 | 사용자가 보는 모든 시간은 한국 시간 |
| ⏰ **스케줄 실행** | 한국시간 기준 계산 | 한국 시간으로 계산하여 정확한 실행 |
| 🛠 **시간 비교** | 동일 해석 방식 적용 | 모든 API에서 같은 스마트 해석 로직 사용 |

### 🧠 **스마트 시간 해석 로직**

```typescript
// 🔥 타임존이 포함된 ISO 문자열인지 확인
if (storedTimeString.includes('+09:00') || storedTimeString.includes('+0900')) {
  // 한국 타임존 포함: 한국 시간 값으로 Date 객체 생성
  scheduledTimeKST = parseKoreaTimeFromISO(storedTimeString);
} else if (storedTimeString.includes('Z')) {
  // UTC 타임존 포함: UTC로 해석하고 한국시간으로 변환
  scheduledTimeKST = utcToKoreaTime(new Date(storedTimeString));
} else {
  // 타임존 없음: 생성 시간 기준 자동 감지
  const isRecentData = (now.getTime() - createdAt.getTime()) < (24 * 60 * 60 * 1000);
  
  if (isRecentData) {
    // 새 데이터: 한국시간으로 저장됨
    scheduledTimeKST = new Date(storedTimeString);
  } else {
    // 기존 데이터: UTC/KST 중 더 합리적인 해석 선택
    const utcInterpretation = utcToKoreaTime(new Date(storedTimeString));
    const directInterpretation = new Date(storedTimeString);
    
    // 현재 시간과의 차이를 비교하여 더 합리적인 해석 선택
    scheduledTimeKST = selectBetterInterpretation(utcInterpretation, directInterpretation);
  }
}
```

### 🗄️ **테이블 설계 가이드**

```sql
-- ✅ 현재 구현된 구조
CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY,
  workflow_id UUID NOT NULL,
  
  -- 🔥 한국시간 문자열로 저장 ("2025-07-01 11:45:00" 형식)
  scheduled_time TEXT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending',
  workflow_data JSONB NOT NULL,
  
  -- 🔥 모든 시간 필드를 한국시간 문자열로 통일
  created_at TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')),
  executed_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);
```

### 🔄 **데이터 플로우**

#### 1. **사용자 입력 → DB 저장**
```typescript
// 사용자가 "오전 11시 45분"으로 입력
const userInput = "11:45"; // KST

// 1. 한국 시간으로 Date 객체 생성
const koreaTime = calculateNextKoreaScheduleTime(userInput, 'daily');

// 2. 한국시간 문자열로 DB 저장
await supabase.from('scheduled_jobs').insert({
  scheduled_time: formatKoreaTime(koreaTime, 'yyyy-MM-dd HH:mm:ss') // "2025-07-01 11:45:00"
});
```

#### 2. **DB 조회 → 사용자 표시**
```typescript
// DB에서 시간 조회
const { data } = await supabase.from('scheduled_jobs').select('*');

// 스마트 해석으로 한국시간 Date 객체로 변환
const scheduledTimeKST = smartTimeInterpretation(data.scheduled_time, data.created_at);

// 사용자에게 표시
const displayTime = formatKoreaTime(scheduledTimeKST); // "2025-07-01 11:45:00"
```

#### 3. **스케줄 실행 체크**
```typescript
// 현재 한국 시간
const nowKST = getKoreaTime();

// DB 시간을 스마트 해석으로 한국시간으로 변환
const scheduledKST = smartTimeInterpretation(job.scheduled_time, job.created_at);

// 한국 시간 기준으로 비교
const shouldExecute = nowKST >= scheduledKST;
```

## 🚫 **하지 말아야 할 실수들**

### ❌ **잘못된 방법들**
```typescript
// ❌ 스마트 해석 없이 직접 Date 생성
const scheduledTime = new Date(job.scheduled_time); // 기존 데이터 오해석 위험

// ❌ 하드코딩된 시간대 변환
const koreaTime = new Date(job.scheduled_time + '+09:00'); // 이미 한국시간인 경우 문제

// ❌ 일관성 없는 저장 방식
await supabase.insert({ 
  scheduled_time: now.toISOString() // UTC로 저장하면 혼란
});
```

### ✅ **올바른 방법들**
```typescript
// ✅ 스마트 해석 사용
const scheduledTimeKST = smartTimeInterpretation(job.scheduled_time, job.created_at);

// ✅ 한국시간 문자열로 일관성 있게 저장
await supabase.insert({ 
  scheduled_time: formatKoreaTime(koreaTime, 'yyyy-MM-dd HH:mm:ss')
});

// ✅ 모든 API에서 동일한 해석 로직 사용
const scheduledTimeKST = parseTimeWithSmartLogic(job.scheduled_time, job.created_at, now);
```

## 🛠️ **구현 가이드**

### 1. **필수 Import**
```typescript
import {
  getKoreaTime,           // 현재 한국 시간
  formatKoreaTime,        // 한국 시간 포맷팅
  utcToKoreaTime,         // UTC → KST (기존 데이터용)
  calculateNextKoreaScheduleTime, // 스케줄 계산
  debugTimeInfo           // 디버깅용
} from '@/lib/utils/timezone';
```

### 2. **새 스케줄 저장 시**
```typescript
// 🔥 원칙: 한국시간 문자열로 저장
const scheduledTime = calculateNextKoreaScheduleTime(timeString, frequency);
const now = getKoreaTime();

const record = {
  scheduled_time: formatKoreaTime(scheduledTime, 'yyyy-MM-dd HH:mm:ss'),
  created_at: formatKoreaTime(now, 'yyyy-MM-dd HH:mm:ss'),
  updated_at: formatKoreaTime(now, 'yyyy-MM-dd HH:mm:ss')
};
```

### 3. **시간 해석 및 비교**
```typescript
// 🔥 원칙: 스마트 해석 로직 사용
const scheduledTimeKST = smartTimeInterpretation(job.scheduled_time, job.created_at, now);
const nowKST = getKoreaTime();

const timeDiff = nowKST.getTime() - scheduledTimeKST.getTime();
const shouldExecute = timeDiff >= 0;
```

### 4. **사용자 표시**
```typescript
// 🔥 원칙: 해석된 한국시간을 포맷하여 표시
const scheduledTimeKST = smartTimeInterpretation(dbRecord.scheduled_time, dbRecord.created_at, now);
const displayTime = formatKoreaTime(scheduledTimeKST);

console.log(`실행 예정: ${displayTime}`); // "2025-07-01 11:45:00"
```

## 📝 **코드 주석 가이드**

### **표준 주석 템플릿**
```typescript
/**
 * 🕐 시간대 처리 원칙 (하이브리드 방식):
 * - 저장: 한국시간 문자열로 저장 (새 데이터)
 * - 해석: 스마트 로직으로 UTC/KST 자동 감지 (기존 데이터 호환)
 * - 입력: 사용자는 KST로 입력
 * - 출력: 사용자에게는 KST로 표시
 * - 연산: 모든 시간을 한국시간으로 해석하여 비교
 */
```

### **함수별 주석 예시**
```typescript
// 🔥 시간대 처리: 한국시간 기준으로 계산하여 문자열로 저장
const scheduledTime = calculateNextKoreaScheduleTime(time, frequency);
const timeString = formatKoreaTime(scheduledTime, 'yyyy-MM-dd HH:mm:ss');

// 🔥 시간대 처리: 스마트 해석으로 한국시간 Date 객체 생성
const scheduledTimeKST = smartTimeInterpretation(job.scheduled_time, job.created_at, now);
const shouldExecute = nowKST >= scheduledTimeKST;
```

## 🧪 **테스트 가이드**

### **시간대 테스트 체크리스트**
- [ ] 한국 시간 11:45 입력 → "2025-07-01 11:45:00" 저장 확인
- [ ] "2025-07-01 11:45:00" 조회 → 한국 시간 11:45로 해석 확인  
- [ ] 기존 UTC 데이터 → 올바른 한국시간으로 해석 확인
- [ ] 스케줄 실행: 한국 시간 11:45에 정확히 실행 확인
- [ ] 모든 API에서 동일한 시간 표시 확인

### **디버깅 도구**
```typescript
// 시간대 정보 상세 출력
debugTimeInfo('스케줄 등록 시간', scheduledTime);
// 출력:
// 🕐 스케줄 등록 시간:
//    한국 시간: 2025-07-01 11:45:00
//    UTC 시간: 2025-07-01T02:45:00.000Z
//    KST ISO: 2025-07-01T11:45:00.000+09:00
//    저장 형식: "2025-07-01 11:45:00"

// 스마트 해석 결과 확인
console.log(`⚡ 스마트 해석: ${storedTimeString} → ${formatKoreaTime(interpretedTime)}`);
```

## 🚀 **마이그레이션 가이드**

### **기존 시스템에서 전환 순서**
1. **스마트 해석 로직 구현**: 모든 API에 동일한 해석 로직 적용
2. **새 저장 방식 적용**: 신규 스케줄은 한국시간 문자열로 저장
3. **기존 데이터 호환성 확인**: 기존 데이터가 올바르게 해석되는지 확인
4. **점진적 마이그레이션**: 필요시 기존 데이터를 한국시간 형식으로 변환

### **우선순위**
1. **🔥 High**: 스케줄러 실행 API (정확한 실행 시간)
2. **🔥 High**: 스케줄 등록 API (일관된 저장 방식)
3. **⚠️ Medium**: 모니터링 API (올바른 시간 표시)
4. **💡 Low**: 기존 데이터 마이그레이션

---

## 📊 **현재 구현 상태**

### ✅ **완료된 기능**
- [x] 시간대 유틸리티 함수 (`lib/utils/timezone.ts`)
- [x] 스케줄러 등록 시 한국시간 문자열 저장
- [x] 스마트 시간 해석 로직 (모든 API 적용)
- [x] 한국 시간 기준 스케줄 계산
- [x] AWS Lambda와 Vercel 서버 일관성 확보

### 🔄 **개선된 부분**
- [x] ✨ 하이브리드 시간 저장 방식 (신규: KST, 기존: 호환)
- [x] ✨ 타임존 포함 문자열 처리 (+09:00, Z 등)
- [x] ✨ 24시간 기준 자동 데이터 구분
- [x] ✨ 모든 API에서 동일한 해석 로직

### 🎯 **달성된 목표**
✅ **"하나를 고치면 다른 것이 문제되는" 시소 현상 해결**  
✅ **AWS Lambda와 Vercel 서버 간 시간 해석 일관성**  
✅ **기존 데이터와 신규 데이터 모두 올바른 작동**  
✅ **사용자 입력 시간과 실제 실행 시간 정확한 일치**

모든 시간 관련 코드가 **"저장은 KST, 스마트 해석"** 원칙을 따르도록 통일하여, 서버 환경이나 배포 지역에 관계없이 **한국 시간 기준으로 정확하게 작동**하는 시스템을 구축했습니다. 