# 🗄️ Supabase 하이브리드 시스템 설정 가이드

## 📋 **개요**
MySQL(읽기) + Supabase(쓰기) 하이브리드 아키텍처를 위한 Supabase 테이블 설정 가이드입니다.

## 🚀 **빠른 설정 (권장)**

### 1단계: Supabase 프로젝트 접속
1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. 좌측 메뉴에서 **SQL Editor** 클릭

### 2단계: 테이블 생성
`supabase_quick_setup.sql` 파일의 명령문을 **단계별로** 복사해서 실행하세요.

```sql
-- 1단계: 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

```sql
-- 2단계: 워크플로우 테이블 생성
CREATE TABLE workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  trigger_type VARCHAR(100) NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  target_config JSONB DEFAULT '{}',
  message_config JSONB DEFAULT '{}',
  variables JSONB DEFAULT '{}',
  schedule_config JSONB DEFAULT '{}',
  statistics JSONB DEFAULT '{}',
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3단계: 나머지 테이블들 순서대로 생성
`supabase_quick_setup.sql`의 3단계부터 12단계까지 순서대로 실행하세요.

## 🏗️ **전체 스키마 설정 (고급)**

전체 기능이 포함된 완전한 스키마를 원한다면 `supabase_hybrid_schema.sql` 파일을 사용하세요.

### 포함된 기능:
- ✅ **11개 테이블** (워크플로우, 템플릿, 로그, 통계 등)
- ✅ **성능 최적화 인덱스** 
- ✅ **Row Level Security (RLS)** 정책
- ✅ **자동 트리거** (updated_at, 통계 업데이트)
- ✅ **편의성 뷰** (요약 통계)
- ✅ **기본 데이터** (설정, 템플릿)

## 📊 **생성되는 테이블 구조**

### 🔄 **워크플로우 관리**
- `workflows` - 워크플로우 메인 테이블
- `workflow_runs` - 실행 기록

### 📝 **템플릿 시스템**
- `message_templates` - 메시지 템플릿
- `template_usage_logs` - 사용 기록

### 📨 **메시지 발송**
- `message_logs` - 발송 기록 및 상태

### ⚙️ **시스템 관리**
- `system_settings` - 시스템 설정
- `api_credentials` - API 인증 정보

### 📈 **통계 및 로그**
- `daily_statistics` - 일별 통계
- `monthly_statistics` - 월별 통계
- `user_activity_logs` - 사용자 활동 로그
- `system_event_logs` - 시스템 이벤트 로그

## 🔐 **보안 설정**

### Row Level Security (RLS)
모든 테이블에 RLS가 활성화되어 있습니다:
- **읽기**: 인증된 사용자 모두 가능
- **쓰기**: 서비스 역할 또는 인증된 사용자
- **시스템 설정**: 서비스 역할만 접근 가능

### API 키 설정
`.env.local` 파일에 Supabase 설정이 있는지 확인하세요:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 🧪 **테스트 및 확인**

### 1. 테이블 생성 확인
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

### 2. 기본 데이터 확인
```sql
-- 시스템 설정 확인
SELECT * FROM system_settings;

-- 기본 템플릿 확인
SELECT name, category, message_type FROM message_templates;

-- 오늘 통계 확인
SELECT * FROM daily_statistics WHERE date = CURRENT_DATE;
```

### 3. API 연결 테스트
개발 서버에서 대시보드 페이지(`/admin/dashboard`)에 접속하여 데이터가 정상적으로 로드되는지 확인하세요.

## 🔧 **문제 해결**

### 권한 오류 발생 시
```sql
-- RLS 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

### 테이블 삭제 (필요시)
```sql
-- 주의: 모든 데이터가 삭제됩니다!
DROP TABLE IF EXISTS workflow_runs CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
DROP TABLE IF EXISTS template_usage_logs CASCADE;
DROP TABLE IF EXISTS message_templates CASCADE;
DROP TABLE IF EXISTS message_logs CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS daily_statistics CASCADE;
-- ... 기타 테이블들
```

## 📱 **다음 단계**

1. ✅ Supabase 테이블 생성 완료
2. 🔄 Next.js 앱에서 API 연결 테스트
3. 📊 대시보드에서 데이터 확인
4. 🚀 워크플로우 생성 및 테스트

## 💡 **팁**

- **단계별 실행**: 한 번에 모든 명령을 실행하지 말고 단계별로 실행하세요
- **오류 확인**: 각 단계 후 오류가 없는지 확인하세요
- **백업**: 중요한 데이터가 있다면 먼저 백업하세요
- **테스트**: 개발 환경에서 먼저 테스트해보세요

---

## 🆘 **지원**

문제가 발생하면:
1. Supabase 로그 확인
2. 브라우저 개발자 도구 콘솔 확인
3. Next.js 서버 로그 확인 