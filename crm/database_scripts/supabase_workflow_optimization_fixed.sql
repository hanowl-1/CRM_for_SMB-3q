-- =====================================================
-- Supabase 워크플로우 최적화 마이그레이션 스크립트 (수정버전)
-- 기존 테이블 구조 문제 해결 포함
-- =====================================================

-- 0. 기존 테이블 구조 확인 및 수정
-- =====================================================

-- message_logs 테이블에 workflow_id 컬럼 추가 (없는 경우)
ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS workflow_id UUID;

-- message_logs 테이블에 기본 컬럼들 추가 (없는 경우)
ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20);

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- workflows 테이블에 기본 컬럼들 추가 (없는 경우)
ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';

ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 1. workflows 테이블에 mapping_config 컬럼 추가
-- =====================================================
ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS mapping_config JSONB DEFAULT '{}';

-- 기존 target_config에서 매핑 정보 분리 (target_config가 있는 경우만)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'workflows' AND column_name = 'target_config') THEN
        UPDATE workflows 
        SET mapping_config = target_config->'targetTemplateMappings',
            target_config = target_config - 'targetTemplateMappings'
        WHERE target_config ? 'targetTemplateMappings';
    END IF;
END $$;

-- 2. 알림톡 템플릿 테이블 생성 (1단계 최적화)
-- =====================================================
CREATE TABLE IF NOT EXISTS kakao_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code VARCHAR(100) NOT NULL UNIQUE, -- CoolSMS 템플릿 코드
  template_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) 
    CHECK (category IN ('welcome', 'reminder', 'promotion', 
                       'notification', 'alert', 'survey', 'thanks', 'performance')),
  
  -- 템플릿 내용
  template_content TEXT NOT NULL,
  template_extra TEXT,
  template_ad TEXT,
  
  -- 🔥 변수 정보 (동적 쿼리 포함)
  variables JSONB DEFAULT '[]',        -- 추출된 변수 목록
  variable_queries JSONB DEFAULT '{}', -- 각 변수별 동적 쿼리 설정
  
  -- 버튼 설정
  buttons JSONB DEFAULT '[]',
  
  -- 메타데이터
  status VARCHAR(50) DEFAULT 'active' 
    CHECK (status IN ('draft', 'active', 'archived')),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 대상 쿼리 템플릿 테이블 생성 (2단계 최적화)
-- =====================================================
CREATE TABLE IF NOT EXISTS target_query_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  
  -- 🔥 MySQL 동적 쿼리
  query_sql TEXT NOT NULL,
  query_description TEXT,
  expected_columns JSONB DEFAULT '[]', -- 예상 결과 컬럼 정보
  
  -- 메타데이터
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT false,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 매핑 템플릿 테이블 생성 (3단계 최적화)
-- =====================================================
CREATE TABLE IF NOT EXISTS mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  
  -- 🔥 핵심: 재사용 가능한 매핑 정보
  target_template_mappings JSONB NOT NULL DEFAULT '[]',
  
  -- 사용 패턴 분석
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- 공유 설정
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  
  -- 메타데이터
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 개별 변수 매핑 템플릿 테이블 생성
-- =====================================================
CREATE TABLE IF NOT EXISTS variable_mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  
  -- 🔥 개별 변수 매핑 정보
  variable_mappings JSONB NOT NULL DEFAULT '[]',
  
  -- 메타데이터
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 성능 최적화 인덱스 생성 (안전하게)
-- =====================================================

-- workflows 테이블 인덱스
DO $$
BEGIN
    -- status 컬럼이 있는 경우만 인덱스 생성
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'workflows' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
    END IF;
    
    -- next_run_at 컬럼이 있는 경우만 인덱스 생성
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'workflows' AND column_name = 'next_run_at') THEN
        CREATE INDEX IF NOT EXISTS idx_workflows_next_run_at ON workflows(next_run_at);
    END IF;
    
    -- created_at 컬럼이 있는 경우만 인덱스 생성
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'workflows' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);
    END IF;
END $$;

