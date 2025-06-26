# 데이터베이스 스크립트 폴더
## SQL 스크립트 파일 모음 (정리 완료)

이 폴더에는 메시지 자동화 플랫폼의 데이터베이스 설정을 위한 **핵심 SQL 스크립트**만 포함되어 있습니다.

### 📁 최종 파일 목록

#### ⭐ 핵심 스크립트 (우선 실행)

**1. `supabase_hybrid_schema.sql` (24KB)**
- **목적**: 메인 데이터베이스 스키마 생성
- **우선순위**: 🔴 필수 (1순위)
- **포함 내용**: 모든 테이블, 인덱스, 트리거, 함수, 뷰
- **사용 시기**: 신규 Supabase 프로젝트 설정 시 최우선 실행

**2. `supabase_rls_fix.sql` (2KB)**
- **목적**: RLS(Row Level Security) 정책 수정
- **우선순위**: 🟡 중요 (2순위)
- **포함 내용**: 권한 문제 해결, Service Role 우회 정책
- **사용 시기**: 스키마 생성 후 권한 설정 또는 API 오류 발생 시

**3. `supabase_timezone_setup.sql` (6KB)**
- **목적**: 한국 시간대 설정 및 시간 처리 함수
- **우선순위**: 🟡 중요 (3순위)
- **포함 내용**: 시간대 유틸리티 함수, 한국 시간 뷰
- **사용 시기**: 스케줄러 시스템 사용 시 필수

#### 🔧 문제 해결 스크립트

**4. `fix_rls_permissions.sql` (1.6KB)**
- **목적**: 특정 권한 문제 해결
- **사용 시기**: API 호출 시 권한 오류 발생

**5. `fix_missing_columns.sql` (2.3KB)**
- **목적**: 누락된 컬럼 추가
- **사용 시기**: 기존 DB 업그레이드 시

#### 🚀 최적화 스크립트

**6. `supabase_workflow_optimization_fixed.sql` (20KB)**
- **목적**: 워크플로우 시스템 최적화
- **사용 시기**: 성능 개선이 필요한 경우

#### 🗑️ 개발용 유틸리티 (주의!)

**7. `quick_drop_tables.sql` (3.4KB)**
- **목적**: 개발 중 테이블 빠른 삭제
- **⚠️ 주의**: 모든 데이터 삭제! 개발 환경에서만 사용

### 🚀 권장 실행 순서

#### 신규 설치 (완전 설치)
```bash
1. supabase_hybrid_schema.sql           # 메인 스키마 생성
2. supabase_rls_fix.sql                 # RLS 정책 설정
3. supabase_timezone_setup.sql          # 시간대 설정
4. 테스트 및 검증
```

#### 기존 DB 업그레이드
```bash
1. fix_missing_columns.sql              # 누락 컬럼 추가
2. supabase_workflow_optimization_fixed.sql  # 성능 최적화
3. supabase_timezone_setup.sql          # 시간대 설정 (필요시)
```

#### 권한 문제 해결
```bash
1. fix_rls_permissions.sql              # 특정 권한 문제
2. supabase_rls_fix.sql                 # 전체 RLS 재설정
```

#### 클린 재설치 (개발용)
```bash
1. quick_drop_tables.sql                # 기존 테이블 삭제 (주의!)
2. supabase_hybrid_schema.sql           # 새로 스키마 생성
3. supabase_rls_fix.sql                 # RLS 정책 설정
4. supabase_timezone_setup.sql          # 시간대 설정
```

### 📖 상세 가이드

더 자세한 사용법은 다음 문서들을 참조하세요:

- **[Database_Setup_Scripts.md](../documents/Database_Setup_Scripts.md)** - 스크립트 상세 가이드
- **[Database_Schema.md](../documents/Database_Schema.md)** - 완전한 스키마 문서
- **[Database_Migration_Guide.md](../documents/Database_Migration_Guide.md)** - 마이그레이션 가이드
- **[Timezone_Issue_Resolution.md](../documents/Timezone_Issue_Resolution.md)** - 시간대 문제 해결

### ⚠️ 안전 수칙

1. **프로덕션 환경**: 삭제 스크립트 절대 사용 금지
2. **백업 필수**: 스크립트 실행 전 반드시 백업
3. **단계별 실행**: 권장 순서에 따라 단계별 실행
4. **테스트 우선**: 개발 환경에서 충분히 테스트 후 적용

### 🗑️ 정리된 파일들

다음 파일들은 중복 또는 구버전으로 삭제되었습니다:
- `supabase_workflow_optimization.sql` → `supabase_workflow_optimization_fixed.sql`로 대체
- `supabase_migration.sql` → `supabase_hybrid_schema.sql`로 대체
- `supabase_quick_setup.sql` → `supabase_hybrid_schema.sql`로 대체
- `supabase_rls_policies.sql` → `supabase_rls_fix.sql`로 대체
- `drop_existing_tables.sql` → `quick_drop_tables.sql`로 대체

---

> **📝 참고**: 이 스크립트들은 실제 운영 환경에서 검증된 안정적인 파일들입니다. 안전한 사용을 위해 documents 폴더의 상세 가이드를 반드시 참조하시기 바랍니다.