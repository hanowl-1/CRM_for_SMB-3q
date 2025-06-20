const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createScheduledJobsTable() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('🚀 scheduled_jobs 테이블 생성 중...');
  
  const sql = `
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
    ADD CONSTRAINT IF NOT EXISTS check_status 
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ 테이블 생성 실패:', error);
      
      // exec_sql이 없으면 직접 SQL 실행 시도
      console.log('🔄 직접 SQL 실행 시도...');
      
      // 테이블 생성만 시도
      const { error: createError } = await supabase
        .from('scheduled_jobs')
        .select('*')
        .limit(1);
        
      if (createError && createError.code === '42P01') {
        console.log('⚠️ scheduled_jobs 테이블이 존재하지 않습니다.');
        console.log('📝 Supabase 대시보드에서 수동으로 생성해야 합니다.');
        return false;
      }
    } else {
      console.log('✅ scheduled_jobs 테이블 생성 완료!');
      return true;
    }
  } catch (error) {
    console.error('❌ 스크립트 실행 실패:', error);
    return false;
  }
}

createScheduledJobsTable()
  .then((success) => {
    if (success) {
      console.log('🎉 테이블 생성이 완료되었습니다!');
      process.exit(0);
    } else {
      console.log('⚠️ 수동으로 테이블을 생성해야 합니다.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }); 