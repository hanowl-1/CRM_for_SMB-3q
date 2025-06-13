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
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  workflow_name VARCHAR(255),
  recipient_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. 메시지 발송 기록 테이블
-- =====================================================

-- 메시지 발송 로그 테이블
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  workflow_name VARCHAR(255),
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  template_name VARCHAR(255),
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('sms', 'kakao', 'email', 'push')),
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  message_content TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'read')),
  provider VARCHAR(50), -- 'coolsms', 'kakao', 'sendgrid' 등
  provider_message_id VARCHAR(255),
  error_message TEXT,
  cost_amount DECIMAL(10,2),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. 시스템 설정 및 관리 테이블
-- =====================================================

-- 시스템 설정 테이블
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category VARCHAR(100) NOT NULL, -- 'mysql', 'sms', 'kakao', 'email', 'general'
  key VARCHAR(255) NOT NULL,
  value JSONB,
  description TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category, key)
);

-- API 키 및 인증 정보 테이블
CREATE TABLE IF NOT EXISTS api_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider VARCHAR(100) NOT NULL, -- 'coolsms', 'kakao', 'sendgrid' 등
  name VARCHAR(255) NOT NULL,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  additional_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. 사용자 활동 및 감사 로그 테이블
-- =====================================================

-- 사용자 활동 로그 테이블
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id VARCHAR(255),
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'execute', 'view'
  resource_type VARCHAR(100) NOT NULL, -- 'workflow', 'template', 'message', 'setting'
  resource_id VARCHAR(255),
  resource_name VARCHAR(255),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 시스템 이벤트 로그 테이블
CREATE TABLE IF NOT EXISTS system_event_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL, -- 'error', 'warning', 'info', 'success'
  source VARCHAR(100) NOT NULL, -- 'workflow', 'scheduler', 'api', 'system'
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  severity INTEGER DEFAULT 1, -- 1: info, 2: warning, 3: error, 4: critical
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. 성능 및 통계 테이블
-- =====================================================

-- 일별 통계 테이블
CREATE TABLE IF NOT EXISTS daily_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  total_workflows_executed INTEGER DEFAULT 0,
  total_messages_sent INTEGER DEFAULT 0,
  total_messages_delivered INTEGER DEFAULT 0,
  total_messages_failed INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  sms_count INTEGER DEFAULT 0,
  kakao_count INTEGER DEFAULT 0,
  email_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  average_execution_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date)
);

-- 월별 통계 테이블
CREATE TABLE IF NOT EXISTS monthly_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  total_workflows_executed INTEGER DEFAULT 0,
  total_messages_sent INTEGER DEFAULT 0,
  total_messages_delivered INTEGER DEFAULT 0,
  total_messages_failed INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  most_used_template_id UUID,
  most_active_workflow_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(year, month)
);

-- =====================================================
-- 7. 인덱스 생성
-- =====================================================

-- 워크플로우 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflows_next_run_at ON workflows(next_run_at) WHERE next_run_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);

-- 워크플로우 실행 기록 인덱스
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at DESC);

-- 템플릿 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_message_type ON message_templates(message_type);
CREATE INDEX IF NOT EXISTS idx_templates_status ON message_templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON message_templates(created_at DESC);

-- 템플릿 사용 기록 인덱스
CREATE INDEX IF NOT EXISTS idx_template_usage_template_id ON template_usage_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_workflow_id ON template_usage_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_used_at ON template_usage_logs(used_at DESC);

