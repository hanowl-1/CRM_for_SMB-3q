import { NextResponse } from 'next/server';

// GET /api/supabase/test - Supabase 연결 테스트
export async function GET() {
  try {
    console.log('Supabase 연결 테스트 시작...');
    
    // 환경변수 확인
    const envVars = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    };
    
    console.log('Supabase 환경변수 상태:', envVars);
    
    // 환경변수가 없으면 에러 반환 (빌드 시에는 에러를 던지지 않음)
    if (!envVars.url || !envVars.hasAnonKey) {
      return NextResponse.json({
        success: false,
        error: 'Supabase 환경변수 누락',
        message: '필요한 Supabase 환경변수가 설정되지 않았습니다.',
        envStatus: envVars,
        required: {
          NEXT_PUBLIC_SUPABASE_URL: '필수',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: '필수',
          SUPABASE_SERVICE_ROLE_KEY: '선택사항 (관리자 기능용)'
        }
      }, { status: 500 });
    }
    
    // 동적 import로 Supabase 클라이언트 로드 (빌드 시 에러 방지)
    let supabaseDataService;
    try {
      const { default: service } = await import('@/lib/services/supabase-data-service');
      supabaseDataService = service;
    } catch (error) {
      console.log('Supabase 서비스 로드 실패:', error.message);
      return NextResponse.json({
        success: false,
        error: 'Supabase 서비스 로드 실패',
        message: 'Supabase 클라이언트를 초기화할 수 없습니다.',
        details: error.message
      }, { status: 500 });
    }
    
    // Supabase 연결 초기화
    const isConnected = await supabaseDataService.initialize();
    
    if (!isConnected) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Supabase 연결 실패',
          message: '데이터베이스에 연결할 수 없습니다.',
          envStatus: envVars
        },
        { status: 500 }
      );
    }

    // 기본 통계 조회 (테이블이 있는 경우)
    let statistics = null;
    try {
      statistics = await supabaseDataService.getStatistics();
    } catch (error) {
      console.log('통계 조회 실패 (테이블이 없을 수 있음):', error.message);
    }

    // 테이블 목록 조회 시도
    let tables = [];
    try {
      const { data: tableData } = await supabaseDataService.supabaseAdmin
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      tables = tableData?.map(t => t.table_name) || [];
    } catch (error) {
      console.log('테이블 목록 조회 실패:', error.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase 연결 성공',
      connection: {
        url: envVars.url,
        hasAnonKey: envVars.hasAnonKey,
        hasServiceKey: envVars.hasServiceKey
      },
      statistics,
      tables,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Supabase 연결 테스트 실패:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Supabase 연결 테스트 중 오류 발생',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 