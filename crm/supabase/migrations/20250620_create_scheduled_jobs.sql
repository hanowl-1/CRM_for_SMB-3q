-- 영구 스케줄러를 위한 scheduled_jobs 테이블 생성
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  workflow_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_time ON scheduled_jobs(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_workflow_id ON scheduled_jobs(workflow_id);

-- 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER trigger_update_scheduled_jobs_updated_at
  BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_jobs_updated_at();

-- 상태 체크 제약 조건
ALTER TABLE scheduled_jobs 
ADD CONSTRAINT check_status 
CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));

-- 코멘트 추가
COMMENT ON TABLE scheduled_jobs IS '영구 스케줄러를 위한 예약된 작업 테이블';
COMMENT ON COLUMN scheduled_jobs.workflow_id IS '실행할 워크플로우 ID';
COMMENT ON COLUMN scheduled_jobs.scheduled_time IS '예약된 실행 시간';
COMMENT ON COLUMN scheduled_jobs.status IS '작업 상태 (pending, running, completed, failed, cancelled)';
COMMENT ON COLUMN scheduled_jobs.workflow_data IS '워크플로우 전체 데이터 (JSON)';
COMMENT ON COLUMN scheduled_jobs.retry_count IS '재시도 횟수';
COMMENT ON COLUMN scheduled_jobs.max_retries IS '최대 재시도 횟수'; 