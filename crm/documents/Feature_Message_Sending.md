# 메시지 발송 기능 PRD
## 메시지 자동화 플랫폼 - 메시지 발송

### 1. 기능 개요

#### 1.1 기능명
**통합 메시지 발송 시스템 (Integrated Message Sending System)**

#### 1.2 기능 목적
CoolSMS API를 통한 카카오톡 알림톡, SMS, LMS 메시지의 실제 발송 및 대체 발송 로직 구현

#### 1.3 핵심 가치
- **다채널 지원**: 알림톡, SMS, LMS 통합 발송
- **대체 발송**: 알림톡 실패 시 SMS 자동 대체
- **실시간 처리**: 즉시 발송 및 결과 확인
- **안전한 테스트**: 시뮬레이션 모드로 안전한 테스트

### 2. ✅ 구현 완료된 기능

#### 2.1 ✅ CoolSMS API 완전 연동

##### 2.1.1 ✅ API 설정 및 인증
- **✅ 구현된 기능:**
  - CoolSMS API 키 관리
  - 다중 발신번호 지원
  - API 버전 관리 (v4)
  - 자동 인증 토큰 갱신

- **✅ 환경 설정:**
```typescript
const coolsmsConfig = {
  apiKey: process.env.COOLSMS_API_KEY,
  apiSecret: process.env.COOLSMS_API_SECRET,
  fromNumber: process.env.COOLSMS_FROM_NUMBER,
  kakaoSenderId: process.env.COOLSMS_KAKAO_SENDER_ID
};
```

##### 2.1.2 ✅ 발신번호 관리
- **✅ 구현된 기능:**
  - 등록된 발신번호 조회
  - 발신번호 유효성 검증
  - 용도별 발신번호 분리 (SMS/알림톡)
  - 발신번호 상태 모니터링

#### 2.2 ✅ 알림톡 발송 시스템

##### 2.2.1 ✅ 템플릿 기반 발송
- **✅ 구현된 기능:**
  - CoolSMS 등록 템플릿 사용
  - 템플릿 코드 자동 매핑
  - 변수 치환 처리
  - 버튼 정보 포함 발송

