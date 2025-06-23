import { NextRequest, NextResponse } from 'next/server';
import persistentSchedulerService from '@/lib/services/persistent-scheduler-service';

// 즉시 실행 엔드포인트 (매분 실행)
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
      console.log('🚫 Execute Job 인증 실패 - Auth Header:', authHeader, 'API Key:', apiKey);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('⚡ Execute Job 실행 중...');
    
    // 현재 실행해야 할 모든 대기 중인 작업들을 즉시 실행
    const executedCount = await persistentSchedulerService.checkAndExecutePendingJobs();
    
    console.log(`✅ ${executedCount}개의 작업 즉시 실행 완료`);

    return NextResponse.json({
      success: true,
      message: 'Pending jobs executed successfully',
      timestamp: new Date().toISOString(),
      executedJobs: executedCount
    });

  } catch (error) {
    console.error('❌ Execute Job 실행 실패:', error);
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