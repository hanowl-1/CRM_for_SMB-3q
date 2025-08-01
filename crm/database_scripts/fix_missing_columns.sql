-- =====================================================
-- 누락된 데이터베이스 컬럼 추가 스크립트
-- =====================================================

-- 1. scheduled_jobs 테이블에 started_at 컬럼 추가
-- =====================================================
ALTER TABLE scheduled_jobs 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- 2. message_logs 테이블에 workflow_name 컬럼 추가
-- =====================================================
ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS workflow_name VARCHAR(255);

-- 3. message_logs 테이블에 추가 필요 컬럼들 확인 및 추가
-- =====================================================
ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS workflow_id UUID;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'kakao';

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20);

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS message_content TEXT;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4. 인덱스 추가
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_started_at ON scheduled_jobs(started_at);
CREATE INDEX IF NOT EXISTS idx_message_logs_workflow_name ON message_logs(workflow_name);
CREATE INDEX IF NOT EXISTS idx_message_logs_workflow_id ON message_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);

-- 5. 코멘트 추가
-- =====================================================
COMMENT ON COLUMN scheduled_jobs.started_at IS '작업 시작 시간';
COMMENT ON COLUMN message_logs.workflow_name IS '워크플로우 이름';
COMMENT ON COLUMN message_logs.workflow_id IS '워크플로우 ID';
COMMENT ON COLUMN message_logs.message_type IS '메시지 타입 (kakao, sms 등)';
COMMENT ON COLUMN message_logs.recipient_phone IS '수신자 전화번호';
COMMENT ON COLUMN message_logs.recipient_name IS '수신자 이름';
COMMENT ON COLUMN message_logs.message_content IS '메시지 내용';
COMMENT ON COLUMN message_logs.status IS '발송 상태'; 