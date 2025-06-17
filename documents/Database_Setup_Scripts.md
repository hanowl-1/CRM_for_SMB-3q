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

### 9. ✅ 환경별 설정 가이드

#### 9.1 ✅ 개발 환경 (Development)
```sql
-- 1. 전체 스키마 생성
\i supabase_hybrid_schema.sql

-- 2. 개발용 권한 설정
\i supabase_rls_fix.sql

-- 3. 테스트 데이터 (선택사항)
\i scripts/disable-rls-and-seed.sql
```

#### 9.2 ✅ 스테이징 환경 (Staging)
```sql
-- 1. 프로덕션과 동일한 스키마
\i supabase_hybrid_schema.sql

-- 2. 제한적 권한 설정
\i supabase_rls_policies.sql
```

#### 9.3 ✅ 프로덕션 환경 (Production)
```sql
-- 1. 메인 스키마만
\i supabase_hybrid_schema.sql

-- 2. 엄격한 RLS 정책
\i supabase_rls_policies.sql

-- 3. 모니터링 설정
-- 추가 모니터링 테이블 생성
```

### 10. ✅ 문제 해결 가이드

#### 10.1 ✅ 일반적인 오류

**권한 오류 (Permission Denied)**
```sql
-- 해결책
\i supabase_rls_fix.sql
```

**테이블 존재하지 않음**
```sql
-- 해결책
\i supabase_hybrid_schema.sql
```

**RLS 정책 충돌**
```sql
-- 해결책
\i fix_rls_permissions.sql
```

#### 10.2 ✅ 디버깅 쿼리

**테이블 존재 확인**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

**RLS 정책 확인**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename IN ('workflows', 'message_templates', 'individual_variable_mappings');
```

**권한 확인**
```sql
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'workflows';
```

### 11. ✅ 백업 및 복구

#### 11.1 ✅ 스키마 백업
```bash
# 스키마만 백업
pg_dump -h your-host -U postgres -d postgres --schema-only > schema_backup.sql

# 데이터 포함 백업
pg_dump -h your-host -U postgres -d postgres > full_backup.sql
```

#### 11.2 ✅ 복구
```bash
# 스키마 복구
psql -h your-host -U postgres -d postgres < schema_backup.sql

# 전체 복구
psql -h your-host -U postgres -d postgres < full_backup.sql
```

### 12. ✅ 성능 최적화

#### 12.1 ✅ 인덱스 모니터링
```sql
-- 인덱스 사용 통계
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

#### 12.2 ✅ 쿼리 성능 분석
```sql
-- 느린 쿼리 확인
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

### 13. ✅ 마이그레이션 체크리스트

#### 13.1 ✅ 설치 전 확인사항
- [ ] Supabase 프로젝트 생성 완료
- [ ] 데이터베이스 접근 권한 확인
- [ ] 백업 계획 수립
- [ ] 환경변수 설정 완료

#### 13.2 ✅ 설치 후 확인사항
- [ ] 모든 테이블 생성 확인
- [ ] RLS 정책 적용 확인
- [ ] API 연결 테스트
- [ ] 기본 데이터 입력 테스트

### 14. 결론

이 스크립트 모음은 **메시지 자동화 플랫폼의 완전한 데이터베이스 설정**을 지원합니다.

#### ✅ 주요 특징:
- **단계별 설정**: 체계적인 설치 과정
- **환경별 대응**: 개발/스테이징/프로덕션 환경 지원
- **문제 해결**: 일반적인 문제에 대한 해결책 제공
- **성능 최적화**: 인덱스 및 쿼리 최적화
- **안전한 운영**: 백업 및 복구 가이드

현재 스크립트들은 **실제 운영 환경에서 검증된 안정적인 설정**을 제공하며, 플랫폼의 모든 기능을 완벽하게 지원합니다. 