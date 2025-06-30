-- ==========================================
-- 스케줄러 시스템 설정 SQL 스크립트
-- 메시지 자동화 플랫폼 - 스케줄러 시스템
-- 작성일: 2025.06.23
-- 업데이트: 2025.06.30 - 한국시간 저장 방식으로 변경
-- ==========================================

-- ==========================================
-- 1. scheduled_jobs 테이블 생성 (스케줄러 작업 저장)
-- 🔥 시간 저장 방식: 한국시간 문자열로 저장 (기존 데이터와 호환성 유지)
-- ==========================================
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  
  -- 🔥 한국시간으로 저장 ("2025-07-01 11:45:00" 형식)
  -- TIMESTAMPTZ 대신 TEXT 사용하여 시간대 변환 오류 방지
  scheduled_time TEXT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  workflow_data JSONB NOT NULL,
  
  -- 🔥 생성/수정 시간도 한국시간 문자열로 저장
  created_at TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')),
  
  -- 🔥 실행 관련 시간들 (한국시간 문자열)
  executed_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- ==========================================
-- 2. workflows 테이블에 schedule_config 컬럼 추가
-- (schedule_settings → schedule_config로 변경)
-- ==========================================
DO $$ 
BEGIN 
  -- schedule_config 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflows' AND column_name = 'schedule_config'
  ) THEN
    ALTER TABLE workflows ADD COLUMN schedule_config JSONB;
  END IF;
  
  -- 기존 schedule_settings 데이터가 있다면 schedule_config로 이전
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflows' AND column_name = 'schedule_settings'
  ) THEN
    UPDATE workflows SET schedule_config = schedule_settings WHERE schedule_settings IS NOT NULL;
  END IF;
END $$;

-- ==========================================
-- 3. 인덱스 생성 (성능 최적화)
-- 🔥 TEXT 타입 시간 필드에 대한 인덱스
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
-- 🔥 한국시간 문자열로 updated_at 업데이트
-- ==========================================
CREATE OR REPLACE FUNCTION update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS');
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
-- 6. 유틸리티 뷰 생성 (모니터링용)
-- 🔥 한국시간 문자열 기반 집계
-- ==========================================
CREATE OR REPLACE VIEW scheduled_jobs_summary AS
SELECT 
  status,
  COUNT(*) as count,
  MIN(scheduled_time) as earliest_scheduled,
  MAX(scheduled_time) as latest_scheduled,
  -- 🔥 한국시간 기준 지연 작업 계산
  COUNT(*) FILTER (WHERE 
    scheduled_time < to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') 
    AND status = 'pending'
  ) as overdue_count
FROM scheduled_jobs 
GROUP BY status;

-- ==========================================
-- 7. 정리 함수 생성 (오래된 로그 삭제용)
-- 🔥 한국시간 기준 날짜 계산
-- ==========================================
CREATE OR REPLACE FUNCTION cleanup_old_scheduled_jobs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  cutoff_date TEXT;
BEGIN
  -- 한국시간 기준 cutoff 날짜 계산
  cutoff_date := to_char(
    (NOW() AT TIME ZONE 'Asia/Seoul') - INTERVAL '1 day' * days_to_keep, 
    'YYYY-MM-DD HH24:MI:SS'
  );
  
  DELETE FROM scheduled_jobs 
  WHERE status IN ('completed', 'failed', 'cancelled') 
    AND updated_at < cutoff_date;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 8. 시간 변환 유틸리티 함수들
-- 🔥 한국시간 ↔ UTC 변환 지원
-- ==========================================

-- 한국시간 문자열을 UTC TIMESTAMPTZ로 변환
CREATE OR REPLACE FUNCTION kst_to_utc(kst_text TEXT)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN (kst_text || '+09:00')::TIMESTAMPTZ AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql;

-- UTC TIMESTAMPTZ를 한국시간 문자열로 변환
CREATE OR REPLACE FUNCTION utc_to_kst(utc_timestamp TIMESTAMPTZ)
RETURNS TEXT AS $$
BEGIN
  RETURN to_char(utc_timestamp AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS');
END;
$$ LANGUAGE plpgsql;

-- 현재 한국시간 문자열 반환
CREATE OR REPLACE FUNCTION current_kst()
RETURNS TEXT AS $$
BEGIN
  RETURN to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS');
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

-- 워크플로우 테이블에 schedule_config 컬럼이 추가되었는지 확인
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'workflows' AND column_name = 'schedule_config';

-- 시간 변환 함수 테스트
-- SELECT 
--   current_kst() as current_korea_time,
--   kst_to_utc('2025-07-01 11:45:00') as converted_to_utc,
--   utc_to_kst(NOW()) as current_utc_to_kst;

-- ==========================================
-- 10. 데이터 마이그레이션 (기존 데이터가 있는 경우)
-- 🔥 TIMESTAMPTZ → TEXT 변환
-- ==========================================

-- 기존 TIMESTAMPTZ 컬럼이 있다면 마이그레이션
DO $$
BEGIN
  -- scheduled_time이 TIMESTAMPTZ 타입인지 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scheduled_jobs' 
    AND column_name = 'scheduled_time' 
    AND data_type = 'timestamp with time zone'
  ) THEN
    RAISE NOTICE '기존 TIMESTAMPTZ 데이터를 한국시간 TEXT로 마이그레이션합니다...';
    
    -- 임시 컬럼 생성
    ALTER TABLE scheduled_jobs ADD COLUMN scheduled_time_new TEXT;
    
    -- 데이터 변환 (UTC → KST)
    UPDATE scheduled_jobs 
    SET scheduled_time_new = to_char(scheduled_time AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS');
    
    -- 기존 컬럼 삭제 및 이름 변경
    ALTER TABLE scheduled_jobs DROP COLUMN scheduled_time;
    ALTER TABLE scheduled_jobs RENAME COLUMN scheduled_time_new TO scheduled_time;
    
    RAISE NOTICE '마이그레이션 완료!';
  END IF;
END $$;

-- ==========================================
-- 설정 완료 메시지
-- ==========================================
DO $$
BEGIN
  RAISE NOTICE '✅ 스케줄러 시스템 설정이 완료되었습니다!';
  RAISE NOTICE '🕐 시간 저장 방식: 한국시간 문자열 (KST)';
  RAISE NOTICE '📋 다음 단계:';
  RAISE NOTICE '1. 테이블 구조 확인: SELECT * FROM scheduled_jobs LIMIT 1;';
  RAISE NOTICE '2. 뷰 확인: SELECT * FROM scheduled_jobs_summary;';
  RAISE NOTICE '3. 시간 함수 테스트: SELECT current_kst(), kst_to_utc(''2025-07-01 11:45:00'');';
  RAISE NOTICE '4. API 테스트: curl http://localhost:3000/api/scheduler/monitor';
END $$; 