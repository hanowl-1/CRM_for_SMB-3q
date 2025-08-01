-- =====================================================
-- 변수-대상자 쿼리 매핑 테이블 생성
-- 변수 쿼리 결과와 대상자 쿼리 결과 간의 컬럼 매핑 저장
-- =====================================================

-- 변수 쿼리 매핑 테이블 (새로운 방식)
CREATE TABLE IF NOT EXISTS variable_query_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 기본 정보
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- 변수 정보
  template_variable VARCHAR(255) NOT NULL, -- 템플릿에서 사용되는 변수명 (예: #total_reviews)
  
  -- 변수 쿼리 설정
  variable_query_sql TEXT NOT NULL, -- 변수 값을 가져올 쿼리
  variable_query_key_column VARCHAR(255) NOT NULL, -- 변수 쿼리의 키 컬럼 (예: id)
  variable_query_value_column VARCHAR(255) NOT NULL, -- 변수 쿼리의 값 컬럼 (예: total_reviews)
  
  -- 대상자 쿼리 매핑
  target_query_key_column VARCHAR(255) NOT NULL, -- 대상자 쿼리의 키 컬럼 (예: id)
  
  -- 포맷팅 및 기본값
  formatter VARCHAR(50) DEFAULT 'text' CHECK (formatter IN ('text', 'number', 'currency', 'date', 'phone')),
  default_value TEXT,
  
  -- 분류 및 태그
  category VARCHAR(100) DEFAULT 'general',
  tags JSONB DEFAULT '[]',
  
  -- 사용 통계
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- 공유 설정
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  
  -- 메타데이터
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 제약조건: 사용자별로 템플릿 변수명은 유일
  UNIQUE(template_variable, created_by)
);

-- 워크플로우별 변수 매핑 설정 테이블
CREATE TABLE IF NOT EXISTS workflow_variable_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 워크플로우 정보
  workflow_id UUID NOT NULL,
  
  -- 변수 매핑 정보 (JSONB 배열로 저장)
  variable_mappings JSONB NOT NULL DEFAULT '[]',
  -- 예시 구조:
  -- [
  --   {
  --     "templateVariable": "#total_reviews",
  --     "variableQuerySql": "SELECT id, total_reviews FROM reviews WHERE company_id = {id}",
  --     "variableQueryKeyColumn": "id",
  --     "variableQueryValueColumn": "total_reviews", 
  --     "targetQueryKeyColumn": "id",
  --     "formatter": "number",
  --     "defaultValue": "0"
  --   }
  -- ]
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 외래키 제약조건
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  
  -- 제약조건: 워크플로우당 하나의 매핑 설정
  UNIQUE(workflow_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_variable_query_mappings_template_variable 
  ON variable_query_mappings(template_variable);
  
CREATE INDEX IF NOT EXISTS idx_variable_query_mappings_category 
  ON variable_query_mappings(category);
  
CREATE INDEX IF NOT EXISTS idx_variable_query_mappings_created_by 
  ON variable_query_mappings(created_by);
  
CREATE INDEX IF NOT EXISTS idx_workflow_variable_mappings_workflow_id 
  ON workflow_variable_mappings(workflow_id);

-- RLS 정책 설정
ALTER TABLE variable_query_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_variable_mappings ENABLE ROW LEVEL SECURITY;

-- public 또는 본인이 생성한 매핑만 조회 가능
CREATE POLICY "Allow read access to variable_query_mappings" 
  ON variable_query_mappings FOR SELECT 
  USING (is_public = true OR created_by = auth.uid()::text);

-- 본인이 생성한 매핑만 수정 가능
CREATE POLICY "Allow users to manage their variable_query_mappings" 
  ON variable_query_mappings FOR ALL 
  USING (created_by = auth.uid()::text)
  WITH CHECK (created_by = auth.uid()::text);

-- 워크플로우 매핑은 인증된 사용자만 접근 가능
CREATE POLICY "Allow authenticated users to manage workflow_variable_mappings" 
  ON workflow_variable_mappings FOR ALL 
  TO authenticated
  USING (true) WITH CHECK (true);

-- 샘플 데이터 삽입
INSERT INTO variable_query_mappings (
  name, 
  description, 
  template_variable, 
  variable_query_sql, 
  variable_query_key_column, 
  variable_query_value_column, 
  target_query_key_column,
  formatter,
  category,
  is_public,
  created_by
) VALUES 
(
  '총 리뷰 수 조회',
  '회사별 총 리뷰 개수를 조회하는 변수 매핑',
  '#total_reviews',
  'SELECT id, COUNT(*) as total_reviews FROM reviews WHERE company_id = {id} GROUP BY id',
  'id',
  'total_reviews',
  'id',
  'number',
  'performance',
  true,
  'system'
),
(
  '월간 리뷰 수 조회',
  '회사별 이번 달 리뷰 개수를 조회하는 변수 매핑',
  '#monthly_review_count',
  'SELECT id, COUNT(*) as monthly_reviews FROM reviews WHERE company_id = {id} AND created_at >= DATE_TRUNC(''month'', NOW()) GROUP BY id',
  'id',
  'monthly_reviews',
  'id',
  'number',
  'performance',
  true,
  'system'
),
(
  '평점 5점 리뷰어 수',
  '회사별 평점 5점을 준 리뷰어 수를 조회하는 변수 매핑',
  '#top_5p_reviewers_count',
  'SELECT id, COUNT(*) as top_reviewers FROM reviews WHERE company_id = {id} AND rating = 5 GROUP BY id',
  'id',
  'top_reviewers',
  'id',
  'number',
  'performance',
  true,
  'system'
);

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 변수-대상자 쿼리 매핑 테이블이 성공적으로 생성되었습니다!';
  RAISE NOTICE '📊 variable_query_mappings: 재사용 가능한 변수 매핑 템플릿';
  RAISE NOTICE '🔗 workflow_variable_mappings: 워크플로우별 변수 매핑 설정';
  RAISE NOTICE '🎯 샘플 데이터 3개가 추가되었습니다.';
END $$; 