-- kakao_templates 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_kakao_templates_code ON kakao_templates(template_code);
CREATE INDEX IF NOT EXISTS idx_kakao_templates_category ON kakao_templates(category);
CREATE INDEX IF NOT EXISTS idx_kakao_templates_status ON kakao_templates(status);
CREATE INDEX IF NOT EXISTS idx_kakao_templates_usage_count ON kakao_templates(usage_count DESC);

-- target_query_templates 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_target_query_templates_category ON target_query_templates(category);
CREATE INDEX IF NOT EXISTS idx_target_query_templates_usage_count ON target_query_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_target_query_templates_is_public ON target_query_templates(is_public);

-- mapping_templates 테이블 인덱스  
CREATE INDEX IF NOT EXISTS idx_mapping_templates_category ON mapping_templates(category);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_usage_count ON mapping_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_is_public ON mapping_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_is_favorite ON mapping_templates(is_favorite);

-- message_logs 테이블 인덱스 (안전하게)
DO $$
BEGIN
    -- workflow_id 컬럼이 있는 경우만 인덱스 생성
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'message_logs' AND column_name = 'workflow_id') THEN
        CREATE INDEX IF NOT EXISTS idx_message_logs_workflow_id ON message_logs(workflow_id);
    END IF;
    
    -- status 컬럼이 있는 경우만 인덱스 생성
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'message_logs' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
    END IF;
    
    -- created_at 컬럼이 있는 경우만 인덱스 생성
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'message_logs' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at DESC);
    END IF;
    
    -- recipient_phone 컬럼이 있는 경우만 인덱스 생성
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'message_logs' AND column_name = 'recipient_phone') THEN
        CREATE INDEX IF NOT EXISTS idx_message_logs_recipient_phone ON message_logs(recipient_phone);
    END IF;
END $$;

-- 7. 샘플 데이터 삽입
-- =====================================================

-- 샘플 알림톡 템플릿 (중복 방지)
INSERT INTO kakao_templates (template_code, template_name, category, template_content, variables, variable_queries)
VALUES 
(
  'TK_PERFORMANCE_001',
  '성과 리포트 알림톡',
  'performance',
  '{{company_name}}님, 이번 달 리뷰 {{total_reviews}}개를 받으셨습니다! 평균 평점은 {{avg_rating}}점입니다. 계속해서 좋은 서비스 부탁드립니다.',
  '["company_name", "total_reviews", "avg_rating"]',
  '{
    "company_name": {
      "sourceType": "field",
      "field": "company_name",
      "description": "회사명",
      "defaultValue": "고객님",
      "formatter": "text"
    },
    "total_reviews": {
      "sourceType": "query",
      "sql": "SELECT COUNT(*) as count FROM reviews WHERE company_id = ?",
      "description": "총 리뷰 수",
      "defaultValue": "0",
      "formatter": "number"
    },
    "avg_rating": {
      "sourceType": "query", 
      "sql": "SELECT ROUND(AVG(rating), 1) as avg_rating FROM reviews WHERE company_id = ?",
      "description": "평균 평점",
      "defaultValue": "0.0",
      "formatter": "number"
    }
  }'
)
ON CONFLICT (template_code) DO NOTHING;

INSERT INTO kakao_templates (template_code, template_name, category, template_content, variables, variable_queries)
VALUES 
(
  'TK_WELCOME_001',
  '신규 가입 환영 메시지',
  'welcome',
  '{{company_name}}님, 서비스 가입을 환영합니다! 궁금한 점이 있으시면 언제든 문의해 주세요.',
  '["company_name"]',
  '{
    "company_name": {
      "sourceType": "field",
      "field": "company_name", 
      "description": "회사명",
      "defaultValue": "고객님",
      "formatter": "text"
    }
  }'
)
ON CONFLICT (template_code) DO NOTHING;