-- 메시지 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_message_logs_workflow_id ON message_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_template_id ON message_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
CREATE INDEX IF NOT EXISTS idx_message_logs_message_type ON message_logs(message_type);
CREATE INDEX IF NOT EXISTS idx_message_logs_recipient_phone ON message_logs(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_message_logs_recipient_email ON message_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_sent_at ON message_logs(sent_at DESC);

-- 활동 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_resource_type ON user_activity_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity_logs(created_at DESC);

-- 시스템 이벤트 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_source ON system_event_logs(source);
CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_event_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_events_resolved ON system_event_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_event_logs(created_at DESC);

-- 통계 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_statistics(date DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_stats_year_month ON monthly_statistics(year DESC, month DESC);

-- =====================================================
-- 8. Row Level Security (RLS) 정책 설정
-- =====================================================

-- RLS 활성화
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_statistics ENABLE ROW LEVEL SECURITY;

-- 기본 읽기 정책 (모든 인증된 사용자)
CREATE POLICY "Enable read access for authenticated users" ON workflows FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON workflow_runs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON message_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON template_usage_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON message_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON daily_statistics FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON monthly_statistics FOR SELECT USING (auth.role() = 'authenticated');

-- 쓰기 정책 (서비스 역할 또는 인증된 사용자)
CREATE POLICY "Enable insert for service role" ON workflows FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
CREATE POLICY "Enable update for service role" ON workflows FOR UPDATE USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
CREATE POLICY "Enable delete for service role" ON workflows FOR DELETE USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role" ON workflow_runs FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
CREATE POLICY "Enable update for service role" ON workflow_runs FOR UPDATE USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role" ON message_templates FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
CREATE POLICY "Enable update for service role" ON message_templates FOR UPDATE USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
CREATE POLICY "Enable delete for service role" ON message_templates FOR DELETE USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role" ON template_usage_logs FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Enable insert for service role" ON message_logs FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
CREATE POLICY "Enable update for service role" ON message_logs FOR UPDATE USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- 시스템 설정은 서비스 역할만 접근 가능
CREATE POLICY "Enable all for service role only" ON system_settings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all for service role only" ON api_credentials FOR ALL USING (auth.role() = 'service_role');

-- 로그 테이블은 삽입만 허용
CREATE POLICY "Enable insert for service role" ON user_activity_logs FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
CREATE POLICY "Enable insert for service role" ON system_event_logs FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- 통계 테이블은 서비스 역할만 쓰기 가능
CREATE POLICY "Enable insert for service role" ON daily_statistics FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Enable update for service role" ON daily_statistics FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "Enable insert for service role" ON monthly_statistics FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Enable update for service role" ON monthly_statistics FOR UPDATE USING (auth.role() = 'service_role');

-- =====================================================
-- 9. 트리거 및 함수 생성
-- =====================================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 생성
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_message_logs_updated_at BEFORE UPDATE ON message_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_credentials_updated_at BEFORE UPDATE ON api_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_daily_statistics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO daily_statistics (date, total_messages_sent, sms_count, kakao_count, email_count)
    VALUES (CURRENT_DATE, 1, 
            CASE WHEN NEW.message_type = 'sms' THEN 1 ELSE 0 END,
            CASE WHEN NEW.message_type = 'kakao' THEN 1 ELSE 0 END,
            CASE WHEN NEW.message_type = 'email' THEN 1 ELSE 0 END)
    ON CONFLICT (date) DO UPDATE SET
        total_messages_sent = daily_statistics.total_messages_sent + 1,
        sms_count = daily_statistics.sms_count + CASE WHEN NEW.message_type = 'sms' THEN 1 ELSE 0 END,
        kakao_count = daily_statistics.kakao_count + CASE WHEN NEW.message_type = 'kakao' THEN 1 ELSE 0 END,
        email_count = daily_statistics.email_count + CASE WHEN NEW.message_type = 'email' THEN 1 ELSE 0 END;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 메시지 발송 시 통계 업데이트 트리거
CREATE TRIGGER update_stats_on_message_sent 
    AFTER INSERT ON message_logs 
    FOR EACH ROW 
    WHEN (NEW.status = 'sent')
    EXECUTE FUNCTION update_daily_statistics();

-- =====================================================
-- 10. 기본 데이터 삽입
-- =====================================================

-- 기본 시스템 설정
INSERT INTO system_settings (category, key, value, description) VALUES
('general', 'system_name', '"CRM for SMB"', '시스템 이름'),
('general', 'timezone', '"Asia/Seoul"', '시스템 기본 시간대'),
('general', 'default_language', '"ko"', '기본 언어'),
('mysql', 'connection_timeout', '60000', 'MySQL 연결 타임아웃 (ms)'),
('sms', 'default_sender', '"18007710"', '기본 SMS 발신번호'),
('sms', 'rate_limit_per_minute', '100', '분당 SMS 발송 제한'),
('kakao', 'rate_limit_per_minute', '1000', '분당 카카오톡 발송 제한'),
('email', 'rate_limit_per_minute', '500', '분당 이메일 발송 제한')
ON CONFLICT (category, key) DO NOTHING;

-- 기본 메시지 템플릿
INSERT INTO message_templates (name, description, category, message_type, content, variables, status) VALUES
('신규 회원 환영 메시지', '새로 가입한 회원에게 보내는 환영 메시지', 'welcome', 'sms', 
 '안녕하세요 {{회사명}}입니다! {{담당자}}님, 회원가입을 환영합니다. 궁금한 점이 있으시면 {{연락처}}로 연락주세요.', 
 '["회사명", "담당자", "연락처"]', 'active'),
('구독 만료 알림', '구독 서비스 만료 전 알림 메시지', 'reminder', 'kakao', 
 '[구독 만료 알림]\n{{회사명}}님의 구독이 {{마감일수}}일 후 만료됩니다.\n연장을 원하시면 {{구매링크}}에서 갱신해주세요.', 
 '["회사명", "마감일수", "구매링크"]', 'active'),
('프로모션 안내', '특별 혜택 및 프로모션 안내 메시지', 'promotion', 'sms', 
 '🎉 {{회사명}} 특별 혜택!\n{{광고명}} 체험 기회를 놓치지 마세요.\n신청: {{신청링크}}\n문의: {{고객센터번호}}', 
 '["회사명", "광고명", "신청링크", "고객센터번호"]', 'active'),
('결제 완료 알림', '결제 완료 후 발송되는 확인 메시지', 'notification', 'sms',
 '{{회사명}} 결제가 완료되었습니다.\n금액: {{결제금액}}원\n일시: {{결제일시}}\n문의: {{고객센터번호}}',
 '["회사명", "결제금액", "결제일시", "고객센터번호"]', 'active'),
('설문조사 요청', '고객 만족도 조사 요청 메시지', 'survey', 'kakao',
 '[고객 만족도 조사]\n{{회사명}}을 이용해주셔서 감사합니다.\n간단한 설문조사에 참여해주세요.\n참여링크: {{설문링크}}\n소요시간: 약 3분',
 '["회사명", "설문링크"]', 'active')
ON CONFLICT DO NOTHING;

-- 오늘 날짜의 기본 통계 레코드 생성
INSERT INTO daily_statistics (date) VALUES (CURRENT_DATE) ON CONFLICT (date) DO NOTHING;

-- =====================================================
-- 11. 뷰 생성 (편의성을 위한 조회 뷰)
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
    COALESCE(SUM(wr.target_count), 0) as total_targets,
    COALESCE(SUM(wr.success_count), 0) as total_success,
    COALESCE(SUM(wr.total_cost), 0) as total_cost
FROM workflows w
LEFT JOIN workflow_runs wr ON w.id = wr.workflow_id
GROUP BY w.id, w.name, w.status, w.trigger_type, w.created_at, w.last_run_at;

-- 메시지 발송 통계 뷰
CREATE OR REPLACE VIEW message_statistics AS
SELECT 
    DATE(created_at) as date,
    message_type,
    status,
    COUNT(*) as count,
    SUM(cost_amount) as total_cost
FROM message_logs
GROUP BY DATE(created_at), message_type, status
ORDER BY date DESC, message_type, status;

-- 템플릿 사용 통계 뷰
CREATE OR REPLACE VIEW template_usage_summary AS
SELECT 
    mt.id,
    mt.name,
    mt.category,
    mt.message_type,
    mt.usage_count,
    mt.last_used_at,
    COUNT(tul.id) as usage_logs_count,
    COALESCE(SUM(tul.recipient_count), 0) as total_recipients,
    COALESCE(SUM(tul.success_count), 0) as total_success
FROM message_templates mt
LEFT JOIN template_usage_logs tul ON mt.id = tul.template_id
GROUP BY mt.id, mt.name, mt.category, mt.message_type, mt.usage_count, mt.last_used_at;

-- =====================================================
-- 스키마 생성 완료
-- =====================================================

-- 테이블 목록 확인
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN (
        'workflows', 'workflow_runs', 'message_templates', 'template_usage_logs',
        'message_logs', 'system_settings', 'api_credentials', 'user_activity_logs',
        'system_event_logs', 'daily_statistics', 'monthly_statistics'
    )
ORDER BY tablename;

-- 인덱스 확인
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND tablename IN (
        'workflows', 'workflow_runs', 'message_templates', 'template_usage_logs',
        'message_logs', 'user_activity_logs', 'system_event_logs', 'daily_statistics'
    )
ORDER BY tablename, indexname; 