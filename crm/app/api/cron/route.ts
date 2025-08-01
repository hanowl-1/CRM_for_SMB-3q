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

// 크론 신호 기록 함수 (cron 엔드포인트용)
async function recordCronCallSignal(request: NextRequest, isAwsLambda: boolean) {
  try {
    const supabase = getSupabase();
    
    // 요청 정보 수집
    const userAgent = request.headers.get('user-agent') || '';
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwardedFor || realIp || null;
    
    // 신호 출처 판단
    let source = 'manual';
    if (isAwsLambda) {
      source = 'aws-lambda-cron';  // cron 엔드포인트 호출임을 구분
    } else if (userAgent.includes('vercel-cron')) {
      source = 'vercel-cron';
    } else if (process.env.NODE_ENV === 'development') {
      source = 'development-cron';
    }
    
    // 헤더 정보 수집
    const relevantHeaders: Record<string, string> = {};
    ['user-agent', 'authorization', 'x-forwarded-for', 'x-real-ip'].forEach(header => {
      const value = request.headers.get(header);
      if (value) {
        if (header === 'authorization') {
          relevantHeaders[header] = value.startsWith('Bearer ') ? 'Bearer [TOKEN]' : 'present';
        } else {
          relevantHeaders[header] = value;
        }
      }
    });
    
    const currentTime = formatKoreaTime(new Date(), 'YYYY-MM-DD HH:mm:ss');
    
    console.log(`🔔 크론 호출 신호 기록: 출처=${source}, 시간=${currentTime}`);
    
    const { data, error } = await supabase
      .from('cron_signals')
      .insert({
        signal_time: currentTime,
        source,
        user_agent: userAgent,
        ip_address: ipAddress,
        request_headers: relevantHeaders,
        response_status: null, // 실행 후 업데이트
        executed_jobs_count: 0, // 실행 후 업데이트
        execution_duration_ms: null, // 실행 후 업데이트
        notes: `크론 엔드포인트 호출 - ${source}`
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ 크론 호출 신호 기록 실패:', error);
      return null;
    }
    
    console.log(`✅ 크론 호출 신호 기록 완료: ID=${data.id}`);
    return data.id;
  } catch (error) {
    console.error('❌ 크론 호출 신호 기록 중 오류:', error);
    return null;
  }
}

// 크론 신호 업데이트 함수
async function updateCronCallSignal(signalId: string | null, responseStatus: number, executedJobsCount: number, durationMs: number) {
  if (!signalId) return;
  
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('cron_signals')
      .update({
        response_status: responseStatus,
        executed_jobs_count: executedJobsCount,
        execution_duration_ms: durationMs
      })
      .eq('id', signalId);
    
    if (error) {
      console.error('❌ 크론 호출 신호 업데이트 실패:', error);
    } else {
      console.log(`✅ 크론 호출 신호 업데이트 완료: ID=${signalId}, 실행작업수=${executedJobsCount}, 소요시간=${durationMs}ms`);
    }
  } catch (error) {
    console.error('❌ 크론 호출 신호 업데이트 중 오류:', error);
  }
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
  const startTime = new Date();
  let cronCallSignalId: string | null = null;
  
  try {
    const now = getKoreaTime();
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    console.log('🔄 === 메인 Cron 엔드포인트 실행 ===');
    console.log(`현재 한국 시간: ${formatKoreaTime(now)}`);
    console.log(`호출자: ${userAgent}`);
    console.log(`환경: ${process.env.NODE_ENV}`);
    
    // AWS Lambda 호출인지 판단
    const isAwsLambda = userAgent.includes('AWS-Lambda-Scheduler');
    console.log(`AWS Lambda 호출: ${isAwsLambda ? 'YES' : 'NO'}`);
    
    // 🔔 크론 호출 신호 기록
    cronCallSignalId = await recordCronCallSignal(request, isAwsLambda);
    
    // 인증 검증
    if (!verifyAuth(request)) {
      console.error('❌ 인증 실패');
      
      // 🔔 크론 신호 업데이트 (인증 실패)
      await updateCronCallSignal(cronCallSignalId, 401, 0, (new Date().getTime() - startTime.getTime()));
      
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
      
      // 🔔 크론 신호 업데이트 (실행 API 실패)
      await updateCronCallSignal(cronCallSignalId, executeResponse.status, 0, (new Date().getTime() - startTime.getTime()));
      
      return NextResponse.json({
        success: false,
        error: `스케줄러 실행 실패: HTTP ${executeResponse.status}`,
        details: errorText,
        caller: userAgent,
        baseUrl
      }, { status: executeResponse.status });
    }
    
    const executeResult = await executeResponse.json();
    console.log('✅ 스케줄러 실행 완료:', executeResult);
    
    // 실행된 작업 수 추출
    const executedJobsCount = executeResult?.data?.executedCount || 0;
    
    // 🔔 크론 신호 업데이트 (성공)
    await updateCronCallSignal(cronCallSignalId, 200, executedJobsCount, (new Date().getTime() - startTime.getTime()));
    
    return NextResponse.json({
      success: true,
      message: 'Cron 실행 완료',
      caller: userAgent,
      result: executeResult,
      timestamp: formatKoreaTime(now),
      baseUrl, // 디버깅용
      environment: process.env.NODE_ENV
    });
    
  } catch (error) {
    console.error('❌ Cron 실행 실패:', error);
    
    // 🔔 크론 신호 업데이트 (오류)
    await updateCronCallSignal(cronCallSignalId, 500, 0, (new Date().getTime() - startTime.getTime()));
    
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