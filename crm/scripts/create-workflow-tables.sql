-- 워크플로우 테이블
CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
    
    -- 메시지 설정
    message_type VARCHAR(50) NOT NULL, -- 'alimtalk', 'sms', 'lms'
    message_content TEXT NOT NULL,
    selected_variables JSONB DEFAULT '[]',
    
    -- 대상 고객 설정
    target_condition VARCHAR(100),
    custom_conditions JSONB DEFAULT '[]',
    
    -- 트리거 이벤트 설정
    trigger_event VARCHAR(100) NOT NULL,
    event_conditions JSONB DEFAULT '[]',
    
    -- 대기 시간 설정
    delay_enabled BOOLEAN DEFAULT FALSE,
    delay_time INTEGER DEFAULT 0,
    delay_unit VARCHAR(20) DEFAULT 'minutes',
    
    -- 추가 필터 설정
    additional_filters JSONB DEFAULT '[]',
    
    -- 운영 설정
    operation_days INTEGER DEFAULT 7, -- -1은 무제한
    operation_hours VARCHAR(50) DEFAULT '24hours',
    max_sends INTEGER,
    
    -- 목표 설정
    goal_enabled BOOLEAN DEFAULT FALSE,
    goal_conditions JSONB DEFAULT '[]',
    
    -- 통계
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_run_at TIMESTAMP
);

-- 워크플로우 실행 로그 테이블
CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    customer_id INTEGER,
    customer_data JSONB, -- 실행 시점의 고객 데이터 스냅샷
    
    -- 실행 단계별 상태
    trigger_matched BOOLEAN DEFAULT FALSE,
    target_matched BOOLEAN DEFAULT FALSE,
    delay_completed BOOLEAN DEFAULT FALSE,
    filters_passed BOOLEAN DEFAULT FALSE,
    message_sent BOOLEAN DEFAULT FALSE,
    goal_achieved BOOLEAN DEFAULT FALSE,
    
    -- 메시지 발송 정보
    message_id VARCHAR(255), -- 외부 서비스 메시지 ID
    phone_number VARCHAR(20),
    final_message_content TEXT,
    
    -- 실행 결과
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'goal_achieved'
    error_message TEXT,
    
    -- 타임스탬프
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scheduled_send_at TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    goal_achieved_at TIMESTAMP
);

-- 워크플로우 일별 통계 테이블
CREATE TABLE IF NOT EXISTS workflow_daily_stats (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    triggered_count INTEGER DEFAULT 0,
    target_matched_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    goal_achieved_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workflow_id, date)
);

-- 고객 이벤트 로그 테이블 (트리거 감지용)
CREATE TABLE IF NOT EXISTS customer_events (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    event_type VARCHAR(100) NOT NULL, -- 'signup', 'login', 'cart_add', 'purchase', 'page_view' 등
    event_data JSONB, -- 이벤트 관련 추가 데이터
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_scheduled_send ON workflow_executions(scheduled_send_at);
CREATE INDEX IF NOT EXISTS idx_customer_events_customer_id ON customer_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_events_type_created ON customer_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_daily_stats_workflow_date ON workflow_daily_stats(workflow_id, date);
