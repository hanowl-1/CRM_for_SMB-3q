-- RLS 정책 수정 - Service Role 우회 설정
-- Supabase SQL 에디터에서 실행하세요

-- 1. 모든 기존 정책 삭제
DROP POLICY IF EXISTS "service_role_all_access" ON individual_variable_mappings;
DROP POLICY IF EXISTS "authenticated_read_access" ON individual_variable_mappings;
DROP POLICY IF EXISTS "authenticated_insert_access" ON individual_variable_mappings;
DROP POLICY IF EXISTS "authenticated_update_access" ON individual_variable_mappings;
DROP POLICY IF EXISTS "authenticated_delete_access" ON individual_variable_mappings;
DROP POLICY IF EXISTS "anonymous_read_public" ON individual_variable_mappings;
DROP POLICY IF EXISTS "dev_all_access" ON individual_variable_mappings;
DROP POLICY IF EXISTS "Allow read access for all users" ON individual_variable_mappings;
DROP POLICY IF EXISTS "Allow insert access for all users" ON individual_variable_mappings;
DROP POLICY IF EXISTS "Allow update access for all users" ON individual_variable_mappings;
DROP POLICY IF EXISTS "Allow delete access for all users" ON individual_variable_mappings;

-- 2. RLS 비활성화 (임시)
ALTER TABLE individual_variable_mappings DISABLE ROW LEVEL SECURITY;

-- 3. 테이블 권한 확인 및 부여
GRANT ALL ON individual_variable_mappings TO service_role;
GRANT ALL ON individual_variable_mappings TO authenticated;
GRANT SELECT ON individual_variable_mappings TO anon;

-- 4. RLS 다시 활성화
ALTER TABLE individual_variable_mappings ENABLE ROW LEVEL SECURITY;

-- 5. Service Role에 대한 완전한 우회 정책
CREATE POLICY "service_role_bypass_rls" ON individual_variable_mappings
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. 개발용 전체 접근 정책 (모든 사용자)
CREATE POLICY "dev_full_access" ON individual_variable_mappings
  FOR ALL 
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'individual_variable_mappings';

-- RLS 상태 확인
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE tablename = 'individual_variable_mappings'; 