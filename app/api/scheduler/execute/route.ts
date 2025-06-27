import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  utcToKoreaTime, 
  koreaTimeToUTCString, 
  formatKoreaTime 
} from '@/lib/utils/timezone';

// 환경별 베이스 URL 결정 함수
function getBaseUrl(request: NextRequest): string {
  // 개발 환경
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // 프로덕션 환경
  if (process.env.VERCEL_PROJECT_URL) {
    return `https://${process.env.VERCEL_PROJECT_URL}`;
  }
  
  // Vercel 환경 변수
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // 요청 헤더에서 호스트 추출
  const host = request.headers.get('host');
  if (host) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}`;
  }
  
  // 기본값
  return 'http://localhost:3000';
}

// 스케줄 작업 실행 API
export async function GET(request: NextRequest) {
  const debugInfo: any[] = [];
  let executedCount = 0;
  const results: any[] = [];
  
  try {
    // 인증 검증 (내부 호출인지 확인)
    const internalCall = request.headers.get('x-scheduler-internal');
    const cronSecret = request.headers.get('x-cron-secret');
    const isAuthorized = internalCall === 'true' || 
                        cronSecret === process.env.CRON_SECRET_TOKEN ||
                        process.env.NODE_ENV === 'development'; // 개발 환경에서는 인증 생략
    
    if (!isAuthorized) {
      console.warn('⚠️ 스케줄러 실행 API 무권한 접근 시도');
      return NextResponse.json({
        success: false,
        message: '권한이 없습니다.'
      }, { status: 401 });
    }
    
    const supabase = getSupabase();
    
    /**
     * 🕐 시간대 처리 원칙:
     * - 저장: UTC로 DB 저장 (서버 환경 독립적)
     * - 비교: 한국 시간 기준으로 실행 시간 판단
     * - 표시: 사용자에게는 KST로 표시
     */
    const now = getKoreaTime(); // 🔥 시간대 처리: 한국 시간 기준으로 현재 시간
    const currentTimeString = formatKoreaTime(now);
    
    console.log(`\n🕐 === 스케줄 실행기 시작 ===`);
    console.log(`현재 한국 시간: ${currentTimeString}`);
    console.log(`환경: ${process.env.NODE_ENV}`);
    console.log(`베이스 URL: ${getBaseUrl(request)}`);
    
    // 실행 대기 중인 작업들 조회 (UTC로 저장된 시간을 가져옴)
    const { data: jobs, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('scheduled_time', { ascending: true });
    
    if (error) {
      console.error('❌ 스케줄 작업 조회 실패:', error);
      return NextResponse.json({
        success: false,
        message: '스케줄 작업 조회 실패: ' + error.message
      }, { status: 500 });
    }
    
    console.log(`📋 대기 중인 작업 수: ${jobs?.length || 0}개`);
    
    const jobsToExecute: any[] = [];
    
    // 각 작업에 대해 실행 시간 체크
    for (const job of jobs || []) {
      // 🔥 시간대 처리: UTC로 저장된 시간을 한국 시간으로 변환하여 비교
      const scheduledTimeKST = utcToKoreaTime(job.scheduled_time);
      
      // 시간 차이 계산 (초 단위)
      const timeDiffSeconds = Math.floor((now.getTime() - scheduledTimeKST.getTime()) / 1000);
      
      // 5분(300초) 허용 오차 적용 - 이전에 실행되지 않은 지연된 작업도 실행
      const TOLERANCE_MS = 5 * 60 * 1000; // 5분 = 300초
      const isTimeToExecute = now.getTime() >= (scheduledTimeKST.getTime() - TOLERANCE_MS);
      
      debugInfo.push({
        id: job.id,
        workflow_name: job.workflow_data?.name || 'Unknown',
        scheduled_time_utc: job.scheduled_time,
        scheduled_time_kst: formatKoreaTime(scheduledTimeKST),
        status: job.status,
        timeDiffSeconds,
        isTimeToExecute
      });
      
      console.log(`작업 ${job.id}: 예정시간=${formatKoreaTime(scheduledTimeKST)}, 현재시간=${currentTimeString}, 차이=${timeDiffSeconds}초, 실행가능=${isTimeToExecute}, 상태=${job.status}`);
      
      if (isTimeToExecute) {
        console.log(`✅ 실행 대상: ${job.workflow_data?.name} (${job.id})`);
        jobsToExecute.push(job);
      } else {
        console.log(`⏸️ 대기: ${job.workflow_data?.name} (${timeDiffSeconds}초 남음)`);
      }
    }
    
    console.log(`🎯 실행할 작업 수: ${jobsToExecute.length}개`);
    
    if (jobsToExecute.length === 0) {
      console.log('⏸️ 실행할 작업이 없습니다.');
      return NextResponse.json({
        success: true,
        data: {
          executedCount: 0,
          results: [],
          debugInfo,
          message: '실행할 작업이 없습니다.',
          totalPendingJobs: jobs?.length || 0,
          environment: process.env.NODE_ENV,
          baseUrl: getBaseUrl(request)
        }
      });
    }
    
    // 작업 실행
    console.log(`\n🚀 === 작업 실행 시작 ===`);
    
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
            // 🔥 시간대 처리: 한국 시간을 UTC로 변환하여 DB 저장
            executed_at: koreaTimeToUTCString(now),
            updated_at: koreaTimeToUTCString(now)
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
              updated_at: koreaTimeToUTCString(now)
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
        const baseUrl = getBaseUrl(request);
        const executeUrl = `${baseUrl}/api/workflow/execute`;
        
        // 인증 헤더 추가
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'x-scheduler-internal': 'true',
          'x-cron-secret': process.env.CRON_SECRET_TOKEN || '',
          // Vercel Protection Bypass 헤더 추가
          'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
          'x-vercel-set-bypass-cookie': 'true'
        };
        
        console.log(`📡 워크플로우 실행 API 호출: ${executeUrl}`);
        
        const response = await fetch(executeUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            workflowId: workflow.id,
            workflow: workflow,
            scheduledExecution: true,
            scheduledJobId: job.id
          })
        });
        
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
              updated_at: koreaTimeToUTCString(now)
            })
            .eq('id', job.id);
          
          // HTTP 401 오류인 경우 특별히 처리
          if (response.status === 401) {
            console.error('🚨 Vercel 인증 오류 발생. CRON_SECRET_TOKEN 환경 변수를 확인하세요.');
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
        
        // 🔥 워크플로우 실행 API에서 스케줄 잡 상태를 completed로 업데이트하므로 여기서는 처리하지 않음
        console.log(`✅ 작업 ${job.id} 실행 완료 - 상태 업데이트는 워크플로우 실행 API에서 처리됨`);
        
        executedCount++;
        results.push({
          jobId: job.id,
          success: true,
          result
        });
        
      } catch (error) {
        console.error(`❌ 작업 ${job.id} 실행 중 오류:`, error);
        
        // 🔥 오류 발생 시 상태를 failed로 변경
        await supabase
          .from('scheduled_jobs')
          .update({ 
            status: 'failed',
            error_message: error instanceof Error ? error.message : '알 수 없는 오류',
            retry_count: (job.retry_count || 0) + 1,
            updated_at: koreaTimeToUTCString(now)
          })
          .eq('id', job.id);
        
        results.push({
          jobId: job.id,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }
    
    console.log(`\n🎯 스케줄 실행 완료: ${executedCount}개 실행, ${results.filter(r => !r.success).length}개 실패`);
    
    return NextResponse.json({
      success: true,
      data: {
        executedCount,
        results,
        debugInfo,
        totalJobs: jobsToExecute.length,
        environment: process.env.NODE_ENV,
        baseUrl: getBaseUrl(request)
      },
      message: `${executedCount}개의 작업이 실행되었습니다.`
    });
    
  } catch (error) {
    console.error('❌ 스케줄 실행기 오류:', error);
    return NextResponse.json({
      success: false,
      message: '스케줄 실행기 오류: ' + (error instanceof Error ? error.message : String(error)),
      environment: process.env.NODE_ENV,
      baseUrl: getBaseUrl(request)
    }, { status: 500 });
  }
}

// POST 방식도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  return GET(request);
} 