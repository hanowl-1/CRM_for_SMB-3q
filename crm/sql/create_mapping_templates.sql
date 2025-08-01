-- 매핑 템플릿 테이블 생성
CREATE TABLE IF NOT EXISTS mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  
  -- 매핑 정보
  target_template_mappings JSONB NOT NULL DEFAULT '[]',
  
  -- 메타데이터
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  
  -- 공유 설정
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  
  -- 인덱스
  CONSTRAINT mapping_templates_name_check CHECK (LENGTH(name) >= 1)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_mapping_templates_category ON mapping_templates(category);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_created_at ON mapping_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_usage_count ON mapping_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_is_public ON mapping_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_is_favorite ON mapping_templates(is_favorite);

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_mapping_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_mapping_templates_updated_at ON mapping_templates;
CREATE TRIGGER trigger_mapping_templates_updated_at
  BEFORE UPDATE ON mapping_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_mapping_templates_updated_at();

-- RLS 정책 설정
ALTER TABLE mapping_templates ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 공개 템플릿을 볼 수 있음
CREATE POLICY "Anyone can view public mapping templates" ON mapping_templates
  FOR SELECT USING (is_public = true);

-- 사용자는 자신의 템플릿을 모두 관리할 수 있음 (현재는 인증 없이 모든 템플릿 접근)
CREATE POLICY "Users can manage all mapping templates" ON mapping_templates
  FOR ALL USING (true);

-- 사용자는 템플릿을 생성할 수 있음
CREATE POLICY "Users can create mapping templates" ON mapping_templates
  FOR INSERT WITH CHECK (true);

-- 샘플 데이터 삽입
INSERT INTO mapping_templates (name, description, category, tags, target_template_mappings, is_public, is_favorite) VALUES
(
  '성과 분석 기본 매핑',
  '월간 성과 리포트에 사용되는 기본적인 매핑 템플릿입니다.',
  'performance',
  ARRAY['성과', '리포트', '월간'],
  '[{
    "id": "sample_mapping_1",
    "targetGroupId": "performance_group",
    "templateId": "performance_template",
    "fieldMappings": [
      {
        "templateVariable": "companyName",
        "targetField": "company_name",
        "formatter": "text",
        "defaultValue": "회사명"
      },
      {
        "templateVariable": "totalReviews",
        "targetField": "total_reviews",
        "formatter": "number",
        "defaultValue": "0"
      },
      {
        "templateVariable": "monthlyReviews",
        "targetField": "monthly_reviews",
        "formatter": "number",
        "defaultValue": "0"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }]'::jsonb,
  true,
  false
),
(
  '환영 메시지 매핑',
  '신규 고객 환영 메시지에 사용되는 매핑 템플릿입니다.',
  'welcome',
  ARRAY['환영', '신규고객', '온보딩'],
  '[{
    "id": "sample_mapping_2",
    "targetGroupId": "new_customer_group",
    "templateId": "welcome_template",
    "fieldMappings": [
      {
        "templateVariable": "customerName",
        "targetField": "customer_name",
        "formatter": "text",
        "defaultValue": "고객님"
      },
      {
        "templateVariable": "joinDate",
        "targetField": "created_at",
        "formatter": "date",
        "defaultValue": "오늘"
      },
      {
        "templateVariable": "serviceName",
        "targetField": "service_name",
        "formatter": "text",
        "defaultValue": "서비스"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }]'::jsonb,
  true,
  true
);

-- 테이블 생성 확인
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'mapping_templates' 
ORDER BY ordinal_position; 