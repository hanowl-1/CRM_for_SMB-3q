-- ==========================================
-- scheduled_jobs 테이블 TEXT 변환 (간단 버전)
-- 직접 Supabase SQL 편집기에서 실행하세요
-- ==========================================

-- 1. 현재 테이블 구조 확인
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'scheduled_jobs'
ORDER BY ordinal_position;

-- 2. 백업 테이블 생성 (안전장치)
DROP TABLE IF EXISTS scheduled_jobs_backup;
CREATE TABLE scheduled_jobs_backup AS SELECT * FROM scheduled_jobs;

-- 3. 새로운 테이블 생성 (TEXT 기반)
DROP TABLE IF EXISTS scheduled_jobs_new;
CREATE TABLE scheduled_jobs_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  scheduled_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  workflow_data JSONB NOT NULL,
  created_at TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')),
  executed_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- 4. 기존 데이터를 새 테이블로 복사 (시간 변환)
INSERT INTO scheduled_jobs_new (
  id, workflow_id, scheduled_time, status, workflow_data,
  created_at, updated_at, executed_at, completed_at, failed_at,
  error_message, retry_count, max_retries
)
SELECT 
  id, 
  workflow_id,
  to_char(scheduled_time AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') as scheduled_time,
  status,
  workflow_data,
  to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') as created_at,
  to_char(updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') as updated_at,
  CASE WHEN executed_at IS NOT NULL 
    THEN to_char(executed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') 
    ELSE NULL END as executed_at,
  CASE WHEN completed_at IS NOT NULL 
    THEN to_char(completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') 
    ELSE NULL END as completed_at,
  CASE WHEN failed_at IS NOT NULL 
    THEN to_char(failed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') 
    ELSE NULL END as failed_at,
  error_message,
  retry_count,
  max_retries
FROM scheduled_jobs;

-- 5. 기존 테이블 삭제 후 새 테이블로 교체
DROP TABLE scheduled_jobs;
ALTER TABLE scheduled_jobs_new RENAME TO scheduled_jobs;

-- 6. 인덱스 생성
CREATE INDEX idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX idx_scheduled_jobs_scheduled_time ON scheduled_jobs(scheduled_time);
CREATE INDEX idx_scheduled_jobs_workflow_id ON scheduled_jobs(workflow_id);
CREATE INDEX idx_scheduled_jobs_status_time ON scheduled_jobs(status, scheduled_time);

-- 7. 자동 업데이트 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER trigger_update_scheduled_jobs_updated_at
  BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_jobs_updated_at();

-- 9. 결과 확인
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'scheduled_jobs'
ORDER BY ordinal_position;

-- 10. 변환된 데이터 확인
SELECT 
  id,
  workflow_data->>'name' as workflow_name,
  scheduled_time,
  status,
  created_at
FROM scheduled_jobs 
ORDER BY created_at DESC 
LIMIT 3;

-- 완료 메시지
SELECT '✅ scheduled_jobs 테이블이 TEXT 형태로 변환되었습니다!' as result; 