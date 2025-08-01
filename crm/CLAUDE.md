# CRM for SMB 메시지 자동화 플랫폼 - CLAUDE.md

이 문서는 Claude Code가 이 프로젝트에서 더 효과적으로 작업하도록 돕기 위한 프로젝트별 지침을 포함합니다.

## 프로젝트 개요

카카오톡 알림톡 및 문자 메시지 자동화 플랫폼으로, 기존 SaaS의 보조 서비스입니다. 구독 상태별 맞춤형 자동 메시지를 발송하는 시스템입니다.

## 기술 스택

### 프론트엔드
- **프레임워크**: Next.js 15.2.4 (App Router)
- **UI 라이브러리**: React 19, TypeScript
- **스타일링**: Tailwind CSS
- **컴포넌트**: shadcn/ui (Radix UI 기반)
- **아이콘**: Lucide React

### 백엔드
- **API**: Next.js API Routes
- **데이터베이스**:
  - MySQL (읽기 전용 - 고객 데이터)
  - Supabase PostgreSQL (플랫폼 데이터)
- **메시지 발송**: CoolSMS API (SMS/LMS/카카오 알림톡)
- **스케줄링**: Vercel Cron + AWS Lambda

## 주요 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 린트 실행
npm run lint

# 테스트 데이터 시드
npm run seed
```

## 프로젝트 구조

```
├── app/                    # Next.js App Router
│   ├── api/               # API 엔드포인트
│   │   ├── auth/          # 인증
│   │   ├── campaigns/     # 캠페인 관리
│   │   ├── cron/          # 크론 작업
│   │   ├── mysql/         # MySQL 데이터 접근
│   │   ├── scheduler/     # 워크플로우 스케줄링
│   │   ├── sms/           # SMS 발송
│   │   ├── supabase/      # Supabase 연동
│   │   ├── templates/     # 템플릿 관리
│   │   └── workflows/     # 워크플로우 실행
│   └── [페이지]/          # UI 페이지
├── components/            # 재사용 가능한 컴포넌트
├── lib/                   # 유틸리티 및 서비스
│   ├── database/          # DB 클라이언트
│   ├── services/          # 비즈니스 로직
│   ├── types/             # TypeScript 타입
│   └── utils/             # 헬퍼 함수
└── database_scripts/      # SQL 마이그레이션
```

## 코딩 규칙

### TypeScript 사용
- 모든 새 파일은 TypeScript(.ts/.tsx)로 작성
- 타입 정의는 `lib/types/` 디렉토리에 관리
- `any` 타입 사용 최소화 (tsconfig에서 허용되지만 지양)

### 컴포넌트 작성
- 함수형 컴포넌트 사용
- shadcn/ui 컴포넌트 우선 사용
- 컴포넌트 파일명은 PascalCase 사용

### API 라우트
- App Router API 라우트 패턴 따르기
- 에러 처리는 일관되게 NextResponse로 반환
- 인증이 필요한 엔드포인트는 auth 미들웨어 사용

### 데이터베이스 접근
- MySQL은 읽기 전용으로만 접근
- Supabase는 Row Level Security(RLS) 활성화 상태
- 데이터베이스 쿼리는 try-catch로 에러 처리

## 주요 기능별 위치

### 워크플로우 관리
- UI: `app/workflow-builder/`, `components/workflow/`
- API: `app/api/workflows/`
- 타입: `lib/types/workflow.ts`

### 템플릿 관리
- UI: `app/template-builder/`, `components/templates/`
- API: `app/api/templates/`

### 메시지 발송
- SMS 발송: `app/sms-sender/`, `app/api/sms/`
- 스케줄러: `app/api/scheduler/`, `lib/services/scheduler.ts`

### 데이터베이스 연동
- MySQL: `lib/database/mysql.ts`, `app/api/mysql/`
- Supabase: `lib/database/supabase.ts`, `app/api/supabase/`

## 환경 변수

필수 환경 변수 (.env.local):
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# MySQL (읽기 전용)
MYSQL_READONLY_HOST=
MYSQL_READONLY_PORT=
MYSQL_READONLY_USER=
MYSQL_READONLY_PASSWORD=
MYSQL_READONLY_DATABASE=

# CoolSMS
COOLSMS_API_KEY=
COOLSMS_API_SECRET=
KAKAO_SENDER_KEY=
SMS_SENDER_NUMBER=

# 스케줄러
CRON_SECRET_TOKEN=
VERCEL_AUTOMATION_BYPASS_SECRET=
```

## 주의사항

### 보안
- 절대 환경 변수나 비밀 키를 코드에 하드코딩하지 마세요
- MySQL은 읽기 전용 권한만 가지고 있습니다
- Supabase RLS 정책을 준수하세요

### 성능
- 대량 메시지 발송 시 배치 처리 사용
- MySQL 쿼리는 인덱스를 활용하도록 최적화
- 클라이언트 사이드 렌더링 최소화

### 시간대
- 모든 시간은 한국 표준시(KST) 기준
- 스케줄러는 한국 시간으로 작동
- DB에 저장할 때 UTC로 변환

## 디버깅 팁

### 로컬 개발
1. `npm run dev`로 개발 서버 실행
2. MySQL 연결 문제 시 VPN 확인
3. Supabase 연결 문제 시 환경 변수 확인

### 에러 처리
- API 응답은 일관된 형식 사용: `{ success: boolean, data?: any, error?: string }`
- 콘솔 로그보다 구조화된 에러 반환 선호
- 사용자 친화적 에러 메시지 제공

### 테스트
- 시드 데이터로 기능 테스트: `npm run seed`
- 워크플로우 테스트 모드 활용
- CoolSMS 테스트 모드로 실제 발송 없이 테스트

## 자주 사용하는 패턴

### API 라우트 패턴
```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // 비즈니스 로직
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
```

### Supabase 쿼리 패턴
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value)

if (error) throw error
```

### MySQL 쿼리 패턴
```typescript
const connection = await getReadOnlyConnection()
try {
  const [rows] = await connection.execute('SELECT * FROM table WHERE ?', [condition])
  return rows
} finally {
  await connection.end()
}
```

## 개발 우선순위

1. **안정성**: 메시지 발송 실패 최소화
2. **사용성**: 직관적인 UI/UX
3. **성능**: 대량 발송 최적화
4. **확장성**: 새로운 메시지 채널 추가 용이

## 추가 리소스

- [PRD 문서](./documents/PRD.md) - 제품 요구사항 상세
- [기술 문서](./documents/) - 기술 구현 상세
- CoolSMS API 문서: https://docs.coolsms.co.kr
- Supabase 문서: https://supabase.com/docs