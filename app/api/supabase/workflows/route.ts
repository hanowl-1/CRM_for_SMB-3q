import { NextRequest, NextResponse } from 'next/server';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';
import type { Workflow } from '@/lib/types/workflow';

// GET: 워크플로우 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    const result = await supabaseWorkflowService.getWorkflows(limit, offset);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.error || '워크플로우 목록 조회에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data || [],
      total: result.data?.length || 0,
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
        
        if (!result.success) {
          return NextResponse.json({
            success: false,
            message: result.error || '워크플로우 생성에 실패했습니다.'
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          data: result.data,
          message: '워크플로우가 성공적으로 생성되었습니다.'
        });
      }

      case 'update': {
        const { id, ...updates } = data;
        const result = await supabaseWorkflowService.updateWorkflow(id, updates);
        
        if (!result.success) {
          return NextResponse.json({
            success: false,
            message: result.error || '워크플로우 업데이트에 실패했습니다.'
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          data: result.data,
          message: '워크플로우가 성공적으로 업데이트되었습니다.'
        });
      }

      case 'delete': {
        const { id } = data;
        const result = await supabaseWorkflowService.deleteWorkflow(id);
        
        if (!result.success) {
          return NextResponse.json({
            success: false,
            message: result.error || '워크플로우 삭제에 실패했습니다.'
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          message: '워크플로우가 성공적으로 삭제되었습니다.'
        });
      }

      case 'toggle_status': {
        const { id, status } = data;
        const result = await supabaseWorkflowService.updateWorkflow(id, { status });
        
        if (!result.success) {
          return NextResponse.json({
            success: false,
            message: result.error || '워크플로우 상태 변경에 실패했습니다.'
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          data: result.data,
          message: `워크플로우 상태가 ${status}로 변경되었습니다.`
        });
      }

      case 'get_stats': {
        const result = await supabaseWorkflowService.getWorkflowStats();
        
        if (!result.success) {
          return NextResponse.json({
            success: false,
            message: result.error || '워크플로우 통계 조회에 실패했습니다.'
          }, { status: 500 });
        }
        
        return NextResponse.json({
          success: true,
          data: result.data,
          message: '워크플로우 통계를 성공적으로 조회했습니다.'
        });
      }

      // 나머지 케이스들은 현재 구현되지 않음
      case 'create_run':
      case 'update_run':
      case 'create_message_log':
      case 'update_message_log':
      default:
        return NextResponse.json({
          success: false,
          message: `아직 구현되지 않은 액션입니다: ${action}`
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
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.error || '워크플로우 업데이트에 실패했습니다.'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      data: result.data,
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

    const result = await supabaseWorkflowService.deleteWorkflow(id);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.error || '워크플로우 삭제에 실패했습니다.'
      }, { status: 500 });
    }
    
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