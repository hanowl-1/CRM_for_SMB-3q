import { getSupabase } from '@/lib/database/supabase-client';
import { formatKoreaTime } from '@/lib/utils/timezone';

/**
 * 워크플로우 자동 스케줄링 유틸리티
 * 워크플로우가 active 상태로 생성/변경될 때 호출
 */

/**
 * 워크플로우가 active 상태가 될 때 자동 스케줄링
 */
export async function handleWorkflowActivation(workflowData: any) {
  console.log(`🔍 워크플로우 활성화 처리: ${workflowData.name}`);
  
  // 스케줄링 조건 확인
  if (!shouldAutoSchedule(workflowData)) {
    console.log(`⏭️ 자동 스케줄링 조건 불만족: ${workflowData.name}`);
    return { success: true, message: '스케줄링 조건 불만족' };
  }
  
  try {
    // 기존 pending 스케줄 작업 제거
    await cancelExistingScheduledJobs(workflowData.id);
    
    // 새 스케줄 작업 등록
    const result = await createRecurringScheduleJob(workflowData);
    
    if (result.success) {
      console.log(`✅ 워크플로우 자동 스케줄링 완료: ${workflowData.name}`);
    } else {
      console.error(`❌ 워크플로우 자동 스케줄링 실패: ${workflowData.name}`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ 워크플로우 활성화 처리 실패: ${workflowData.name}`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 워크플로우가 비활성화될 때 스케줄 작업 정리
 */
export async function handleWorkflowDeactivation(workflowId: string) {
  console.log(`🛑 워크플로우 비활성화 처리: ${workflowId}`);
  
  try {
    await cancelExistingScheduledJobs(workflowId);
    console.log(`✅ 워크플로우 스케줄 작업 정리 완료: ${workflowId}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ 워크플로우 비활성화 처리 실패: ${workflowId}`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 자동 스케줄링 조건 확인
 */
function shouldAutoSchedule(workflowData: any): boolean {
  const conditions = [
    workflowData.status === 'active',
    workflowData.trigger_type === 'manual',
    workflowData.schedule_config?.type === 'recurring',
    workflowData.schedule_config?.recurringPattern
  ];
  
  console.log(`📋 스케줄링 조건 확인:`, {
    status: workflowData.status,
    trigger_type: workflowData.trigger_type,
    schedule_type: workflowData.schedule_config?.type,
    hasRecurringPattern: !!workflowData.schedule_config?.recurringPattern,
    allConditionsMet: conditions.every(Boolean)
  });
  
  return conditions.every(Boolean);
}

/**
 * 기존 pending 스케줄 작업 취소
 */
async function cancelExistingScheduledJobs(workflowId: string) {
  const supabase = getSupabase();
  
  console.log(`🗑️ 기존 스케줄 작업 정리: ${workflowId}`);
  
  const { data: existingJobs, error: fetchError } = await supabase
    .from('scheduled_jobs')
    .select('id')
    .eq('workflow_id', workflowId)
    .eq('status', 'pending');
    
  if (fetchError) {
    console.error('기존 스케줄 작업 조회 실패:', fetchError);
    throw fetchError;
  }
  
  if (existingJobs && existingJobs.length > 0) {
    const { error: deleteError } = await supabase
      .from('scheduled_jobs')
      .delete()
      .eq('workflow_id', workflowId)
      .eq('status', 'pending');
      
    if (deleteError) {
      console.error('기존 스케줄 작업 삭제 실패:', deleteError);
      throw deleteError;
    }
    
    console.log(`✅ 기존 스케줄 작업 ${existingJobs.length}개 삭제됨`);
  } else {
    console.log(`📋 삭제할 기존 스케줄 작업 없음`);
  }
}

/**
 * 반복 스케줄 작업 생성
 */
async function createRecurringScheduleJob(workflowData: any) {
  const supabase = getSupabase();
  const scheduleConfig = workflowData.schedule_config;
  
  try {
    console.log(`📅 반복 스케줄 작업 생성: ${workflowData.name}`, scheduleConfig.recurringPattern);
    
    // 다음 실행 시간 계산
    const { calculateNextKoreaScheduleTime } = require('@/lib/utils/timezone');
    const { frequency, time, daysOfWeek } = scheduleConfig.recurringPattern;
    const nextScheduledTime = calculateNextKoreaScheduleTime(time, frequency, daysOfWeek);
    
    console.log(`⏰ 다음 실행 시간: ${nextScheduledTime.toISOString()}`);
    
    // 한국시간대 문자열로 변환
    const year = nextScheduledTime.getFullYear();
    const month = String(nextScheduledTime.getMonth() + 1).padStart(2, '0');
    const day = String(nextScheduledTime.getDate()).padStart(2, '0');
    const hours = String(nextScheduledTime.getHours()).padStart(2, '0');
    const minutes = String(nextScheduledTime.getMinutes()).padStart(2, '0');
    const seconds = String(nextScheduledTime.getSeconds()).padStart(2, '0');
    const kstTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+09:00`;
    
    const currentTime = formatKoreaTime(new Date(), 'yyyy-MM-dd HH:mm:ss');
    
    // scheduled_jobs에 등록
    const { data: scheduledJob, error: insertError } = await supabase
      .from('scheduled_jobs')
      .insert({
        workflow_id: workflowData.id,
        workflow_data: {
          ...workflowData,
          variables: {
            ...workflowData.variables,
            testSettings: {
              ...workflowData.variables?.testSettings,
              enableRealSending: true // 스케줄 실행은 실제 발송
            }
          }
        },
        scheduled_time: kstTimeString,
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        created_at: `${currentTime}+09:00`
      })
      .select()
      .single();
      
    if (insertError) {
      console.error('❌ 스케줄 작업 등록 실패:', insertError);
      throw insertError;
    }
    
    console.log(`✅ 스케줄 작업 등록 완료: ${scheduledJob.id} (${kstTimeString})`);
    
    return {
      success: true,
      scheduledJobId: scheduledJob.id,
      scheduledTime: kstTimeString,
      nextExecution: nextScheduledTime.toISOString()
    };
    
  } catch (error) {
    console.error('❌ 반복 스케줄 작업 생성 실패:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

