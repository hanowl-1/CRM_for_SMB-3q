# Git 브랜치 네이밍 규칙

이 문서는 CRM for SMB 프로젝트의 Git 브랜치 생성 및 네이밍 규칙을 정의합니다.

## 기본 네이밍 규칙

브랜치 이름 작성 시 다음 규칙을 준수합니다:

1. **소문자 사용**: 브랜치 이름은 항상 소문자로 작성한다.
2. **하이픈(-) 사용**: 단어 사이는 하이픈으로 구분한다.
3. **간결성**: 브랜치 이름은 간결하면서도 의미를 명확히 전달해야 한다.
4. **영문 사용**: 가능한 영어로 작성하여 국제적인 협업에 대비한다.

예시: `feature-user-authentication`

## 브랜치 접두사

브랜치의 목적을 명확히 하기 위해 다음과 같은 접두사를 사용합니다:

### feature/
새로운 기능 개발
- 예: `feature/login-system`
- 예: `feature/kakao-template-sync`

### design/
디자인 변경
- 예: `design/landing-page-redesign`
- 예: `design/dashboard-ui-update`

### bugfix/
버그 수정
- 예: `bugfix/login-error`
- 예: `bugfix/scheduler-timezone-issue`

### hotfix/
긴급한 프로덕션 버그 수정
- 예: `hotfix/security-vulnerability`
- 예: `hotfix/critical-api-error`

### release/
새로운 제품 출시 준비
- 예: `release/v1.2.0`
- 예: `release/2024-q1`

### refactor/
코드 리팩토링
- 예: `refactor/improve-performance`
- 예: `refactor/database-query-optimization`

### docs/
문서 업데이트
- 예: `docs/api-guide`
- 예: `docs/installation-instructions`

### test/
테스트 관련 변경
- 예: `test/integration-tests`
- 예: `test/workflow-unit-tests`

### chore/
빌드 작업, 패키지 매니저 설정 등
- 예: `chore/update-dependencies`
- 예: `chore/eslint-configuration`

### style/
코드 스타일 변경 (포맷팅, 세미콜론 누락 등)
- 예: `style/lint-fixes`
- 예: `style/code-formatting`

### perf/
성능 개선
- 예: `perf/optimize-database-queries`
- 예: `perf/reduce-bundle-size`

## 브랜치 생성 및 관리

### 브랜치 생성 명령어
```bash
# 새 기능 개발
git checkout -b feature/new-feature-name

# 버그 수정
git checkout -b bugfix/issue-description

# 긴급 수정
git checkout -b hotfix/critical-fix
```

### 브랜치 수명 주기
1. **생성**: main 브랜치에서 분기
2. **개발**: 해당 브랜치에서 작업 진행
3. **PR 생성**: 작업 완료 후 Pull Request 생성
4. **리뷰**: 코드 리뷰 진행
5. **병합**: main 브랜치로 병합
6. **삭제**: 병합 후 브랜치 삭제

### 주의사항
- 브랜치 이름에 이슈 번호를 포함시킬 수 있음 (예: `feature/123-user-profile`)
- 개인 정보나 민감한 정보를 브랜치 이름에 포함시키지 않음
- 너무 긴 브랜치 이름은 피하고, 50자 이내로 작성
- 특수문자는 하이픈(-)과 슬래시(/)만 사용

## 예시

### 좋은 예시
- `feature/user-authentication`
- `bugfix/fix-login-redirect`
- `hotfix/patch-security-issue`
- `docs/update-readme`
- `refactor/cleanup-unused-code`

### 나쁜 예시
- `Feature_UserAuth` (대문자와 언더스코어 사용)
- `새기능` (한글 사용)
- `fix` (너무 모호함)
- `my-branch` (의미 불분명)
- `feature/this-is-a-very-long-branch-name-that-describes-everything-in-detail` (너무 김)

이러한 접두사를 사용함으로써, 브랜치의 목적을 한눈에 파악할 수 있고 프로젝트 관리가 더욱 체계적으로 이루어질 수 있습니다.