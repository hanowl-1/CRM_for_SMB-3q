# CoolSMS 알림톡 템플릿 실시간 연동

## 개요
CoolSMS에 등록된 카카오 알림톡 템플릿을 실시간으로 조회하고 자동으로 동기화하는 기능입니다. 기존의 하드코딩된 템플릿 데이터를 CoolSMS API를 통해 최신 상태로 유지합니다.

## 주요 기능

### 1. 실시간 템플릿 조회
- CoolSMS API를 통한 최신 템플릿 목록 조회
- 템플릿 상세 정보 및 변수 자동 추출
- CEO/BLOGGER 채널별 템플릿 분류

### 2. 자동 동기화
- 매일 새벽 3시(KST) 자동 동기화
- Vercel Cron을 통한 스케줄링
- Supabase 데이터베이스 자동 업데이트

### 3. 수동 업데이트
- UI에서 즉시 동기화 버튼
- 커맨드라인 스크립트 실행
- 개발자 도구를 통한 직접 API 호출

## 기술 구현

### API 엔드포인트

#### 1. 템플릿 목록 조회
```typescript
// GET /api/templates/coolsms/real
// CoolSMS API에서 실시간 템플릿 조회
{
  success: true,
  data: [
    {
      templateId: string,
      templateName: string,
      content: string,
      variables: string[],
      channel: 'CEO' | 'BLOGGER',
      // ...
    }
  ],
  source: 'coolsms-api' | 'local-hardcoded'
}
```

#### 2. 템플릿 동기화
```typescript
// GET /api/cron/sync-templates
// 크론 작업용 자동 동기화 엔드포인트
// Authorization: Bearer {CRON_SECRET_TOKEN} 필요
```

### CoolSMS API 인증

#### 서명 생성 방식
```javascript
// HMAC-SHA256 서명 생성
function generateSignature(apiSecret, date, salt) {
  return crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex');
}
```

#### API 호출 예제
```javascript
const response = await fetch('https://api.coolsms.co.kr/kakao/v2/templates', {
  headers: {
    'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
    'Content-Type': 'application/json'
  }
});
```

### 데이터 저장 구조

#### 1. Supabase 테이블 (kakao_templates)
```sql
CREATE TABLE kakao_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT UNIQUE NOT NULL,
  template_code TEXT,
  template_name TEXT NOT NULL,
  content TEXT NOT NULL,
  channel TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  service_platform TEXT,
  template_number INTEGER,
  template_title TEXT,
  variables JSONB DEFAULT '[]',
  status TEXT DEFAULT 'APPROVED',
  inspection_status TEXT DEFAULT 'APPROVED',
  buttons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. 하드코딩 파일 구조
```typescript
// /lib/data/kakao-templates.ts
export const KakaoAlimtalkTemplateById = {
  "KA01TP...": {
    servicePlatform: "MEMBERS",
    channel: "CEO",
    channelId: "KA01PF...",
    templateId: "KA01TP...",
    content: "템플릿 내용...",
    templateName: "122. [슈퍼멤버스] ...",
    templateNumber: 122,
    templateTitle: "...",
    templateParams: ["#{변수1}", "#{변수2}"]
  }
  // ...
};
```

## 업데이트 로직

### 자동 업데이트 플로우
```
1. Vercel Cron 트리거 (매일 03:00 KST)
   ↓
2. /api/cron/sync-templates 호출
   ↓
3. CoolSMS API에서 템플릿 목록 조회
   ↓
4. Supabase DB 업데이트
   - 기존 템플릿 삭제
   - 새 템플릿 일괄 삽입
   ↓
5. 완료 로그 기록
```

### 수동 업데이트 방법

#### 방법 1: 스크립트 실행
```bash
# 하드코딩 파일 업데이트
node scripts/generate-templates-from-api.js
```

#### 방법 2: UI 동기화
1. `/templates/sync` 페이지 접속
2. "CoolSMS 동기화" 버튼 클릭
3. 실시간으로 템플릿 목록 갱신

## UI 컴포넌트

### TemplateSelector 컴포넌트
```typescript
// /components/templates/template-selector.tsx
interface TemplateSelectorProps {
  channel?: 'CEO' | 'BLOGGER'
  onSelect: (template: Template) => void
  selectedTemplateId?: string
}

// 주요 기능:
// - 실시간 템플릿 목록 조회
// - 템플릿 검색 및 필터링
// - 템플릿 미리보기
// - 변수 목록 표시
```

### 사용 예제
```tsx
<TemplateSelector
  channel="CEO"
  onSelect={(template) => {
    console.log('선택된 템플릿:', template);
  }}
/>
```

## 환경 변수 설정

```env
# CoolSMS API 인증
COOLSMS_API_KEY=your_api_key
COOLSMS_API_SECRET=your_api_secret

# 발신 프로필 ID
PFID_CEO=KA01PF201224090944283HjX3BnWfSna
PFID_BLOGGER=KA01PF240827043524198kVF1UDK9zbb

# 크론 작업 보안
CRON_SECRET_TOKEN=your_cron_secret
```

## 주의사항

### 1. API 제한사항
- CoolSMS SDK는 현재 템플릿 목록 조회 API를 공식 지원하지 않음
- 직접 API 호출 시 서명 생성 방식 주의 필요
- Rate Limit 고려 (5초당 700회)

### 2. 데이터 일관성
- 하드코딩 파일과 DB 간 동기화 시점 차이 존재 가능
- 크론 작업 실패 시 수동 동기화 필요
- 템플릿 번호 파싱 로직 정확성 확인 필요

### 3. 보안
- API 키는 환경 변수로만 관리
- 크론 엔드포인트는 Bearer 토큰으로 보호
- 클라이언트에서 직접 CoolSMS API 호출 금지

## 모니터링

### 동기화 상태 확인
```sql
-- 최근 동기화된 템플릿 확인
SELECT 
  template_number,
  template_name,
  channel,
  updated_at
FROM kakao_templates
ORDER BY updated_at DESC
LIMIT 10;

-- 채널별 템플릿 수
SELECT 
  channel,
  COUNT(*) as template_count
FROM kakao_templates
GROUP BY channel;
```

### 로그 확인
- Vercel Functions 로그에서 크론 실행 기록 확인
- 실패 시 에러 메시지 및 스택 트레이스 확인
- 성공 시 동기화된 템플릿 수 확인

## 문제 해결

### 템플릿이 업데이트되지 않을 때
1. CoolSMS API 키 유효성 확인
2. 크론 작업 실행 로그 확인
3. 수동 스크립트 실행으로 에러 확인
4. Supabase RLS 정책 확인

### API 인증 실패 시
1. 환경 변수 설정 확인
2. 서명 생성 로직 검증
3. 시간 동기화 확인 (NTP)
4. API 키 권한 확인

## 향후 개선사항

1. **실시간 웹훅 연동**
   - CoolSMS에서 템플릿 변경 시 즉시 알림
   - 폴링 방식에서 푸시 방식으로 전환

2. **템플릿 버전 관리**
   - 템플릿 변경 이력 추적
   - 이전 버전으로 롤백 기능

3. **캐싱 최적화**
   - Redis를 통한 템플릿 캐싱
   - TTL 기반 자동 갱신

4. **관리자 대시보드**
   - 템플릿 사용 통계
   - 동기화 상태 모니터링
   - 수동 관리 도구