- **✅ 발송 프로세스:**
```typescript
async function sendAlimtalk({
  templateCode,
  templateContent,
  phoneNumber,
  variables,
  enableRealSending,
  fallbackToSMS
}) {
  // 1. 템플릿 ID 조회
  const templateId = findTemplateIdByCode(templateCode);
  
  // 2. 변수 치환
  let processedContent = templateContent;
  Object.entries(variables).forEach(([key, value]) => {
    processedContent = processedContent.replace(
      new RegExp(`#{${key}}`, 'g'), 
      value
    );
  });
  
  // 3. CoolSMS API 호출
  const result = await coolsms.send({
    type: 'alimtalk',
    to: phoneNumber,
    from: kakaoSenderId,
    text: processedContent,
    kakaoOptions: {
      pfId: kakaoSenderId,
      templateId: templateId,
      disableSms: !fallbackToSMS
    }
  });
  
  return result;
}
```

##### 2.2.2 ✅ 알림톡 버튼 지원
- **✅ 구현된 버튼 타입:**
  - **웹링크(WL)**: URL 연결 버튼
  - **앱링크(AL)**: 앱 실행 버튼
  - **전화걸기**: 전화번호 연결
  - **메시지전달(MD)**: 메시지 공유
  - **봇키워드(BK)**: 챗봇 연결

#### 2.3 ✅ SMS/LMS 발송 시스템

##### 2.3.1 ✅ 자동 메시지 타입 감지
- **✅ 구현된 기능:**
  - 글자 수 기반 자동 타입 결정
  - SMS (90자 이하) / LMS (90자 초과) 자동 분류
  - 실시간 타입 변경 감지
  - 비용 최적화를 위한 타입 조정

##### 2.3.2 ✅ 직접 발송 기능
- **✅ 구현된 기능:**
  - 즉시 SMS/LMS 발송
  - 변수 치환 지원
  - 대량 발송 지원
  - 발송 결과 실시간 확인

- **✅ 발송 프로세스:**
```typescript
async function sendSMS({
  phoneNumber,
  message,
  variables,
  enableRealSending
}) {
  // 1. 변수 치환
  let processedMessage = message;
  Object.entries(variables).forEach(([key, value]) => {
    processedMessage = processedMessage.replace(
      new RegExp(`#{${key}}`, 'g'), 
      value
    );
  });
  
  // 2. 메시지 타입 자동 감지
  const messageType = processedMessage.length > 90 ? 'LMS' : 'SMS';
  
  // 3. CoolSMS API 호출
  const result = await coolsms.send({
    type: messageType.toLowerCase(),
    to: phoneNumber,
    from: fromNumber,
    text: processedMessage
  });
  
  return result;
}
```

#### 2.4 ✅ 대체 발송 로직

##### 2.4.1 ✅ 알림톡 → SMS 대체
- **✅ 구현된 로직:**
  1. 알림톡 발송 시도
  2. 실패 시 자동으로 SMS로 대체 발송
  3. 대체 발송 여부 설정 가능
  4. 대체 발송 결과 별도 추적

##### 2.4.2 ✅ 대체 발송 조건
- **✅ 대체 발송 트리거:**
  - 알림톡 템플릿 승인 대기
  - 알림톡 발송 실패
  - 수신자 알림톡 차단
  - 네트워크 오류

#### 2.5 ✅ 테스트 모드

##### 2.5.1 ✅ 시뮬레이션 모드
- **✅ 구현된 기능:**
  - 실제 발송 없이 프로세스 테스트
  - 변수 치환 결과 확인
  - 발송 시뮬레이션 로그
  - 비용 발생 없는 안전한 테스트

##### 2.5.2 ✅ 실제 테스트 모드
- **✅ 구현된 기능:**
  - 지정된 테스트 번호로만 발송
  - 실제 API 호출 테스트
  - 발송 결과 실시간 확인
  - 제한된 테스트 발송

### 3. 워크플로우 테스트 시스템

#### 3.1 ✅ 통합 테스트 실행
- **✅ 구현된 기능:**
  - 워크플로우 전체 프로세스 테스트
  - 단계별 실행 결과 추적
  - 에러 발생 시 상세 디버깅 정보
  - 성공/실패 통계 제공

#### 3.2 ✅ 테스트 결과 분석
- **✅ 제공 정보:**
  - 각 단계별 실행 상태
  - 변수 치환 결과
  - 발송 성공/실패 여부
  - 에러 메시지 및 해결 방법
  - 실행 시간 측정

### 4. 단순 발송 도구

#### 4.1 ✅ 즉시 SMS 발송
- **✅ 구현된 기능:**
  - 단일/다중 수신자 발송
  - 템플릿 선택 및 사용
  - 변수 치환 지원
  - 실시간 글자 수 체크

#### 4.2 ✅ 사용자 친화적 UI
- **✅ 구현된 기능:**
  - 직관적인 발송 폼
  - 실시간 메시지 미리보기
  - 발송 결과 즉시 확인
  - 발송 이력 관리

### 5. 에러 처리 및 복구

#### 5.1 ✅ 구현된 에러 처리
- **✅ 네트워크 에러**: 자동 재시도 로직
- **✅ API 에러**: 상세한 에러 코드 분석
- **✅ 인증 에러**: API 키 검증 및 갱신
- **✅ 발송 실패**: 대체 발송 자동 실행

#### 5.2 ✅ 에러 분류 및 대응
```typescript
interface SendingError {
  code: string;
  message: string;
  retryable: boolean;
  fallbackAvailable: boolean;
  userAction?: string;
}

// 주요 에러 유형
const errorTypes = {
  'INVALID_PHONE': {
    message: '유효하지 않은 전화번호',
    retryable: false,
    fallbackAvailable: false
  },
  'TEMPLATE_NOT_APPROVED': {
    message: '템플릿 승인 대기 중',
    retryable: false,
    fallbackAvailable: true
  },
  'INSUFFICIENT_BALANCE': {
    message: '잔액 부족',
    retryable: false,
    fallbackAvailable: false
  }
};
```

### 6. 발송 통계 및 모니터링

#### 6.1 ✅ 실시간 통계
- **✅ 수집 데이터:**
  - 발송 성공/실패 수
  - 메시지 타입별 통계
  - 대체 발송 비율
  - 평균 응답 시간

#### 6.2 ✅ 발송 로그
- **✅ 로그 정보:**
```typescript
interface SendingLog {
  id: string;
  timestamp: string;
  messageType: 'alimtalk' | 'sms' | 'lms';
  recipient: string;
  content: string;
  status: 'success' | 'failed' | 'fallback';
  errorCode?: string;
  cost: number;
  executionTime: number;
}
```

### 7. 비용 관리

#### 7.1 ✅ 발송 비용 추적
- **✅ 구현된 기능:**
  - 메시지 타입별 비용 계산
  - 실시간 비용 누적
  - 예상 비용 미리보기
  - 비용 한도 설정 가능

#### 7.2 ✅ 비용 최적화
- **✅ 최적화 전략:**
  - SMS/LMS 자동 타입 선택
  - 불필요한 대체 발송 방지
  - 테스트 모드 활용
  - 발송 전 검증 강화

### 8. 보안 및 규정 준수

#### 8.1 ✅ 개인정보 보호
- **✅ 구현된 보안 기능:**
  - 전화번호 마스킹 처리
  - 메시지 내용 암호화 저장
  - 발송 로그 보관 기간 제한
  - 접근 권한 관리

#### 8.2 ✅ 스팸 방지
- **✅ 구현된 기능:**
  - 발송 빈도 제한
  - 수신 거부 관리
  - 불법 스팸 키워드 필터
  - 발송 시간 제한

### 9. API 구조

#### 9.1 ✅ 워크플로우 테스트 API
```typescript
// POST /api/workflow/test
interface WorkflowTestRequest {
  workflowId: string;
  testPhoneNumber: string;
  enableRealSending: boolean;
  fallbackToSMS: boolean;
  testMemo?: string;
}

