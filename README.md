# 📨 메시지 자동화 플랫폼 (CRM for SMB)

> **MySQL 기반 고객 데이터를 활용한 지능형 메시지 자동화 시스템**

[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js%2014-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

## 🎯 프로젝트 개요

기존 MySQL 데이터베이스의 고객 정보를 활용하여 **개인화된 메시지 자동화**를 제공하는 플랫폼입니다. 
복잡한 설정 없이 **6단계 가이드**를 통해 누구나 쉽게 워크플로우를 만들고 실행할 수 있습니다.

### ✨ 핵심 기능

- 🎯 **6단계 워크플로우 빌더** - 직관적인 가이드형 워크플로우 생성
- 📝 **통합 템플릿 관리** - 알림톡, SMS, LMS 템플릿 통합 관리
- 🗄️ **하이브리드 DB 연동** - MySQL (기존 데이터) + Supabase (플랫폼 데이터)
- 📨 **CoolSMS API 연동** - 다채널 메시지 발송 및 대체 발송
- 📊 **실시간 대시보드** - 워크플로우 모니터링 및 통계
- ⏰ **Vercel Cron 스케줄러** - 서버 재시작 내성, 완전 자동화

### 🚀 구현 현황

✅ **100% 완성된 기능들:**
- 워크플로우 빌더 시스템
- 메시지 템플릿 관리
- 데이터베이스 연동 (MySQL + Supabase)
- CoolSMS API 완전 연동
- 실시간 대시보드 및 모니터링
- Vercel Cron 스케줄러 (2분 간격)

## 💰 운영 비용 분석

### 📊 월간 비용 (일일 2,000건 발송 기준)

| 구분 | 서비스 | 비용 | 상태 |
|------|--------|------|------|
| **발송비** | CoolSMS 알림톡 | 900,000원 | 필수 |
| **인프라** | Vercel (Hobby) | 무료 | 현재 |
| **인프라** | Supabase (Free) | 무료 | 현재 |
| **스케줄러** | Vercel Cron | 무료 | 현재 |
| **총 비용** | - | **900,000원/월** | - |

### 💡 비용 절약 효과

```
기존 수동 발송 vs 자동화 시스템:
👤 기존 인건비: 1,800,000원/월
🤖 자동화 비용: 900,000원/월
💰 절약 효과: 900,000원/월 (50% 절약)
📊 연간 절약: 10,800,000원
```

### 📈 규모별 비용 가이드

- **소규모** (500건/일): 225,000원/월
- **중규모** (2,000건/일): 900,000원/월  
- **대규모** (10,000건/일): 3,900,000원/월 (할인 적용)

> 📋 **상세 비용 분석**: [documents/COST_ANALYSIS.md](./documents/COST_ANALYSIS.md) 참조

## 🏗️ 기술 스택

### Frontend
- **Next.js 14** (App Router) + **TypeScript**
- **shadcn/ui** + **Tailwind CSS**
- **Lucide React** (아이콘)

### Backend & Database
- **Supabase** (PostgreSQL) - 플랫폼 전용 데이터
- **MySQL** (기존 운영 DB) - 고객 데이터 읽기 전용
- **CoolSMS v4 API** - 메시지 발송

### Infrastructure
- **Vercel** (Frontend 호스팅)
- **Supabase** (Managed PostgreSQL)

## 🚀 빠른 시작

### 1. 저장소 클론
```bash
git clone https://github.com/your-username/CRM_for_SMB-3q.git
cd CRM_for_SMB-3q
```

### 2. 의존성 설치
```bash
pnpm install
```

### 3. 환경 변수 설정
```bash
cp .env.local.example .env.local
# .env.local 파일에서 다음 값들을 설정:
# - SUPABASE_URL, SUPABASE_ANON_KEY
# - MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
# - COOLSMS_API_KEY, COOLSMS_API_SECRET
```

### 4. 데이터베이스 설정
```bash
# Supabase 스키마 생성
psql -h your-supabase-host -d postgres -f database_scripts/supabase_hybrid_schema.sql

# RLS 정책 설정
psql -h your-supabase-host -d postgres -f database_scripts/supabase_rls_fix.sql
```

### 5. 개발 서버 실행
```bash
pnpm dev
```

## 📚 문서

### 📖 상세 가이드
- **[전체 문서 가이드](./documents/README.md)** - 모든 문서의 색인
- **[메인 PRD](./documents/PRD.md)** - 프로젝트 전체 개요

### 🔧 기능별 상세 문서
- **[워크플로우 빌더](./documents/Feature_Workflow_Builder.md)** - 6단계 가이드 시스템
- **[템플릿 관리](./documents/Feature_Template_Management.md)** - 메시지 템플릿 라이브러리
- **[데이터베이스 연동](./documents/Feature_Database_Integration.md)** - MySQL + Supabase 하이브리드
- **[메시지 발송](./documents/Feature_Message_Sending.md)** - CoolSMS API 연동
- **[대시보드](./documents/Feature_Dashboard_Analytics.md)** - 실시간 모니터링

### 🔧 데이터베이스 관련
- **[데이터베이스 스키마](./documents/Database_Schema.md)** - 완전한 스키마 문서
- **[설정 스크립트](./documents/Database_Setup_Scripts.md)** - SQL 스크립트 가이드
- **[마이그레이션 가이드](./documents/Database_Migration_Guide.md)** - 단계별 전환 절차

### 📊 운영 및 비용 관리
- **[비용 분석](./documents/COST_ANALYSIS.md)** - 상세 비용 계산 및 최적화 전략
- **[확장성 가이드](./documents/SCALING_GUIDE.md)** - 대규모 운영을 위한 시스템 확장

## 📁 프로젝트 구조

```
📁 프로젝트 루트/
├── 📁 app/                    # Next.js 앱 (페이지, API 라우트)
├── 📁 components/             # 재사용 가능한 UI 컴포넌트
├── 📁 lib/                    # 유틸리티, 서비스, 타입 정의
├── 📁 documents/              # 📚 상세 문서 및 PRD
├── 📁 database_scripts/       # 🗄️ SQL 스크립트 모음
├── 📁 legacy_docs/           # 📜 이전 버전 문서 보관
├── 📁 data/                   # 설정 파일 (JSON)
├── 📁 scripts/               # 개발용 스크립트
└── 📁 public/                # 정적 리소스
```

## 🔒 보안 및 규정 준수

- ✅ **읽기 전용 MySQL 연결** - 기존 데이터 안전 보장
- ✅ **RLS 정책 적용** - Supabase Row Level Security
- ✅ **환경변수 기반 키 관리** - 민감 정보 보호
- ✅ **입력 검증** - SQL 인젝션 방지
- ✅ **전화번호 마스킹** - 개인정보 보호

## 📊 주요 특징

### 🎯 사용자 친화적
- **6단계 가이드**: 복잡한 설정 없이 직관적 워크플로우 생성
- **실시간 검증**: 각 단계에서 즉시 데이터 확인 및 테스트
- **통합 관리**: 모든 기능이 하나의 플랫폼에서 관리

### 🔧 기술적 우수성
- **하이브리드 DB**: 기존 MySQL 데이터 활용 + 새로운 기능 확장
- **안전한 연동**: 읽기 전용 연결로 기존 시스템 영향 없음
- **확장 가능**: 모듈식 구조로 새로운 기능 추가 용이

### 📈 비즈니스 가치
- **효율성 증대**: 수동 작업을 자동화로 전환
- **개인화**: 고객별 맞춤 메시지 발송
- **비용 절감**: 통합 플랫폼으로 운영 비용 최적화

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📞 지원

- 📖 **문서**: [documents/](./documents/) 폴더의 상세 가이드 참조
- 🐛 **버그 리포트**: GitHub Issues를 통해 제보
- 💡 **기능 제안**: GitHub Discussions에서 논의

---

> **📝 참고**: 이 프로젝트는 실제 운영 환경에서 검증된 안정적인 시스템입니다. 상세한 사용법은 [documents/](./documents/) 폴더의 문서들을 참조하시기 바랍니다.# Emergency deployment trigger Wed Jun 25 21:12:46 KST 2025
