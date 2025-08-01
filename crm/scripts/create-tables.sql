-- 캠페인 테이블
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    message_type VARCHAR(50) NOT NULL, -- 'alimtalk', 'sms', 'lms'
    message_content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
    target_condition JSONB,
    trigger_event VARCHAR(100),
    delay_time INTEGER DEFAULT 0,
    delay_unit VARCHAR(20) DEFAULT 'minutes',
    schedule_date TIMESTAMP,
    is_scheduled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 변수 테이블
CREATE TABLE IF NOT EXISTS campaign_variables (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    variable_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 고객 테이블
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    user_data JSONB, -- 동적 사용자 데이터 저장
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 메시지 발송 로그 테이블
CREATE TABLE IF NOT EXISTS message_logs (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id),
    customer_id INTEGER REFERENCES customers(id),
    phone VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'opened', 'clicked'
    external_message_id VARCHAR(255), -- Coolsms 메시지 ID
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 캠페인 통계 테이블
CREATE TABLE IF NOT EXISTS campaign_stats (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, date)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_message_logs_campaign_id ON message_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
CREATE INDEX IF NOT EXISTS idx_message_logs_sent_at ON message_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_campaign_stats_campaign_date ON campaign_stats(campaign_id, date);
