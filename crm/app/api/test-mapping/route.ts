import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 individual_variable_mappings 테이블 직접 조회 시작...');
    
    const supabase = getSupabaseAdmin();
    console.log('📋 Supabase Admin 클라이언트 생성 완료');
    
    const { data: mappings, error: mappingError } = await supabase
      .from('individual_variable_mappings')
      .select('*');
      
    console.log('📋 매핑 조회 결과:', {
      hasData: !!mappings,
      dataLength: mappings?.length || 0,
      hasError: !!mappingError,
      errorMessage: mappingError?.message,
      errorCode: mappingError?.code
    });
    
    if (mappingError) {
      console.error('❌ 매핑 조회 오류:', mappingError);
      return NextResponse.json({
        success: false,
        error: mappingError.message,
        code: mappingError.code
      }, { status: 500 });
    }
    
    console.log('📋 조회된 매핑 데이터:', mappings);
    
    return NextResponse.json({
      success: true,
      data: mappings || [],
      count: mappings?.length || 0,
      debug: {
        hasSupabaseAdmin: true,
        tableName: 'individual_variable_mappings'
      }
    });
    
  } catch (error) {
    console.error('❌ 테스트 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
} 