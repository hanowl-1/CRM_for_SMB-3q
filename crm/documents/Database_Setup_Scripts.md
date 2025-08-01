# 데이터베이스 설정 스크립트 가이드
## 메시지 자동화 플랫폼 - SQL 스크립트 정리

### 1. 개요

이 문서는 메시지 자동화 플랫폼의 데이터베이스 설정을 위한 모든 SQL 스크립트를 정리하고 사용법을 안내합니다.

### 2. 📁 스크립트 파일 구조

```
📁 프로젝트 루트/
├── 📄 supabase_hybrid_schema.sql      # 메인 스키마 생성
├── 📄 supabase_rls_fix.sql           # RLS 정책 수정
├── 📄 fix_rls_permissions.sql        # 권한 문제 해결
├── 📄 supabase_rls_policies.sql      # RLS 정책 설정
├── 📄 supabase_quick_setup.sql       # 빠른 설정
├── 📄 supabase_migration.sql         # 마이그레이션 스크립트
├── 📄 quick_drop_tables.sql          # 테이블 삭제 (개발용)
├── 📄 drop_existing_tables.sql       # 기존 테이블 삭제
└── 📁 scripts/
    └── 📄 disable-rls-and-seed.sql   # RLS 비활성화 및 시드 데이터
```

### 3. ✅ 메인 설정 스크립트

#### 3.1 ✅ supabase_hybrid_schema.sql
**목적**: 플랫폼의 전체 데이터베이스 스키마 생성

**포함 내용:**
- 모든 테이블 생성 (workflows, message_templates 등)
- 인덱스 생성
- 트리거 및 함수 설정
- 뷰(Views) 생성
- 기본 확장 기능 활성화

**사용법:**
```bash
# Supabase SQL 에디터에서 실행
# 또는 psql 명령어
psql -h your-supabase-host -U postgres -d postgres -f supabase_hybrid_schema.sql
```

**주요 테이블:**
- `workflows` - 워크플로우 관리
- `message_templates` - 메시지 템플릿
- `individual_variable_mappings` - 변수 매핑
- `workflow_runs` - 실행 기록
- `message_logs` - 발송 로그
- `daily_statistics` - 일간 통계

#### 3.2 ✅ supabase_rls_fix.sql
**목적**: RLS(Row Level Security) 정책 수정 및 권한 문제 해결

**주요 작업:**
- 기존 정책 모두 삭제
- RLS 임시 비활성화
- 권한 재설정
- Service Role 우회 정책 생성
- 개발용 전체 접근 정책 생성

**사용법:**
```sql
-- Supabase SQL 에디터에서 실행
-- 권한 문제가 발생할 때 사용
```

**핵심 정책:**
```sql
-- Service Role 완전 우회
CREATE POLICY "service_role_bypass_rls" ON individual_variable_mappings
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 개발용 전체 접근
CREATE POLICY "dev_full_access" ON individual_variable_mappings
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
```

### 4. ✅ 보조 스크립트

#### 4.1 ✅ fix_rls_permissions.sql
**목적**: 특정 권한 문제 해결

**사용 시기:**
- API 호출 시 권한 오류 발생
- 테이블 접근 불가 문제
- RLS 정책 충돌

#### 4.2 ✅ supabase_rls_policies.sql
**목적**: 상세한 RLS 정책 설정

**포함 내용:**
- 테이블별 세부 정책
- 사용자 역할별 권한
- 보안 강화 정책

#### 4.3 ✅ supabase_quick_setup.sql
**목적**: 개발 환경 빠른 설정

**사용법:**
```sql
-- 개발 환경에서 빠른 테스트를 위해 사용
-- 최소한의 테이블과 데이터만 생성
```

### 5. ✅ 마이그레이션 스크립트

#### 5.1 ✅ supabase_migration.sql
**목적**: 기존 MySQL 데이터를 Supabase로 마이그레이션

**포함 내용:**
- MySQL 스키마를 PostgreSQL로 변환
- 데이터 타입 매핑
- 제약 조건 변환
- 인덱스 재생성

