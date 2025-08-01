-- 스케줄러 실행 로그 테이블 생성
CREATE TABLE IF NOT EXISTS scheduler_execution_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    execution_id VARCHAR(255) NOT NULL,  -- 같은 실행 세션을 그룹화하는 ID
    job_id VARCHAR(255),                 -- scheduled_jobs 테이블의 ID
    workflow_id UUID,                    -- workflows 테이블의 ID
    workflow_name VARCHAR(255),          -- 워크플로우 이름 (빠른 조회용)
    step VARCHAR(50) NOT NULL,           -- 실행 단계 (ExecutionStep enum)
    status VARCHAR(20) NOT NULL,         -- started, success, failed, warning
    message TEXT NOT NULL,               -- 단계별 설명 메시지
    details JSONB,                       -- 추가 상세 정보
    error_message TEXT,                  -- 오류 메시지 (실패 시)
    duration_ms INTEGER,                 -- 실행 소요 시간 (밀리초)
    timestamp TIMESTAMPTZ NOT NULL,     -- 실행 시점
    created_at TIMESTAMPTZ DEFAULT NOW() -- 레코드 생성 시점
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_logs_execution_id ON scheduler_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_logs_job_id ON scheduler_execution_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_logs_workflow_id ON scheduler_execution_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_logs_step ON scheduler_execution_logs(step);
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_logs_status ON scheduler_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_logs_created_at ON scheduler_execution_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_logs_timestamp ON scheduler_execution_logs(timestamp);

-- 복합 인덱스 (자주 사용되는 조합)
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_logs_execution_step ON scheduler_execution_logs(execution_id, step);
CREATE INDEX IF NOT EXISTS idx_scheduler_execution_logs_workflow_step ON scheduler_execution_logs(workflow_id, step, created_at);

-- RLS (Row Level Security) 활성화
ALTER TABLE scheduler_execution_logs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능하도록 정책 생성
CREATE POLICY IF NOT EXISTS "Allow read access for all users" ON scheduler_execution_logs
    FOR SELECT USING (true);

-- 서비스 역할만 쓰기 가능하도록 정책 생성  
CREATE POLICY IF NOT EXISTS "Allow insert for service role" ON scheduler_execution_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow update for service role" ON scheduler_execution_logs
    FOR UPDATE USING (true);

-- 스케줄러 실행 단계 ENUM 타입 정의 (참고용 주석)
/*
실행 단계:
1. cron_trigger      - AWS EventBridge/Vercel Cron 트리거
2. scheduler_detect  - 스케줄러 감지 API
3. jobs_query        - scheduled_jobs 테이블 조회
4. workflow_query    - 워크플로우 정보 조회
5. workflow_execute  - 워크플로우 실행 API 호출
6. target_extract    - 대상자 조회 & 추출
7. template_mapping  - 템플릿 변수 매핑
8. message_generate  - 개인화 메시지 생성
9. sms_api_call      - CoolSMS API 호출
10. result_process   - 발송 결과 처리
11. status_update    - 스케줄 작업 상태 업데이트

상태 값:
- started: 단계 시작
- success: 단계 성공
- failed: 단계 실패
- warning: 단계 경고
*/

-- 테이블 설명 추가
COMMENT ON TABLE scheduler_execution_logs IS '스케줄러 워크플로우 실행 과정의 단계별 로그를 저장하는 테이블';
COMMENT ON COLUMN scheduler_execution_logs.execution_id IS '같은 실행 세션을 그룹화하는 고유 ID';
COMMENT ON COLUMN scheduler_execution_logs.step IS '실행 단계 (cron_trigger, scheduler_detect, jobs_query, workflow_query, workflow_execute, target_extract, template_mapping, message_generate, sms_api_call, result_process, status_update)';
COMMENT ON COLUMN scheduler_execution_logs.status IS '단계 상태 (started, success, failed, warning)';
COMMENT ON COLUMN scheduler_execution_logs.details IS '단계별 상세 정보 (JSON 형태)';
COMMENT ON COLUMN scheduler_execution_logs.duration_ms IS '단계 실행 소요 시간 (밀리초)';

-- 샘플 데이터 확인 쿼리 (참고용)
/*
-- 최근 실행 로그 조회
SELECT execution_id, workflow_name, step, status, message, created_at 
FROM scheduler_execution_logs 
ORDER BY created_at DESC 
LIMIT 20;

-- 실행별 단계 진행 상황 조회
SELECT execution_id, workflow_name, 
       COUNT(*) as total_steps,
       COUNT(CASE WHEN status = 'success' THEN 1 END) as success_steps,
       COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_steps,
       MIN(created_at) as started_at,
       MAX(created_at) as last_step_at
FROM scheduler_execution_logs 
GROUP BY execution_id, workflow_name
ORDER BY MIN(created_at) DESC;

-- 단계별 성공률 통계
SELECT step, 
       COUNT(*) as total,
       COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
       COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
       ROUND(COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
FROM scheduler_execution_logs 
GROUP BY step
ORDER BY step;
*/ 