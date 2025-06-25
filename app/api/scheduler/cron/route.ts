import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';

// 한국시간 헬퍼 함수
function getKoreaTime(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const koreaTime = new Date(utc + (9 * 3600000)); // UTC+9
  return koreaTime;
}

// 다음 실행 시간 계산 함수
function calculateNextRecurringTime(recurringPattern: any): Date {
  const now = getKoreaTime();
  const { frequency, time } = recurringPattern;
  
  if (!time) {
    return new Date(now.getTime() + 60 * 60 * 1000); // 1시간 후
  }
  
  const [hours, minutes] = time.split(':').map(Number);
  const nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);
  
  // 현재 시간과 설정된 시간의 차이 계산
  const timeDiff = nextRun.getTime() - now.getTime();
  
  // 🔥 설정된 시간이 이미 지났으면 다음 실행일로 설정
  if (timeDiff <= 0) {
    // 오늘 시간이 지났으면 다음 실행일로
    switch (frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      default:
        nextRun.setDate(nextRun.getDate() + 1);
    }
  }
  
  // 🔥 설정된 시간이 아직 오지 않았다면 오늘 그 시간에 실행
  return nextRun;
}

// 🔥 Vercel Cron - 스케줄러 실행 (10초마다)
export async function GET(request: NextRequest) {
  try {
    console.log(`🕐 Vercel Cron 실행: ${getKoreaTime().toLocaleString('ko-KR')}`);
    
    // 🔥 내부 스케줄러 실행 API 직접 호출 (Protection Bypass 필요 없음)
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : `https://${process.env.VERCEL_URL || request.headers.get('host')}`;
    
    const executeUrl = `${baseUrl}/api/scheduler/execute`;
    
    // 🔥 내부 호출이므로 Protection Bypass 헤더 불필요
    const response = await fetch(executeUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-vercel-internal': 'true', // 내부 호출 표시
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 스케줄러 실행 실패:', response.status, errorText);
      return NextResponse.json({
        success: false,
        message: `스케줄러 실행 실패: HTTP ${response.status}`,
        error: errorText
      }, { status: response.status });
    }
    
    const result = await response.json();
    console.log('✅ 스케줄러 실행 완료:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Vercel Cron 실행 완료',
      schedulerResult: result,
      timestamp: getKoreaTime().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Vercel Cron 실행 실패:', error);
    return NextResponse.json({
      success: false,
      message: 'Vercel Cron 실행 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}

// POST 방식도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  return GET(request);
} 