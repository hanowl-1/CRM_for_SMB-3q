-- =====================================================
-- Supabase 하이브리드 CRM 시스템 테이블 스키마
-- MySQL(읽기) + Supabase(쓰기) 아키텍처용
-- =====================================================

-- 필요한 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =====================================================
-- 1. 워크플로우 관리 테이블
-- =====================================================

-- 워크플로우 메인 테이블
CREATE TABLE IF NOT EXISTS workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  trigger_type VARCHAR(100) NOT NULL CHECK (trigger_type IN ('manual', 'schedule', 'event', 'webhook')),
  trigger_config JSONB DEFAULT '{}',
  target_config JSONB DEFAULT '{}', -- MySQL 쿼리 설정 또는 테이블 매핑
  message_config JSONB DEFAULT '{}', -- 메시지 템플릿 및 설정
  variables JSONB DEFAULT '{}', -- 추출된 변수 매핑
  schedule_config JSONB DEFAULT '{}', -- 스케줄 설정 (cron 등)
  statistics JSONB DEFAULT '{}', -- 실행 통계
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 워크플로우 실행 기록 테이블
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
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

-- =====================================================
-- 2. 메시지 템플릿 관리 테이블
-- =====================================================

-- 메시지 템플릿 테이블
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) CHECK (category IN ('welcome', 'reminder', 'promotion', 'notification', 'alert', 'survey')),
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('sms', 'kakao', 'email', 'push')),
  template_code VARCHAR(100), -- 카카오톡 템플릿 코드
  subject VARCHAR(255), -- 이메일 제목
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- 사용된 변수 목록
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 템플릿 사용 기록 테이블
CREATE TABLE IF NOT EXISTS template_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES message_templates(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  variables_used JSONB DEFAULT '{}',
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- =====================================================
-- 3. 커스텀 쿼리 관리 테이블 (NEW)
-- =====================================================

-- 커스텀 쿼리 테이블
CREATE TABLE IF NOT EXISTS custom_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  query_sql TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- 쿼리에서 사용되는 변수 목록
  enabled BOOLEAN DEFAULT true,
  category VARCHAR(100) DEFAULT 'general' CHECK (category IN ('general', 'analytics', 'reporting', 'marketing')),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 커스텀 쿼리 실행 로그 테이블
CREATE TABLE IF NOT EXISTS custom_query_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id UUID REFERENCES custom_queries(id) ON DELETE CASCADE,
  executed_by VARCHAR(255),
  execution_time_ms INTEGER,
  result_count INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. 메시지 발송 로그 테이블
-- =====================================================

-- 메시지 발송 로그 테이블
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE CASCADE,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('sms', 'kakao', 'email', 'push')),
  message_content TEXT,
  variables_used JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
  provider VARCHAR(50), -- CoolSMS, 카카오 등
  provider_message_id VARCHAR(255),
  cost DECIMAL(8,2) DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_code VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. 시스템 설정 및 로그 테이블
-- =====================================================

-- 시스템 설정 테이블
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key VARCHAR(255) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  is_encrypted BOOLEAN DEFAULT false,
  updated_by VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API 자격증명 테이블
CREATE TABLE IF NOT EXISTS api_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider VARCHAR(100) NOT NULL, -- 'coolsms', 'kakao', 'mysql' 등
  credential_name VARCHAR(255) NOT NULL,
  credentials JSONB NOT NULL, -- 암호화된 자격증명 정보
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(provider, credential_name)
);

-- 사용자 활동 로그 테이블
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100), -- 'workflow', 'template', 'query' 등
  resource_id VARCHAR(255),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 시스템 이벤트 로그 테이블
