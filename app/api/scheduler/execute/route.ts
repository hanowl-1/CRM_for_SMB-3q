import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 한국시간 헬퍼 함수
function getKoreaTime(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const koreaTime = new Date(utc + (9 * 3600000)); // UTC+9
  return koreaTime;
}

// 크론잡 - 매분 실행되어 pending/running 작업들을 확인하고 실행
export async function GET(request: NextRequest) {
  try {
    console.log('=== 스케줄러 실행기 시작 ===');
    
    const now = getKoreaTime();
    const currentTimeString = now.toTimeString().substring(0, 8); // HH:MM:SS 형식
    console.log(`현재 한국 시간: ${now.toISOString()}`);
    console.log(`현재 시간 문자열: ${currentTimeString}`);
    
    // 🔥 pending과 running 상태 모두 조회하여 실행할 작업 찾기
    const { data: jobs, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .in('status', ['pending', 'running'])
      .order('scheduled_time', { ascending: true });
    
    if (error) {
      console.error('스케줄 작업 조회 실패:', error);
      return NextResponse.json({ 
        error: '스케줄 작업 조회 실패', 
        details: error.message,
        query: 'pending + running jobs'
      }, { status: 500 });
    }
    
    console.log(`총 ${jobs?.length || 0}개의 스케줄 작업 발견 (pending + running)`);
    
    const jobsToExecute = [];
    const debugInfo = [];
    
    // 각 작업에 대해 실행 시간 체크
    for (const job of jobs || []) {
      const scheduledTime = new Date(job.scheduled_time);
      const koreaScheduledTime = new Date(scheduledTime.getTime() + 9 * 60 * 60 * 1000); // UTC → KST 변환
      
      // 한국 시간으로 시:분:초 비교
      const scheduledTimeString = koreaScheduledTime.toTimeString().substring(0, 8);
      
      // 시간 차이 계산 (초 단위)
      const timeDiffSeconds = Math.floor((now.getTime() - koreaScheduledTime.getTime()) / 1000);
      
      // 5분(300초) 허용 오차 적용 - 이전에 실행되지 않은 지연된 작업도 실행
      const TOLERANCE_MS = 5 * 60 * 1000; // 5분 = 300초
      const isTimeToExecute = now.getTime() >= (koreaScheduledTime.getTime() - TOLERANCE_MS);
      
      debugInfo.push({
        id: job.id,
        workflow_name: job.workflow_name || 'Unknown',
        scheduled_time: job.scheduled_time,
        status: job.status,
        timeDiffSeconds,
        isTimeToExecute
      });
      
      console.log(`작업 ${job.id}: 예정시간=${scheduledTimeString}, 현재시간=${currentTimeString}, 차이=${timeDiffSeconds}초, 실행가능=${isTimeToExecute}, 상태=${job.status}`);
      
      if (isTimeToExecute) {
        // 🔥 pending 상태인 경우 running으로 변경
        if (job.status === 'pending') {
          console.log(`🔄 pending → running 상태 변경: ${job.id}`);
          
          const { error: updateError } = await supabase
            .from('scheduled_jobs')
            .update({ 
              status: 'running',
              started_at: now.toISOString(),
              updated_at: now.toISOString()
            })
            .eq('id', job.id);
          
          if (updateError) {
            console.error(`상태 변경 실패 (${job.id}):`, updateError);
            // 🔥 상태 변경 실패해도 실행은 계속 시도 (이전 코드 수정)
            console.log(`상태 변경 실패했지만 실행을 계속 시도합니다: ${job.id}`);
          }
          
          // 상태 변경된 작업 정보 업데이트
          job.status = 'running';
          job.started_at = now.toISOString();
        }
        
        jobsToExecute.push(job);
      }
    }
    
    console.log(`실행할 작업 수: ${jobsToExecute.length}`);
    
    if (jobsToExecute.length === 0) {
      console.log('현재 시간에 실행할 작업이 없습니다.');
      return NextResponse.json({ 
        message: '현재 시간에 실행할 작업 없음', 
        executedJobs: 0,
        debug: {
          totalQueriedJobs: jobs?.length || 0,
          jobsAfterTimeFilter: jobsToExecute.length,
          currentTime: now.toISOString(),
          currentKoreaTime: now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
          queryCondition: 'status IN (pending, running) AND time within 5 minutes',
          jobDetails: debugInfo
        }
      });
    }
    
    let executedCount = 0;
    const results = [];
    
    for (const job of jobsToExecute) {
      try {
        console.log(`\n--- 작업 ${job.id} 실행 시작 ---`);
        console.log('작업 타입:', job.job_type);
        console.log('워크플로우 ID:', job.workflow_id);
        console.log('예정 시간:', job.scheduled_time);
        console.log('상태:', job.status);
        
        // 🔥 실행 상태로 변경
        await supabase
          .from('scheduled_jobs')
          .update({ 
            status: 'running',
            executed_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', job.id);
        
        // 🔥 워크플로우 전체 정보 조회 (실행 API가 workflow 객체를 요구하므로)
        console.log('📋 워크플로우 정보 조회 중...');
        const { data: workflowData, error: workflowError } = await supabase
          .from('workflows')
          .select('*')
          .eq('id', job.workflow_id)
          .single();
        
        if (workflowError || !workflowData) {
          console.error('워크플로우 조회 실패:', workflowError);
          
          await supabase
            .from('scheduled_jobs')
            .update({ 
              status: 'failed',
              error_message: `워크플로우 조회 실패: ${workflowError?.message || '워크플로우를 찾을 수 없음'}`,
              retry_count: (job.retry_count || 0) + 1,
              updated_at: now.toISOString()
            })
            .eq('id', job.id);
          
          results.push({
            jobId: job.id,
            success: false,
            error: `워크플로우 조회 실패: ${workflowError?.message || '워크플로우를 찾을 수 없음'}`
          });
          continue;
        }
        
        console.log('✅ 워크플로우 정보 조회 완료:', workflowData.name);
        
        // 🔥 Supabase 워크플로우 데이터를 표준 Workflow 객체로 변환
        const workflow = {
          id: workflowData.id,
          name: workflowData.name,
          description: workflowData.description || '',
          status: workflowData.status,
          trigger: workflowData.trigger_config || { type: 'manual', name: '수동 실행' },
          targetGroups: workflowData.target_config?.targetGroups || [],
          targetTemplateMappings: workflowData.target_config?.targetTemplateMappings || [],
          steps: workflowData.message_config?.steps || [],
          testSettings: workflowData.variables?.testSettings || { enableRealSending: false },
          scheduleSettings: workflowData.schedule_config || { type: 'immediate' },
          stats: workflowData.statistics || { totalRuns: 0, successRate: 0 },
          createdAt: workflowData.created_at,
          updatedAt: workflowData.updated_at,
          // 🔥 스케줄 실행을 위한 추가 정보
          target_config: workflowData.target_config,
          message_config: workflowData.message_config,
          variables: workflowData.variables
        };
        
        console.log('📤 변환된 워크플로우 객체:', {
          id: workflow.id,
          name: workflow.name,
          targetGroupsCount: workflow.targetGroups.length,
          stepsCount: workflow.steps.length,
          enableRealSending: workflow.testSettings?.enableRealSending || workflow.variables?.testSettings?.enableRealSending
        });
        
        // 워크플로우 실행 API 호출
        const baseUrl = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3000' 
          : `https://${process.env.VERCEL_URL || request.headers.get('host')}`;
        
        const executeUrl = `${baseUrl}/api/workflow/execute`;
        
        // Vercel Protection Bypass for Automation 헤더 추가
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'x-scheduler-internal': 'true',
        };
        
        // VERCEL_AUTOMATION_BYPASS_SECRET 환경 변수가 있으면 추가
        if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
          headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
          headers['x-vercel-set-bypass-cookie'] = 'true';
          console.log('✅ Vercel 인증 우회 헤더 추가됨');
        } else {
          console.warn('⚠️ VERCEL_AUTOMATION_BYPASS_SECRET 환경 변수가 설정되지 않음');
        }
        
        // 🔥 올바른 형식으로 워크플로우 실행 API 호출
        const requestBody = {
          workflow: workflow,
          scheduledExecution: true,
          jobId: job.id,
          enableRealSending: workflow.testSettings?.enableRealSending || workflow.variables?.testSettings?.enableRealSending || false
        };
        
        console.log('📤 워크플로우 실행 API 요청 데이터:', {
          workflowId: requestBody.workflow.id,
          workflowName: requestBody.workflow.name,
          scheduledExecution: requestBody.scheduledExecution,
          jobId: requestBody.jobId,
          enableRealSending: requestBody.enableRealSending
        });
        
        console.log('📤 요청 헤더:', {
          'Content-Type': headers['Content-Type'],
          'x-scheduler-internal': headers['x-scheduler-internal'],
          'x-vercel-protection-bypass': headers['x-vercel-protection-bypass'] ? 'SET' : 'NOT_SET',
          'x-vercel-set-bypass-cookie': headers['x-vercel-set-bypass-cookie']
        });
        
        const response = await fetch(executeUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });
        
        console.log('워크플로우 실행 API 응답 상태:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('워크플로우 실행 실패:', response.status, errorText);
          
          // 🔥 실행 실패시 상태를 failed로 변경
          await supabase
            .from('scheduled_jobs')
            .update({ 
              status: 'failed',
              error_message: `HTTP ${response.status}: ${errorText}`,
              retry_count: (job.retry_count || 0) + 1,
              updated_at: now.toISOString()
            })
            .eq('id', job.id);
          
          // HTTP 401 오류인 경우 특별히 처리
          if (response.status === 401) {
            console.error('🚨 Vercel 인증 오류 발생. VERCEL_AUTOMATION_BYPASS_SECRET 환경 변수를 확인하세요.');
          }
          
          results.push({
            jobId: job.id,
            success: false,
            error: `HTTP ${response.status}: ${errorText}`
          });
          continue;
        }
        
        const result = await response.json();
        console.log('워크플로우 실행 결과:', result);
        
        // 🔥 실행 성공시 상태를 completed로 변경
        await supabase
          .from('scheduled_jobs')
          .update({ 
            status: 'completed',
            completed_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', job.id);
        
        executedCount++;
        results.push({
          jobId: job.id,
          success: true,
          result
        });
        
        console.log(`✅ 작업 ${job.id} 실행 완료`);
        
      } catch (error) {
        console.error(`❌ 작업 ${job.id} 실행 중 오류:`, error);
        
        // 🔥 예외 발생시 상태를 failed로 변경
        await supabase
          .from('scheduled_jobs')
          .update({ 
            status: 'failed',
            error_message: error instanceof Error ? error.message : '알 수 없는 오류',
            retry_count: (job.retry_count || 0) + 1,
            updated_at: now.toISOString()
          })
          .eq('id', job.id);
        
        results.push({
          jobId: job.id,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }
    
    console.log(`\n=== 스케줄러 실행 완료 ===`);
    console.log(`총 실행된 작업 수: ${executedCount}`);
    
    return NextResponse.json({
      message: `${executedCount}개 작업 실행 완료`,
      executedJobs: executedCount,
      results
    });
    
  } catch (error) {
    console.error('스케줄러 실행 오류:', error);
    return NextResponse.json(
      { error: '스케줄러 실행 실패', details: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

// POST 방식도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  return GET(request);
} 