-- 샘플 대상 쿼리 템플릿
INSERT INTO target_query_templates (name, description, category, query_sql, expected_columns)
VALUES 
(
  '활성 고객 조회',
  '최근 30일 내 활동한 활성 고객 목록',
  'customer_segments',
  'SELECT id, contacts, company_name, last_login_date FROM customers WHERE last_login_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND status = ''active'' ORDER BY last_login_date DESC',
  '["id", "contacts", "company_name", "last_login_date"]'
),
(
  '리뷰 많은 고객',
  '리뷰 10개 이상 보유한 우수 고객',
  'performance_based',
  'SELECT c.id, c.contacts, c.company_name, COUNT(r.id) as review_count FROM customers c JOIN reviews r ON c.id = r.company_id GROUP BY c.id, c.contacts, c.company_name HAVING COUNT(r.id) >= 10 ORDER BY review_count DESC',
  '["id", "contacts", "company_name", "review_count"]'
);

-- 샘플 매핑 템플릿
INSERT INTO mapping_templates (name, description, category, target_template_mappings, is_public)
VALUES 
(
  '성과 리포트 기본 매핑',
  '성과 리포트 알림톡용 기본 변수 매핑',
  'performance',
  '[
    {
      "id": "mapping_1",
      "targetGroupId": "group_1",
      "templateId": "template_1",
      "fieldMappings": [
        {
          "templateVariable": "company_name",
          "targetField": "company_name",
          "formatter": "text",
          "defaultValue": "고객님"
        },
        {
          "templateVariable": "total_reviews",
          "targetField": "review_count", 
          "formatter": "number",
          "defaultValue": "0"
        },
        {
          "templateVariable": "avg_rating",
          "targetField": "avg_rating",
          "formatter": "number", 
          "defaultValue": "0.0"
        }
      ]
    }
  ]',
  true
),
(
  '기본 고객 정보 매핑',
  '일반적인 고객 정보 변수 매핑',
  'general',
  '[
    {
      "id": "mapping_2",
      "targetGroupId": "group_2", 
      "templateId": "template_2",
      "fieldMappings": [
        {
          "templateVariable": "company_name",
          "targetField": "company_name",
          "formatter": "text",
          "defaultValue": "고객님"
        },
        {
          "templateVariable": "contact_name", 
          "targetField": "contact_name",
          "formatter": "text",
          "defaultValue": "담당자님"
        }
      ]
    }
  ]',
  true
);

-- 8. RLS 정책 설정 (보안)
-- =====================================================

-- workflows 테이블 RLS 활성화 (이미 활성화되어 있을 수 있음)
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- kakao_templates 테이블 RLS 설정
ALTER TABLE kakao_templates ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 알림톡 템플릿 조회 가능
DO $$
BEGIN
    -- 기존 정책이 있는지 확인 후 생성
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read access to kakao_templates') THEN
        CREATE POLICY "Allow read access to kakao_templates" ON kakao_templates
          FOR SELECT TO authenticated, anon
          USING (true);
    END IF;
END $$;

-- 인증된 사용자만 알림톡 템플릿 수정 가능
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to manage kakao_templates') THEN
        CREATE POLICY "Allow authenticated users to manage kakao_templates" ON kakao_templates
          FOR ALL TO authenticated
          USING (true) WITH CHECK (true);
    END IF;
END $$;

-- target_query_templates 테이블 RLS 설정
ALTER TABLE target_query_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read access to target_query_templates') THEN
        CREATE POLICY "Allow read access to target_query_templates" ON target_query_templates
          FOR SELECT TO authenticated, anon
          USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to manage target_query_templates') THEN
        CREATE POLICY "Allow authenticated users to manage target_query_templates" ON target_query_templates
          FOR ALL TO authenticated
          USING (true) WITH CHECK (true);
    END IF;
END $$;

-- mapping_templates 테이블 RLS 설정
ALTER TABLE mapping_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read access to public mapping_templates') THEN
        CREATE POLICY "Allow read access to public mapping_templates" ON mapping_templates
          FOR SELECT TO authenticated, anon
          USING (is_public = true OR created_by = auth.uid()::text);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow users to manage their mapping_templates') THEN
        CREATE POLICY "Allow users to manage their mapping_templates" ON mapping_templates
          FOR ALL TO authenticated
          USING (created_by = auth.uid()::text)
          WITH CHECK (created_by = auth.uid()::text);
    END IF;