CREATE TABLE IF NOT EXISTS system_event_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) DEFAULT 'system' CHECK (event_category IN ('system', 'security', 'performance', 'error')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. 변수 매핑 템플릿 관리 테이블 (NEW)
-- =====================================================

-- 변수 매핑 템플릿 테이블
CREATE TABLE IF NOT EXISTS variable_mapping_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general' CHECK (category IN ('general', 'performance', 'welcome', 'payment', 'custom')),
  tags JSONB DEFAULT '[]', -- 태그 배열
  variable_mappings JSONB NOT NULL DEFAULT '[]', -- VariableMapping 배열
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 매핑 이력 템플릿 테이블 (전체 변수 매핑 세트)
CREATE TABLE IF NOT EXISTS mapping_history_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_content TEXT NOT NULL, -- 원본 카카오톡 템플릿 내용
  variable_mappings JSONB NOT NULL DEFAULT '[]', -- 전체 변수 매핑 배열
  category VARCHAR(100) DEFAULT 'custom',
  tags JSONB DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 변수 쿼리 템플릿 테이블
CREATE TABLE IF NOT EXISTS variable_query_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  variable_name VARCHAR(255) NOT NULL, -- 대상 변수명
  query_sql TEXT NOT NULL,
  selected_column VARCHAR(255), -- 선택된 컬럼명
  category VARCHAR(100) DEFAULT 'general',
  tags JSONB DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 개별 변수 매핑 저장 테이블 (NEW)
CREATE TABLE IF NOT EXISTS individual_variable_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  variable_name VARCHAR(255) NOT NULL, -- 변수명 (예: #{companyName})
  display_name VARCHAR(255), -- 표시명 (예: "회사명")
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('field', 'query', 'function')),
  source_field TEXT, -- 필드명 또는 쿼리 또는 함수명
  selected_column VARCHAR(255), -- 쿼리 결과에서 선택된 컬럼
  default_value TEXT, -- 기본값
  formatter VARCHAR(50) DEFAULT 'text' CHECK (formatter IN ('text', 'number', 'currency', 'date')),
  category VARCHAR(100) DEFAULT 'general',
  tags JSONB DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(variable_name, created_by) -- 사용자별로 변수명은 유일
);

-- =====================================================
-- 7. 통계 및 분석 테이블
-- =====================================================

-- 일별 통계 테이블
CREATE TABLE IF NOT EXISTS daily_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE NOT NULL,
  workflows_created INTEGER DEFAULT 0,
  workflows_executed INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  unique_recipients INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(stat_date)
);

-- 월별 통계 테이블
CREATE TABLE IF NOT EXISTS monthly_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_month DATE NOT NULL, -- 월의 첫째 날 (YYYY-MM-01)
  workflows_created INTEGER DEFAULT 0,
  workflows_executed INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  total_cost DECIMAL(12,2) DEFAULT 0,
  unique_recipients INTEGER DEFAULT 0,
  avg_delivery_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(stat_month)
);

-- =====================================================
-- 8. 인덱스 생성 (성능 최적화)
-- =====================================================

-- 워크플로우 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at);
CREATE INDEX IF NOT EXISTS idx_workflows_next_run ON workflows(next_run_at) WHERE next_run_at IS NOT NULL;

-- 워크플로우 실행 기록 인덱스
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at);

-- 메시지 템플릿 인덱스
CREATE INDEX IF NOT EXISTS idx_message_templates_status ON message_templates(status);
CREATE INDEX IF NOT EXISTS idx_message_templates_message_type ON message_templates(message_type);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);

-- 커스텀 쿼리 인덱스
CREATE INDEX IF NOT EXISTS idx_custom_queries_enabled ON custom_queries(enabled);
CREATE INDEX IF NOT EXISTS idx_custom_queries_category ON custom_queries(category);
CREATE INDEX IF NOT EXISTS idx_custom_queries_created_at ON custom_queries(created_at);