interface WorkflowTestResponse {
  success: boolean;
  results: StepResult[];
  summary: TestSummary;
  error?: string;
}
```

#### 9.2 ✅ 단순 발송 API
```typescript
// POST /api/message/send
interface SimpleSendRequest {
  phoneNumbers: string[];
  message: string;
  variables?: Record<string, string>;
  messageType?: 'auto' | 'sms' | 'lms';
}

interface SimpleSendResponse {
  success: boolean;
  sent: number;
  failed: number;
  results: SendResult[];
}
```

### 10. 성능 최적화

#### 10.1 ✅ 구현된 최적화
- **✅ 연결 풀링**: CoolSMS API 연결 재사용
- **✅ 배치 처리**: 다중 수신자 일괄 처리
- **✅ 비동기 처리**: 대용량 발송 비동기 처리
- **✅ 캐싱**: 템플릿 정보 캐싱

#### 10.2 🔄 향후 최적화 계획
- 🔄 **큐 시스템**: 대용량 발송 큐 관리
- 🔄 **로드 밸런싱**: 다중 API 키 로드 밸런싱
- 🔄 **압축**: 메시지 내용 압축 저장
- 🔄 **CDN**: 이미지 첨부 시 CDN 활용

### 11. 모바일 최적화

#### 11.1 ✅ 반응형 발송 UI
- **✅ 구현된 기능:**
  - 모바일 친화적 발송 폼
  - 터치 최적화 인터페이스
  - 모바일 메시지 미리보기
  - 간편한 수신자 입력

### 12. 향후 개발 계획

#### 12.1 🔄 단기 개선 사항 (1-2개월)
- 🔄 **예약 발송**: 특정 시간 예약 발송
- 🔄 **대량 발송**: 1만건 이상 대량 발송 지원
- 🔄 **발송 취소**: 예약된 발송 취소 기능
- 🔄 **상세 통계**: 고급 발송 분석 기능

#### 12.2 ❌ 장기 개발 계획 (3-6개월)
- ❌ **MMS 지원**: 이미지 첨부 메시지
- ❌ **RCS 지원**: 차세대 메시지 서비스
- ❌ **AI 최적화**: 발송 시간 AI 최적화
- ❌ **다중 업체**: 여러 SMS 업체 연동

### 13. 문제 해결 가이드

#### 13.1 ✅ 일반적인 문제
- **✅ 발송 실패**: API 키, 잔액, 발신번호 확인
- **✅ 알림톡 실패**: 템플릿 승인 상태 확인
- **✅ 변수 오류**: 변수명 및 매핑 확인
- **✅ 네트워크 오류**: 연결 상태 및 재시도

#### 13.2 ✅ 디버깅 도구
- **✅ 발송 로그**: 상세한 발송 이력
- **✅ 에러 분석**: 에러 코드별 해결 방법
- **✅ 테스트 모드**: 안전한 테스트 환경
- **✅ 실시간 모니터링**: 발송 상태 실시간 확인

### 14. 성공 지표

#### 14.1 ✅ 측정 가능한 지표
- **✅ 발송 성공률**: 95% 이상
- **✅ 응답 시간**: 평균 3초 이하
- **✅ 대체 발송률**: 10% 이하
- **✅ 에러율**: 5% 이하

#### 14.2 🔄 목표 지표 (향후 설정)
- 🔄 **사용자 만족도**: 9.0/10 이상
- 🔄 **발송 성공률**: 98% 이상
- 🔄 **비용 효율성**: 20% 비용 절감
- 🔄 **처리 속도**: 50% 성능 향상

### 15. 결론

통합 메시지 발송 시스템은 **메시지 자동화 플랫폼의 핵심 실행 엔진**으로서 완전히 구현되었습니다.

#### ✅ 주요 성과:
- **CoolSMS API 완전 연동** 달성
- **다채널 메시지 발송** 지원 (알림톡, SMS, LMS)
- **대체 발송 로직** 구현
- **안전한 테스트 시스템** 구축
- **실시간 모니터링** 및 에러 처리

현재 시스템은 **실제 운영 환경에서 안정적으로 메시지를 발송**할 수 있으며, 높은 성공률과 우수한 사용자 경험을 제공합니다.

향후에는 대량 발송 최적화, 예약 발송, 고급 분석 기능 등을 추가하여 더욱 강력하고 효율적인 메시지 발송 시스템으로 발전시켜 나갈 계획입니다. 