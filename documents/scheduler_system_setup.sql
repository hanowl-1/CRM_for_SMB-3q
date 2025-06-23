-- ==========================================
-- 스케줄러 시스템 설정 SQL 스크립트
-- 메시지 자동화 플랫폼 - 스케줄러 시스템
-- 작성일: 2025.06.23
-- ==========================================

-- ==========================================
-- 1. scheduled_jobs 테이블 생성 (스케줄러 작업 저장)
-- ==========================================
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  workflow_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- ==========================================
-- 2. workflows 테이블에 schedule_settings 컬럼 추가
-- ==========================================
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflows' AND column_name = 'schedule_settings'
  ) THEN
    ALTER TABLE workflows ADD COLUMN schedule_settings JSONB;
  END IF;
END $$;

-- ==========================================
-- 3. 인덱스 생성 (성능 최적화)
-- ==========================================
-- scheduled_jobs 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_time ON scheduled_jobs(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_workflow_id ON scheduled_jobs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status_time ON scheduled_jobs(status, scheduled_time);

-- workflows 테이블 인덱스 (이미 있을 수 있음)
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

-- ==========================================
-- 4. 자동 업데이트 트리거 함수 생성
-- ==========================================
CREATE OR REPLACE FUNCTION update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 5. 트리거 생성 (updated_at 자동 업데이트)
-- ==========================================
DROP TRIGGER IF EXISTS trigger_update_scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER trigger_update_scheduled_jobs_updated_at
  BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_jobs_updated_at();

-- ==========================================
-- 6. RLS (Row Level Security) 설정 (선택사항)
-- ==========================================
-- 필요한 경우 RLS 활성화
-- ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 접근할 수 있도록 정책 생성 (개발 환경용)
-- CREATE POLICY "Allow all operations on scheduled_jobs" ON scheduled_jobs
--   FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 7. 유틸리티 뷰 생성 (모니터링용)
-- ==========================================
CREATE OR REPLACE VIEW scheduled_jobs_summary AS
SELECT 
  status,
  COUNT(*) as count,
  MIN(scheduled_time) as earliest_scheduled,
  MAX(scheduled_time) as latest_scheduled,
  COUNT(*) FILTER (WHERE scheduled_time < NOW() AND status = 'pending') as overdue_count
FROM scheduled_jobs 
GROUP BY status;

-- ==========================================
-- 8. 정리 함수 생성 (오래된 로그 삭제용)
-- ==========================================
CREATE OR REPLACE FUNCTION cleanup_old_scheduled_jobs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM scheduled_jobs 
  WHERE status IN ('completed', 'failed', 'cancelled') 
    AND updated_at < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 9. 테스트 데이터 확인 쿼리 (실행 후 확인용)
-- ==========================================
-- 다음 쿼리들로 설정이 제대로 되었는지 확인하세요:

-- 테이블 구조 확인
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'scheduled_jobs' 
-- ORDER BY ordinal_position;

-- 워크플로우 테이블에 schedule_settings 컬럼이 추가되었는지 확인
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'workflows' AND column_name = 'schedule_settings';

-- 인덱스 확인
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('scheduled_jobs', 'workflows');

-- ==========================================
-- 10. 샘플 데이터 삽입 (테스트용 - 선택사항)
-- ==========================================
-- 테스트용 워크플로우 업데이트 (기존 워크플로우가 있다면)
-- UPDATE workflows 
-- SET schedule_settings = '{
--   "type": "recurring",
--   "timezone": "Asia/Seoul",
--   "recurringPattern": {
--     "time": "09:00",
--     "interval": 1,
--     "frequency": "daily"
--   }
-- }'::jsonb
-- WHERE name = '테스트_스케줄러';

-- ==========================================
-- 설정 완료 메시지
-- ==========================================
DO $$
BEGIN
  RAISE NOTICE '✅ 스케줄러 시스템 설정이 완료되었습니다!';
  RAISE NOTICE '📋 다음 단계:';
  RAISE NOTICE '1. 테이블 구조 확인: SELECT * FROM scheduled_jobs LIMIT 1;';
  RAISE NOTICE '2. 뷰 확인: SELECT * FROM scheduled_jobs_summary;';
  RAISE NOTICE '3. API 테스트: curl http://localhost:3000/api/scheduler/monitor';
END $$; 