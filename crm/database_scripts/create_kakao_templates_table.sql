-- 카카오 알림톡 템플릿 테이블 생성
CREATE TABLE IF NOT EXISTS kakao_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id VARCHAR(255) UNIQUE NOT NULL,
  template_code VARCHAR(255),
  template_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(50),
  inspection_status VARCHAR(50),
  channel VARCHAR(50) NOT NULL, -- CEO, BLOGGER
  channel_id VARCHAR(255) NOT NULL, -- pfId
  buttons JSONB DEFAULT '[]',
  variables TEXT[] DEFAULT '{}',
  coolsms_created_at TIMESTAMP WITH TIME ZONE,
  coolsms_updated_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_kakao_templates_channel ON kakao_templates(channel);
CREATE INDEX idx_kakao_templates_status ON kakao_templates(inspection_status);
CREATE INDEX idx_kakao_templates_name ON kakao_templates(template_name);

-- RLS 정책 (필요에 따라 조정)
ALTER TABLE kakao_templates ENABLE ROW LEVEL SECURITY;

-- 읽기 권한 (모든 인증된 사용자)
CREATE POLICY "Allow read access to all users" ON kakao_templates
  FOR SELECT USING (true);

-- 쓰기 권한 (서비스 역할만)
CREATE POLICY "Allow write access to service role only" ON kakao_templates
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');