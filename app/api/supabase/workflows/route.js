import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/database/supabase-client';

// 워크플로우 테이블 스키마
const WORKFLOW_SCHEMA = `
CREATE TABLE IF NOT EXISTS workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'archived'
  trigger_type VARCHAR(100) NOT NULL, -- 'manual', 'schedule', 'event'
  trigger_config JSONB,
  target_config JSONB, -- MySQL 쿼리 설정 또는 테이블 매핑
  message_config JSONB, -- 메시지 템플릿 및 설정
  variables JSONB, -- 추출된 변수 매핑
  schedule_config JSONB, -- 스케줄 설정
  statistics JSONB DEFAULT '{}', -- 실행 통계
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflows_next_run_at ON workflows(next_run_at);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);
`;

// 워크플로우 실행 기록 테이블
const WORKFLOW_RUNS_SCHEMA = `
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed', 'cancelled'
  trigger_type VARCHAR(100),
  target_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  error_message TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  logs JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at DESC);
`;

// 테이블 초기화
async function ensureWorkflowTables() {
  try {
    // 워크플로우 테이블 생성
    const { error: workflowError } = await supabaseAdmin.rpc('exec_sql', { 
      sql: WORKFLOW_SCHEMA 
    });
    
    if (workflowError && !workflowError.message.includes('already exists')) {
      console.error('워크플로우 테이블 생성 실패:', workflowError);
    }

    // 워크플로우 실행 기록 테이블 생성
    const { error: runsError } = await supabaseAdmin.rpc('exec_sql', { 
      sql: WORKFLOW_RUNS_SCHEMA 
    });
    
    if (runsError && !runsError.message.includes('already exists')) {
      console.error('워크플로우 실행 기록 테이블 생성 실패:', runsError);
    }
  } catch (error) {
    console.error('워크플로우 테이블 초기화 오류:', error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    // 테이블 존재 확인
    await ensureWorkflowTables();

    if (action === 'create') {
      // 새 워크플로우 생성
      const workflowData = {
        name: data.name,
        description: data.description,
        status: data.status || 'draft',
        trigger_type: data.triggerType,
        trigger_config: data.triggerConfig || {},
        target_config: data.targetConfig || {},
        message_config: data.messageConfig || {},
        variables: data.variables || {},
        schedule_config: data.scheduleConfig || {},
        created_by: data.createdBy
      };

      const { data: result, error } = await supabaseAdmin
        .from('workflows')
        .insert(workflowData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: '워크플로우가 생성되었습니다.'
      });
    }

    if (action === 'update') {
      // 워크플로우 업데이트
      const { id, ...updateData } = data;
      
      const workflowData = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const { data: result, error } = await supabaseAdmin
        .from('workflows')
        .update(workflowData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: '워크플로우가 업데이트되었습니다.'
      });
    }

    if (action === 'delete') {
      // 워크플로우 삭제
      const { id } = data;

      const { error } = await supabaseAdmin
        .from('workflows')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: '워크플로우가 삭제되었습니다.'
      });
    }

    if (action === 'toggle_status') {
      // 워크플로우 상태 토글
      const { id, status } = data;

      const { data: result, error } = await supabaseAdmin
        .from('workflows')
        .update({ 
          status, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: `워크플로우가 ${status}로 변경되었습니다.`
      });
    }

    if (action === 'create_run') {
      // 워크플로우 실행 기록 생성
      const runData = {
        workflow_id: data.workflowId,
        status: data.status || 'running',
        trigger_type: data.triggerType,
        target_count: data.targetCount || 0
      };

      const { data: result, error } = await supabaseAdmin
        .from('workflow_runs')
        .insert(runData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: '워크플로우 실행이 시작되었습니다.'
      });
    }

    if (action === 'update_run') {
      // 워크플로우 실행 기록 업데이트
      const { runId, ...updateData } = data;
      
      const runData = {
        ...updateData,
        completed_at: updateData.status === 'completed' || updateData.status === 'failed' 
          ? new Date().toISOString() 
          : null
      };

      const { data: result, error } = await supabaseAdmin
        .from('workflow_runs')
        .update(runData)
        .eq('id', runId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // 워크플로우 통계 업데이트
      if (result.status === 'completed') {
        await updateWorkflowStatistics(result.workflow_id, result);
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: '워크플로우 실행 기록이 업데이트되었습니다.'
      });
    }

    return NextResponse.json({ 
      error: '잘못된 액션입니다.' 
    }, { status: 400 });

  } catch (error) {
    console.error('워크플로우 API 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');
    const triggerType = searchParams.get('trigger_type');
    const includeRuns = searchParams.get('include_runs') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 테이블 존재 확인
    await ensureWorkflowTables();

    if (id) {
      // 특정 워크플로우 조회
      let query = supabaseAdmin
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      const { data: workflow, error } = await query;

      if (error) {
        throw error;
      }

      let runs = [];
      if (includeRuns) {
        const { data: runsData } = await supabaseAdmin
          .from('workflow_runs')
          .select('*')
          .eq('workflow_id', id)
          .order('started_at', { ascending: false })
          .limit(10);
        
        runs = runsData || [];
      }

      return NextResponse.json({
        success: true,
        data: { ...workflow, runs },
        timestamp: new Date().toISOString()
      });
    }

    // 워크플로우 목록 조회
    let query = supabaseAdmin
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 필터 적용
    if (status) {
      query = query.eq('status', status);
    }
    if (triggerType) {
      query = query.eq('trigger_type', triggerType);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // 전체 통계 조회
    const { data: stats } = await supabaseAdmin
      .from('workflows')
      .select('status, count(*)')
      .group('status');

    return NextResponse.json({
      success: true,
      data,
      count,
      stats,
      pagination: {
        limit,
        offset,
        hasMore: data.length === limit
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('워크플로우 조회 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}

// 워크플로우 통계 업데이트
async function updateWorkflowStatistics(workflowId, runResult) {
  try {
    const { data: workflow } = await supabaseAdmin
      .from('workflows')
      .select('statistics')
      .eq('id', workflowId)
      .single();

    const currentStats = workflow?.statistics || {};
    const newStats = {
      ...currentStats,
      totalRuns: (currentStats.totalRuns || 0) + 1,
      totalTargets: (currentStats.totalTargets || 0) + (runResult.target_count || 0),
      totalSuccess: (currentStats.totalSuccess || 0) + (runResult.success_count || 0),
      totalFailed: (currentStats.totalFailed || 0) + (runResult.failed_count || 0),
      totalCost: (currentStats.totalCost || 0) + (runResult.total_cost || 0),
      lastRunAt: new Date().toISOString(),
      averageExecutionTime: currentStats.averageExecutionTime 
        ? (currentStats.averageExecutionTime + (runResult.execution_time_ms || 0)) / 2
        : (runResult.execution_time_ms || 0)
    };

    await supabaseAdmin
      .from('workflows')
      .update({ 
        statistics: newStats,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', workflowId);

  } catch (error) {
    console.error('워크플로우 통계 업데이트 오류:', error);
  }
} 