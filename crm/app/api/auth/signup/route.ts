import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: '이메일과 비밀번호는 필수입니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 회원가입 시도
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
          role: 'admin', // 기본적으로 관리자 권한
        }
      }
    });

    if (error) {
      console.error('❌ 회원가입 실패:', error);
      
      if (error.message.includes('User already registered')) {
        return NextResponse.json(
          { success: false, message: '이미 등록된 이메일입니다.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    console.log('✅ 회원가입 성공:', data.user?.email);

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해주세요.',
      data: {
        user: data.user,
        session: data.session
      }
    });

  } catch (error) {
    console.error('❌ 회원가입 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 