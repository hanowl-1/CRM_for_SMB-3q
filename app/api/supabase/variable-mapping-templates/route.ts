import { NextRequest, NextResponse } from 'next/server';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const id = searchParams.get('id');
    const category = searchParams.get('category');
    const isPublic = searchParams.get('isPublic');
    const isFavorite = searchParams.get('isFavorite');

    console.log(`📋 변수 매핑 템플릿 ${action} 요청`);

    switch (action) {
      case 'list': {
        const filter: any = {};
        if (category) filter.category = category;
        if (isPublic !== null) filter.isPublic = isPublic === 'true';
        if (isFavorite !== null) filter.isFavorite = isFavorite === 'true';

        const result = await supabaseWorkflowService.getVariableMappingTemplates(filter);
        
        if (result.success) {
          return NextResponse.json({
            success: true,
            data: result.data,
            count: result.data?.length || 0
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error
          }, { status: 500 });
        }
      }

      case 'get': {
        if (!id) {
          return NextResponse.json({
            success: false,
            error: 'ID가 필요합니다'
          }, { status: 400 });
        }

        const result = await supabaseWorkflowService.getVariableMappingTemplate(id);
        
        if (result.success) {
          return NextResponse.json({
            success: true,
            data: result.data
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error
          }, { status: 404 });
        }
      }

      default:
        return NextResponse.json({
          success: false,
          error: '지원하지 않는 액션입니다'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('변수 매핑 템플릿 조회 실패:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'create';
    const body = await request.json();

    console.log(`💾 변수 매핑 템플릿 ${action} 요청:`, body);

    switch (action) {
      case 'create': {
        const result = await supabaseWorkflowService.createVariableMappingTemplate(body);
        
        if (result.success) {
          return NextResponse.json({
            success: true,
            data: result.data,
            message: '변수 매핑 템플릿이 생성되었습니다'
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error
          }, { status: 500 });
        }
      }

      case 'update': {
        const { id, ...updates } = body;
        
        if (!id) {
          return NextResponse.json({
            success: false,
            error: 'ID가 필요합니다'
          }, { status: 400 });
        }

        const result = await supabaseWorkflowService.updateVariableMappingTemplate(id, updates);
        
        if (result.success) {
          return NextResponse.json({
            success: true,
            data: result.data,
            message: '변수 매핑 템플릿이 업데이트되었습니다'
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error
          }, { status: 500 });
        }
      }

      case 'record-usage': {
        const { id } = body;
        
        if (!id) {
          return NextResponse.json({
            success: false,
            error: 'ID가 필요합니다'
          }, { status: 400 });
        }

        const result = await supabaseWorkflowService.recordVariableMappingTemplateUsage(id);
        
        if (result.success) {
          return NextResponse.json({
            success: true,
            message: '사용 기록이 저장되었습니다'
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error
          }, { status: 500 });
        }
      }

      default:
        return NextResponse.json({
          success: false,
          error: '지원하지 않는 액션입니다'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('변수 매핑 템플릿 처리 실패:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID가 필요합니다'
      }, { status: 400 });
    }

    console.log(`🗑️ 변수 매핑 템플릿 삭제 요청: ${id}`);

    const result = await supabaseWorkflowService.deleteVariableMappingTemplate(id);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: '변수 매핑 템플릿이 삭제되었습니다'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('변수 매핑 템플릿 삭제 실패:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
} 