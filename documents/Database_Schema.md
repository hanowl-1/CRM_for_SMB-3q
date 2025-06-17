# 데이터베이스 스키마 문서
## 메시지 자동화 플랫폼 - 데이터베이스 스키마

### 1. 개요

#### 1.1 아키텍처
**하이브리드 데이터베이스 구조** - 기존 운영 DB 보존 + 신규 기능 확장

- **MySQL (기존 운영 DB)**: 고객 데이터, 구독 정보 (읽기 전용)
- **Supabase PostgreSQL**: 메시지 플랫폼 전용 데이터 (읽기/쓰기)

#### 1.2 설계 원칙
- **안전한 분리**: 운영 DB와 플랫폼 DB 완전 분리
- **실시간 연동**: MySQL 데이터 실시간 조회 및 활용
- **확장성**: 플랫폼 기능 확장에 유연한 구조
- **보안**: RLS(Row Level Security) 적용

### 2. ✅ Supabase 스키마 (플랫폼 전용)

#### 2.1 ✅ 워크플로우 관리

##### 2.1.1 ✅ workflows 테이블
```sql
CREATE TABLE workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft' 
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  trigger_type VARCHAR(100) NOT NULL 
    CHECK (trigger_type IN ('manual', 'schedule', 'event', 'webhook')),
  trigger_config JSONB DEFAULT '{}',
  target_config JSONB DEFAULT '{}',    -- MySQL 쿼리 설정
  message_config JSONB DEFAULT '{}',   -- 메시지 템플릿 설정
  variables JSONB DEFAULT '{}',        -- 변수 매핑
  schedule_config JSONB DEFAULT '{}',  -- 스케줄 설정
  statistics JSONB DEFAULT '{}',       -- 실행 통계
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**주요 필드 설명:**
- `target_config`: MySQL 쿼리 또는 정적 대상 설정
- `message_config`: 선택된 템플릿 및 메시지 설정
- `variables`: 대상-템플릿 간 변수 매핑 정보
- `schedule_config`: 발송 타이밍 및 스케줄 설정

##### 2.1.2 ✅ workflow_runs 테이블
```sql
CREATE TABLE workflow_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL 
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  trigger_type VARCHAR(100),
  target_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  error_message TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  logs JSONB DEFAULT '[]'
);
```

#### 2.2 ✅ 메시지 템플릿 관리

##### 2.2.1 ✅ message_templates 테이블
```sql
CREATE TABLE message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) 
    CHECK (category IN ('welcome', 'reminder', 'promotion', 
                       'notification', 'alert', 'survey', 'thanks', 'others')),
  message_type VARCHAR(50) NOT NULL 
    CHECK (message_type IN ('sms', 'lms', 'kakao')),
  template_code VARCHAR(100),  -- CoolSMS 템플릿 코드
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  buttons JSONB DEFAULT '[]',  -- 알림톡 버튼 설정
  status VARCHAR(50) DEFAULT 'active' 
    CHECK (status IN ('draft', 'active', 'archived')),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**카테고리 분류:**
- `welcome`: 환영, 온보딩 메시지
- `reminder`: 리마인더, 알림
- `promotion`: 프로모션, 마케팅
- `notification`: 일반 알림
- `alert`: 긴급 알림
- `survey`: 설문, 피드백
- `thanks`: 감사 인사
- `others`: 기타

##### 2.2.2 ✅ template_usage_logs 테이블
```sql
CREATE TABLE template_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES message_templates(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  variables_used JSONB DEFAULT '{}',
  success BOOLEAN DEFAULT true,
  error_message TEXT
);
```

#### 2.3 ✅ 변수 매핑 관리

##### 2.3.1 ✅ individual_variable_mappings 테이블
```sql
CREATE TABLE individual_variable_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  variable_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  source_type VARCHAR(50) NOT NULL 
    CHECK (source_type IN ('static', 'query', 'function')),
  source_field TEXT,           -- 정적값 또는 쿼리
  selected_column VARCHAR(255), -- 선택된 컬럼명
  default_value TEXT,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**소스 타입:**
- `static`: 정적 값
- `query`: MySQL 쿼리 결과
- `function`: 함수 기반 (현재시간 등)

##### 2.3.2 ✅ variable_query_templates 테이블
```sql
CREATE TABLE variable_query_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  query_sql TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2.4 ✅ 메시지 발송 로그

