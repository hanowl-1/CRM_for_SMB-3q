import { NextRequest, NextResponse } from 'next/server';
import persistentSchedulerService from '@/lib/services/persistent-scheduler-service';

// Vercel Cron Job용 엔드포인트 (하루에 한 번 실행)
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron Job 인증 확인
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('🚫 Cron Job 인증 실패');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('⏰ Vercel Daily Cron Job 실행 중... (자정)');
    
    // 오늘 하루 동안 실행해야 할 모든 반복 작업들을 미리 계산하여 scheduled_jobs에 저장
    const result = await persistentSchedulerService.scheduleTodaysJobs();
    
    console.log(`📅 오늘(${new Date().toLocaleDateString('ko-KR')}) 스케줄 생성 완료:`, result);

    return NextResponse.json({
      success: true,
      message: 'Daily schedule created successfully',
      timestamp: new Date().toISOString(),
      scheduledJobs: result.scheduledCount,
      nextScheduledJobs: result.nextJobs || []
    });

  } catch (error) {
    console.error('❌ Daily Cron Job 실행 실패:', error);
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