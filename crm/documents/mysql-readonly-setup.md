# MySQL Readonly 계정 연동 가이드

## 1. 사전 준비사항

### 필요한 정보
- **호스트**: `supermembers-prod.cluster-cy8cnze5wxti.ap-northeast-2.rds.amazonaws.com`
- **포트**: `3306`
- **데이터베이스**: `supermembers`
- **사용자명**: `readonly_user` (실제 계정명으로 변경)
- **비밀번호**: (별도 제공)

### 필요한 패키지 설치
```bash
npm install mysql2
```

## 2. 환경변수 설정

`.env.local` 파일에 다음 내용 추가:
```env
# MySQL Readonly 연결 설정
MYSQL_READONLY_HOST=supermembers-prod.cluster-cy8cnze5wxti.ap-northeast-2.rds.amazonaws.com
MYSQL_READONLY_PORT=3306
MYSQL_READONLY_USER=readyonly
MYSQL_READONLY_PASSWORD=phozphoz1!
MYSQL_READONLY_DATABASE=supermembers
```

## 3. 터미널에서 직접 로그인

### MySQL 클라이언트 설치 (macOS)
```bash
# Homebrew 설치 (없는 경우)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# MySQL 클라이언트 설치
brew install mysql
```

### 로그인 명령어
```bash
# 기본 로그인
mysql -h supermembers-prod.cluster-cy8cnze5wxti.ap-northeast-2.rds.amazonaws.com -P 3306 -u readonly_user -p supermembers

# SSL 연결 (필요한 경우)
mysql -h supermembers-prod.cluster-cy8cnze5wxti.ap-northeast-2.rds.amazonaws.com -P 3306 -u readonly_user -p supermembers --ssl-mode=REQUIRED
```

### 기본 쿼리 테스트
```sql
-- 연결 테스트
SELECT 1;

-- 현재 사용자 확인
SELECT USER();

-- 데이터베이스 버전 확인
SELECT VERSION();

-- 테이블 목록 조회
SHOW TABLES;

-- 회사 수 확인
SELECT COUNT(*) FROM Companies;
```

## 4. Node.js 연동 방법

### 연결 설정 파일 (`lib/database/mysql-connection.js`)
```javascript
const mysql = require('mysql2/promise');

const mysqlConfig = {
  host: process.env.MYSQL_READONLY_HOST,
  port: parseInt(process.env.MYSQL_READONLY_PORT),
  user: process.env.MYSQL_READONLY_USER,
  password: process.env.MYSQL_READONLY_PASSWORD,
  database: process.env.MYSQL_READONLY_DATABASE,
  charset: 'utf8mb4',
  timezone: '+09:00',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
};

const pool = mysql.createPool(mysqlConfig);

async function executeQuery(sql, params = []) {
  try {
    const [rows, fields] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('쿼리 실행 실패:', error);
    throw error;
  }
}

module.exports = { pool, executeQuery };
```

### 사용 예시
```javascript
const { executeQuery } = require('./lib/database/mysql-connection');

// 회사 목록 조회
async function getCompanies() {
  const sql = 'SELECT * FROM Companies LIMIT 10';
  const companies = await executeQuery(sql);
  return companies;
}

// 특정 회사 조회
async function getCompanyById(id) {
  const sql = 'SELECT * FROM Companies WHERE id = ?';
  const result = await executeQuery(sql, [id]);
  return result[0];
}
```

## 5. Next.js API 라우트 예시

### `/app/api/mysql/test/route.js`
```javascript
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database/mysql-connection';

export async function GET() {
  try {
    const result = await executeQuery('SELECT COUNT(*) as count FROM Companies');
    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'MySQL 연결 성공'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'MySQL 연결 실패', details: error.message },
      { status: 500 }
    );
  }
}
```

## 6. 보안 고려사항

### 1. 환경변수 보안
- `.env.local` 파일을 `.gitignore`에 추가
- 프로덕션에서는 환경변수 관리 서비스 사용

### 2. 연결 제한
- Readonly 계정은 SELECT 권한만 가짐
- 연결 풀 크기 제한으로 리소스 관리
- 타임아웃 설정으로 장시간 연결 방지

### 3. 쿼리 최적화
- LIMIT 절 사용으로 대량 데이터 조회 방지
- 인덱스가 있는 컬럼으로 WHERE 조건 설정
- 페이지네이션 구현

## 7. 문제 해결

### 연결 실패 시
1. **네트워크 연결 확인**
   ```bash
   ping supermembers-prod.cluster-cy8cnze5wxti.ap-northeast-2.rds.amazonaws.com
   ```

2. **포트 접근 확인**
   ```bash
   telnet supermembers-prod.cluster-cy8cnze5wxti.ap-northeast-2.rds.amazonaws.com 3306
   ```

3. **SSL 인증서 문제**
   - `ssl: { rejectUnauthorized: false }` 옵션 추가

### 권한 오류 시
- Readonly 계정 권한 확인
- SELECT 권한만 있는지 확인
- 특정 테이블 접근 권한 확인

### 성능 이슈 시
- 연결 풀 크기 조정
- 쿼리 최적화
- 인덱스 활용 확인

## 8. 유용한 쿼리 모음

### 기본 통계
```sql
-- 전체 테이블별 레코드 수
SELECT 
  TABLE_NAME,
  TABLE_ROWS
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'supermembers'
ORDER BY TABLE_ROWS DESC;

-- 최근 가입한 회사 10개
SELECT name, email, createdAt 
FROM Companies 
ORDER BY createdAt DESC 
LIMIT 10;

-- 월별 가입 통계
SELECT 
  DATE_FORMAT(createdAt, '%Y-%m') as month,
  COUNT(*) as count
FROM Companies 
GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
ORDER BY month DESC;
```

### 데이터 품질 확인
```sql
-- NULL 값이 많은 컬럼 확인
SELECT 
  COUNT(*) as total,
  COUNT(name) as name_count,
  COUNT(email) as email_count,
  COUNT(charger) as charger_count
FROM Companies;

-- 중복 이메일 확인
SELECT email, COUNT(*) as count
FROM Companies 
GROUP BY email 
HAVING COUNT(*) > 1;
```

## 9. 모니터링 및 로깅

### 연결 상태 모니터링
```javascript
async function checkConnectionHealth() {
  try {
    const result = await executeQuery('SELECT 1 as health_check');
    console.log('MySQL 연결 상태: 정상');
    return true;
  } catch (error) {
    console.error('MySQL 연결 상태: 오류', error);
    return false;
  }
}

// 주기적 헬스체크 (5분마다)
setInterval(checkConnectionHealth, 5 * 60 * 1000);
```

### 쿼리 로깅
```javascript
async function executeQueryWithLogging(sql, params = []) {
  const startTime = Date.now();
  try {
    const result = await executeQuery(sql, params);
    const duration = Date.now() - startTime;
    console.log(`쿼리 실행 성공: ${duration}ms`, { sql, params });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`쿼리 실행 실패: ${duration}ms`, { sql, params, error });
    throw error;
  }
}
```

## 10. 데이터 내보내기

### CSV 내보내기 함수
```javascript
function convertToCSV(data) {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => 
        JSON.stringify(row[header] || '')
      ).join(',')
    )
  ].join('\n');
  
  return csvContent;
}

async function exportCompaniesToCSV() {
  const companies = await executeQuery('SELECT * FROM Companies LIMIT 1000');
  const csv = convertToCSV(companies);
  return csv;
}
```

이 가이드를 따라하면 MySQL readonly 계정에 안전하게 연결하고 데이터를 조회할 수 있습니다. 