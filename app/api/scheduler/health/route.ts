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
 * - 크론 신호 모니터링을 통한 정확한 상태 파악
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
    
    // 2. 🔔 크론 신호 상태 확인 (새로 추가)
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // 최근 크론 신호 조회
    const { data: cronSignals } = await client
      .from('cron_signals')
      .select('*')
      .order('signal_time', { ascending: false })
      .limit(20);
    
    // AWS Lambda 신호만 필터링 (두 가지 타입 모두 포함)
    const awsLambdaSignals = cronSignals?.filter(s => 
      s.source === 'aws-lambda' || s.source === 'aws-lambda-cron'
    ) || [];
    const lastAwsLambdaSignal = awsLambdaSignals[0];
    
    // 크론 신호 통계 (AWS Lambda만)
    const recentAwsSignals = awsLambdaSignals.filter(s => new Date(s.signal_time) >= tenMinutesAgo);
    const hourlyAwsSignals = awsLambdaSignals.filter(s => new Date(s.signal_time) >= oneHourAgo);
    
    // 전체 크론 신호 통계
    const recentCronSignals = cronSignals?.filter(s => new Date(s.signal_time) >= tenMinutesAgo) || [];
    const hourlyCronSignals = cronSignals?.filter(s => new Date(s.signal_time) >= oneHourAgo) || [];
    
    let cronStatus = {
      has_signals: cronSignals && cronSignals.length > 0,
      last_aws_signal: null as any,
      minutes_since_last_signal: null as number | null,
      is_healthy: false,
      recent_signals_count: recentCronSignals.length, // 전체 신호
      hourly_signals_count: hourlyCronSignals.length, // 전체 신호
      recent_aws_signals_count: recentAwsSignals.length, // AWS Lambda 신호만
      hourly_aws_signals_count: hourlyAwsSignals.length, // AWS Lambda 신호만
      health_status: 'unknown' as 'healthy' | 'warning' | 'critical' | 'unknown'
    };
    
    if (lastAwsLambdaSignal) {
      const lastSignalTime = new Date(lastAwsLambdaSignal.signal_time);
      const minutesSinceLastSignal = Math.floor((now.getTime() - lastSignalTime.getTime()) / (1000 * 60));
      
      cronStatus.last_aws_signal = {
        time: formatKoreaTime(lastSignalTime),
        source: lastAwsLambdaSignal.source, // 'aws-lambda' 또는 'aws-lambda-cron'
        executed_jobs: lastAwsLambdaSignal.executed_jobs_count || 0,
        duration_ms: lastAwsLambdaSignal.execution_duration_ms || 0,
        response_status: lastAwsLambdaSignal.response_status || 0
      };
      cronStatus.minutes_since_last_signal = minutesSinceLastSignal;
      
      // 건강성 판단
      if (minutesSinceLastSignal <= 7) {
        cronStatus.is_healthy = true;
        cronStatus.health_status = 'healthy';
      } else if (minutesSinceLastSignal <= 15) {
        cronStatus.health_status = 'warning';
      } else {
        cronStatus.health_status = 'critical';
      }
    }
    
    // 3. 최근 5분 내 스케줄러 실행 기록 확인
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
    
    // 4. AWS Lambda 실행 추론 (크론 신호 정보 포함)
    const hasRecentExecutions = recentExecutions && recentExecutions.length > 0;
    const hasPendingOverdueJobs = pendingJobs && pendingJobs.length > 0;
    
    // AWS Lambda가 정상 작동 중인지 판단 (크론 신호 기반)
    const lambdaStatus = {
      is_working: cronStatus.is_healthy && (hasRecentExecutions || !hasPendingOverdueJobs),
      last_execution: recentExecutions?.[0]?.executed_at || null,
      pending_overdue_count: pendingJobs?.length || 0,
      recent_execution_count: recentExecutions?.length || 0,
      cron_signal_health: cronStatus.health_status
    };
    
    // 5. 전체 스케줄러 통계
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
    
    // 6. 권장 조치사항 (크론 신호 기반 개선)
    const recommendations = [];
    
    // 크론 신호 기반 권장사항
    if (!cronStatus.has_signals) {
      recommendations.push({
        level: 'critical',
        message: '크론 신호 기록이 없습니다. 스케줄러가 한 번도 실행되지 않았습니다.',
        action: 'check_initial_setup'
      });
    } else if (cronStatus.health_status === 'critical') {
      recommendations.push({
        level: 'critical',
        message: `AWS Lambda가 ${cronStatus.minutes_since_last_signal}분 동안 신호를 보내지 않았습니다. Lambda 설정을 확인하세요.`,
        action: 'check_aws_lambda'
      });
    } else if (cronStatus.health_status === 'warning') {
      recommendations.push({
        level: 'warning',
        message: `AWS Lambda 신호가 ${cronStatus.minutes_since_last_signal}분 전에 마지막으로 수신되었습니다. 지연이 발생하고 있습니다.`,
        action: 'monitor_lambda_delay'
      });
    }
    
    if (hasPendingOverdueJobs && cronStatus.is_healthy) {
      recommendations.push({
        level: 'warning',
        message: '크론 신호는 정상이지만 지연된 작업이 있습니다. 워크플로우 처리 성능을 확인하세요.',
        action: 'check_workflow_performance'
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
        cron_status: cronStatus, // 🔔 새로 추가된 크론 신호 상태
        lambda_status: lambdaStatus,
        statistics: stats,
        recent_activity: {
          recent_jobs: recentJobs?.slice(0, 5) || [],
          recent_executions: recentExecutions?.slice(0, 5) || [],
          pending_overdue: pendingJobs?.slice(0, 5) || [],
          recent_cron_signals: cronSignals?.slice(0, 5) || [] // 🔔 최근 크론 신호
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