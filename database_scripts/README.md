# 데이터베이스 스크립트 폴더
## SQL 스크립트 파일 모음

이 폴더에는 메시지 자동화 플랫폼의 데이터베이스 설정을 위한 모든 SQL 스크립트가 포함되어 있습니다.

### 📁 파일 목록

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

#### 🔧 보조 스크립트

**3. `fix_rls_permissions.sql` (1.6KB)**
- **목적**: 특정 권한 문제 해결
- **사용 시기**: API 호출 시 권한 오류 발생

**4. `supabase_rls_policies.sql` (2.5KB)**
- **목적**: 상세한 RLS 정책 설정
- **사용 시기**: 프로덕션 환경 또는 보안 강화 필요 시

**5. `supabase_quick_setup.sql` (5.5KB)**
- **목적**: 개발 환경 빠른 설정
- **사용 시기**: 개발 초기 빠른 테스트용

#### 🔄 마이그레이션 스크립트

**6. `supabase_migration.sql` (24KB)**
- **목적**: MySQL → Supabase 마이그레이션
- **사용 시기**: 기존 MySQL 시스템에서 전환 시

#### 🗑️ 개발용 유틸리티 (주의!)

**7. `quick_drop_tables.sql` (3.4KB)**
- **목적**: 개발 중 테이블 빠른 삭제
- **⚠️ 주의**: 모든 데이터 삭제! 개발 환경에서만 사용

**8. `drop_existing_tables.sql` (4.7KB)**
- **목적**: 기존 테이블 완전 삭제
- **⚠️ 주의**: 모든 데이터 영구 삭제! 개발 환경에서만 사용

### 🚀 권장 실행 순서

#### 신규 설치
```bash
1. supabase_hybrid_schema.sql      # 메인 스키마 생성
2. supabase_rls_fix.sql           # RLS 정책 설정
3. 테스트 및 검증
```

#### 권한 문제 해결
```bash
1. fix_rls_permissions.sql        # 특정 권한 문제
2. supabase_rls_fix.sql           # 전체 RLS 재설정
```

#### 클린 재설치 (개발용)
```bash
1. quick_drop_tables.sql          # 기존 테이블 삭제 (주의!)
2. supabase_hybrid_schema.sql     # 새로 스키마 생성
3. supabase_rls_fix.sql           # RLS 정책 설정
```

### 📖 상세 가이드

더 자세한 사용법은 다음 문서들을 참조하세요:

- **[Database_Setup_Scripts.md](../documents/Database_Setup_Scripts.md)** - 스크립트 상세 가이드
- **[Database_Schema.md](../documents/Database_Schema.md)** - 완전한 스키마 문서
- **[Database_Migration_Guide.md](../documents/Database_Migration_Guide.md)** - 마이그레이션 가이드

### ⚠️ 안전 수칙

1. **프로덕션 환경**: 삭제 스크립트 절대 사용 금지
2. **백업 필수**: 스크립트 실행 전 반드시 백업
3. **단계별 실행**: 권장 순서에 따라 단계별 실행
4. **테스트 우선**: 개발 환경에서 충분히 테스트 후 적용

---

> **📝 참고**: 이 스크립트들은 실제 운영 환경에서 검증된 안정적인 파일들입니다. 안전한 사용을 위해 documents 폴더의 상세 가이드를 반드시 참조하시기 바랍니다.