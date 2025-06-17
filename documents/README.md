# 📚 메시지 자동화 플랫폼 문서

이 폴더에는 메시지 자동화 플랫폼의 전체 기능 및 개발 현황에 대한 상세한 문서들이 포함되어 있습니다.

## 📋 문서 목록

### 📄 메인 PRD (Product Requirements Document)
- **[PRD.md](./PRD.md)** - 플랫폼 전체 개요 및 구현 현황

### 🔧 기능별 상세 PRD

#### 1. 🎯 [워크플로우 빌더](./Feature_Workflow_Builder.md)
- **기능**: 6단계 가이드형 워크플로우 생성 시스템
- **상태**: ✅ 완전 구현
- **핵심 가치**: 직관적인 단계별 가이드, 실시간 검증, 즉시 테스트

#### 2. 📝 [템플릿 관리](./Feature_Template_Management.md)
- **기능**: 메시지 템플릿 생성, 편집, 라이브러리 관리
- **상태**: ✅ 완전 구현
- **핵심 가치**: 통합 관리, 변수 기반 개인화, CoolSMS 연동

#### 3. 🗄️ [데이터베이스 연동](./Feature_Database_Integration.md)
- **기능**: MySQL + Supabase 하이브리드 DB 연동
- **상태**: ✅ 완전 구현
- **핵심 가치**: 안전한 분리, 실시간 연동, 확장성

#### 4. 📨 [메시지 발송](./Feature_Message_Sending.md)
- **기능**: CoolSMS API 통한 알림톡, SMS, LMS 발송
- **상태**: ✅ 완전 구현
- **핵심 가치**: 다채널 지원, 대체 발송, 안전한 테스트

#### 5. 📊 [대시보드 & 분석](./Feature_Dashboard_Analytics.md)
- **기능**: 통합 대시보드 및 실시간 모니터링
- **상태**: ✅ 완전 구현
- **핵심 가치**: 실시간 모니터링, 효율적 관리, 직관적 UI/UX

### 🗄️ 데이터베이스 관련 문서

#### 6. 📋 [데이터베이스 스키마](./Database_Schema.md)
- **내용**: 완전한 데이터베이스 스키마 문서
- **상태**: ✅ 완전 구현
- **포함 사항**: Supabase 스키마, MySQL 연동, 인덱스, 트리거, 뷰

#### 7. ⚙️ [데이터베이스 설정 스크립트](./Database_Setup_Scripts.md)
- **내용**: SQL 스크립트 모음 및 사용 가이드
- **상태**: ✅ 완전 구현
- **포함 사항**: 설치 스크립트, RLS 정책, 문제 해결 가이드

#### 8. 🔄 [데이터베이스 마이그레이션 가이드](./Database_Migration_Guide.md)
- **내용**: 단계별 마이그레이션 절차 및 체크리스트
- **상태**: ✅ 완전 구현
- **포함 사항**: 5단계 마이그레이션, 테스트 방법, 롤백 계획

## 🎯 프로젝트 현황

### ✅ 완전 구현된 기능 (100%)
1. **워크플로우 빌더** - 6단계 가이드 시스템
2. **템플릿 관리** - 생성, 편집, 라이브러리
3. **데이터베이스 연동** - MySQL + Supabase 하이브리드
4. **메시지 발송** - CoolSMS API 완전 연동
5. **대시보드** - 실시간 모니터링 및 관리
6. **데이터베이스 스키마** - 완전한 스키마 설계 및 구현
7. **마이그레이션 시스템** - 안전한 데이터 전환 체계

### 🔄 향후 개선 예정 (1-2개월)
- 성능 최적화
- 고급 분석 기능
- 사용자 경험 개선
- 추가 보안 강화

### ❌ 장기 계획 (3-6개월)
- AI 기반 기능
- 다중 업체 연동
- 고급 협업 도구
- 모바일 앱 개발

## 🏗️ 기술 스택

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Library**: shadcn/ui + Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React Hooks + Context API

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: 
  - MySQL (기존 운영 DB, 읽기 전용)
  - Supabase PostgreSQL (플랫폼 전용)
- **External APIs**: CoolSMS v4

