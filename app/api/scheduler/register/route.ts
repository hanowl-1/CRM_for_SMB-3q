import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { getKoreaTime, koreaTimeToUTC, createKoreaScheduleTime, formatKoreaTime } from '@/lib/utils';

// 다음 실행 시간 계산 함수
function calculateNextRecurringTime(recurringPattern: any): Date {
  const now = getKoreaTime();
  const { frequency, time } = recurringPattern;
  
  console.log(`🕐 현재 한국 시간: ${formatKoreaTime(now)}`);
  
  if (!time) {
    return new Date(now.getTime() + 60 * 60 * 1000); // 1시간 후
  }
  
  const [hours, minutes] = time.split(':').map(Number);
  console.log(`⏰ 설정된 시간: ${hours}:${minutes}`);
  
  // 한국 시간 기준으로 다음 실행 시간 생성
  const nextRun = createKoreaScheduleTime(time);
  
  console.log(`📅 계산된 다음 실행 시간: ${formatKoreaTime(nextRun)}`);
  
  // 현재 시간과 설정된 시간의 차이 계산 (밀리초)
  const timeDiff = nextRun.getTime() - now.getTime();
  console.log(`⏱️ 시간 차이: ${Math.round(timeDiff / 1000 / 60)}분`);
  
  // 설정된 시간이 이미 지났으면 (5분 이상 차이) 다음 실행일로 설정
  if (timeDiff < -5 * 60 * 1000) { // 5분 여유를 둠
    console.log(`⏭️ 오늘 시간이 지났음, 다음 실행일로 설정`);
    
    switch (frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      default:
        nextRun.setDate(nextRun.getDate() + 1);
    }
    console.log(`📅 다음 실행일로 조정: ${formatKoreaTime(nextRun)}`);
  } else {
    console.log(`✅ 오늘 해당 시간에 실행 예정`);
  }
  
  return nextRun;
}

// 워크플로우 스케줄 등록 API
export async function GET(request: NextRequest) {
  try {
    const client = getSupabase();
    const now = getKoreaTime();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log(`🕐 스케줄 등록 실행: ${formatKoreaTime(now)}`);
    
    // 활성 워크플로우들 조회
    const { data: workflows, error: workflowError } = await client
      .from('workflows')
      .select('*')
      .eq('status', 'active');
    
    if (workflowError) {
      console.error('❌ 워크플로우 조회 실패:', workflowError);
      return NextResponse.json({
        success: false,
        message: '워크플로우 조회 실패: ' + workflowError.message
      }, { status: 500 });
    }
    
    let scheduledCount = 0;
    const scheduledJobs = [];
    
    for (const workflow of workflows || []) {
      const scheduleConfig = workflow.schedule_config || workflow.schedule_settings;
      
      if (!scheduleConfig || scheduleConfig.type === 'immediate') {
        continue; // 즉시 실행 워크플로우는 건너뛰기
      }
      
      let scheduledTime: Date | null = null;
      
      switch (scheduleConfig.type) {
        case 'scheduled':
          // 일회성 예약
          if (scheduleConfig.scheduledTime) {
            const targetTime = new Date(scheduleConfig.scheduledTime);
            if (targetTime.toISOString().split('T')[0] === today) {
              scheduledTime = targetTime;
            }
          }
          break;
          
        case 'recurring':
          // 반복 실행 - 다음 실행 시간을 계산하고 등록
          if (scheduleConfig.recurringPattern) {
            const nextTime = calculateNextRecurringTime(scheduleConfig.recurringPattern);
            scheduledTime = nextTime;
          }
          break;
          
        case 'delay':
          // 지연 실행은 여기서 처리하지 않음 (워크플로우 활성화 시 즉시 등록)
          break;
      }
      
      if (scheduledTime) {
        // 이미 등록된 작업이 있는지 확인 (같은 워크플로우의 pending 작업)
        const { data: existingJobs } = await client
          .from('scheduled_jobs')
          .select('id, scheduled_time')
          .eq('workflow_id', workflow.id)
          .eq('status', 'pending');
        
        // 기존 작업이 있으면 정확히 같은 시간인 경우만 건너뛰기
        let shouldCreateNew = true;
        if (existingJobs && existingJobs.length > 0) {
          for (const existingJob of existingJobs) {
            const existingTime = new Date(existingJob.scheduled_time);
            
            // 🔥 정확히 같은 시간(초 단위까지)인 경우만 같은 작업으로 간주
            if (scheduledTime.getTime() === existingTime.getTime()) {
              shouldCreateNew = false;
              console.log(`⏭️ 기존 작업 유지 (정확히 같은 시간): ${workflow.name} → ${formatKoreaTime(existingTime)}`);
              break;
            }
          }
          
          // 새로운 시간으로 등록하는 경우 기존 작업들 삭제
          if (shouldCreateNew) {
            await client
              .from('scheduled_jobs')
              .delete()
              .eq('workflow_id', workflow.id)
              .eq('status', 'pending');
            console.log(`🗑️ 기존 작업 삭제 (시간 변경됨): ${workflow.name}`);
          }
        }
        
        if (shouldCreateNew) {
          // 새 작업 등록 - 한국 시간을 그대로 저장 (DB가 한국 시간대로 설정됨)
          const { data: newJob, error: insertError } = await client
            .from('scheduled_jobs')
            .insert({
              workflow_id: workflow.id,
              workflow_data: {
                id: workflow.id,
                name: workflow.name,
                description: workflow.description,
                message_config: workflow.message_config,
                target_config: workflow.target_config,
                schedule_config: scheduleConfig
              },
              scheduled_time: scheduledTime.toISOString(), // 🔥 한국 시간을 그대로 저장
              status: 'pending',
              retry_count: 0,
              max_retries: 3,
              created_at: now.toISOString() // 🔥 한국 시간을 그대로 저장
            })
            .select()
            .single();
          
          if (insertError) {
            console.error(`❌ 작업 등록 실패 (${workflow.name}):`, insertError);
          } else {
            scheduledCount++;
            scheduledJobs.push({
              workflowName: workflow.name,
              scheduledTime: formatKoreaTime(scheduledTime),
              jobId: newJob.id
            });
            console.log(`✅ 작업 등록: ${workflow.name} → ${formatKoreaTime(scheduledTime)}`);
          }
        }
      }
    }
    
    console.log(`🎯 스케줄 등록 완료: ${scheduledCount}개 작업 등록`);
    
    return NextResponse.json({
      success: true,
      data: {
        scheduledCount,
        scheduledJobs,
        processedWorkflows: workflows?.length || 0
      },
      message: `${scheduledCount}개의 작업이 오늘 일정에 등록되었습니다.`
    });
    
  } catch (error) {
    console.error('❌ 스케줄 등록 실패:', error);
    return NextResponse.json({
      success: false,
      message: '스케줄 등록 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}

// POST 방식도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  return GET(request);
} 