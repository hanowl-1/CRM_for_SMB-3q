-- 크론 신호 로그 테이블 생성
CREATE TABLE IF NOT EXISTS cron_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    signal_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(50) NOT NULL DEFAULT 'aws-lambda', -- 'aws-lambda', 'manual', 'test' 등
    user_agent TEXT,
    ip_address INET,
    request_headers JSONB,
    response_status INTEGER,
    executed_jobs_count INTEGER DEFAULT 0,
    execution_duration_ms INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_cron_signals_signal_time ON cron_signals(signal_time DESC);
CREATE INDEX IF NOT EXISTS idx_cron_signals_source ON cron_signals(source);

-- RLS 정책 설정 (모든 사용자가 읽기 가능, 시스템만 쓰기 가능)
ALTER TABLE cron_signals ENABLE ROW LEVEL SECURITY;

-- 읽기 정책
CREATE POLICY "Anyone can read cron signals" ON cron_signals
    FOR SELECT USING (true);

-- 쓰기 정책 (서비스 역할 키만 가능)
CREATE POLICY "Service role can insert cron signals" ON cron_signals
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update cron signals" ON cron_signals
    FOR UPDATE USING (true);

-- 테이블 설명
COMMENT ON TABLE cron_signals IS '크론 스케줄러 신호 로그 테이블';
COMMENT ON COLUMN cron_signals.signal_time IS '크론 신호 받은 시간';
COMMENT ON COLUMN cron_signals.source IS '신호 출처 (aws-lambda, manual, test)';
COMMENT ON COLUMN cron_signals.executed_jobs_count IS '해당 신호로 실행된 작업 수';
COMMENT ON COLUMN cron_signals.execution_duration_ms IS '실행 소요 시간 (밀리초)'; 