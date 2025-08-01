import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';

// 스케줄러 로그 조회 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status'); // pending, running, completed, failed, cancelled
    const workflowId = searchParams.get('workflowId');

    const client = getSupabase();
    
    let query = client
      .from('scheduled_jobs')
      .select(`
        id,
        workflow_id,
        scheduled_time,
        status,
        created_at,
        updated_at,
        executed_at,
        error_message,
        retry_count,
        max_retries,
        workflow_data
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // 상태별 필터링
    if (status) {
      query = query.eq('status', status);
    }

    // 워크플로우별 필터링
    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('❌ 스케줄러 로그 조회 실패:', error);
      return NextResponse.json({
        success: false,
        message: '스케줄러 로그 조회 실패: ' + error.message
      }, { status: 500 });
    }

    // 로그 데이터 가공
    const processedLogs = logs?.map(log => ({
      id: log.id,
      workflowId: log.workflow_id,
      workflowName: log.workflow_data?.name || 'Unknown',
      scheduledTime: log.scheduled_time,
      status: log.status,
      createdAt: log.created_at,
      updatedAt: log.updated_at,
      executedAt: log.executed_at,
      errorMessage: log.error_message,
      retryCount: log.retry_count,
      maxRetries: log.max_retries,
      isOverdue: new Date(log.scheduled_time) < new Date() && log.status === 'pending'
    })) || [];

    // 통계 계산
    const stats = {
      total: processedLogs.length,
      pending: processedLogs.filter(l => l.status === 'pending').length,
      running: processedLogs.filter(l => l.status === 'running').length,
      completed: processedLogs.filter(l => l.status === 'completed').length,
      failed: processedLogs.filter(l => l.status === 'failed').length,
      cancelled: processedLogs.filter(l => l.status === 'cancelled').length,
      overdue: processedLogs.filter(l => l.isOverdue).length
    };

    return NextResponse.json({
      success: true,
      data: {
        logs: processedLogs,
        stats
      },
      message: `${processedLogs.length}개의 스케줄러 로그를 조회했습니다.`
    });

  } catch (error) {
    console.error('❌ 스케줄러 로그 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 