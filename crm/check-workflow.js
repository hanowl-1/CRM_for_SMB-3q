const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './dev.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkflow() {
  try {
    console.log('워크플로우 "테스트" 설정 확인 중...\n');
    
    // 워크플로우 정보 조회
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('name', '테스트')
      .single();
    
    if (workflowError) {
      console.error('워크플로우 조회 오류:', workflowError);
      return;
    }
    
    if (!workflow) {
      console.log('"테스트" 워크플로우를 찾을 수 없습니다.');
      return;
    }
    
    console.log('=== 워크플로우 기본 정보 ===');
    console.log('ID:', workflow.id);
    console.log('이름:', workflow.name);
    console.log('상태:', workflow.status);
    console.log('생성일:', workflow.created_at);
    console.log('수정일:', workflow.updated_at);
    
    console.log('\n=== 스케줄 설정 ===');
    if (workflow.schedule_settings) {
      const schedule = workflow.schedule_settings;
      console.log('스케줄 설정:', JSON.stringify(schedule, null, 2));
      
      if (schedule.time) {
        console.log('설정된 시간:', schedule.time);
      }
      if (schedule.frequency) {
        console.log('반복 주기:', schedule.frequency);
      }
    } else {
      console.log('스케줄 설정이 없습니다.');
    }
    
    console.log('\n=== 테스트 설정 ===');
    if (workflow.test_settings) {
      const testSettings = workflow.test_settings;
      console.log('테스트 설정:', JSON.stringify(testSettings, null, 2));
      
      if (testSettings.enableRealSending !== undefined) {
        console.log('실제 발송 모드:', testSettings.enableRealSending ? '✅ 활성화됨' : '❌ 비활성화됨');
      } else {
        console.log('실제 발송 모드: ❌ 설정되지 않음 (기본값: false)');
      }
    } else {
      console.log('테스트 설정이 없습니다. (기본값: enableRealSending = false)');
    }
    
    // 스케줄 작업 확인
    console.log('\n=== 스케줄 작업 확인 ===');
    const { data: jobs, error: jobsError } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('workflow_id', workflow.id)
      .eq('status', 'active')
      .order('scheduled_time', { ascending: true });
    
    if (jobsError) {
      console.error('스케줄 작업 조회 오류:', jobsError);
      return;
    }
    
    if (jobs && jobs.length > 0) {
      console.log('활성 스케줄 작업 수:', jobs.length);
      jobs.forEach((job, index) => {
        const scheduledTime = new Date(job.scheduled_time);
        const koreaTime = scheduledTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        console.log(`${index + 1}. 작업 ID: ${job.id}`);
        console.log(`   예정 시간: ${koreaTime}`);
        console.log(`   작업 타입: ${job.job_type}`);
        console.log(`   상태: ${job.status}`);
        console.log(`   생성일: ${new Date(job.created_at).toLocaleString('ko-KR')}`);
        console.log('');
      });
      
      // 2시 50분 작업 특별 확인
      const job250 = jobs.find(job => {
        const scheduledTime = new Date(job.scheduled_time);
        return scheduledTime.getHours() === 14 && scheduledTime.getMinutes() === 50;
      });
      
      if (job250) {
        console.log('🎯 2시 50분 작업 발견!');
        console.log('작업 ID:', job250.id);
        console.log('예정 시간:', new Date(job250.scheduled_time).toLocaleString('ko-KR'));
        console.log('상태:', job250.status);
      } else {
        console.log('⚠️ 2시 50분 작업이 없습니다.');
      }
    } else {
      console.log('활성 스케줄 작업이 없습니다.');
    }
    
    // 현재 시간 확인
    console.log('\n=== 현재 시간 정보 ===');
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', {timeZone: 'Asia/Seoul'}));
    console.log('현재 한국 시간:', koreaTime.toLocaleString('ko-KR'));
    console.log('현재 시:', koreaTime.getHours());
    console.log('현재 분:', koreaTime.getMinutes());
    
  } catch (error) {
    console.error('확인 중 오류 발생:', error);
  }
}

checkWorkflow(); 