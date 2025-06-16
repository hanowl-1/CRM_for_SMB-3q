import { NextRequest, NextResponse } from 'next/server';
import { supabaseWorkflowService } from '@/lib/services/supabase-workflow-service';
import type { Workflow } from '@/lib/types/workflow';

// GET: 워크플로우 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    const workflows = await supabaseWorkflowService.getWorkflows({
      status,
      limit,
      offset
    });

    // Supabase 워크플로우를 클라이언트 형식으로 변환
    const clientWorkflows = workflows.map(workflow => 
      supabaseWorkflowService.convertToClientWorkflow(workflow)
    );

    return NextResponse.json({
      success: true,
      data: clientWorkflows,
      total: workflows.length,
      message: '워크플로우 목록을 성공적으로 조회했습니다.'
    });

  } catch (error) {
    console.error('워크플로우 목록 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '워크플로우 목록 조회에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
}

// POST: 워크플로우 생성/업데이트/삭제 등 액션 처리
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create': {
        const workflow = data as Workflow;
        const result = await supabaseWorkflowService.createWorkflow(workflow);
        
        return NextResponse.json({
          success: true,
          data: supabaseWorkflowService.convertToClientWorkflow(result),
          message: '워크플로우가 성공적으로 생성되었습니다.'
        });
      }

      case 'update': {
        const { id, ...updates } = data;
        const result = await supabaseWorkflowService.updateWorkflow(id, updates);
        
        return NextResponse.json({
          success: true,
          data: supabaseWorkflowService.convertToClientWorkflow(result),
          message: '워크플로우가 성공적으로 업데이트되었습니다.'
        });
      }

      case 'delete': {
        const { id } = data;
        await supabaseWorkflowService.deleteWorkflow(id);
        
        return NextResponse.json({
          success: true,
          message: '워크플로우가 성공적으로 삭제되었습니다.'
        });
      }

      case 'toggle_status': {
        const { id, status } = data;
        const result = await supabaseWorkflowService.updateWorkflow(id, { status });
        
        return NextResponse.json({
          success: true,
          data: supabaseWorkflowService.convertToClientWorkflow(result),
          message: `워크플로우 상태가 ${status}로 변경되었습니다.`
        });
      }

      case 'get_stats': {
        const { id } = data;
        const stats = await supabaseWorkflowService.getWorkflowStats(id);
        
        return NextResponse.json({
          success: true,
          data: stats,
          message: '워크플로우 통계를 성공적으로 조회했습니다.'
        });
      }

      case 'create_run': {
        const { workflowId, triggerType, targetCount } = data;
        const result = await supabaseWorkflowService.createWorkflowRun(workflowId, {
          triggerType,
          targetCount
        });
        
        return NextResponse.json({
          success: true,
          data: result,
          message: '워크플로우 실행이 시작되었습니다.'
        });
      }

      case 'update_run': {
        const { runId, ...updates } = data;
        const result = await supabaseWorkflowService.updateWorkflowRun(runId, updates);
        
        return NextResponse.json({
          success: true,
          data: result,
          message: '워크플로우 실행 기록이 업데이트되었습니다.'
        });
      }

      case 'create_message_log': {
        const result = await supabaseWorkflowService.createMessageLog(data);
        
        return NextResponse.json({
          success: true,
          data: result,
          message: '메시지 로그가 생성되었습니다.'
        });
      }

      case 'update_message_log': {
        const { logId, ...updates } = data;
        const result = await supabaseWorkflowService.updateMessageLog(logId, updates);
        
        return NextResponse.json({
          success: true,
          data: result,
          message: '메시지 로그가 업데이트되었습니다.'
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: `알 수 없는 액션입니다: ${action}`
        }, { status: 400 });
    }

  } catch (error) {
    console.error('워크플로우 API 처리 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '요청 처리에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
}

// PUT: 특정 워크플로우 업데이트
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({
        success: false,
        message: '워크플로우 ID가 필요합니다.'
      }, { status: 400 });
    }

    const updates = await request.json();
    const result = await supabaseWorkflowService.updateWorkflow(id, updates);
    
    return NextResponse.json({
      success: true,
      data: supabaseWorkflowService.convertToClientWorkflow(result),
      message: '워크플로우가 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('워크플로우 업데이트 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '워크플로우 업데이트에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
}

// DELETE: 특정 워크플로우 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({
        success: false,
        message: '워크플로우 ID가 필요합니다.'
      }, { status: 400 });
    }

    await supabaseWorkflowService.deleteWorkflow(id);
    
    return NextResponse.json({
      success: true,
      message: '워크플로우가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('워크플로우 삭제 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '워크플로우 삭제에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
} 