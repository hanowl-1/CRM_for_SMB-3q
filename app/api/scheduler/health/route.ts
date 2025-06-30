import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  formatKoreaTime, 
  koreaTimeToUTCString 
} from '@/lib/utils/timezone';

/**
 * 스케줄러 헬스체크 API
 * - AWS Lambda가 정상적으로 5분마다 실행되는지 확인
 * - 마지막 실행 시간과 현재 시간 비교
 * - 스케줄 잡 생성/실행 통계 제공
 */
export async function GET(request: NextRequest) {
  try {
    const client = getSupabase();
    const now = new Date(); // 🔥 현재 UTC 시간 사용 (정확한 시간 처리)
    
    // 1. 시스템 헬스체크 로그 기록
    const healthCheck = {
      timestamp: now.toISOString(), // 🔥 정확한 UTC 시간
      korea_time: formatKoreaTime(now), // 🔥 UTC → KST 표시 변환
      check_type: 'scheduler_health',
      environment: process.env.NODE_ENV,
      aws_lambda_enabled: process.env.AWS_LAMBDA_ENABLED === 'true'
    };
    
    // 2. 최근 5분 내 스케줄러 실행 기록 확인
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    // 최근 생성된 스케줄 잡들
    const { data: recentJobs } = await client
      .from('scheduled_jobs')
      .select('*')
      .gte('created_at', fiveMinutesAgo.toISOString()) // 🔥 정확한 UTC 시간 사용
      .order('created_at', { ascending: false });
    
    // 최근 실행된 스케줄 잡들  
    const { data: recentExecutions } = await client
      .from('scheduled_jobs')
      .select('*')
      .gte('executed_at', fiveMinutesAgo.toISOString()) // 🔥 정확한 UTC 시간 사용
      .order('executed_at', { ascending: false });
    
    // 현재 대기 중인 실행 가능한 작업들
    const { data: pendingJobs } = await client
      .from('scheduled_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', now.toISOString()) // 🔥 정확한 UTC 시간 사용
      .order('scheduled_time', { ascending: true });
    
    // 3. AWS Lambda 실행 추론
    const hasRecentExecutions = recentExecutions && recentExecutions.length > 0;
    const hasPendingOverdueJobs = pendingJobs && pendingJobs.length > 0;
    
    // AWS Lambda가 정상 작동 중인지 판단
    const lambdaStatus = {
      is_working: hasRecentExecutions || !hasPendingOverdueJobs,
      last_execution: recentExecutions?.[0]?.executed_at || null,
      pending_overdue_count: pendingJobs?.length || 0,
      recent_execution_count: recentExecutions?.length || 0
    };
    
    // 4. 전체 스케줄러 통계
    const { data: allJobs } = await client
      .from('scheduled_jobs')
      .select('status, created_at, scheduled_time, executed_at')
      .order('created_at', { ascending: false })
      .limit(100);
    
    const stats = {
      total: allJobs?.length || 0,
      pending: allJobs?.filter(j => j.status === 'pending').length || 0,
      running: allJobs?.filter(j => j.status === 'running').length || 0,
      completed: allJobs?.filter(j => j.status === 'completed').length || 0,
      failed: allJobs?.filter(j => j.status === 'failed').length || 0
    };
    
    // 5. 권장 조치사항
    const recommendations = [];
    
    if (hasPendingOverdueJobs && !hasRecentExecutions) {
      recommendations.push({
        level: 'critical',
        message: 'AWS Lambda 스케줄러가 5분 이상 실행되지 않았습니다. Lambda 설정을 확인하세요.',
        action: 'check_aws_lambda'
      });
    }
    
    if (stats.failed > stats.completed * 0.5) {
      recommendations.push({
        level: 'warning', 
        message: '실패율이 높습니다. 워크플로우 설정을 확인하세요.',
        action: 'check_workflow_config'
      });
    }
    
    if (stats.pending > 10) {
      recommendations.push({
        level: 'info',
        message: '대기 중인 작업이 많습니다. 처리 성능을 확인하세요.',
        action: 'check_performance'
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        health_check: healthCheck,
        lambda_status: lambdaStatus,
        statistics: stats,
        recent_activity: {
          recent_jobs: recentJobs?.slice(0, 5) || [],
          recent_executions: recentExecutions?.slice(0, 5) || [],
          pending_overdue: pendingJobs?.slice(0, 5) || []
        },
        recommendations
      },
      message: lambdaStatus.is_working 
        ? '스케줄러가 정상 작동 중입니다.' 
        : '스케줄러에 문제가 있을 수 있습니다.'
    });
    
  } catch (error) {
    console.error('❌ 스케줄러 헬스체크 실패:', error);
    return NextResponse.json({
      success: false,
      message: '스케줄러 헬스체크 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
} 