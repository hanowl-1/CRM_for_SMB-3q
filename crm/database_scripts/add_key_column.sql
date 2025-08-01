-- =====================================================
-- individual_variable_mappings 테이블에 key_column 추가
-- =====================================================

-- key_column 컬럼 추가 (매핑에 사용할 키 컬럼 정보 저장)
ALTER TABLE individual_variable_mappings 
ADD COLUMN IF NOT EXISTS key_column VARCHAR(255) DEFAULT '';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_individual_variable_mappings_key_column 
ON individual_variable_mappings(key_column);

-- 코멘트 추가
COMMENT ON COLUMN individual_variable_mappings.key_column IS '데이터 매핑에 사용할 키 컬럼 (예: a.id)';

-- 기존 데이터에 대해 key_column 기본값 설정 (필요시)
-- UPDATE individual_variable_mappings 
-- SET key_column = 'id' 
-- WHERE key_column IS NULL OR key_column = '';

-- 확인 쿼리
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'individual_variable_mappings' 
  AND column_name = 'key_column'; 