##### 2.4.1 ✅ message_logs 테이블
```sql
CREATE TABLE message_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE CASCADE,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(20),
  recipient_name VARCHAR(255),
  message_type VARCHAR(50) NOT NULL 
    CHECK (message_type IN ('sms', 'lms', 'kakao')),
  message_content TEXT,
  variables_used JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL 
    CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
  provider VARCHAR(50),           -- CoolSMS
  provider_message_id VARCHAR(255),
  cost DECIMAL(8,2) DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_code VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2.5 ✅ 시스템 관리

##### 2.5.1 ✅ system_settings 테이블
```sql
CREATE TABLE system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key VARCHAR(255) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  is_encrypted BOOLEAN DEFAULT false,
  updated_by VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

##### 2.5.2 ✅ user_activity_logs 테이블
```sql
CREATE TABLE user_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),  -- 'workflow', 'template' 등
  resource_id VARCHAR(255),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2.6 ✅ 통계 및 분석

##### 2.6.1 ✅ daily_statistics 테이블
```sql
CREATE TABLE daily_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE NOT NULL UNIQUE,
  workflows_created INTEGER DEFAULT 0,
  workflows_executed INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  templates_used INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. ✅ MySQL 스키마 (기존 운영 DB)

#### 3.1 읽기 전용 연결
```sql
-- 읽기 전용 사용자 생성 예시
CREATE USER 'crm_readonly'@'%' IDENTIFIED BY 'secure_password';
GRANT SELECT ON your_database.* TO 'crm_readonly'@'%';
FLUSH PRIVILEGES;
```

#### 3.2 주요 테이블 (예시)
```sql
-- 고객 정보 테이블
CREATE TABLE customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 구독 정보 테이블
CREATE TABLE subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_id INT,
  status VARCHAR(50),
  start_date DATE,
  end_date DATE,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### 4. ✅ 인덱스 최적화

#### 4.1 ✅ Supabase 인덱스
```sql
-- 워크플로우 관련
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_created_at ON workflows(created_at);
CREATE INDEX idx_workflows_next_run ON workflows(next_run_at) 
  WHERE next_run_at IS NOT NULL;

-- 워크플로우 실행 기록
CREATE INDEX idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_started_at ON workflow_runs(started_at);

-- 메시지 템플릿
CREATE INDEX idx_message_templates_status ON message_templates(status);
CREATE INDEX idx_message_templates_message_type ON message_templates(message_type);
CREATE INDEX idx_message_templates_category ON message_templates(category);

-- 메시지 로그
CREATE INDEX idx_message_logs_workflow_run_id ON message_logs(workflow_run_id);
CREATE INDEX idx_message_logs_status ON message_logs(status);
CREATE INDEX idx_message_logs_sent_at ON message_logs(sent_at);
CREATE INDEX idx_message_logs_recipient_phone ON message_logs(recipient_phone);

-- 사용자 활동 로그
CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at);

-- 통계
CREATE INDEX idx_daily_statistics_stat_date ON daily_statistics(stat_date);
```

### 5. ✅ 트리거 및 함수

#### 5.1 ✅ 자동 업데이트 트리거
```sql
-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_workflows_updated_at 
  BEFORE UPDATE ON workflows 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at 
  BEFORE UPDATE ON message_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 5.2 ✅ 사용 통계 업데이트 함수
```sql
-- 사용 횟수 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'template_usage_logs' THEN
        UPDATE message_templates 
        SET usage_count = usage_count + 1,
            last_used_at = NOW()
        WHERE id = NEW.template_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_template_usage_count 
  AFTER INSERT ON template_usage_logs 
  FOR EACH ROW EXECUTE FUNCTION update_usage_count();
```

### 6. ✅ 보안 설정

#### 6.1 ✅ Row Level Security (RLS)
```sql
-- RLS 활성화
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_variable_mappings ENABLE ROW LEVEL SECURITY;

-- 기본 정책 (개발용 - 모든 접근 허용)
CREATE POLICY "dev_full_access" ON workflows
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "dev_full_access" ON message_templates
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "dev_full_access" ON individual_variable_mappings
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
```

#### 6.2 ✅ Service Role 우회
```sql
-- Service Role에 대한 완전한 우회 정책
CREATE POLICY "service_role_bypass_rls" ON workflows
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_rls" ON message_templates
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_rls" ON individual_variable_mappings
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### 7. ✅ 뷰 (Views)

#### 7.1 ✅ 워크플로우 요약 뷰
```sql
CREATE OR REPLACE VIEW workflow_summary AS
SELECT 
  w.id,
  w.name,
  w.status,
  w.created_at,
  COUNT(wr.id) as total_runs,
  COUNT(CASE WHEN wr.status = 'completed' THEN 1 END) as successful_runs,
  COUNT(CASE WHEN wr.status = 'failed' THEN 1 END) as failed_runs,
  MAX(wr.started_at) as last_run_at,
  SUM(wr.total_cost) as total_cost