END $$;

-- variable_mapping_templates 테이블 RLS 설정
ALTER TABLE variable_mapping_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read access to public variable_mapping_templates') THEN
        CREATE POLICY "Allow read access to public variable_mapping_templates" ON variable_mapping_templates
          FOR SELECT TO authenticated, anon
          USING (is_public = true OR created_by = auth.uid()::text);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow users to manage their variable_mapping_templates') THEN
        CREATE POLICY "Allow users to manage their variable_mapping_templates" ON variable_mapping_templates
          FOR ALL TO authenticated
          USING (created_by = auth.uid()::text)
          WITH CHECK (created_by = auth.uid()::text);
    END IF;
END $$;

-- 9. 트리거 함수 생성 (자동 업데이트)
-- =====================================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 각 테이블에 updated_at 트리거 적용 (중복 방지)
DO $$
BEGIN
    -- kakao_templates 트리거
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_kakao_templates_updated_at') THEN
        CREATE TRIGGER update_kakao_templates_updated_at 
          BEFORE UPDATE ON kakao_templates 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- target_query_templates 트리거
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_target_query_templates_updated_at') THEN
        CREATE TRIGGER update_target_query_templates_updated_at 
          BEFORE UPDATE ON target_query_templates 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- mapping_templates 트리거
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mapping_templates_updated_at') THEN
        CREATE TRIGGER update_mapping_templates_updated_at 
          BEFORE UPDATE ON mapping_templates 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- variable_mapping_templates 트리거
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_variable_mapping_templates_updated_at') THEN
        CREATE TRIGGER update_variable_mapping_templates_updated_at 
          BEFORE UPDATE ON variable_mapping_templates 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 10. 사용량 통계 업데이트 함수
-- =====================================================

-- 사용량 카운트 증가 함수
CREATE OR REPLACE FUNCTION increment_usage_count(table_name TEXT, record_id UUID)
RETURNS VOID AS $$
BEGIN
  CASE table_name
    WHEN 'kakao_templates' THEN
      UPDATE kakao_templates 
      SET usage_count = usage_count + 1, last_used_at = NOW()
      WHERE id = record_id;
    WHEN 'target_query_templates' THEN
      UPDATE target_query_templates 
      SET usage_count = usage_count + 1, last_used_at = NOW()
      WHERE id = record_id;
    WHEN 'mapping_templates' THEN
      UPDATE mapping_templates 
      SET usage_count = usage_count + 1, last_used_at = NOW()
      WHERE id = record_id;
    WHEN 'variable_mapping_templates' THEN
      UPDATE variable_mapping_templates 
      SET usage_count = usage_count + 1, last_used_at = NOW()
      WHERE id = record_id;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 마이그레이션 완료 확인 쿼리
-- =====================================================

-- 테이블 생성 확인
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename IN (
  'workflows', 
  'kakao_templates', 
  'target_query_templates', 
  'mapping_templates',
  'variable_mapping_templates',
  'message_logs'
)
ORDER BY tablename;

-- 컬럼 구조 확인
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('workflows', 'message_logs', 'kakao_templates', 'mapping_templates')
ORDER BY table_name, ordinal_position;

-- 샘플 데이터 확인
SELECT 'kakao_templates' as table_name, COUNT(*) as record_count FROM kakao_templates
UNION ALL
SELECT 'target_query_templates' as table_name, COUNT(*) as record_count FROM target_query_templates  
UNION ALL
SELECT 'mapping_templates' as table_name, COUNT(*) as record_count FROM mapping_templates
UNION ALL
SELECT 'workflows' as table_name, COUNT(*) as record_count FROM workflows;

-- =====================================================
-- 실행 완료!
-- 이제 3단계 워크플로우 최적화가 안전하게 완료되었습니다.
-- ===================================================== 