### Infrastructure
- **Hosting**: Vercel (Frontend)
- **Database**: Supabase (Managed PostgreSQL)
- **External DB**: MySQL (기존 운영 서버)

## 📊 데이터베이스 아키텍처

### 하이브리드 DB 구조
```
📊 MySQL Database (읽기 전용)     📊 Supabase PostgreSQL (읽기/쓰기)
├── 고객 데이터 (customers)        ├── workflows
├── 구독 정보 (subscriptions)      ├── message_templates
├── 결제 이력 (payments)           ├── individual_variable_mappings
└── 기타 운영 데이터               ├── workflow_runs
                                   ├── message_logs
                                   └── daily_statistics
```

### 주요 테이블 (Supabase)
- **workflows**: 워크플로우 관리 (메인 테이블)
- **message_templates**: 메시지 템플릿 라이브러리
- **individual_variable_mappings**: 변수 매핑 시스템
- **workflow_runs**: 실행 기록 및 통계
- **message_logs**: 발송 로그 및 결과
- **daily_statistics**: 일간 통계 및 분석

## 📈 성공 지표

### 현재 달성 지표
- ✅ **기능 완성도**: 100% (모든 핵심 기능 구현)
- ✅ **데이터베이스 연동**: 100% (MySQL + Supabase)
- ✅ **API 연동**: 100% (CoolSMS 완전 연동)
- ✅ **사용자 인터페이스**: 100% (직관적 UI/UX)
- ✅ **데이터베이스 스키마**: 100% (완전한 스키마 설계)
- ✅ **마이그레이션 가이드**: 100% (체계적인 전환 절차)

### 목표 지표
- 🎯 **사용자 만족도**: 8.5/10 이상
- 🎯 **워크플로우 완성률**: 90% 이상
- 🎯 **메시지 발송 성공률**: 95% 이상
- 🎯 **시스템 가동률**: 99.9% 이상

## 🔒 보안 및 규정 준수

### 구현된 보안 기능
- ✅ **데이터베이스 보안**: 읽기 전용 MySQL 연결
- ✅ **API 보안**: 환경변수 기반 키 관리
- ✅ **입력 검증**: SQL 인젝션 방지
- ✅ **데이터 암호화**: Supabase 내장 암호화
- ✅ **RLS 정책**: Row Level Security 적용
- ✅ **권한 관리**: 역할 기반 접근 제어

### 개인정보 보호
- ✅ **전화번호 마스킹**: 민감 정보 보호
- ✅ **로그 관리**: 보관 기간 제한
- ✅ **접근 권한**: 역할 기반 접근 제어
- ✅ **데이터 백업**: 안전한 백업 및 복구

## 📁 스키마 파일 구조

### SQL 스크립트 파일
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

### 설정 순서 (권장)
1. **메인 스키마 생성**: `supabase_hybrid_schema.sql`
2. **RLS 정책 수정**: `supabase_rls_fix.sql`
3. **설정 확인**: 테이블 및 권한 검증

## 📞 지원 및 문의

### 개발팀 연락처
- **개발 책임자**: [담당자 정보]
- **기술 문의**: [기술 지원 채널]
- **버그 리포트**: [이슈 트래킹 시스템]

### 사용자 가이드
- 📖 **사용법**: 각 기능별 PRD 문서 참조
- 🛠️ **문제 해결**: 각 문서의 "문제 해결" 섹션 참조
- 💡 **팁**: "사용자 워크플로우" 섹션 참조
- 🗄️ **데이터베이스**: 스키마 및 마이그레이션 가이드 참조

## 📅 업데이트 이력

### 2024년 1월
- ✅ 전체 플랫폼 완성
- ✅ 모든 핵심 기능 구현
- ✅ 상세 PRD 문서 작성 완료
- ✅ 데이터베이스 스키마 문서 추가
- ✅ SQL 스크립트 정리 및 가이드 작성
- ✅ 마이그레이션 가이드 완성

---

> **📝 참고**: 이 문서들은 실제 구현된 기능을 기반으로 작성되었으며, 정기적으로 업데이트됩니다. 최신 정보는 각 기능별 PRD 문서를 참조하시기 바랍니다. 