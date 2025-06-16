import { NextRequest, NextResponse } from 'next/server';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';

// 디버깅을 위한 환경변수 확인
console.log('🔍 API 라우트 환경변수 확인:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY 존재:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log('SUPABASE_SERVICE_ROLE_KEY 존재:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('SUPABASE_SERVICE_ROLE_KEY 길이:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0);

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
    
    console.log(`💾 개별 변수 매핑 POST API 요청: ${action}`);
    
    let body;
    try {
      body = await request.json();
      console.log('📝 요청 본문:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('❌ JSON 파싱 오류:', parseError);
      return NextResponse.json({
        success: false,
        error: 'JSON 파싱 오류가 발생했습니다.'
      }, { status: 400 });
    }

    switch (action) {
      case 'create':
        console.log('🔧 개별 변수 매핑 생성 시작...');
        
        if (!body.variableName || !body.sourceType) {
          console.error('❌ 필수 필드 누락:', { variableName: body.variableName, sourceType: body.sourceType });
          return NextResponse.json({
            success: false,
            error: 'variableName과 sourceType은 필수입니다.'
          }, { status: 400 });
        }

        console.log('✅ 필수 필드 검증 통과');
        
        try {
          const created = await supabaseWorkflowService.createIndividualVariableMapping(body);
          console.log(`✅ 개별 변수 매핑 생성 완료: ${body.variableName}`, created);
          
          return NextResponse.json({
            success: true,
            data: created
          });
        } catch (serviceError) {
          console.error('❌ 서비스 레이어 오류:', serviceError);
          console.error('❌ 서비스 오류 스택:', serviceError instanceof Error ? serviceError.stack : 'No stack');
          
          return NextResponse.json({
            success: false,
            error: serviceError instanceof Error ? serviceError.message : '서비스 오류가 발생했습니다.'
          }, { status: 500 });
        }

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
    console.error('❌ 개별 변수 매핑 생성/업데이트 API 최상위 오류:', error);
    console.error('❌ 최상위 오류 스택:', error instanceof Error ? error.stack : 'No stack');
    
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