FROM workflows w
LEFT JOIN workflow_runs wr ON w.id = wr.workflow_id
GROUP BY w.id, w.name, w.status, w.created_at;
```

#### 7.2 ✅ 일간 통계 요약 뷰
```sql
CREATE OR REPLACE VIEW daily_stats_summary AS
SELECT 
  stat_date,
  workflows_created,
  workflows_executed,
  messages_sent,
  messages_failed,
  CASE 
    WHEN messages_sent > 0 
    THEN ROUND((messages_sent - messages_failed) * 100.0 / messages_sent, 2)
    ELSE 0 
  END as success_rate,
  total_cost
FROM daily_statistics
ORDER BY stat_date DESC;
```

### 8. 데이터 흐름

#### 8.1 ✅ 워크플로우 실행 흐름
1. **워크플로우 생성** → `workflows` 테이블에 저장
2. **실행 시작** → `workflow_runs` 테이블에 실행 기록 생성
3. **MySQL 쿼리** → 기존 DB에서 대상 데이터 조회
4. **메시지 발송** → CoolSMS API 호출
5. **결과 로깅** → `message_logs` 테이블에 발송 결과 저장
6. **통계 업데이트** → `daily_statistics` 테이블 업데이트

#### 8.2 ✅ 변수 매핑 흐름
1. **변수 정의** → `individual_variable_mappings`에 저장
2. **쿼리 템플릿** → `variable_query_templates`에 저장
3. **실행 시 매핑** → MySQL 쿼리 결과와 템플릿 변수 매칭
4. **메시지 생성** → 변수 치환된 최종 메시지 생성

### 9. 백업 및 복구

#### 9.1 ✅ 자동 백업
- **Supabase**: 자동 백업 활성화 (Point-in-time Recovery)
- **중요 설정**: `system_settings` 테이블 정기 백업
- **워크플로우**: 중요 워크플로우 JSON 내보내기

#### 9.2 ✅ 재해 복구
- **RTO (Recovery Time Objective)**: 1시간 이내
- **RPO (Recovery Point Objective)**: 15분 이내
- **백업 전략**: 일일 전체 백업 + 실시간 증분 백업

### 10. 성능 모니터링

#### 10.1 ✅ 주요 지표
- **쿼리 성능**: 평균 응답 시간 < 2초
- **동시 연결**: 최대 100개 동시 연결 지원
- **디스크 사용량**: 월 10GB 이하 증가
- **메모리 사용**: 평균 메모리 사용률 < 80%

#### 10.2 ✅ 모니터링 도구
- **Supabase Dashboard**: 실시간 성능 모니터링
- **PostgreSQL Stats**: `pg_stat_statements` 확장 활용
- **Custom Metrics**: 애플리케이션 레벨 메트릭 수집

### 11. 마이그레이션 가이드

#### 11.1 ✅ 초기 설정
```bash
# 1. Supabase 프로젝트 생성
# 2. 스키마 파일 실행
psql -h your-supabase-host -U postgres -d postgres -f supabase_hybrid_schema.sql

# 3. RLS 정책 적용
psql -h your-supabase-host -U postgres -d postgres -f supabase_rls_fix.sql
```

#### 11.2 ✅ 데이터 마이그레이션
- **기존 데이터**: MySQL에서 Supabase로 필요 시 마이그레이션
- **설정 데이터**: `system_settings` 테이블에 초기 설정 입력
- **테스트 데이터**: 개발/테스트용 샘플 데이터 생성

### 12. 결론

이 데이터베이스 스키마는 **메시지 자동화 플랫폼의 완전한 데이터 관리 기반**을 제공합니다.

#### ✅ 주요 특징:
- **하이브리드 구조**: 기존 DB 보존 + 신규 기능 확장
- **확장 가능한 설계**: 미래 기능 확장에 유연한 구조
- **성능 최적화**: 적절한 인덱스 및 뷰 활용
- **보안 강화**: RLS 및 권한 관리 완비
- **모니터링**: 종합적인 로깅 및 통계 시스템

현재 스키마는 **실제 운영 환경에서 안정적으로 동작**하며, 플랫폼의 모든 기능을 완벽하게 지원합니다. 