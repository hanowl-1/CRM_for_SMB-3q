import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  utcToKoreaTime, 
  formatKoreaTime, 
  koreaTimeToUTCString,
  debugTimeInfo 
} from '@/lib/utils/timezone';

/**
 * 🔥 메인 Cron 엔드포인트
 * 
 * 이 엔드포인트는 두 가지 방식으로 호출됩니다:
 * 1. Vercel Cron Jobs (무료 플랜: 하루 1회, 자정 UTC)
 * 2. AWS Lambda (매 5분마다 정확한 스케줄링)
 * 
 * 🕐 시간대 처리 원칙:
 * - 저장: UTC로 DB 저장 (서버 환경 독립적)
 * - 입력: 사용자는 KST로 입력
 * - 출력: 사용자에게는 KST로 표시
 * - 연산: 내부 비교는 같은 시간대끼리
 */

// 환경별 베이스 URL 결정 함수
function getBaseUrl(request: NextRequest): string {
  // 개발 환경
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // 프로덕션 환경
  if (process.env.VERCEL_PROJECT_URL) {
    return `https://${process.env.VERCEL_PROJECT_URL}`;
  }
  
  // Vercel 환경 변수
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // 요청 헤더에서 호스트 추출
  const host = request.headers.get('host');
  if (host) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}`;
  }
  
  // 기본값
  return 'http://localhost:3000';
}

// 인증 검증 함수
function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent');
  const secretToken = process.env.CRON_SECRET_TOKEN;
  
  // 개발 환경에서는 인증 건너뛰기
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // Vercel Cron Jobs 인증
  if (userAgent?.includes('vercel-cron')) {
    return true;
  }
  
  // AWS Lambda 인증
  if (userAgent?.includes('AWS-Lambda-Scheduler')) {
    if (authHeader && secretToken) {
      const token = authHeader.replace('Bearer ', '');
      return token === secretToken;
    }
  }
  
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const now = getKoreaTime();
    const caller = request.headers.get('user-agent') || 'unknown';
    
    console.log('🔄 === 메인 Cron 엔드포인트 실행 ===');
    console.log(`현재 한국 시간: ${formatKoreaTime(now)}`);
    console.log(`호출자: ${caller}`);
    console.log(`환경: ${process.env.NODE_ENV}`);
    
    // 인증 검증
    if (!verifyAuth(request)) {
      console.error('❌ 인증 실패');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('✅ 인증 성공');
    
    // 환경별 베이스 URL 결정
    const baseUrl = getBaseUrl(request);
    console.log(`🌐 사용할 베이스 URL: ${baseUrl}`);
    
    // 스케줄러 실행 API 호출
    const executeResponse = await fetch(`${baseUrl}/api/scheduler/execute`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-scheduler-internal': 'true',
        'x-cron-secret': process.env.CRON_SECRET_TOKEN || '',
        'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
        'x-vercel-set-bypass-cookie': 'true'
      }
    });
    
    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.error(`❌ 스케줄러 실행 API 호출 실패 (${executeResponse.status}):`, errorText);
      return NextResponse.json({
        success: false,
        error: `스케줄러 실행 실패: HTTP ${executeResponse.status}`,
        details: errorText,
        caller,
        baseUrl
      }, { status: executeResponse.status });
    }
    
    const executeResult = await executeResponse.json();
    console.log('✅ 스케줄러 실행 완료:', executeResult);
    
    return NextResponse.json({
      success: true,
      message: 'Cron 실행 완료',
      caller,
      result: executeResult,
      timestamp: formatKoreaTime(now),
      baseUrl, // 디버깅용
      environment: process.env.NODE_ENV
    });
    
  } catch (error) {
    console.error('❌ Cron 실행 실패:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      caller: request.headers.get('user-agent') || 'unknown',
      baseUrl: getBaseUrl(request),
      environment: process.env.NODE_ENV
    }, { status: 500 });
  }
}

// POST 방식도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  return GET(request);
} 