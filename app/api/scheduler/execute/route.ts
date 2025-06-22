import { NextRequest, NextResponse } from 'next/server';
import persistentSchedulerService from '@/lib/services/persistent-scheduler-service';

// 외부 Cron 서비스용 실시간 실행 엔드포인트 (매분마다 실행)
export async function GET(request: NextRequest) {
  try {
    // 인증 확인 (Bearer 토큰 또는 URL 파라미터)
    const authHeader = request.headers.get('authorization');
    const urlParams = new URL(request.url).searchParams;
    const apiKey = urlParams.get('key');
    
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-2024';
    
    const isValidAuth = 
      authHeader === `Bearer ${cronSecret}` || 
      apiKey === cronSecret;
    
    if (!isValidAuth) {
      console.log('🚫 실시간 스케줄러 인증 실패 - Auth Header:', authHeader, 'API Key:', apiKey);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 실시간 스케줄러 실행 중...');
    
    // 대기 중인 작업들을 확인하고 실행
    const executedCount = await persistentSchedulerService.checkAndExecutePendingJobs();
    
    // 스케줄러 상태도 함께 조회
    const status = await persistentSchedulerService.getStatus();
    
    console.log('✅ 실시간 스케줄러 실행 완료:', { executedCount, status });

    return NextResponse.json({
      success: true,
      message: 'Scheduler executed successfully',
      timestamp: new Date().toISOString(),
      executedJobs: executedCount,
      schedulerStatus: status
    });

  } catch (error) {
    console.error('❌ 실시간 스케줄러 실행 실패:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST 방식도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  return GET(request);
} 