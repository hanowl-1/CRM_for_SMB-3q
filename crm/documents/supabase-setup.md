# Supabase 설정 가이드

## 1. Supabase 프로젝트 생성

### 1.1 Supabase 계정 생성
1. [Supabase](https://supabase.com) 접속
2. "Start your project" 클릭
3. GitHub/Google 계정으로 로그인

### 1.2 새 프로젝트 생성
1. "New Project" 클릭
2. 프로젝트 정보 입력:
   - **Name**: `supermembers-crm`
   - **Database Password**: 강력한 비밀번호 설정
   - **Region**: `Northeast Asia (Seoul)`
3. "Create new project" 클릭

## 2. 환경변수 설정

### 2.1 Supabase 프로젝트 정보 확인
프로젝트 생성 후 Settings > API에서 다음 정보 확인:

- **Project URL**: `https://your-project-id.supabase.co`
- **anon public key**: `eyJ...` (공개 키)
- **service_role key**: `eyJ...` (서비스 역할 키, 비공개)

### 2.2 .env.local 파일 업데이트
```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 3. 데이터베이스 스키마 생성

### 3.1 SQL Editor에서 마이그레이션 실행
Supabase 대시보드 > SQL Editor에서 `supabase_migration.sql` 파일 내용을 실행합니다.

### 3.2 주요 테이블 생성 확인
```sql
-- 테이블 목록 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 각 테이블의 레코드 수 확인
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY tablename, attname;
```

## 4. Row Level Security (RLS) 설정

### 4.1 기본 RLS 정책
```sql
-- 모든 테이블에 RLS 활성화
ALTER TABLE "Companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;

-- 기본 읽기 정책 (모든 사용자)
CREATE POLICY "Enable read access for all users" ON "Companies"
FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "Ads"
FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "Contracts"
FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "Users"
FOR SELECT USING (true);
```

### 4.2 인증된 사용자 정책
```sql
-- 인증된 사용자만 수정 가능
CREATE POLICY "Enable insert for authenticated users only" ON "Companies"
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON "Companies"
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON "Companies"
FOR DELETE USING (auth.role() = 'authenticated');
```

## 5. 데이터 마이그레이션

### 5.1 MySQL에서 Supabase로 데이터 이전

#### 방법 1: CSV 내보내기/가져오기
```sql
-- MySQL에서 CSV 내보내기
SELECT * FROM Companies 
INTO OUTFILE '/tmp/companies.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n';
```

#### 방법 2: API를 통한 데이터 이전
```javascript
// 데이터 마이그레이션 스크립트 예시
const mysql = require('mysql2/promise');
const { createClient } = require('@supabase/supabase-js');

async function migrateData() {
  // MySQL 연결
  const mysqlConnection = await mysql.createConnection({
    host: 'your-mysql-host',
    user: 'readonly',
    password: 'your-password',
    database: 'supermembers'
  });

  // Supabase 연결
  const supabase = createClient(
    'your-supabase-url',
    'your-service-role-key'
  );

  // 회사 데이터 마이그레이션
  const [companies] = await mysqlConnection.execute('SELECT * FROM Companies LIMIT 1000');
  
  const { data, error } = await supabase
    .from('Companies')
    .insert(companies);

  if (error) {
    console.error('마이그레이션 실패:', error);
  } else {
    console.log('마이그레이션 성공:', data.length, '개 레코드');
  }
}
```

## 6. API 테스트

### 6.1 연결 테스트
```bash
# 개발 서버 시작
npm run dev

# Supabase 연결 테스트
curl http://localhost:3001/api/supabase/test
```

### 6.2 예상 응답
```json
{
  "success": true,
  "message": "Supabase 연결 성공!",
  "data": {
    "connection": {
      "url": "https://your-project.supabase.co",
      "hasServiceKey": true
    },
    "statistics": {
      "totalCompanies": 0,
      "totalAds": 0,
      "totalContracts": 0,
      "totalUsers": 0,
      "totalInquiries": 0
    }
  }
}
```

## 7. 실시간 기능 설정

### 7.1 Realtime 활성화
```sql
-- 실시간 구독을 위한 테이블 설정
ALTER PUBLICATION supabase_realtime ADD TABLE "Companies";
ALTER PUBLICATION supabase_realtime ADD TABLE "Ads";
ALTER PUBLICATION supabase_realtime ADD TABLE "Contracts";
```

### 7.2 클라이언트에서 실시간 구독
```javascript
// 실시간 데이터 구독 예시
const subscription = supabase
  .channel('companies-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'Companies' },
    (payload) => {
      console.log('회사 데이터 변경:', payload);
    }
  )
  .subscribe();
```

## 8. 백업 및 복원

### 8.1 자동 백업 설정
Supabase는 자동으로 일일 백업을 수행합니다.
- Settings > Database > Backups에서 확인 가능

### 8.2 수동 백업
```bash
# pg_dump를 사용한 백업
pg_dump "postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres" > backup.sql
```

## 9. 모니터링 및 로그

### 9.1 대시보드 모니터링
- **Database**: 연결 수, 쿼리 성능
- **API**: 요청 수, 응답 시간
- **Auth**: 사용자 활동
- **Storage**: 파일 사용량

### 9.2 로그 확인
```sql
-- 느린 쿼리 확인
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## 10. 보안 설정

### 10.1 API 키 보안
- `anon` 키: 클라이언트에서 사용 (공개 가능)
- `service_role` 키: 서버에서만 사용 (비공개)

### 10.2 도메인 제한
Settings > API > URL Configuration에서 허용된 도메인 설정

### 10.3 Rate Limiting
```sql
-- 사용자별 요청 제한 설정
CREATE OR REPLACE FUNCTION rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- 분당 100회 제한 로직
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 11. 성능 최적화

### 11.1 인덱스 생성
```sql
-- 자주 조회되는 컬럼에 인덱스 생성
CREATE INDEX idx_companies_email ON "Companies"(email);
CREATE INDEX idx_companies_created_at ON "Companies"(createdAt);
CREATE INDEX idx_ads_company_id ON "Ads"(companyId);
```

### 11.2 쿼리 최적화
```javascript
// 효율적인 쿼리 작성
const { data } = await supabase
  .from('Companies')
  .select('id, name, email')  // 필요한 컬럼만 선택
  .eq('is_active', true)      // 인덱스가 있는 컬럼으로 필터링
  .order('createdAt', { ascending: false })
  .limit(20);                 // 페이지네이션
```

## 12. 문제 해결

### 12.1 연결 실패
- 환경변수 확인
- 프로젝트 URL 정확성 확인
- API 키 유효성 확인

### 12.2 권한 오류
- RLS 정책 확인
- 사용자 인증 상태 확인
- 테이블 권한 설정 확인

### 12.3 성능 이슈
- 쿼리 실행 계획 확인
- 인덱스 사용 여부 확인
- 연결 풀 설정 최적화

이 가이드를 따라하면 Supabase를 성공적으로 설정하고 MySQL 데이터를 마이그레이션할 수 있습니다. 