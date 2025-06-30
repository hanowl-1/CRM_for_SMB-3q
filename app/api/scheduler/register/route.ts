import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  getKoreaMoment, 
  calculateNextKoreaScheduleTime, 
  formatKoreaTime, 
  koreaTimeToUTCString,
  debugTimeInfo 
} from '@/lib/utils/timezone';

// 다음 실행 시간 계산 함수
function calculateNextRecurringTime(recurringPattern: any): Date {
  const { frequency, time } = recurringPattern;
  
  console.log(`🕐 현재 한국 시간: ${formatKoreaTime(getKoreaTime())}`);
  
  if (!time) {
    const oneHourLater = getKoreaMoment().add(1, 'hour').toDate();
    return oneHourLater;
  }
  
  console.log(`⏰ 설정된 시간: ${time}`);
  
  // 전문적인 한국 시간 스케줄 계산
  const nextRun = calculateNextKoreaScheduleTime(time, frequency);
  
  console.log(`📅 계산된 다음 실행 시간: ${formatKoreaTime(nextRun)}`);
  debugTimeInfo('스케줄 계산 결과', nextRun);
  
  return nextRun;
}

// 워크플로우 스케줄 등록 API
export async function GET(request: NextRequest) {
  try {
    const client = getSupabase();
    const now = getKoreaTime();
    
    console.log(`🕐 스케줄 등록 실행: ${formatKoreaTime(now)}`);
    debugTimeInfo('등록 시작 시간', now);
    
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
            scheduledTime = new Date(scheduleConfig.scheduledTime);
          }
          break;
          
        case 'recurring':
          // 반복 실행 - 다음 실행 시간을 계산하고 등록
          if (scheduleConfig.recurringPattern) {
            scheduledTime = calculateNextRecurringTime(scheduleConfig.recurringPattern);
          }
          break;
          
        case 'delay':
          // 지연 실행은 여기서 처리하지 않음 (워크플로우 활성화 시 즉시 등록)
          break;
      }
      
      if (scheduledTime) {
        const isRecurringWorkflow = scheduleConfig?.type === 'recurring';
        
        // 기존 활성 작업들 조회 (pending + running)
        const { data: existingJobs } = await client
          .from('scheduled_jobs')
          .select('id, scheduled_time, status')
          .eq('workflow_id', workflow.id)
          .in('status', ['pending', 'running']);
        
        let shouldCreateNew = true;
        
        if (isRecurringWorkflow) {
          // 🔥 반복 발송의 경우: 1개 워크플로우 = 1개 활성 스케줄 원칙 적용
          if (existingJobs && existingJobs.length > 0) {
            console.log(`🔄 반복 워크플로우 (${workflow.name}): 기존 ${existingJobs.length}개 활성 작업 정리`);
            
            // 모든 기존 활성 작업들을 취소
            const { data: cancelledJobs } = await client
              .from('scheduled_jobs')
              .update({ 
                status: 'cancelled',
                updated_at: formatKoreaTime(now, 'yyyy-MM-dd HH:mm:ss'), // 🔥 TEXT 컬럼에 순수 한국시간 문자열 저장
                error_message: '새로운 스케줄 등록으로 인한 자동 취소'
              })
              .eq('workflow_id', workflow.id)
              .in('status', ['pending', 'running'])
              .select();
            
            const cancelledCount = cancelledJobs?.length || 0;
            console.log(`✅ 기존 활성 작업 ${cancelledCount}개 취소 완료: ${workflow.name}`);
          }
          
          // 반복 발송은 항상 새로운 작업 생성
          shouldCreateNew = true;
        } else {
          // 🔥 일회성 실행의 경우: 정확히 같은 시간만 중복으로 간주
          if (existingJobs && existingJobs.length > 0) {
            for (const existingJob of existingJobs) {
              const existingTime = new Date(existingJob.scheduled_time);
              
              // 정확히 같은 시간(초 단위까지)인 경우만 같은 작업으로 간주
              if (scheduledTime.getTime() === existingTime.getTime()) {
                shouldCreateNew = false;
                console.log(`⏭️ 일회성 작업 중복 방지: ${workflow.name} → ${formatKoreaTime(existingTime)}`);
                break;
              }
            }
            
            // 새로운 시간으로 등록하는 경우 기존 작업들 취소
            if (shouldCreateNew) {
              await client
                .from('scheduled_jobs')
                .update({ 
                  status: 'cancelled',
                  updated_at: formatKoreaTime(now, 'yyyy-MM-dd HH:mm:ss'), // 🔥 TEXT 컬럼에 순수 한국시간 문자열 저장
                  error_message: '시간 변경으로 인한 자동 취소'
                })
                .eq('workflow_id', workflow.id)
                .in('status', ['pending', 'running']);
              console.log(`🗑️ 일회성 작업 기존 스케줄 취소 (시간 변경됨): ${workflow.name}`);
            }
          }
        }
        
        if (shouldCreateNew) {
          // 새 작업 등록 - 한국시간으로 저장 (기존 데이터와 일관성 유지)
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
              scheduled_time: formatKoreaTime(scheduledTime, 'yyyy-MM-dd HH:mm:ss'), // 🔥 TEXT 컬럼에 순수 한국시간 문자열 저장
              status: 'pending',
              retry_count: 0,
              max_retries: 3,
              created_at: formatKoreaTime(now, 'yyyy-MM-dd HH:mm:ss') // 🔥 TEXT 컬럼에 순수 한국시간 문자열 저장
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
            debugTimeInfo(`등록된 작업 (${workflow.name})`, scheduledTime);
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
      message: `${scheduledCount}개의 작업이 스케줄에 등록되었습니다.`
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