import { NextRequest, NextResponse } from 'next/server';
import persistentSchedulerService from '@/lib/services/persistent-scheduler-service';

// Vercel Cron Job용 엔드포인트
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron Job 인증 확인
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('🚫 Cron Job 인증 실패');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('⏰ Vercel Cron Job 실행 중...');
    
    // 영구 스케줄러가 실행 중인지 확인
    const status = await persistentSchedulerService.getStatus();
    
    if (!status.isRunning) {
      // 스케줄러가 중지되어 있으면 시작
      console.log('🚀 영구 스케줄러 재시작 중...');
      persistentSchedulerService.startScheduler();
    }

    return NextResponse.json({
      success: true,
      message: 'Cron job executed successfully',
      timestamp: new Date().toISOString(),
      schedulerStatus: status
    });

  } catch (error) {
    console.error('❌ Cron Job 실행 실패:', error);
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