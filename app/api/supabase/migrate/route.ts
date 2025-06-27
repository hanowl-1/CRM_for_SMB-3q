import { NextRequest, NextResponse } from 'next/server';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    console.log(`🔧 데이터베이스 마이그레이션 요청: ${action}`);
    
    if (action === 'add-key-column') {
      // individual_variable_mappings 테이블에 key_column 추가
      const migrationSQL = `
        -- key_column 컬럼 추가 (매핑에 사용할 키 컬럼 정보 저장)
        ALTER TABLE individual_variable_mappings 
        ADD COLUMN IF NOT EXISTS key_column VARCHAR(255) DEFAULT '';
        
        -- 인덱스 추가
        CREATE INDEX IF NOT EXISTS idx_individual_variable_mappings_key_column 
        ON individual_variable_mappings(key_column);
      `;
      
      // @ts-ignore - 내부 클라이언트 접근
      const client = supabaseWorkflowService.getClient();
      
      console.log('🔧 key_column 컬럼 추가 마이그레이션 실행 중...');
      
      const { data, error } = await client.rpc('exec_sql', {
        sql_query: migrationSQL
      });
      
      if (error) {
        console.error('❌ 마이그레이션 실패:', error);
        // RPC 함수가 없을 경우 직접 SQL 실행 시도
        try {
          const { data: alterData, error: alterError } = await client
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_name', 'individual_variable_mappings')
            .eq('column_name', 'key_column');
            
          if (alterError) {
            throw alterError;
          }
          
          if (!alterData || alterData.length === 0) {
            // 컬럼이 없으므로 추가 필요
            console.log('⚠️ RPC 함수를 사용할 수 없어 수동으로 컬럼 확인 완료. Supabase 대시보드에서 수동으로 추가해주세요.');
            return NextResponse.json({
              success: false,
              message: 'key_column 컬럼이 존재하지 않습니다. Supabase 대시보드에서 수동으로 추가해주세요.',
              sql: migrationSQL
            });
          } else {
            console.log('✅ key_column 컬럼이 이미 존재합니다.');
            return NextResponse.json({
              success: true,
              message: 'key_column 컬럼이 이미 존재합니다.'
            });
          }
        } catch (checkError) {
          console.error('❌ 컬럼 확인 실패:', checkError);
          return NextResponse.json({
            success: false,
            message: 'key_column 컬럼 확인에 실패했습니다. Supabase 대시보드에서 수동으로 추가해주세요.',
            sql: migrationSQL,
            error: checkError
          }, { status: 500 });
        }
      }
      
      console.log('✅ key_column 컬럼 추가 마이그레이션 완료');
      
      return NextResponse.json({
        success: true,
        message: 'key_column 컬럼이 성공적으로 추가되었습니다.',
        data: data
      });
    }
    
    return NextResponse.json({
      success: false,
      message: '지원하지 않는 마이그레이션 액션입니다.'
    }, { status: 400 });
    
  } catch (error) {
    console.error('❌ 마이그레이션 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '마이그레이션에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
} 