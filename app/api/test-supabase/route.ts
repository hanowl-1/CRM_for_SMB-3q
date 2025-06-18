import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Supabase 연결 테스트 시작...');
    
    // 환경변수 확인 (Anon 키 사용)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('환경변수 확인:');
    console.log('- URL:', url);
    console.log('- Anon Key 존재:', !!anonKey);
    console.log('- Anon Key 길이:', anonKey?.length || 0);
    
    if (!url || !anonKey) {
      return NextResponse.json({
        success: false,
        error: '환경변수가 설정되지 않았습니다.',
        debug: {
          hasUrl: !!url,
          hasAnonKey: !!anonKey
        }
      });
    }

    // Anon 키로 Supabase 클라이언트 생성
    const supabase = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('테이블 접근 시도...');
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Supabase 테이블 접근 오류:', error);
      return NextResponse.json({
        success: false,
        error: `테이블 접근 오류: ${error.message}`,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
    }

    console.log('✅ Supabase 연결 성공, 데이터:', data);
    return NextResponse.json({
      success: true,
      message: 'Supabase 연결 성공',
      data: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('❌ Supabase 테스트 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 