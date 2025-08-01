import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { formatKoreaTime } from '@/lib/utils/timezone';

// 크론 신호 조회 API
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const source = searchParams.get('source'); // 'aws-lambda', 'manual', 'development' 등
    
    console.log(`📊 크론 신호 조회 요청: limit=${limit}, source=${source || 'all'}`);
    
    // 기본 쿼리
    let query = supabase
      .from('cron_signals')
      .select('*');
    
    // 출처 필터링
    if (source) {
      query = query.eq('source', source);
    }
    
    // 최신순 정렬 및 제한
    query = query
      .order('signal_time', { ascending: false })
      .limit(limit);
    
    const { data: signals, error } = await query;
    
    if (error) {
      console.error('❌ 크론 신호 조회 실패:', error);
      return NextResponse.json({
        success: false,
        message: '크론 신호 조회 실패: ' + error.message
      }, { status: 500 });
    }
    
    // 통계 계산
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentSignals = signals?.filter(s => new Date(s.signal_time) >= fiveMinutesAgo) || [];
    const hourlySignals = signals?.filter(s => new Date(s.signal_time) >= oneHourAgo) || [];
    
    const awsLambdaSignals = signals?.filter(s => s.source === 'aws-lambda') || [];
    const lastAwsLambdaSignal = awsLambdaSignals[0]; // 가장 최근 AWS Lambda 신호
    
    // 마지막 신호 이후 경과 시간 계산
    let minutesSinceLastSignal = null;
    let isHealthy = true;
    
    if (lastAwsLambdaSignal) {
      const lastSignalTime = new Date(lastAwsLambdaSignal.signal_time);
      minutesSinceLastSignal = Math.floor((now.getTime() - lastSignalTime.getTime()) / (1000 * 60));
      isHealthy = minutesSinceLastSignal <= 10; // 10분 이내면 정상
    }
    
    const statistics = {
      totalSignals: signals?.length || 0,
      recentSignals: recentSignals.length, // 최근 5분
      hourlySignals: hourlySignals.length, // 최근 1시간
      awsLambdaSignals: awsLambdaSignals.length,
      lastAwsLambdaSignal: lastAwsLambdaSignal ? {
        time: formatKoreaTime(new Date(lastAwsLambdaSignal.signal_time)),
        minutesAgo: minutesSinceLastSignal,
        executedJobs: lastAwsLambdaSignal.executed_jobs_count,
        duration: lastAwsLambdaSignal.execution_duration_ms,
        responseStatus: lastAwsLambdaSignal.response_status
      } : null,
      isHealthy,
      healthStatus: isHealthy ? 'normal' : 'warning'
    };
    
    console.log(`✅ 크론 신호 조회 완료: ${signals?.length || 0}개 조회`);
    console.log(`📊 건강성: ${isHealthy ? '정상' : '경고'} (마지막 신호: ${minutesSinceLastSignal}분 전)`);
    
    return NextResponse.json({
      success: true,
      data: {
        signals: signals || [],
        statistics,
        query: {
          limit,
          source: source || 'all',
          timestamp: formatKoreaTime(now)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ 크론 신호 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '크론 신호 API 오류: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}

// POST 방식은 지원하지 않음
export async function POST() {
  return NextResponse.json({
    success: false,
    message: 'POST 방식은 지원하지 않습니다.'
  }, { status: 405 });
} 