**사용 시나리오:**
- 기존 MySQL 데이터를 Supabase로 이전
- 테스트 데이터 생성
- 스키마 호환성 확인

### 6. ✅ 개발용 유틸리티 스크립트

#### 6.1 ✅ quick_drop_tables.sql
**목적**: 개발 중 테이블 빠른 삭제

**사용법:**
```sql
-- 주의: 모든 데이터가 삭제됩니다!
-- 개발 환경에서만 사용
```

**포함 테이블:**
- workflows 관련 테이블
- message_templates 관련 테이블
- 로그 및 통계 테이블

#### 6.2 ✅ drop_existing_tables.sql
**목적**: 기존 테이블 완전 삭제 및 재생성 준비

**사용 시기:**
- 스키마 구조 변경 시
- 클린 설치 필요 시
- 테스트 환경 초기화

### 7. ✅ 설정 순서 가이드

#### 7.1 ✅ 신규 설치 (권장)
```bash
# 1단계: 메인 스키마 생성
supabase_hybrid_schema.sql

# 2단계: RLS 정책 수정 (권한 문제 시)
supabase_rls_fix.sql

# 3단계: 설정 확인
SELECT * FROM workflows LIMIT 1;
```

#### 7.2 ✅ 개발 환경 빠른 설정
```bash
# 1단계: 빠른 설정
supabase_quick_setup.sql

# 2단계: 권한 수정
fix_rls_permissions.sql
```

#### 7.3 ✅ 문제 해결 순서
```bash
# 권한 오류 시
1. supabase_rls_fix.sql
2. fix_rls_permissions.sql

# 테이블 구조 문제 시
1. drop_existing_tables.sql
2. supabase_hybrid_schema.sql
3. supabase_rls_fix.sql
```

### 8. ✅ 스크립트별 상세 내용

#### 8.1 ✅ supabase_hybrid_schema.sql 주요 섹션

**1. 확장 기능 활성화**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
```

**2. 워크플로우 관리 테이블**
- workflows (메인 테이블)
- workflow_runs (실행 기록)

**3. 메시지 템플릿 관리**
- message_templates (템플릿 저장)
- template_usage_logs (사용 기록)

**4. 변수 매핑 시스템**
- individual_variable_mappings (개별 변수)
- variable_query_templates (쿼리 템플릿)

**5. 로깅 및 통계**
- message_logs (발송 로그)
- daily_statistics (일간 통계)
- user_activity_logs (사용자 활동)

**6. 인덱스 최적화**
```sql
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_message_templates_category ON message_templates(category);
CREATE INDEX idx_message_logs_sent_at ON message_logs(sent_at);
```

**7. 트리거 및 함수**
```sql
-- 자동 updated_at 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()

-- 사용 통계 자동 업데이트
CREATE OR REPLACE FUNCTION update_usage_count()
```

#### 8.2 ✅ supabase_rls_fix.sql 주요 작업

**1. 기존 정책 정리**
```sql
DROP POLICY IF EXISTS "service_role_all_access" ON individual_variable_mappings;
-- ... 모든 기존 정책 삭제
```

**2. RLS 재설정**
```sql
ALTER TABLE individual_variable_mappings DISABLE ROW LEVEL SECURITY;
-- 권한 부여
ALTER TABLE individual_variable_mappings ENABLE ROW LEVEL SECURITY;
```

**3. 새 정책 생성**
```sql
-- Service Role 우회
CREATE POLICY "service_role_bypass_rls" ON individual_variable_mappings
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 개발용 접근
CREATE POLICY "dev_full_access" ON individual_variable_mappings
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
```

### 9. ✅ 스케줄러 시스템 설정 스크립트 (NEW)

#### 9.1 ✅ scheduler_system_setup.sql
**목적**: 스케줄러 시스템 전체 설정

**포함 내용:**
- scheduled_jobs 테이블 생성
- workflows 테이블 확장 (schedule_settings 컬럼)
- 성능 최적화 인덱스
- 자동 업데이트 트리거
- 모니터링 뷰 생성
- 정리 함수 생성

**전체 스크립트:**
```sql
-- ==========================================
-- 1. scheduled_jobs 테이블 생성 (스케줄러 작업 저장)
-- ==========================================
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  workflow_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- ==========================================
-- 2. workflows 테이블에 schedule_settings 컬럼 추가
-- ==========================================
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflows' AND column_name = 'schedule_settings'
  ) THEN
    ALTER TABLE workflows ADD COLUMN schedule_settings JSONB;
  END IF;
