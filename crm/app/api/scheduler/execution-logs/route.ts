import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { getKoreaTime, formatKoreaTime, koreaTimeToUTCString } from '@/lib/utils/timezone';

// 실행 단계 정의
export type ExecutionStep = 
  | 'cron_trigger'      // 1. AWS EventBridge/Vercel Cron 트리거
  | 'scheduler_detect'  // 2. 스케줄러 감지 API
  | 'jobs_query'        // 3. scheduled_jobs 테이블 조회
  | 'workflow_query'    // 4. 워크플로우 정보 조회
  | 'workflow_execute'  // 5. 워크플로우 실행 API 호출
  | 'target_extract'    // 6. 대상자 조회 & 추출
  | 'template_mapping'  // 7. 템플릿 변수 매핑
  | 'message_generate'  // 8. 개인화 메시지 생성
  | 'sms_api_call'      // 9. CoolSMS API 호출
  | 'result_process'    // 10. 발송 결과 처리
  | 'status_update';    // 11. 스케줄 작업 상태 업데이트

export interface ExecutionLogEntry {
  id?: string;
  execution_id: string;
  job_id?: string;
  workflow_id?: string;
  workflow_name?: string;
  step: ExecutionStep;
  status: 'started' | 'success' | 'failed' | 'warning';
  message: string;
  details?: any;
  error_message?: string;
  duration_ms?: number;
  timestamp: string;
  created_at?: string;
}

// 실행 로그 생성
export async function POST(request: NextRequest) {
  try {
    const { action, ...logData } = await request.json();

    const client = getSupabase();
    const now = getKoreaTime();

    if (action === 'create') {
      const logEntry: ExecutionLogEntry = {
        ...logData,
        timestamp: koreaTimeToUTCString(now),
        created_at: koreaTimeToUTCString(now)
      };

      const { data, error } = await client
        .from('scheduler_execution_logs')
        .insert([logEntry])
        .select()
        .single();

      if (error) {
        console.error('❌ 실행 로그 생성 실패:', error);
        return NextResponse.json({
          success: false,
          message: '실행 로그 생성 실패: ' + error.message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data
      });
    }

    if (action === 'bulk_create') {
      const logs = logData.logs as ExecutionLogEntry[];
      const processedLogs = logs.map(log => ({
        ...log,
        timestamp: log.timestamp || koreaTimeToUTCString(now),
        created_at: koreaTimeToUTCString(now)
      }));

      const { data, error } = await client
        .from('scheduler_execution_logs')
        .insert(processedLogs)
        .select();

      if (error) {
        console.error('❌ 실행 로그 벌크 생성 실패:', error);
        return NextResponse.json({
          success: false,
          message: '실행 로그 벌크 생성 실패: ' + error.message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data,
        created_count: data?.length || 0
      });
    }

    return NextResponse.json({
      success: false,
      message: '지원하지 않는 액션입니다.'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ 실행 로그 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// 실행 로그 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const execution_id = searchParams.get('execution_id');
    const job_id = searchParams.get('job_id');
    const workflow_id = searchParams.get('workflow_id');
    const limit = parseInt(searchParams.get('limit') || '100');
    const step = searchParams.get('step') as ExecutionStep;
    const status = searchParams.get('status');
    const since = searchParams.get('since'); // 특정 시간 이후의 로그만

    const client = getSupabase();
    let query = client
      .from('scheduler_execution_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // 필터링
    if (execution_id) {
      query = query.eq('execution_id', execution_id);
    }
    if (job_id) {
      query = query.eq('job_id', job_id);
    }
    if (workflow_id) {
      query = query.eq('workflow_id', workflow_id);
    }
    if (step) {
      query = query.eq('step', step);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (since) {
      query = query.gte('created_at', since);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('❌ 실행 로그 조회 실패:', error);
      return NextResponse.json({
        success: false,
        message: '실행 로그 조회 실패: ' + error.message
      }, { status: 500 });
    }

    // 실행별로 그룹화하여 반환
    const executionGroups: { [key: string]: ExecutionLogEntry[] } = {};
    logs?.forEach(log => {
      if (!executionGroups[log.execution_id]) {
        executionGroups[log.execution_id] = [];
      }
      executionGroups[log.execution_id].push(log);
    });

    // 단계별 통계 계산
    const stepStats: { [key in ExecutionStep]?: { total: number; success: number; failed: number; } } = {};
    logs?.forEach(log => {
      if (!stepStats[log.step]) {
        stepStats[log.step] = { total: 0, success: 0, failed: 0 };
      }
      stepStats[log.step].total++;
      if (log.status === 'success') {
        stepStats[log.step].success++;
      } else if (log.status === 'failed') {
        stepStats[log.step].failed++;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        logs: logs || [],
        execution_groups: executionGroups,
        step_statistics: stepStats,
        total_logs: logs?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ 실행 로그 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
} 