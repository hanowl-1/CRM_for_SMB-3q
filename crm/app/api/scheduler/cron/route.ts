import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { getKoreaTime, koreaTimeToUTC, formatKoreaTime } from '@/lib/utils';

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

// 🔥 Vercel Cron - 스케줄러 실행 (10초마다)
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const now = getKoreaTime();
    
    console.log('🔄 === 크론 스케줄러 실행 ===');
    console.log(`현재 한국 시간: ${formatKoreaTime(now)}`);
    console.log(`환경: ${process.env.NODE_ENV}`);
    console.log(`베이스 URL: ${getBaseUrl(request)}`);
    
    // 실행할 작업들 조회
    const { data: jobs, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', koreaTimeToUTC(now))
      .order('scheduled_time', { ascending: true });
    
    if (error) {
      console.error('작업 조회 실패:', error);
      return NextResponse.json({ error: '작업 조회 실패' }, { status: 500 });
    }
    
    console.log(`실행할 작업 수: ${jobs?.length || 0}`);
    
    const results = [];
    
    for (const job of jobs || []) {
      // 작업 실행 로직
      results.push({
        id: job.id,
        status: 'executed',
        timestamp: koreaTimeToUTC(now)
      });
    }
    
    return NextResponse.json({
      success: true,
      executedJobs: results.length,
      results,
      timestamp: koreaTimeToUTC(now)
    });
    
  } catch (error) {
    console.error('크론 스케줄러 오류:', error);
    return NextResponse.json({ error: '크론 스케줄러 오류' }, { status: 500 });
  }
}

// POST 방식도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const now = getKoreaTime();
    
    console.log(`🕐 Vercel Cron 실행: ${formatKoreaTime(now)}`);
    
    // 환경별 베이스 URL 결정
    const baseUrl = getBaseUrl(request);
    console.log(`🌐 사용할 베이스 URL: ${baseUrl}`);
    
    const executeResponse = await fetch(`${baseUrl}/api/scheduler/execute`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 내부 호출 식별용 헤더
        'x-scheduler-internal': 'true',
        // CRON 인증 토큰 (필요한 경우)
        'x-cron-secret': process.env.CRON_SECRET_TOKEN || '',
        // Vercel Protection Bypass 헤더 추가
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
        baseUrl
      }, { status: executeResponse.status });
    }
    
    const executeResult = await executeResponse.json();
    
    console.log('✅ 스케줄러 실행 완료:', executeResult);
    
    return NextResponse.json({
      success: true,
      message: 'Vercel Cron 실행 완료',
      result: executeResult,
      baseUrl, // 디버깅용
      environment: process.env.NODE_ENV
    });
    
  } catch (error) {
    console.error('❌ Vercel Cron 실행 실패:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      baseUrl: getBaseUrl(request), // 디버깅용
      environment: process.env.NODE_ENV
    }, { status: 500 });
  }
} 