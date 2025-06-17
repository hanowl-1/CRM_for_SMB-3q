-- =====================================================
-- Supabase SQL Editor 단계별 실행 명령문
-- 복사해서 하나씩 실행하세요
-- =====================================================

-- 1단계: 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2단계: 워크플로우 테이블 생성
CREATE TABLE workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  trigger_type VARCHAR(100) NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  target_config JSONB DEFAULT '{}',
  message_config JSONB DEFAULT '{}',
  variables JSONB DEFAULT '{}',
  schedule_config JSONB DEFAULT '{}',
  statistics JSONB DEFAULT '{}',
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3단계: 워크플로우 실행 기록 테이블
CREATE TABLE workflow_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
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

-- 4단계: 메시지 템플릿 테이블
CREATE TABLE message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  message_type VARCHAR(50) NOT NULL,
  template_code VARCHAR(100),
  subject VARCHAR(255),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'draft',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5단계: 메시지 발송 로그 테이블
CREATE TABLE message_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  workflow_name VARCHAR(255),
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  template_name VARCHAR(255),
  message_type VARCHAR(50) NOT NULL,
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  message_content TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL,
  provider VARCHAR(50),
  provider_message_id VARCHAR(255),
  error_message TEXT,
  cost_amount DECIMAL(10,2),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6단계: 시스템 설정 테이블
CREATE TABLE system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  key VARCHAR(255) NOT NULL,
  value JSONB,
  description TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category, key)
);

-- 7단계: 일별 통계 테이블
CREATE TABLE daily_statistics (
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

-- 8단계: 인덱스 생성
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_created_at ON workflows(created_at DESC);
CREATE INDEX idx_message_logs_status ON message_logs(status);
CREATE INDEX idx_message_logs_created_at ON message_logs(created_at DESC);
CREATE INDEX idx_daily_stats_date ON daily_statistics(date DESC);

-- 9단계: 기본 데이터 삽입
INSERT INTO system_settings (category, key, value, description) VALUES
('general', 'system_name', '"CRM for SMB"', '시스템 이름'),
('general', 'timezone', '"Asia/Seoul"', '시스템 기본 시간대'),
('sms', 'default_sender', '"18007710"', '기본 SMS 발신번호');

-- 10단계: 기본 템플릿 생성
INSERT INTO message_templates (name, description, category, message_type, content, variables, status) VALUES
('신규 회원 환영 메시지', '새로 가입한 회원에게 보내는 환영 메시지', 'welcome', 'sms', 
 '안녕하세요 {{회사명}}입니다! {{담당자}}님, 회원가입을 환영합니다.', 
 '["회사명", "담당자"]', 'active'),
('구독 만료 알림', '구독 서비스 만료 전 알림 메시지', 'reminder', 'kakao', 
 '{{회사명}}님의 구독이 {{마감일수}}일 후 만료됩니다.', 
 '["회사명", "마감일수"]', 'active');

-- 11단계: 오늘 통계 레코드 생성
INSERT INTO daily_statistics (date) VALUES (CURRENT_DATE);

-- 12단계: 테이블 생성 확인
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename; 