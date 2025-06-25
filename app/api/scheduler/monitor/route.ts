import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';

// 한국시간 헬퍼 함수
function getKoreaTime(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const koreaTime = new Date(utc + (9 * 3600000)); // UTC+9
  return koreaTime;
}

// 크론잡 기반 스케줄러 모니터링 API
export async function GET(request: NextRequest) {
  try {
    const client = getSupabase();
    const now = getKoreaTime();
    
    console.log(`📊 스케줄러 모니터링 시작: ${now.toLocaleString('ko-KR')}`);
    
    // URL 파라미터에서 필터 옵션 추출
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const workflowId = searchParams.get('workflowId');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // 스케줄 작업 조회
    let query = client
      .from('scheduled_jobs')
      .select('*')
      .order('scheduled_time', { ascending: false })
      .limit(limit);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }
    
    const { data: scheduledJobs, error: jobsError } = await query;
    
    if (jobsError) {
      console.error('❌ 스케줄 작업 조회 실패:', jobsError);
      return NextResponse.json({
        success: false,
        message: '스케줄 작업 조회 실패: ' + jobsError.message
      }, { status: 500 });
    }
    
    console.log(`📋 조회된 스케줄 작업 수: ${scheduledJobs?.length || 0}개`);
    
    // 🔍 2시 40분 "테스트" 워크플로우 특별 모니터링
    const testWorkflow240 = scheduledJobs?.find(job => 
      job.workflow_data?.name === '테스트' && 
      new Date(job.scheduled_time).getHours() === 14 && 
      new Date(job.scheduled_time).getMinutes() === 40
    );
    
    if (testWorkflow240) {
      const scheduledTime = new Date(testWorkflow240.scheduled_time);
      const timeDiff = scheduledTime.getTime() - now.getTime();
      const timeDiffMinutes = Math.round(timeDiff / (1000 * 60));
      
      console.log(`🎯 === 2시 40분 "테스트" 워크플로우 모니터링 ===`);
      console.log(`  📋 작업 ID: ${testWorkflow240.id}`);
      console.log(`  📅 예정시간: ${scheduledTime.toLocaleString('ko-KR')} (${scheduledTime.toISOString()})`);
      console.log(`  🕐 현재시간: ${now.toLocaleString('ko-KR')} (${now.toISOString()})`);
      console.log(`  ⏱️ 시간차이: ${timeDiffMinutes}분 (${timeDiff}ms)`);
      console.log(`  📊 작업상태: ${testWorkflow240.status}`);
      console.log(`  🔄 재시도: ${testWorkflow240.retry_count}/${testWorkflow240.max_retries || 3}`);
      console.log(`  📝 생성시간: ${new Date(testWorkflow240.created_at).toLocaleString('ko-KR')}`);
      console.log(`  🔄 업데이트: ${new Date(testWorkflow240.updated_at).toLocaleString('ko-KR')}`);
      
      if (testWorkflow240.started_at) {
        console.log(`  🚀 시작시간: ${new Date(testWorkflow240.started_at).toLocaleString('ko-KR')}`);
      }
      
      if (testWorkflow240.completed_at) {
        console.log(`  ✅ 완료시간: ${new Date(testWorkflow240.completed_at).toLocaleString('ko-KR')}`);
      }
      
      if (testWorkflow240.error_message) {
        console.log(`  ❌ 오류메시지: ${testWorkflow240.error_message}`);
      }
      
      // 실행 조건 분석
      const shouldExecute = scheduledTime.getTime() <= now.getTime();
      console.log(`  🔍 실행조건: ${shouldExecute ? '✅ 충족됨' : '⏳ 미충족'}`);
      
      if (testWorkflow240.status === 'pending' && timeDiff < 0) {
        console.log(`  🚨 경고: 예정시간이 ${Math.abs(timeDiffMinutes)}분 지났는데 아직 pending 상태입니다!`);
        console.log(`  🔍 가능한 원인:`);
        console.log(`    1. 스케줄러 실행기가 작동하지 않음`);
        console.log(`    2. 시간 비교 로직 오류`);
        console.log(`    3. 워크플로우 실행 API 오류`);
      }
      
      console.log(`🎯 === 모니터링 완료 ===`);
    }
    
    // 워크플로우 실행 기록 조회
    const { data: workflowRuns, error: runsError } = await client
      .from('workflow_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);
    
    if (runsError) {
      console.warn('⚠️ 워크플로우 실행 기록 조회 실패:', runsError);
    }
    
    console.log(`📋 워크플로우 실행 기록: ${workflowRuns?.length || 0}개`);
    
    // 최근 메시지 로그 조회
    const { data: messageLogs, error: logsError } = await client
      .from('message_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (logsError) {
      console.warn('⚠️ 메시지 로그 조회 실패:', logsError);
    }
    
    console.log(`📋 최근 메시지 로그: ${messageLogs?.length || 0}개`);
    
    // 통계 계산
    const stats = {
      totalJobs: scheduledJobs?.length || 0,
      pendingJobs: scheduledJobs?.filter(job => job.status === 'pending').length || 0,
      runningJobs: scheduledJobs?.filter(job => job.status === 'running').length || 0,
      completedJobs: scheduledJobs?.filter(job => job.status === 'completed').length || 0,
      failedJobs: scheduledJobs?.filter(job => job.status === 'failed').length || 0,
      cancelledJobs: scheduledJobs?.filter(job => job.status === 'cancelled').length || 0,
      totalRuns: workflowRuns?.length || 0,
      totalMessages: messageLogs?.length || 0
    };
    
    // 🔍 상세 작업 분석
    const jobAnalysis = scheduledJobs?.map(job => {
      const scheduledTime = new Date(job.scheduled_time);
      const timeDiff = scheduledTime.getTime() - now.getTime();
      const timeDiffMinutes = Math.round(timeDiff / (1000 * 60));
      
      return {
        id: job.id,
        workflowName: job.workflow_data?.name,
        status: job.status,
        scheduledTime: scheduledTime.toLocaleString('ko-KR'),
        scheduledTimeISO: scheduledTime.toISOString(),
        timeDiffMinutes,
        isOverdue: timeDiff < 0 && job.status === 'pending',
        retryCount: job.retry_count,
        maxRetries: job.max_retries || 3,
        createdAt: new Date(job.created_at).toLocaleString('ko-KR'),
        updatedAt: new Date(job.updated_at).toLocaleString('ko-KR'),
        startedAt: job.started_at ? new Date(job.started_at).toLocaleString('ko-KR') : null,
        completedAt: job.completed_at ? new Date(job.completed_at).toLocaleString('ko-KR') : null,
        errorMessage: job.error_message,
        // 🎯 2시 40분 테스트 워크플로우 표시
        isTestWorkflow240: job.workflow_data?.name === '테스트' && 
                          scheduledTime.getHours() === 14 && 
                          scheduledTime.getMinutes() === 40
      };
    }) || [];
    
    // 지연된 작업들 특별 표시
    const overdueJobs = jobAnalysis.filter(job => job.isOverdue);
    if (overdueJobs.length > 0) {
      console.log(`🚨 지연된 작업 ${overdueJobs.length}개 발견:`);
      overdueJobs.forEach(job => {
        console.log(`  - ${job.workflowName}: ${job.timeDiffMinutes}분 지연 (${job.scheduledTime})`);
      });
    }
    
    console.log(`📊 스케줄러 모니터링 완료: pending=${stats.pendingJobs}, running=${stats.runningJobs}, completed=${stats.completedJobs}, failed=${stats.failedJobs}`);
    
    return NextResponse.json({
      success: true,
      data: {
        currentTime: now.toLocaleString('ko-KR'),
        currentTimeISO: now.toISOString(),
        stats,
        scheduledJobs: jobAnalysis,
        workflowRuns: workflowRuns || [],
        messageLogs: messageLogs || [],
        overdueJobs,
        testWorkflow240: testWorkflow240 ? {
          id: testWorkflow240.id,
          status: testWorkflow240.status,
          scheduledTime: new Date(testWorkflow240.scheduled_time).toLocaleString('ko-KR'),
          timeDiffMinutes: Math.round((new Date(testWorkflow240.scheduled_time).getTime() - now.getTime()) / (1000 * 60)),
          retryCount: testWorkflow240.retry_count,
          errorMessage: testWorkflow240.error_message
        } : null
      }
    });

  } catch (error) {
    console.error('❌ 스케줄러 모니터링 오류:', error);
    return NextResponse.json({
      success: false,
      message: '스케줄러 모니터링 오류: ' + (error instanceof Error ? error.message : String(error)),
      currentTime: getKoreaTime().toLocaleString('ko-KR')
    }, { status: 500 });
  }
} 