import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import persistentSchedulerService from '@/lib/services/persistent-scheduler-service';

// 실시간 스케줄러 모니터링 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    const client = getSupabase();
    
    switch (action) {
      case 'status':
        // 전체 상태 조회
        const status = await persistentSchedulerService.getStatus();
        
        // 최근 로그 5개 조회
        const { data: recentLogs } = await client
          .from('scheduled_jobs')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(5);

        // 오늘 통계
        const today = new Date().toISOString().split('T')[0];
        const { data: todayJobs } = await client
          .from('scheduled_jobs')
          .select('status')
          .gte('created_at', today + 'T00:00:00.000Z')
          .lt('created_at', today + 'T23:59:59.999Z');

        const todayStats = {
          total: todayJobs?.length || 0,
          completed: todayJobs?.filter(j => j.status === 'completed').length || 0,
          failed: todayJobs?.filter(j => j.status === 'failed').length || 0,
          pending: todayJobs?.filter(j => j.status === 'pending').length || 0
        };

        return NextResponse.json({
          success: true,
          data: {
            scheduler: status,
            recentLogs: recentLogs?.map(log => ({
              id: log.id,
              workflowName: log.workflow_data?.name || 'Unknown',
              status: log.status,
              scheduledTime: log.scheduled_time,
              executedAt: log.executed_at,
              errorMessage: log.error_message,
              isOverdue: new Date(log.scheduled_time) < new Date() && log.status === 'pending'
            })) || [],
            todayStats
          }
        });

      case 'upcoming':
        // 다가오는 작업들 (다음 24시간)
        const next24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { data: upcomingJobs } = await client
          .from('scheduled_jobs')
          .select('*')
          .eq('status', 'pending')
          .gte('scheduled_time', new Date().toISOString())
          .lte('scheduled_time', next24Hours)
          .order('scheduled_time', { ascending: true })
          .limit(20);

        return NextResponse.json({
          success: true,
          data: upcomingJobs?.map(job => ({
            id: job.id,
            workflowName: job.workflow_data?.name || 'Unknown',
            scheduledTime: job.scheduled_time,
            timeUntil: Math.round((new Date(job.scheduled_time).getTime() - Date.now()) / 60000), // 분 단위
            retryCount: job.retry_count
          })) || []
        });

      case 'failed':
        // 실패한 작업들
        const { data: failedJobs } = await client
          .from('scheduled_jobs')
          .select('*')
          .eq('status', 'failed')
          .order('updated_at', { ascending: false })
          .limit(20);

        return NextResponse.json({
          success: true,
          data: failedJobs?.map(job => ({
            id: job.id,
            workflowName: job.workflow_data?.name || 'Unknown',
            scheduledTime: job.scheduled_time,
            failedAt: job.updated_at,
            errorMessage: job.error_message,
            retryCount: job.retry_count,
            maxRetries: job.max_retries,
            canRetry: job.retry_count < job.max_retries
          })) || []
        });

      case 'health':
        // 시스템 건강 상태 체크
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        // 지난 1시간 동안 처리된 작업 수
        const { data: recentActivity } = await client
          .from('scheduled_jobs')
          .select('status, updated_at')
          .gte('updated_at', oneHourAgo.toISOString());

        // 지연된 작업 수 (예정 시간이 지났는데 아직 pending인 작업)
        const { data: overdueJobs } = await client
          .from('scheduled_jobs')
          .select('id')
          .eq('status', 'pending')
          .lt('scheduled_time', now.toISOString());

        const health = {
          status: 'healthy',
          recentActivity: recentActivity?.length || 0,
          overdueJobs: overdueJobs?.length || 0,
          lastActivity: recentActivity?.[0]?.updated_at || null
        };

        // 건강 상태 판단
        if (health.overdueJobs > 5) {
          health.status = 'critical';
        } else if (health.overdueJobs > 0 || health.recentActivity === 0) {
          health.status = 'warning';
        }

        return NextResponse.json({
          success: true,
          data: health
        });

      default:
        return NextResponse.json({
          success: false,
          message: '지원하지 않는 액션입니다.'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ 스케줄러 모니터링 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 