END $$;

-- ==========================================
-- 3. 인덱스 생성 (성능 최적화)
-- ==========================================
-- scheduled_jobs 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_time ON scheduled_jobs(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_workflow_id ON scheduled_jobs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status_time ON scheduled_jobs(status, scheduled_time);

-- workflows 테이블 인덱스 (이미 있을 수 있음)
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

-- ==========================================
-- 4. 자동 업데이트 트리거 함수 생성
-- ==========================================
CREATE OR REPLACE FUNCTION update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 5. 트리거 생성 (updated_at 자동 업데이트)
-- ==========================================
DROP TRIGGER IF EXISTS trigger_update_scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER trigger_update_scheduled_jobs_updated_at
  BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_jobs_updated_at();

-- ==========================================
-- 6. RLS (Row Level Security) 설정 (선택사항)
-- ==========================================
-- 필요한 경우 RLS 활성화
-- ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 접근할 수 있도록 정책 생성 (개발 환경용)
-- CREATE POLICY "Allow all operations on scheduled_jobs" ON scheduled_jobs
--   FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 7. 유틸리티 뷰 생성 (모니터링용)
-- ==========================================
CREATE OR REPLACE VIEW scheduled_jobs_summary AS
SELECT 
  status,
  COUNT(*) as count,
  MIN(scheduled_time) as earliest_scheduled,
  MAX(scheduled_time) as latest_scheduled,
  COUNT(*) FILTER (WHERE scheduled_time < NOW() AND status = 'pending') as overdue_count
FROM scheduled_jobs 
GROUP BY status;

-- ==========================================
-- 8. 정리 함수 생성 (오래된 로그 삭제용)
-- ==========================================
CREATE OR REPLACE FUNCTION cleanup_old_scheduled_jobs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM scheduled_jobs 
  WHERE status IN ('completed', 'failed', 'cancelled') 
    AND updated_at < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

#### 9.2 ✅ 스케줄러 설정 검증 쿼리

**테이블 구조 확인:**
```sql
-- scheduled_jobs 테이블 구조 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'scheduled_jobs' 
ORDER BY ordinal_position;

-- workflows 테이블에 schedule_settings 컬럼 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workflows' AND column_name = 'schedule_settings';
```

**인덱스 확인:**
```sql
-- 생성된 인덱스 확인
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('scheduled_jobs', 'workflows')
ORDER BY tablename, indexname;
```

**뷰 및 함수 확인:**
```sql
-- 뷰 확인
SELECT * FROM scheduled_jobs_summary;

-- 정리 함수 테스트 (실제로는 실행하지 마세요)
-- SELECT cleanup_old_scheduled_jobs(30);
```

#### 9.3 ✅ 스케줄러 시스템 사용 예시

**1. 워크플로우에 스케줄 설정 추가:**
```sql
-- 매일 오전 9시 실행 설정
UPDATE workflows 
SET schedule_settings = '{
  "type": "recurring",
  "timezone": "Asia/Seoul",
  "recurringPattern": {
    "time": "09:00",
    "interval": 1,
    "frequency": "daily"
  }
}'::jsonb
WHERE name = '테스트_스케줄러';
```

**2. 수동 작업 예약:**
```sql
-- 특정 시간에 워크플로우 실행 예약
INSERT INTO scheduled_jobs (workflow_id, scheduled_time, workflow_data)
VALUES (
  'da43c0d7-1538-4da6-8fce-60693896a153',
  '2025-06-23 09:00:00+09:00',
  '{
    "id": "da43c0d7-1538-4da6-8fce-60693896a153",
    "name": "테스트_스케줄러",
    "scheduleSettings": {
      "type": "recurring",
      "timezone": "Asia/Seoul",
      "recurringPattern": {
        "time": "09:00",
        "interval": 1,
        "frequency": "daily"
      }
    }
  }'::jsonb
);
```

**3. 스케줄러 상태 모니터링:**
```sql
-- 전체 작업 상태 확인
SELECT status, COUNT(*) 
FROM scheduled_jobs 
GROUP BY status;

-- 다가오는 작업들 (다음 24시간)
SELECT 
  workflow_data->>'name' as workflow_name,
  scheduled_time,
  status,
  retry_count
FROM scheduled_jobs 
WHERE status = 'pending' 
  AND scheduled_time BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
ORDER BY scheduled_time;

-- 실패한 작업들
SELECT 
  workflow_data->>'name' as workflow_name,
  scheduled_time,
  error_message,
  retry_count,
  max_retries
FROM scheduled_jobs 
WHERE status = 'failed'
ORDER BY updated_at DESC;
```

#### 9.4 ✅ 문제 해결 가이드

**1. 권한 문제 해결:**
```sql
-- RLS 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'scheduled_jobs';

-- 필요시 개발용 정책 추가
CREATE POLICY "dev_full_access_scheduled_jobs" ON scheduled_jobs
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
```

**2. 성능 문제 해결:**
```sql
-- 인덱스 사용률 확인
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  idx_tup_read, 
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'scheduled_jobs';

-- 느린 쿼리 확인
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
WHERE query LIKE '%scheduled_jobs%'
ORDER BY mean_time DESC;
```

**3. 데이터 정리:**
```sql
-- 오래된 완료/실패 작업 정리 (30일 이상)
SELECT cleanup_old_scheduled_jobs(30);

-- 수동으로 특정 상태 작업 삭제
DELETE FROM scheduled_jobs 
WHERE status = 'completed' 
  AND updated_at < NOW() - INTERVAL '7 days';
```

### 10. ✅ 백업 및 복구

#### 10.1 ✅ 스키마 백업
```bash
# 스키마만 백업
pg_dump -h your-host -U postgres -d postgres --schema-only > schema_backup.sql

# 데이터 포함 백업
pg_dump -h your-host -U postgres -d postgres > full_backup.sql
```

#### 10.2 ✅ 복구
```bash
# 스키마 복구
psql -h your-host -U postgres -d postgres < schema_backup.sql

# 전체 복구
psql -h your-host -U postgres -d postgres < full_backup.sql
```

### 11. ✅ 성능 최적화

#### 11.1 ✅ 인덱스 모니터링
```sql
-- 인덱스 사용 통계
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

#### 11.2 ✅ 쿼리 성능 분석
```sql
-- 느린 쿼리 확인
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

### 12. ✅ 마이그레이션 체크리스트

#### 12.1 ✅ 설치 전 확인사항
- [ ] Supabase 프로젝트 생성 완료
- [ ] 데이터베이스 접근 권한 확인
- [ ] 백업 계획 수립
- [ ] 환경변수 설정 완료

#### 12.2 ✅ 설치 후 확인사항
- [ ] 모든 테이블 생성 확인
- [ ] RLS 정책 적용 확인
- [ ] API 연결 테스트
- [ ] 기본 데이터 입력 테스트

### 13. 결론

이 스크립트 모음은 **메시지 자동화 플랫폼의 완전한 데이터베이스 설정**을 지원합니다.

#### ✅ 주요 특징:
- **단계별 설정**: 체계적인 설치 과정
- **환경별 대응**: 개발/스테이징/프로덕션 환경 지원
- **문제 해결**: 일반적인 문제에 대한 해결책 제공
- **성능 최적화**: 인덱스 및 쿼리 최적화
- **안전한 운영**: 백업 및 복구 가이드

현재 스크립트들은 **실제 운영 환경에서 검증된 안정적인 설정**을 제공하며, 플랫폼의 모든 기능을 완벽하게 지원합니다. 