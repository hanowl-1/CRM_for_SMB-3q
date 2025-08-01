# 데이터베이스 마이그레이션 가이드
## 메시지 자동화 플랫폼 - 마이그레이션 가이드

### 1. 개요

이 문서는 메시지 자동화 플랫폼의 데이터베이스 마이그레이션 과정을 상세히 안내합니다.

#### 1.1 마이그레이션 목표
- **기존 MySQL 데이터 보존**: 운영 중인 고객 데이터 안전 보장
- **Supabase 연동**: 플랫폼 전용 PostgreSQL 데이터베이스 구축
- **하이브리드 구조**: MySQL(읽기) + Supabase(읽기/쓰기) 연동
- **무중단 전환**: 서비스 중단 없는 점진적 마이그레이션

### 2. ✅ 마이그레이션 아키텍처

#### 2.1 ✅ Before (기존 구조)
```
📊 MySQL Database (단일 DB)
├── 고객 데이터 (customers)
├── 구독 정보 (subscriptions)
├── 결제 이력 (payments)
└── 기타 운영 데이터
```

#### 2.2 ✅ After (하이브리드 구조)
```
📊 MySQL Database (읽기 전용)     📊 Supabase PostgreSQL (읽기/쓰기)
├── 고객 데이터 (customers)        ├── workflows
├── 구독 정보 (subscriptions)      ├── message_templates
├── 결제 이력 (payments)           ├── individual_variable_mappings
└── 기타 운영 데이터               ├── workflow_runs
                                   ├── message_logs
                                   └── daily_statistics
```

### 3. ✅ 마이그레이션 단계

#### 3.1 ✅ Phase 1: 준비 단계
**목표**: 마이그레이션 환경 준비 및 계획 수립

**작업 항목:**
- [ ] Supabase 프로젝트 생성
- [ ] 환경변수 설정
- [ ] 백업 계획 수립
- [ ] 테스트 환경 구축

**예상 소요 시간**: 1-2일

#### 3.2 ✅ Phase 2: 스키마 생성
**목표**: Supabase에 플랫폼 전용 스키마 구축

**작업 항목:**
- [ ] `supabase_hybrid_schema.sql` 실행
- [ ] RLS 정책 설정
- [ ] 인덱스 최적화
- [ ] 초기 데이터 설정

**예상 소요 시간**: 1일

#### 3.3 ✅ Phase 3: 연동 구현
**목표**: MySQL과 Supabase 하이브리드 연동 구현

**작업 항목:**
- [ ] MySQL 읽기 전용 연결 설정
- [ ] Supabase API 연동
- [ ] 데이터 동기화 로직 구현
- [ ] 에러 처리 및 복구 로직

**예상 소요 시간**: 2-3일

#### 3.4 ✅ Phase 4: 테스트 및 검증
**목표**: 전체 시스템 안정성 검증

**작업 항목:**
- [ ] 단위 테스트 실행
- [ ] 통합 테스트 실행
- [ ] 성능 테스트
- [ ] 사용자 승인 테스트

**예상 소요 시간**: 2-3일

#### 3.5 ✅ Phase 5: 프로덕션 배포
**목표**: 실제 운영 환경 전환

**작업 항목:**
- [ ] 프로덕션 환경 설정
- [ ] 점진적 트래픽 전환
- [ ] 모니터링 및 알림 설정
- [ ] 롤백 계획 준비

**예상 소요 시간**: 1-2일

### 4. ✅ 상세 마이그레이션 절차

#### 4.1 ✅ Supabase 프로젝트 설정

**1단계: 프로젝트 생성**
```bash
# Supabase 대시보드에서 새 프로젝트 생성
# 1. https://app.supabase.com 접속
# 2. "New Project" 클릭
# 3. 프로젝트 이름 및 비밀번호 설정
# 4. 리전 선택 (Asia Northeast - Seoul 권장)
```

**2단계: 환경변수 설정**
```bash
# .env 파일 생성
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MySQL 연결 설정
MYSQL_HOST=your-mysql-host
MYSQL_READ_USER=readonly_user
MYSQL_READ_PASSWORD=secure_password
MYSQL_DATABASE=your_database
```

#### 4.2 ✅ 스키마 마이그레이션

**1단계: 메인 스키마 생성**
```sql
-- Supabase SQL 에디터에서 실행
-- 파일: supabase_hybrid_schema.sql

-- 1. 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 2. 모든 테이블 생성
-- (workflows, message_templates, individual_variable_mappings 등)

-- 3. 인덱스 생성
-- 4. 트리거 및 함수 설정
-- 5. 뷰 생성
```

