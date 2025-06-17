# 🧹 Supabase 테이블 정리 및 하이브리드 시스템 설정 가이드

## 📋 **개요**
기존 MySQL 마이그레이션 테이블들을 정리하고 새로운 하이브리드 CRM 시스템을 설정하는 완전한 가이드입니다.

## ⚠️ **주의사항**
- **데이터 백업**: 중요한 데이터가 있다면 반드시 먼저 백업하세요
- **단계별 실행**: 명령어를 한 번에 모두 실행하지 말고 단계별로 실행하세요
- **확인 후 진행**: 각 단계 후 결과를 확인하고 다음 단계로 진행하세요

## 🗑️ **1단계: 기존 테이블 정리**

### 방법 1: 빠른 정리 (권장)
`quick_drop_tables.sql` 파일의 명령어를 **단계별로** 실행하세요.

```sql
-- 1단계: 기존 하이브리드 시스템 테이블 삭제
DROP TABLE IF EXISTS workflow_runs CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
-- ... 나머지 명령어들
```

### 방법 2: 완전한 정리
`drop_existing_tables.sql` 파일을 사용하여 모든 관련 테이블, 시퀀스, 뷰, 함수를 삭제합니다.

## 🏗️ **2단계: 새로운 하이브리드 시스템 설정**

### 빠른 설정
`supabase_quick_setup.sql` 파일의 명령어를 **단계별로** 실행하세요.

```sql
-- 1단계: 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2단계: 워크플로우 테이블 생성
CREATE TABLE workflows (
  -- 테이블 정의
);
-- ... 나머지 단계들
```

### 완전한 설정 (고급 기능 포함)
`supabase_hybrid_schema.sql` 파일을 사용하여 모든 기능을 포함한 완전한 시스템을 설정합니다.

## 📊 **3단계: 설정 확인**

### 테이블 생성 확인
```sql
-- 생성된 테이블 목록 확인
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

### 기본 데이터 확인
```sql
-- 시스템 설정 확인
SELECT * FROM system_settings;

-- 기본 템플릿 확인
SELECT name, category, message_type FROM message_templates;
```

## 🔄 **4단계: 시스템 연동 테스트**

### API 연결 테스트
1. Next.js 개발 서버 실행: `npm run dev`
2. 대시보드 페이지 접속: `http://localhost:3002/admin/dashboard`
3. 데이터 로드 확인

### 기능 테스트
1. **테이블 매핑**: `/admin/table-mappings`
2. **커스텀 쿼리**: `/admin/custom-queries`
3. **시스템 대시보드**: `/admin/dashboard`

## 📁 **파일 구조**

```
프로젝트 루트/
├── supabase_hybrid_schema.sql      # 완전한 스키마 (고급)
├── supabase_quick_setup.sql        # 빠른 설정 (권장)
├── drop_existing_tables.sql        # 완전한 테이블 삭제
├── quick_drop_tables.sql           # 단계별 테이블 삭제 (권장)
├── SUPABASE_SETUP_GUIDE.md         # 설정 가이드
└── CLEANUP_GUIDE.md                # 이 파일
```

## 🎯 **권장 실행 순서**

### 1️⃣ 기존 테이블 정리
```bash
# Supabase SQL Editor에서 실행
# quick_drop_tables.sql의 1단계부터 12단계까지 순서대로 실행
```

### 2️⃣ 새로운 시스템 설정
```bash
# Supabase SQL Editor에서 실행
# supabase_quick_setup.sql의 1단계부터 12단계까지 순서대로 실행
```

### 3️⃣ 연동 테스트
```bash
# 터미널에서 실행
npm run dev
# 브라우저에서 http://localhost:3002/admin/dashboard 접속
```

## 🔧 **문제 해결**

### 테이블 삭제 오류
```sql
-- 외래키 제약조건으로 인한 오류 시
DROP TABLE table_name CASCADE;
```

### 권한 오류
```sql
-- RLS 정책 확인
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

### 시퀀스 오류
```sql
-- 시퀀스 재설정
SELECT setval('table_name_id_seq', (SELECT MAX(id) FROM table_name));
```

## 📈 **새로운 하이브리드 시스템 구조**

### 🔵 **MySQL (읽기 전용)**
- 123개 기존 비즈니스 테이블
- 테이블 매핑 시스템
- 커스텀 쿼리 시스템
- 실시간 데이터 검색

### 🟢 **Supabase (쓰기/기록)**
- `workflows` - 워크플로우 관리
- `message_templates` - 템플릿 시스템
- `message_logs` - 발송 기록
- `daily_statistics` - 통계 데이터
- `system_settings` - 시스템 설정

## ✅ **완료 체크리스트**

- [ ] 기존 테이블 백업 완료
- [ ] 기존 테이블 삭제 완료
- [ ] 새로운 하이브리드 테이블 생성 완료
- [ ] 기본 데이터 삽입 완료
- [ ] API 연결 테스트 완료
- [ ] 대시보드 접속 확인 완료
- [ ] 테이블 매핑 기능 테스트 완료
- [ ] 커스텀 쿼리 기능 테스트 완료

## 🆘 **지원**

문제가 발생하면:
1. **Supabase 로그** 확인
2. **브라우저 개발자 도구** 콘솔 확인
3. **Next.js 서버 로그** 확인
4. **네트워크 탭**에서 API 요청/응답 확인

---

## 💡 **팁**

- **점진적 마이그레이션**: 한 번에 모든 것을 변경하지 말고 단계별로 진행
- **테스트 환경**: 프로덕션 환경에 적용하기 전에 개발 환경에서 충분히 테스트
- **모니터링**: 시스템 변경 후 성능과 안정성을 지속적으로 모니터링
- **문서화**: 변경 사항과 설정을 문서화하여 팀과 공유 