import { NextResponse } from 'next/server';
import { getSupabaseInfo } from '@/lib/database/supabase-client';

export async function GET() {
  try {
    const supabaseInfo = getSupabaseInfo();
    
    return NextResponse.json({
      success: true,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT_SET',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET',
        MYSQL_READONLY_HOST: process.env.MYSQL_READONLY_HOST ? 'SET' : 'NOT_SET',
        COOLSMS_API_KEY: process.env.COOLSMS_API_KEY ? 'SET' : 'NOT_SET',
        KAKAO_SENDER_KEY: process.env.KAKAO_SENDER_KEY ? 'SET' : 'NOT_SET'
      },
      supabaseInfo
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT_SET',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET'
      }
    }, { status: 500 });
  }
} 