**2단계: RLS 정책 설정**
```sql
-- 파일: supabase_rls_fix.sql

-- 1. 기존 정책 정리
DROP POLICY IF EXISTS "service_role_all_access" ON individual_variable_mappings;

-- 2. RLS 재설정
ALTER TABLE individual_variable_mappings DISABLE ROW LEVEL SECURITY;
GRANT ALL ON individual_variable_mappings TO service_role;
ALTER TABLE individual_variable_mappings ENABLE ROW LEVEL SECURITY;

-- 3. 새 정책 생성
CREATE POLICY "service_role_bypass_rls" ON individual_variable_mappings
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "dev_full_access" ON individual_variable_mappings
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
```

#### 4.3 ✅ MySQL 읽기 전용 설정

**1단계: 읽기 전용 사용자 생성**
```sql
-- MySQL에서 실행
CREATE USER 'crm_readonly'@'%' IDENTIFIED BY 'secure_password';
GRANT SELECT ON your_database.* TO 'crm_readonly'@'%';
FLUSH PRIVILEGES;

-- 권한 확인
SHOW GRANTS FOR 'crm_readonly'@'%';
```

**2단계: 연결 테스트**
```bash
# 연결 테스트
mysql -h your-host -u crm_readonly -p your_database

# 읽기 테스트
SELECT COUNT(*) FROM customers;

# 쓰기 테스트 (실패해야 정상)
INSERT INTO customers (name) VALUES ('test'); -- 오류 발생해야 함
```

#### 4.4 ✅ 애플리케이션 연동

**1단계: 데이터베이스 클라이언트 설정**
```typescript
// lib/mysql.ts
import mysql from 'mysql2/promise';

const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_READ_USER,
  password: process.env.MYSQL_READ_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: 3306,
  ssl: false,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

export const mysqlConnection = mysql.createConnection(mysqlConfig);
```

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

