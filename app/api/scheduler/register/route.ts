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

// 워크플로우 즉시 실행 함수
async function executeWorkflowImmediately(workflow: any) {
  console.log(`🚀 워크플로우 즉시 실행 시작: ${workflow.name}`);
  
  try {
    // 워크플로우 실행 API 호출
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : `https://${process.env.VERCEL_URL || process.env.VERCEL_PROJECT_URL}`;
    
    const executeUrl = `${baseUrl}/api/workflow/execute`;
    
    const requestBody = {
      workflowId: workflow.id,
      enableRealSending: true, // 즉시 실행은 실제 발송
      scheduledExecution: false // 수동 실행으로 표시
    };
    
    console.log(`📡 워크플로우 실행 API 호출: ${executeUrl}`);
    console.log(`📋 요청 데이터:`, requestBody);
    
    const response = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scheduler-internal': 'true', // 내부 호출 표시
        ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET && {
          'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET
        })
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`✅ 워크플로우 즉시 실행 완료: ${workflow.name}`);
      console.log(`📊 실행 결과:`, {
        runId: result.runId,
        successCount: result.results?.reduce((sum: number, r: any) => sum + (r.successCount || 0), 0) || 0,
        failedCount: result.results?.reduce((sum: number, r: any) => sum + (r.failedCount || 0), 0) || 0
      });
      
      return {
        success: true,
        message: '워크플로우 즉시 실행 완료',
        executionResult: result
      };
    } else {
      console.error(`❌ 워크플로우 즉시 실행 실패: ${workflow.name}`, result);
      return {
        success: false,
        error: result.error || '워크플로우 실행 API 호출 실패'
      };
    }
    
  } catch (error) {
    console.error(`❌ 워크플로우 즉시 실행 중 오류: ${workflow.name}`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

// 다음 실행 시간 계산 함수
function calculateNextRecurringTime(recurringPattern: any): Date {
  const { frequency, time, daysOfWeek } = recurringPattern;
  
  console.log(`🕐 현재 한국 시간: ${formatKoreaTime(getKoreaTime())}`);
  
  if (!time) {
    const oneHourLater = getKoreaMoment().add(1, 'hour').toDate();
    return oneHourLater;
  }
  
  console.log(`⏰ 설정된 시간: ${time}`);
  
  // 주간 반복이고 요일이 지정된 경우 로그
  if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
    console.log(`📅 지정된 요일: ${daysOfWeek.map((d: number) => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')}`);
  }
  
  // 전문적인 한국 시간 스케줄 계산 (daysOfWeek 파라미터 추가)
  const nextRun = calculateNextKoreaScheduleTime(time, frequency, daysOfWeek);
  
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
    let immediateCount = 0;
    const scheduledJobs = [];
    const immediateJobs = [];
    
    for (const workflow of workflows || []) {
      const scheduleConfig = workflow.schedule_config || workflow.schedule_settings;
      
      if (!scheduleConfig) {
        continue; // 스케줄 설정이 없는 워크플로우는 건너뛰기
      }
      
      // 즉시 실행 워크플로우 처리
      if (scheduleConfig.type === 'immediate') {
        console.log(`⚡ 즉시 실행 워크플로우 발견: ${workflow.name}`);
        const executeResult = await executeWorkflowImmediately(workflow);
        
        if (executeResult.success) {
          immediateCount++;
          immediateJobs.push({
            workflowName: workflow.name,
            executionTime: formatKoreaTime(getKoreaTime()),
            runId: executeResult.executionResult?.runId,
            result: executeResult.executionResult
          });
          console.log(`✅ 즉시 실행 완료: ${workflow.name}`);
        } else {
          console.error(`❌ 즉시 실행 실패: ${workflow.name}`, executeResult.error);
        }
        continue;
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
                updated_at: new Date().toISOString(), // 🔥 현재 시간을 ISO 문자열로 저장
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
                  updated_at: new Date().toISOString(), // 🔥 현재 시간을 ISO 문자열로 저장
                  error_message: '시간 변경으로 인한 자동 취소'
                })
                .eq('workflow_id', workflow.id)
                .in('status', ['pending', 'running']);
              console.log(`🗑️ 일회성 작업 기존 스케줄 취소 (시간 변경됨): ${workflow.name}`);
            }
          }
        }
        
        if (shouldCreateNew) {
          // 🔥 한국시간대 문자열을 직접 처리하여 시간대 변환 문제 해결
          let kstTimeString: string;
          
          // scheduledTime을 문자열로 변환하여 타입 안전성 확보
          const scheduledTimeStr = String(scheduledTime);
          
          if (scheduledTimeStr.includes('+09:00')) {
            // UI에서 한국시간대 포함 문자열을 받은 경우 (예: "2025-06-30T17:30+09:00")
            // PostgreSQL TIMESTAMPTZ 형태로 변환 (예: "2025-06-30 17:30:00+09:00")
            kstTimeString = scheduledTimeStr.replace('T', ' ');
            
            // 초 부분이 없으면 추가
            if (kstTimeString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}\+09:00$/)) {
              kstTimeString = kstTimeString.replace('+09:00', ':00+09:00');
            }
            
            console.log('✅ 한국시간대 포함 문자열 직접 변환:', {
              원본: scheduledTime,
              변환후: kstTimeString
            });
          } else {
            // Date 객체이거나 시간대 정보가 없는 경우 (반복 스케줄 등)
            const dateObj = scheduledTime instanceof Date ? scheduledTime : new Date(scheduledTime);
            
            // 🔥 calculateNextKoreaScheduleTime 함수가 반환한 Date 객체는 이미 한국시간 값이므로
            // 추가로 9시간을 더할 필요가 없음. 그대로 포맷팅만 수행
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            const seconds = String(dateObj.getSeconds()).padStart(2, '0');
            kstTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+09:00`;
            
            console.log('✅ 한국시간 Date 객체 직접 포맷팅:', {
              원본Date: dateObj.toISOString(),
              한국시간문자열: kstTimeString
            });
          }
          
          const currentTime = new Date().toISOString();

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
              scheduled_time: kstTimeString, // 🔥 한국시간대를 명시한 문자열
              status: 'pending',
              retry_count: 0,
              max_retries: 3,
              created_at: currentTime // 🔥 현재 시간
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
    
    console.log(`🎯 워크플로우 처리 완료: ${immediateCount}개 즉시실행, ${scheduledCount}개 스케줄등록`);
    
    return NextResponse.json({
      success: true,
      data: {
        immediateCount,
        immediateJobs,
        scheduledCount,
        scheduledJobs,
        processedWorkflows: workflows?.length || 0
      },
      message: `${immediateCount}개 워크플로우가 즉시 실행되었고, ${scheduledCount}개의 작업이 스케줄에 등록되었습니다.`
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