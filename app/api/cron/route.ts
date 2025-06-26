import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  utcToKoreaTime, 
  formatKoreaTime, 
  koreaTimeToUTCString,
  debugTimeInfo 
} from '@/lib/utils/timezone';

export async function GET(request: NextRequest) {
  try {
    const client = getSupabase();
    const now = getKoreaTime();
    
    console.log(`🕐 Cron 실행: ${formatKoreaTime(now)}`);
    debugTimeInfo('Cron 실행 시간', now);
    
    // 실행할 작업들 조회 (UTC로 저장된 시간을 현재 UTC 시간과 비교)
    const nowUTC = new Date(); // Vercel 서버의 현재 UTC 시간
    
    const { data: jobs, error: jobsError } = await client
      .from('scheduled_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', nowUTC.toISOString()); // UTC 기준으로 비교
    
    if (jobsError) {
      console.error('❌ 작업 조회 실패:', jobsError);
      return NextResponse.json({
        success: false,
        message: '작업 조회 실패: ' + jobsError.message
      }, { status: 500 });
    }
    
    console.log(`📋 실행 대상 작업: ${jobs?.length || 0}개`);
    
    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: '실행할 작업이 없습니다.',
        data: { executedJobs: 0 }
      });
    }
    
    let executedCount = 0;
    const executionResults = [];
    
    for (const job of jobs) {
      try {
        // DB에 저장된 UTC 시간을 한국 시간으로 변환하여 표시
        const scheduledKoreaTime = utcToKoreaTime(new Date(job.scheduled_time));
        console.log(`🚀 작업 실행: ${job.workflow_data.name} (예정: ${formatKoreaTime(scheduledKoreaTime)})`);
        
        // 작업 상태를 'running'으로 업데이트
        await client
          .from('scheduled_jobs')
          .update({ 
            status: 'running',
            started_at: koreaTimeToUTCString(now) // UTC로 저장
          })
          .eq('id', job.id);
        
        // 워크플로우 실행 API 호출
        const executeUrl = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3000/api/workflow/execute'
          : `https://${process.env.VERCEL_PROJECT_URL || process.env.VERCEL_URL}/api/workflow/execute`;
        
        const executeResponse = await fetch(executeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Vercel Authentication 우회 헤더 추가
            'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || 'development'
          },
          body: JSON.stringify({
            workflowId: job.workflow_id,
            workflowData: job.workflow_data
          })
        });
        
        const executeResult = await executeResponse.json();
        
        if (executeResult.success) {
          // 성공: 작업 완료 처리
          await client
            .from('scheduled_jobs')
            .update({ 
              status: 'completed',
              completed_at: koreaTimeToUTCString(now), // UTC로 저장
              result: executeResult
            })
            .eq('id', job.id);
          
          executedCount++;
          executionResults.push({
            jobId: job.id,
            workflowName: job.workflow_data.name,
            scheduledTime: formatKoreaTime(scheduledKoreaTime),
            status: 'completed',
            result: executeResult
          });
          
          console.log(`✅ 작업 완료: ${job.workflow_data.name}`);
        } else {
          // 실패: 재시도 또는 실패 처리
          const newRetryCount = (job.retry_count || 0) + 1;
          const maxRetries = job.max_retries || 3;
          
          if (newRetryCount < maxRetries) {
            // 재시도 대기
            await client
              .from('scheduled_jobs')
              .update({ 
                status: 'pending',
                retry_count: newRetryCount,
                last_error: executeResult.message || '실행 실패'
              })
              .eq('id', job.id);
            
            console.log(`🔄 재시도 대기: ${job.workflow_data.name} (${newRetryCount}/${maxRetries})`);
          } else {
            // 최대 재시도 초과: 실패 처리
            await client
              .from('scheduled_jobs')
              .update({ 
                status: 'failed',
                failed_at: koreaTimeToUTCString(now), // UTC로 저장
                retry_count: newRetryCount,
                last_error: executeResult.message || '최대 재시도 초과'
              })
              .eq('id', job.id);
            
            console.log(`❌ 작업 실패: ${job.workflow_data.name} (최대 재시도 초과)`);
          }
          
          executionResults.push({
            jobId: job.id,
            workflowName: job.workflow_data.name,
            scheduledTime: formatKoreaTime(scheduledKoreaTime),
            status: newRetryCount < maxRetries ? 'retry' : 'failed',
            error: executeResult.message || '실행 실패'
          });
        }
        
      } catch (error) {
        console.error(`❌ 작업 처리 실패 (${job.workflow_data.name}):`, error);
        
        // 예외 발생: 실패 처리
        await client
          .from('scheduled_jobs')
          .update({ 
            status: 'failed',
            failed_at: koreaTimeToUTCString(now), // UTC로 저장
            last_error: error instanceof Error ? error.message : String(error)
          })
          .eq('id', job.id);
      }
    }
    
    console.log(`🎯 Cron 실행 완료: ${executedCount}/${jobs.length}개 작업 완료`);
    
    return NextResponse.json({
      success: true,
      data: {
        totalJobs: jobs.length,
        executedJobs: executedCount,
        executionResults
      },
      message: `${executedCount}개의 작업이 실행되었습니다.`
    });
    
  } catch (error) {
    console.error('❌ Cron 실행 실패:', error);
    return NextResponse.json({
      success: false,
      message: 'Cron 실행 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // POST 요청도 같은 로직으로 처리
  return GET(request);
} 