-- 메시지 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_message_logs_workflow_run_id ON message_logs(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
CREATE INDEX IF NOT EXISTS idx_message_logs_message_type ON message_logs(message_type);
CREATE INDEX IF NOT EXISTS idx_message_logs_sent_at ON message_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_message_logs_recipient_phone ON message_logs(recipient_phone);

-- 시스템 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_event_type ON system_event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_severity ON system_event_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_event_logs_created_at ON system_event_logs(created_at);

-- 통계 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_statistics_stat_date ON daily_statistics(stat_date);
CREATE INDEX IF NOT EXISTS idx_monthly_statistics_stat_month ON monthly_statistics(stat_month);

-- =====================================================
-- 9. 트리거 생성 (자동 업데이트)
-- =====================================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 각 테이블에 updated_at 트리거 적용
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_queries_updated_at BEFORE UPDATE ON custom_queries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_credentials_updated_at BEFORE UPDATE ON api_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monthly_statistics_updated_at BEFORE UPDATE ON monthly_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 사용량 카운터 업데이트 트리거
CREATE OR REPLACE FUNCTION update_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'template_usage_logs' THEN
        UPDATE message_templates 
        SET usage_count = usage_count + 1, last_used_at = NOW()
        WHERE id = NEW.template_id;
    ELSIF TG_TABLE_NAME = 'custom_query_logs' THEN
        UPDATE custom_queries 
        SET usage_count = usage_count + 1, last_used_at = NOW()
        WHERE id = NEW.query_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_template_usage_count AFTER INSERT ON template_usage_logs FOR EACH ROW EXECUTE FUNCTION update_usage_count();
CREATE TRIGGER update_custom_query_usage_count AFTER INSERT ON custom_query_logs FOR EACH ROW EXECUTE FUNCTION update_usage_count();

-- =====================================================
-- 10. Row Level Security (RLS) 정책
-- =====================================================

-- RLS 활성화
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 기본 읽기 정책 (모든 인증된 사용자)
CREATE POLICY "Enable read access for authenticated users" ON workflows FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON workflow_runs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON message_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON custom_queries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON message_logs FOR SELECT USING (auth.role() = 'authenticated');

-- 쓰기 정책 (서비스 역할만)
CREATE POLICY "Enable all access for service role" ON workflows FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Enable all access for service role" ON workflow_runs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Enable all access for service role" ON message_templates FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Enable all access for service role" ON custom_queries FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Enable all access for service role" ON message_logs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Enable all access for service role" ON system_settings FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 11. 편의성 뷰 생성
-- =====================================================

-- 워크플로우 요약 뷰
CREATE OR REPLACE VIEW workflow_summary AS
SELECT 
    w.id,
    w.name,
    w.status,
    w.trigger_type,
    w.created_at,
    w.last_run_at,
    COUNT(wr.id) as total_runs,
    COUNT(CASE WHEN wr.status = 'completed' THEN 1 END) as successful_runs,
    COUNT(CASE WHEN wr.status = 'failed' THEN 1 END) as failed_runs,
    COALESCE(SUM(wr.total_cost), 0) as total_cost,
    COALESCE(SUM(wr.success_count), 0) as total_messages_sent
FROM workflows w
LEFT JOIN workflow_runs wr ON w.id = wr.workflow_id
GROUP BY w.id, w.name, w.status, w.trigger_type, w.created_at, w.last_run_at;

-- 일별 통계 요약 뷰
CREATE OR REPLACE VIEW daily_stats_summary AS
SELECT 
    stat_date,
    workflows_executed,
    messages_sent,
    messages_delivered,
    messages_failed,
    CASE 
        WHEN messages_sent > 0 THEN ROUND((messages_delivered::DECIMAL / messages_sent) * 100, 2)
        ELSE 0 
    END as delivery_rate,
    total_cost
FROM daily_statistics
ORDER BY stat_date DESC;

-- =====================================================
-- 12. 기본 데이터 삽입
-- =====================================================

-- 기본 시스템 설정
INSERT INTO system_settings (setting_key, setting_value, description, category) VALUES
('system.name', '"CRM 자동화 시스템"', '시스템 이름', 'general'),
('system.version', '"1.0.0"', '시스템 버전', 'general'),
('message.default_sender', '"18007710"', '기본 발신번호', 'messaging'),
('message.max_retry_count', '3', '메시지 재시도 최대 횟수', 'messaging'),
('workflow.max_concurrent_runs', '10', '동시 실행 가능한 워크플로우 수', 'workflow'),
('system.timezone', '"Asia/Seoul"', '시스템 시간대', 'general')
ON CONFLICT (setting_key) DO NOTHING;

-- 기본 메시지 템플릿
INSERT INTO message_templates (name, description, category, message_type, content, variables, status) VALUES
('환영 메시지', '신규 가입자 환영 메시지', 'welcome', 'sms', '안녕하세요 {{name}}님! 가입을 환영합니다.', '["name"]', 'active'),
('리마인더', '일반적인 리마인더 메시지', 'reminder', 'sms', '{{name}}님, {{event}}에 대한 알림입니다.', '["name", "event"]', 'active'),
('프로모션', '프로모션 안내 메시지', 'promotion', 'sms', '{{name}}님께 특별 할인 혜택을 드립니다! {{discount}}% 할인', '["name", "discount"]', 'active')
ON CONFLICT DO NOTHING;

-- 기본 커스텀 쿼리
INSERT INTO custom_queries (query_name, display_name, description, query_sql, variables, category, enabled) VALUES
('active_companies', '활성 회사 목록', '현재 활성화된 회사들의 기본 정보를 조회합니다', 'SELECT id, name, email, contacts FROM Companies WHERE is_active = 1 ORDER BY createdAt DESC', '[]', 'general', true),
('recent_contracts', '최근 계약 현황', '최근 30일간의 계약 현황을 조회합니다', 'SELECT c.id, c.company, c.companyName, c.currentState, c.createdAt FROM Contracts c WHERE c.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) ORDER BY c.createdAt DESC', '[]', 'analytics', true),
('monthly_signups', '월별 가입 통계', '월별 신규 가입 회사 수를 조회합니다', 'SELECT DATE_FORMAT(createdAt, "%Y-%m") as month, COUNT(*) as signup_count FROM Companies WHERE is_active = 1 GROUP BY DATE_FORMAT(createdAt, "%Y-%m") ORDER BY month DESC', '[]', 'reporting', true)
ON CONFLICT (query_name) DO NOTHING;

-- =====================================================
-- 13. 완료 메시지
-- =====================================================

-- 스키마 생성 완료 확인
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Supabase 하이브리드 CRM 스키마 생성 완료!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '생성된 테이블:';
    RAISE NOTICE '- workflows (워크플로우)';
    RAISE NOTICE '- workflow_runs (워크플로우 실행 기록)';
    RAISE NOTICE '- message_templates (메시지 템플릿)';
    RAISE NOTICE '- template_usage_logs (템플릿 사용 로그)';
    RAISE NOTICE '- custom_queries (커스텀 쿼리) - NEW!';
    RAISE NOTICE '- custom_query_logs (쿼리 실행 로그) - NEW!';
    RAISE NOTICE '- message_logs (메시지 발송 로그)';
    RAISE NOTICE '- system_settings (시스템 설정)';
    RAISE NOTICE '- api_credentials (API 자격증명)';
    RAISE NOTICE '- user_activity_logs (사용자 활동 로그)';
    RAISE NOTICE '- system_event_logs (시스템 이벤트 로그)';
    RAISE NOTICE '- daily_statistics (일별 통계)';
    RAISE NOTICE '- monthly_statistics (월별 통계)';
    RAISE NOTICE '- variable_mapping_templates (변수 매핑 템플릿) - NEW!';
    RAISE NOTICE '- mapping_history_templates (매핑 이력 템플릿) - NEW!';
    RAISE NOTICE '- variable_query_templates (변수 쿼리 템플릿) - NEW!';
    RAISE NOTICE '- individual_variable_mappings (개별 변수 매핑) - NEW!';
    RAISE NOTICE '==============================================';
END $$; 