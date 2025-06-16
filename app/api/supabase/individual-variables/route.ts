import { NextRequest, NextResponse } from 'next/server';
import { supabaseWorkflowService } from '@/lib/services/supabase-workflow-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const variableName = searchParams.get('variableName');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const isPublic = searchParams.get('isPublic');
    const isFavorite = searchParams.get('isFavorite');

    console.log(`🔍 개별 변수 매핑 API 요청: ${action}`);

    switch (action) {
      case 'list':
        const filter = {
          category: category || 'all',
          search: search || '',
          isPublic: isPublic ? isPublic === 'true' : undefined,
          isFavorite: isFavorite ? isFavorite === 'true' : undefined
        };
        
        const mappings = await supabaseWorkflowService.getIndividualVariableMappings(filter);
        console.log(`📊 개별 변수 매핑 ${mappings.length}개 조회 완료`);
        
        return NextResponse.json({
          success: true,
          data: mappings,
          count: mappings.length
        });

      case 'get':
        if (!variableName) {
          return NextResponse.json({
            success: false,
            error: 'variableName 파라미터가 필요합니다.'
          }, { status: 400 });
        }

        const mapping = await supabaseWorkflowService.getIndividualVariableMapping(variableName);
        console.log(`📋 개별 변수 매핑 조회: ${variableName} - ${mapping ? '성공' : '없음'}`);
        
        return NextResponse.json({
          success: true,
          data: mapping
        });

      default:
        return NextResponse.json({
          success: false,
          error: '지원하지 않는 액션입니다.'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ 개별 변수 매핑 조회 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();

    console.log(`💾 개별 변수 매핑 API 요청: ${action}`, body);

    switch (action) {
      case 'create':
        if (!body.variableName || !body.sourceType) {
          return NextResponse.json({
            success: false,
            error: 'variableName과 sourceType은 필수입니다.'
          }, { status: 400 });
        }

        const created = await supabaseWorkflowService.createIndividualVariableMapping(body);
        console.log(`✅ 개별 변수 매핑 생성 완료: ${body.variableName}`);
        
        return NextResponse.json({
          success: true,
          data: created
        });

      case 'update':
        if (!body.id) {
          return NextResponse.json({
            success: false,
            error: 'id는 필수입니다.'
          }, { status: 400 });
        }

        const updated = await supabaseWorkflowService.updateIndividualVariableMapping(body.id, body);
        console.log(`🔧 개별 변수 매핑 업데이트 완료: ${body.id}`);
        
        return NextResponse.json({
          success: true,
          data: updated
        });

      case 'record-usage':
        if (!body.variableName) {
          return NextResponse.json({
            success: false,
            error: 'variableName은 필수입니다.'
          }, { status: 400 });
        }

        await supabaseWorkflowService.recordIndividualVariableMappingUsage(body.variableName);
        console.log(`📈 개별 변수 매핑 사용 기록 완료: ${body.variableName}`);
        
        return NextResponse.json({
          success: true,
          message: '사용 기록이 완료되었습니다.'
        });

      default:
        return NextResponse.json({
          success: false,
          error: '지원하지 않는 액션입니다.'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ 개별 변수 매핑 생성/업데이트 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    console.log(`🗑️ 개별 변수 매핑 삭제 API 요청: ${action}, ID: ${id}`);

    if (action === 'delete') {
      if (!id) {
        return NextResponse.json({
          success: false,
          error: 'id 파라미터가 필요합니다.'
        }, { status: 400 });
      }

      const deleted = await supabaseWorkflowService.deleteIndividualVariableMapping(id);
      console.log(`🗑️ 개별 변수 매핑 삭제 완료: ${id}`);
      
      return NextResponse.json({
        success: true,
        message: '개별 변수 매핑이 삭제되었습니다.'
      });
    }

    return NextResponse.json({
      success: false,
      error: '지원하지 않는 액션입니다.'
    }, { status: 400 });
  } catch (error) {
    console.error('❌ 개별 변수 매핑 삭제 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    }, { status: 500 });
  }
} 