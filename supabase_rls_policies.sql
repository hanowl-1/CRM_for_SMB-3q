-- individual_variable_mappings 테이블 RLS 정책 설정
-- Supabase SQL 에디터에서 실행하세요

-- 1. 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Allow read access for all users" ON individual_variable_mappings;
DROP POLICY IF EXISTS "Allow insert access for all users" ON individual_variable_mappings;
DROP POLICY IF EXISTS "Allow update access for all users" ON individual_variable_mappings;
DROP POLICY IF EXISTS "Allow delete access for all users" ON individual_variable_mappings;

-- 2. RLS 활성화 확인
ALTER TABLE individual_variable_mappings ENABLE ROW LEVEL SECURITY;

-- 3. Service Role에 대한 모든 권한 허용 (가장 중요!)
CREATE POLICY "service_role_all_access" ON individual_variable_mappings
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. 인증된 사용자에 대한 읽기 권한
CREATE POLICY "authenticated_read_access" ON individual_variable_mappings
  FOR SELECT 
  TO authenticated
  USING (true);

-- 5. 인증된 사용자에 대한 삽입 권한
CREATE POLICY "authenticated_insert_access" ON individual_variable_mappings
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- 6. 인증된 사용자에 대한 업데이트 권한 (본인이 생성한 것만)
CREATE POLICY "authenticated_update_access" ON individual_variable_mappings
  FOR UPDATE 
  TO authenticated
  USING (created_by = auth.jwt() ->> 'sub' OR is_public = true)
  WITH CHECK (created_by = auth.jwt() ->> 'sub' OR is_public = true);

-- 7. 인증된 사용자에 대한 삭제 권한 (본인이 생성한 것만)
CREATE POLICY "authenticated_delete_access" ON individual_variable_mappings
  FOR DELETE 
  TO authenticated
  USING (created_by = auth.jwt() ->> 'sub');

-- 8. 익명 사용자에 대한 읽기 권한 (공개된 것만)
CREATE POLICY "anonymous_read_public" ON individual_variable_mappings
  FOR SELECT 
  TO anon
  USING (is_public = true);

-- 9. 개발 환경을 위한 임시 정책 (모든 사용자에게 모든 권한 - 개발용)
-- 운영 환경에서는 이 정책을 삭제하세요!
CREATE POLICY "dev_all_access" ON individual_variable_mappings
  FOR ALL 
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'individual_variable_mappings';

-- 테이블 권한 확인
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'individual_variable_mappings'; 