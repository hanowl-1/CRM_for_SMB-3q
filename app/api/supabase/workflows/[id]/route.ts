import { NextRequest, NextResponse } from 'next/server';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';

// GET: 특정 워크플로우 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: '워크플로우 ID가 필요합니다.'
      }, { status: 400 });
    }

    const result = await supabaseWorkflowService.getWorkflow(id);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.error || '워크플로우 조회에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: '워크플로우를 성공적으로 조회했습니다.'
    });

  } catch (error) {
    console.error('워크플로우 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '워크플로우 조회에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
}

// PUT: 특정 워크플로우 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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