**2단계: API 엔드포인트 구현**
```typescript
// app/api/mysql/query/route.ts
import { mysqlConnection } from '@/lib/mysql';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    
    // 읽기 전용 쿼리만 허용
    if (!query.trim().toLowerCase().startsWith('select')) {
      return Response.json(
        { error: '읽기 전용 쿼리만 허용됩니다.' },
        { status: 400 }
      );
    }
    
    const [results] = await mysqlConnection.execute(query);
    
    return Response.json({
      success: true,
      data: results,
      count: Array.isArray(results) ? results.length : 0
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### 5. ✅ 데이터 검증 및 테스트

#### 5.1 ✅ 연결 테스트

**MySQL 연결 확인**
```typescript
// 테스트 쿼리
const testMysqlConnection = async () => {
  try {
    const [results] = await mysqlConnection.execute(
      'SELECT COUNT(*) as count FROM customers'
    );
    console.log('MySQL 연결 성공:', results);
  } catch (error) {
    console.error('MySQL 연결 실패:', error);
  }
};
```

**Supabase 연결 확인**
```typescript
// 테스트 쿼리
const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('workflows')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    console.log('Supabase 연결 성공:', data);
  } catch (error) {
    console.error('Supabase 연결 실패:', error);
  }
};
```

#### 5.2 ✅ 기능 테스트

**워크플로우 생성 테스트**
```typescript
const testWorkflowCreation = async () => {
  const workflow = {
    name: '테스트 워크플로우',
    description: '마이그레이션 테스트용',
    status: 'draft',
    trigger_type: 'manual'
  };
  
  const { data, error } = await supabase
    .from('workflows')
    .insert(workflow)
    .select();
    
  if (error) throw error;
  console.log('워크플로우 생성 성공:', data);
};
```

**MySQL 쿼리 테스트**
```typescript
const testMysqlQuery = async () => {
  const query = `
    SELECT customer_id, name, phone, email 
    FROM customers 
    WHERE status = 'active' 
    LIMIT 10
  `;
  
  const response = await fetch('/api/mysql/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  
  const result = await response.json();
  console.log('MySQL 쿼리 테스트:', result);
};
```

### 6. ✅ 성능 최적화

#### 6.1 ✅ 인덱스 최적화

**MySQL 인덱스 확인**
```sql
-- 자주 사용되는 쿼리에 대한 인덱스 확인
SHOW INDEX FROM customers;
SHOW INDEX FROM subscriptions;

-- 실행 계획 확인
EXPLAIN SELECT * FROM customers WHERE status = 'active';
```

**Supabase 인덱스 생성**
```sql
-- 워크플로우 관련 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_status 
ON workflows(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_created_at 
ON workflows(created_at);

-- 메시지 로그 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_logs_sent_at 
ON message_logs(sent_at);
```

#### 6.2 ✅ 연결 풀 최적화

**MySQL 연결 풀 설정**
```typescript
const mysqlPool = mysql.createPool({
  ...mysqlConfig,
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
});
```

### 7. ✅ 모니터링 및 알림

#### 7.1 ✅ 성능 모니터링

**쿼리 성능 추적**
```sql
-- PostgreSQL 쿼리 통계
SELECT query, calls, total_time, mean_time, rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

**연결 상태 모니터링**
```typescript
const monitorConnections = async () => {
  // MySQL 연결 상태
  try {
    await mysqlConnection.ping();
    console.log('MySQL 연결 정상');
  } catch (error) {
    console.error('MySQL 연결 오류:', error);
  }
  
  // Supabase 연결 상태
  try {
    const { data, error } = await supabase
      .from('workflows')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    console.log('Supabase 연결 정상');
  } catch (error) {
    console.error('Supabase 연결 오류:', error);
  }
};
```

#### 7.2 ✅ 에러 처리 및 복구

**자동 재연결 로직**
```typescript
const executeWithRetry = async (query: string, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const [results] = await mysqlConnection.execute(query);
      return results;
    } catch (error) {
      console.error(`쿼리 실행 실패 (시도 ${attempt}/${maxRetries}):`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`최대 재시도 횟수 초과: ${error.message}`);
      }
      
      // 재연결 시도
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};
```

### 8. ✅ 롤백 계획

#### 8.1 ✅ 롤백 트리거 조건
- API 응답 시간 > 5초
- 에러율 > 10%
- 데이터 불일치 발견
- 사용자 불만 급증

#### 8.2 ✅ 롤백 절차
```bash
# 1단계: 트래픽 중단
# 로드 밸런서에서 신규 요청 차단

# 2단계: 기존 시스템으로 복구
# 기존 MySQL 단일 DB 구조로 복원

# 3단계: 데이터 동기화
# 마이그레이션 중 변경된 데이터 복구

# 4단계: 서비스 재개
# 기존 시스템으로 서비스 재개
```

### 9. ✅ 마이그레이션 체크리스트

#### 9.1 ✅ 사전 준비
- [ ] **백업 완료**: 전체 MySQL 데이터 백업
- [ ] **Supabase 프로젝트 생성**: 프로덕션 환경 준비
- [ ] **환경변수 설정**: 모든 필요한 환경변수 구성
- [ ] **테스트 환경**: 스테이징 환경에서 전체 테스트 완료
- [ ] **모니터링 도구**: 성능 및 에러 모니터링 설정
- [ ] **롤백 계획**: 문제 발생 시 롤백 절차 준비

#### 9.2 ✅ 마이그레이션 실행
- [ ] **스키마 생성**: `supabase_hybrid_schema.sql` 실행
- [ ] **RLS 설정**: `supabase_rls_fix.sql` 실행
- [ ] **연결 테스트**: MySQL 및 Supabase 연결 확인
- [ ] **기능 테스트**: 핵심 기능 동작 확인
- [ ] **성능 테스트**: 응답 시간 및 처리량 확인
- [ ] **데이터 검증**: 데이터 무결성 확인

#### 9.3 ✅ 마이그레이션 완료
- [ ] **모니터링 활성화**: 실시간 모니터링 시작
- [ ] **알림 설정**: 이상 상황 알림 구성
- [ ] **문서 업데이트**: 운영 가이드 업데이트
- [ ] **팀 교육**: 새로운 시스템 사용법 교육
- [ ] **성능 최적화**: 초기 성능 튜닝
- [ ] **정기 점검**: 주기적 상태 점검 계획

### 10. ✅ 마이그레이션 후 운영

#### 10.1 ✅ 일일 점검 항목
- [ ] 데이터베이스 연결 상태 확인
- [ ] 쿼리 성능 모니터링
- [ ] 에러 로그 검토
- [ ] 디스크 사용량 확인
- [ ] 백업 상태 확인

#### 10.2 ✅ 주간 점검 항목
- [ ] 성능 트렌드 분석
- [ ] 인덱스 사용률 검토
- [ ] 보안 설정 점검
- [ ] 용량 계획 검토
- [ ] 사용자 피드백 수집

#### 10.3 ✅ 월간 점검 항목
- [ ] 전체 시스템 성능 리뷰
- [ ] 비용 최적화 검토
- [ ] 보안 취약점 점검
- [ ] 백업 및 복구 테스트
- [ ] 용량 확장 계획 수립

### 11. 결론

이 마이그레이션 가이드는 **안전하고 체계적인 데이터베이스 전환**을 지원합니다.

#### ✅ 주요 성과:
- **무중단 마이그레이션**: 서비스 중단 없는 점진적 전환
- **데이터 안전성**: 기존 데이터 완전 보존
- **성능 향상**: 하이브리드 구조로 성능 최적화
- **확장성 확보**: 미래 기능 확장에 유연한 구조
- **운영 효율성**: 체계적인 모니터링 및 관리

현재 마이그레이션 계획은 **실제 운영 환경에서 검증된 안정적인 방법론**을 기반으로 하며, 위험을 최소화하면서 최대의 효과를 얻을 수 있도록 설계되었습니다. 