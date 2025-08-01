-- 임시로 RLS 완전 비활성화
ALTER TABLE individual_variable_mappings DISABLE ROW LEVEL SECURITY;

-- 모든 기존 정책 삭제
DROP POLICY IF EXISTS "individual_variable_mappings_service_role_policy" ON individual_variable_mappings;
DROP POLICY IF EXISTS "individual_variable_mappings_authenticated_policy" ON individual_variable_mappings;
DROP POLICY IF EXISTS "individual_variable_mappings_anon_policy" ON individual_variable_mappings;
DROP POLICY IF EXISTS "individual_variable_mappings_dev_policy" ON individual_variable_mappings;

-- 테이블에 대한 모든 권한 부여
GRANT ALL ON individual_variable_mappings TO anon;
GRANT ALL ON individual_variable_mappings TO authenticated;
GRANT ALL ON individual_variable_mappings TO service_role;

-- 시퀀스 이름 확인 후 권한 부여 (일반적인 PostgreSQL 시퀀스 명명 규칙)
-- UUID 기본키를 사용하는 경우 시퀀스가 없을 수 있음
DO $$
BEGIN
    -- 시퀀스가 존재하는지 확인하고 권한 부여
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename LIKE '%individual_variable_mappings%') THEN
        EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon';
        EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated';
        EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role';
    END IF;
END $$;

-- 모든 함수에 대한 권한도 부여
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role; 