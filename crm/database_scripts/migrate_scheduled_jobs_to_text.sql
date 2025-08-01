-- ==========================================
-- scheduled_jobs 테이블 시간 컬럼 TEXT 마이그레이션
-- TIMESTAMPTZ → TEXT 변환으로 한국시간 정확 저장
-- ==========================================

-- 백업 테이블 생성 (안전장치)
CREATE TABLE IF NOT EXISTS scheduled_jobs_backup_timestamptz AS 
SELECT * FROM scheduled_jobs;

-- 1. scheduled_time 컬럼 변경
DO $$
BEGIN
  -- 기존 TIMESTAMPTZ 데이터를 한국시간 TEXT로 변환
  ALTER TABLE scheduled_jobs ADD COLUMN scheduled_time_new TEXT;
  
  UPDATE scheduled_jobs 
  SET scheduled_time_new = to_char(scheduled_time AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')
  WHERE scheduled_time IS NOT NULL;
  
  -- 기존 컬럼 삭제 후 새 컬럼으로 대체
  ALTER TABLE scheduled_jobs DROP COLUMN scheduled_time;
  ALTER TABLE scheduled_jobs RENAME COLUMN scheduled_time_new TO scheduled_time;
  
  -- NOT NULL 제약 조건 추가
  ALTER TABLE scheduled_jobs ALTER COLUMN scheduled_time SET NOT NULL;
  
  RAISE NOTICE '✅ scheduled_time 컬럼 TEXT 변환 완료';
END $$;

-- 2. created_at 컬럼 변경
DO $$
BEGIN
  ALTER TABLE scheduled_jobs ADD COLUMN created_at_new TEXT;
  
  UPDATE scheduled_jobs 
  SET created_at_new = to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')
  WHERE created_at IS NOT NULL;
  
  ALTER TABLE scheduled_jobs DROP COLUMN created_at;
  ALTER TABLE scheduled_jobs RENAME COLUMN created_at_new TO created_at;
  
  -- 기본값 설정
  ALTER TABLE scheduled_jobs ALTER COLUMN created_at SET DEFAULT (to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'));
  
  RAISE NOTICE '✅ created_at 컬럼 TEXT 변환 완료';
END $$;

-- 3. updated_at 컬럼 변경
DO $$
BEGIN
  ALTER TABLE scheduled_jobs ADD COLUMN updated_at_new TEXT;
  
  UPDATE scheduled_jobs 
  SET updated_at_new = to_char(updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')
  WHERE updated_at IS NOT NULL;
  
  ALTER TABLE scheduled_jobs DROP COLUMN updated_at;
  ALTER TABLE scheduled_jobs RENAME COLUMN updated_at_new TO updated_at;
  
  -- 기본값 설정
  ALTER TABLE scheduled_jobs ALTER COLUMN updated_at SET DEFAULT (to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'));
  
  RAISE NOTICE '✅ updated_at 컬럼 TEXT 변환 완료';
END $$;

-- 4. executed_at 컬럼 변경 (nullable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scheduled_jobs' 
    AND column_name = 'executed_at'
    AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE scheduled_jobs ADD COLUMN executed_at_new TEXT;
    
    UPDATE scheduled_jobs 
    SET executed_at_new = to_char(executed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')
    WHERE executed_at IS NOT NULL;
    
    ALTER TABLE scheduled_jobs DROP COLUMN executed_at;
    ALTER TABLE scheduled_jobs RENAME COLUMN executed_at_new TO executed_at;
    
    RAISE NOTICE '✅ executed_at 컬럼 TEXT 변환 완료';
  ELSE
    -- 컬럼이 없으면 생성
    ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS executed_at TEXT;
    RAISE NOTICE '✅ executed_at 컬럼 생성 완료';
  END IF;
END $$;

-- 5. completed_at 컬럼 변경 (nullable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scheduled_jobs' 
    AND column_name = 'completed_at'
    AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE scheduled_jobs ADD COLUMN completed_at_new TEXT;
    
    UPDATE scheduled_jobs 
    SET completed_at_new = to_char(completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')
    WHERE completed_at IS NOT NULL;
    
    ALTER TABLE scheduled_jobs DROP COLUMN completed_at;
    ALTER TABLE scheduled_jobs RENAME COLUMN completed_at_new TO completed_at;
    
    RAISE NOTICE '✅ completed_at 컬럼 TEXT 변환 완료';
  ELSE
    -- 컬럼이 없으면 생성
    ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS completed_at TEXT;
    RAISE NOTICE '✅ completed_at 컬럼 생성 완료';
  END IF;
END $$;

-- 6. failed_at 컬럼 추가 (없으면)
ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS failed_at TEXT;

-- 7. 인덱스 재생성 (TEXT 기반)
DROP INDEX IF EXISTS idx_scheduled_jobs_scheduled_time;
CREATE INDEX idx_scheduled_jobs_scheduled_time ON scheduled_jobs(scheduled_time);

DROP INDEX IF EXISTS idx_scheduled_jobs_status_time;  
CREATE INDEX idx_scheduled_jobs_status_time ON scheduled_jobs(status, scheduled_time);

-- 8. 자동 업데이트 트리거 함수 수정
CREATE OR REPLACE FUNCTION update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. 트리거 재생성
DROP TRIGGER IF EXISTS trigger_update_scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER trigger_update_scheduled_jobs_updated_at
  BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_jobs_updated_at();

-- 10. 결과 확인
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'scheduled_jobs' 
AND column_name IN ('scheduled_time', 'created_at', 'updated_at', 'executed_at', 'completed_at', 'failed_at')
ORDER BY ordinal_position;

-- 11. 샘플 데이터 확인
SELECT 
  id,
  workflow_data->>'name' as workflow_name,
  scheduled_time,
  status,
  created_at,
  updated_at
FROM scheduled_jobs 
ORDER BY created_at DESC 
LIMIT 5;

RAISE NOTICE '🎉 scheduled_jobs 테이블 TEXT 마이그레이션 완료!';
RAISE NOTICE '📋 이제 모든 시간 필드가 한국시간 문자열로 저장됩니다.';
RAISE NOTICE '🔧 애플리케이션 코드에서 +09:00 제거하고 순수 한국시간 문자열만 저장하세요.'; 