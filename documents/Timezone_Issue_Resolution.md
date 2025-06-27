# 시간대 처리 원칙 및 구현 가이드

## 🌏 **핵심 원칙: "저장은 UTC, 입력/출력은 KST"**

한국 서비스이지만 서버/스케줄러 환경이 UTC(미국 시간)로 돌아가는 경우, **"시간대 혼란(Timezone Hell)"**을 방지하기 위한 체계적인 접근 방법입니다.

### ✅ **시간대 처리 원칙**

| 항목 | 원칙 | 설명 |
|------|------|------|
| 💾 **DB 저장** | 항상 UTC로 저장 | Supabase, MySQL 등 모든 DB에 UTC 시간으로 저장 |
| 🖥 **사용자 입력/표시** | 항상 KST(+9)로 변환 | 사용자가 보는 모든 시간은 한국 시간 |
| ⏰ **스케줄 트리거** | UTC 기준 설정, KST 계산 | 한국 시간으로 계산 후 UTC로 변환하여 저장 |
| 🛠 **시스템 연산** | UTC 기준 수행 | 비교, 조건문 등 내부 처리는 UTC 기준 |

### 🗄️ **테이블 설계 가이드**

```sql
-- ✅ 권장 컬럼 구조
CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY,
  workflow_id UUID NOT NULL,
  
  -- UTC 기준 실제 실행 시각 (스케줄러가 참고)
  scheduled_time TIMESTAMPTZ NOT NULL,
  
  -- KST 기준 사용자 입력값 (참고용, UX용) - 선택사항
  scheduled_time_display TEXT, -- "2025-06-27 21:00 KST"
  
  -- 시간대 정보 (기본값 고정 가능)
  timezone TEXT DEFAULT 'Asia/Seoul',
  
  -- 기타 UTC 시간 필드들
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

### 🔄 **데이터 플로우**

#### 1. **사용자 입력 → DB 저장**
```typescript
// 사용자가 "저녁 9시"로 입력
const userInput = "21:00"; // KST

// 1. 한국 시간으로 Date 객체 생성
const koreaTime = createKoreaDateTime(userInput);

// 2. UTC로 변환하여 DB 저장
const utcTime = koreaTimeToUTCString(koreaTime);
await supabase.from('scheduled_jobs').insert({
  scheduled_time: utcTime // "2025-06-27T12:00:00.000Z"
});
```

#### 2. **DB 조회 → 사용자 표시**
```typescript
// DB에서 UTC 시간 조회
const { data } = await supabase.from('scheduled_jobs').select('*');

// UTC → KST 변환하여 표시
const displayTime = formatKoreaTime(
  utcToKoreaTime(new Date(data.scheduled_time))
); // "2025-06-27 21:00:00"
```

#### 3. **스케줄 실행 체크**
```typescript
// 현재 시간 (한국 시간 기준)
const nowKST = getKoreaTime();

// DB 저장된 UTC 시간을 한국 시간으로 변환
const scheduledKST = utcToKoreaTime(new Date(job.scheduled_time));

// 한국 시간 기준으로 비교
const shouldExecute = nowKST >= scheduledKST;
```

## 🚫 **하지 말아야 할 실수들**

### ❌ **잘못된 방법들**
```typescript
// ❌ DB에 KST 그대로 저장하고 UTC 서버에서 직접 비교
const koreaTime = new Date(); // 서버 시간에 따라 달라짐
await supabase.insert({ scheduled_time: koreaTime.toISOString() });

// ❌ 시간대 없이 new Date() 사용
const now = new Date(); // 서버/브라우저 시간대에 의존

// ❌ 문자열 시간 직접 비교
if (job.scheduled_time > "2025-06-27T21:00:00") // 위험!
```

### ✅ **올바른 방법들**
```typescript
// ✅ 한국 시간 기준으로 계산 후 UTC 저장
const koreaTime = getKoreaTime();
const utcTime = koreaTimeToUTCString(koreaTime);
await supabase.insert({ scheduled_time: utcTime });

// ✅ 시간대 인식 비교
const nowKST = getKoreaTime();
const scheduledKST = utcToKoreaTime(new Date(job.scheduled_time));
const shouldExecute = nowKST >= scheduledKST;

