import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      VERCEL_AUTOMATION_BYPASS_SECRET: process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? 
        `설정됨 (길이: ${process.env.VERCEL_AUTOMATION_BYPASS_SECRET.length})` : '설정되지 않음',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '설정됨' : '설정되지 않음',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '설정됨' : '설정되지 않음',
      timestamp: new Date().toISOString()
    };

    console.log('환경 변수 체크:', envCheck);

    return NextResponse.json({
      message: '환경 변수 체크 완료',
      environment: envCheck,
      headers: {
        host: request.headers.get('host'),
        'user-agent': request.headers.get('user-agent'),
        'x-forwarded-for': request.headers.get('x-forwarded-for')
      }
    });

  } catch (error) {
    console.error('환경 변수 체크 오류:', error);
    return NextResponse.json(
      { 
        error: '환경 변수 체크 실패', 
        details: error instanceof Error ? error.message : '알 수 없는 오류' 
      },
      { status: 500 }
    );
  }
} 