// ✅ Date 객체 기반 비교
if (new Date(job.scheduled_time) <= new Date()) // 안전함
```

## 🛠️ **구현 가이드**

### 1. **필수 Import**
```typescript
import {
  getKoreaTime,           // 현재 한국 시간
  koreaTimeToUTCString,   // KST → UTC 문자열 (DB 저장용)
  utcToKoreaTime,         // UTC → KST (표시용)
  formatKoreaTime,        // 한국 시간 포맷팅
  debugTimeInfo           // 디버깅용
} from '@/lib/utils/timezone';
```

### 2. **DB 저장 시**
```typescript
// 🔥 원칙: 모든 시간은 UTC로 저장
const now = getKoreaTime(); // 한국 시간 기준
const record = {
  created_at: koreaTimeToUTCString(now),    // UTC 저장
  updated_at: koreaTimeToUTCString(now),    // UTC 저장
  scheduled_time: koreaTimeToUTCString(scheduledTime) // UTC 저장
};
```

### 3. **시간 비교 시**
```typescript
// 🔥 원칙: 같은 시간대끼리 비교
const nowKST = getKoreaTime();
const scheduledKST = utcToKoreaTime(new Date(job.scheduled_time));

const timeDiff = nowKST.getTime() - scheduledKST.getTime();
const shouldExecute = timeDiff >= 0;
```

### 4. **사용자 표시 시**
```typescript
// 🔥 원칙: 항상 한국 시간으로 표시
const displayTime = formatKoreaTime(
  utcToKoreaTime(new Date(dbRecord.scheduled_time))
);
console.log(`실행 예정: ${displayTime}`); // "2025-06-27 21:00:00"
```

## 📝 **코드 주석 가이드**

### **표준 주석 템플릿**
```typescript
/**
 * 🕐 시간대 처리 원칙:
 * - 저장: UTC로 DB 저장 (서버 환경 독립적)
 * - 입력: 사용자는 KST로 입력
 * - 출력: 사용자에게는 KST로 표시
 * - 연산: 내부 비교는 같은 시간대끼리
 */
```

### **함수별 주석 예시**
```typescript
// 🔥 시간대 처리: 한국 시간 기준으로 계산 후 UTC 저장
const scheduledTime = calculateNextKoreaScheduleTime(time, frequency);
const utcTime = koreaTimeToUTCString(scheduledTime);

// 🔥 시간대 처리: DB의 UTC 시간을 한국 시간으로 변환하여 비교
const scheduledKST = utcToKoreaTime(new Date(job.scheduled_time));
const shouldExecute = nowKST >= scheduledKST;
```

## 🧪 **테스트 가이드**

### **시간대 테스트 체크리스트**
- [ ] 한국 시간 21:00 입력 → UTC 12:00으로 저장 확인
- [ ] UTC 12:00 조회 → 한국 시간 21:00으로 표시 확인  
- [ ] 스케줄 실행: 한국 시간 21:00에 정확히 실행 확인
- [ ] 서버 시간대 변경해도 동일하게 작동 확인

### **디버깅 도구**
```typescript
// 시간대 정보 상세 출력
debugTimeInfo('스케줄 등록 시간', scheduledTime);
// 출력:
// 🕐 스케줄 등록 시간:
//    한국 시간: 2025-06-27 21:00:00
//    UTC 시간: 2025-06-27T12:00:00.000Z
//    KST ISO: 2025-06-27T21:00:00.000+09:00
//    UTC ISO: 2025-06-27T12:00:00.000Z
```

## 🚀 **마이그레이션 가이드**

### **기존 코드 수정 순서**
1. **`new Date()` 찾기**: `grep -r "new Date()" --include="*.ts"`
2. **시간대 함수로 교체**: `getKoreaTime()` 또는 적절한 함수 사용
3. **DB 저장 코드 수정**: `koreaTimeToUTCString()` 사용
4. **표시 코드 수정**: `formatKoreaTime(utcToKoreaTime())` 사용
5. **테스트**: 실제 스케줄 실행 확인

### **우선순위**
1. **🔥 High**: 스케줄러 관련 코드 (실행 시간 정확성)
2. **🔥 High**: 워크플로우 실행 시간 기록
3. **⚠️ Medium**: 일반적인 생성/수정 시간
4. **💡 Low**: 로그 및 디버그 시간

---

## 📊 **현재 구현 상태**

### ✅ **완료된 기능**
- [x] 시간대 유틸리티 함수 (`lib/utils/timezone.ts`)
- [x] 스케줄러 등록 시 KST → UTC 변환
- [x] 스케줄러 실행 시 UTC → KST 변환
- [x] 한국 시간 기준 다음 실행 시간 계산

### 🔄 **개선 필요**
- [ ] 일관된 시간대 처리 (여러 API에서 `new Date()` 직접 사용)
- [ ] 표준 주석 추가
- [ ] 테이블 컬럼 명시적 구분 (UTC vs KST)
- [ ] 프론트엔드 시간 표시 일관성

### 🎯 **최종 목표**
모든 시간 관련 코드가 **"저장은 UTC, 입력/출력은 KST"** 원칙을 따르도록 통일하여, 서버 환경이나 배포 지역에 관계없이 **한국 시간 기준으로 정확하게 작동**하는 시스템 구축. 