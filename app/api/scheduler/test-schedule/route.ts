import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { getKoreaTime, koreaTimeToUTC, formatKoreaTime } from '@/lib/utils';
import { 
  getKoreaMoment, 
  calculateNextKoreaScheduleTime, 
  debugTimeInfo 
} from '@/lib/utils/timezone';

// 다음 실행 시간 계산 함수
function calculateNextRecurringTime(recurringPattern: any): Date {
  const { frequency, time, daysOfWeek } = recurringPattern;
  
  console.log(`🕐 현재 한국 시간: ${formatKoreaTime(getKoreaTime())}`);
  
  if (!time) {
    const oneHourLater = getKoreaMoment().add(1, 'hour').toDate();
    return oneHourLater;
  }
  
  console.log(`⏰ 설정된 시간: ${time}`);
  
  // 주간 반복이고 요일이 지정된 경우 로그
  if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
    console.log(`📅 지정된 요일: ${daysOfWeek.map((d: number) => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')}`);
  }
  
  // 전문적인 한국 시간 스케줄 계산 (daysOfWeek 파라미터 추가)
  const nextRun = calculateNextKoreaScheduleTime(time, frequency, daysOfWeek);
  
  console.log(`📅 계산된 다음 실행 시간: ${formatKoreaTime(nextRun)}`);
  debugTimeInfo('스케줄 계산 결과', nextRun);
  
  return nextRun;
}

// 테스트용 스케줄 생성 API
export async function POST(request: NextRequest) {
  try {
    const { workflow } = await request.json();
    
    if (!workflow) {
      return NextResponse.json({
        success: false,
        message: '워크플로우 정보가 필요합니다'
      }, { status: 400 });
    }
    
    const scheduleSettings = workflow.scheduleSettings;
    const now = getKoreaTime();
    let scheduledTime: Date | null = null;
    
    console.log(`🧪 테스트 스케줄 실행: ${formatKoreaTime(now)}`);
    console.log('📋 받은 스케줄 설정:', scheduleSettings);
    
    // 스케줄 설정에 따른 실행 시간 계산
    switch (scheduleSettings?.type) {
      case 'immediate':
        scheduledTime = now;
        break;
        
      case 'delay':
        const delayMinutes = scheduleSettings.delay || 5;
        scheduledTime = new Date(now.getTime() + (delayMinutes * 60 * 1000));
        break;
        
      case 'scheduled':
        if (scheduleSettings.scheduledTime) {
          scheduledTime = new Date(scheduleSettings.scheduledTime);
        }
        break;
        
      case 'recurring':
        // 반복 스케줄의 경우 다음 실행 시간 계산
        if (scheduleSettings.recurringPattern) {
          try {
            scheduledTime = calculateNextRecurringTime(scheduleSettings.recurringPattern);
          } catch (error) {
            console.error('❌ 반복 스케줄 시간 계산 실패:', error);
            scheduledTime = new Date(now.getTime() + (60 * 60 * 1000)); // 1시간 후 기본값
          }
        }
        break;
        
      default:
        scheduledTime = now;
    }
    
    if (!scheduledTime) {
      return NextResponse.json({
        success: false,
        message: '실행 시간을 계산할 수 없습니다'
      }, { status: 400 });
    }
    
    console.log(`📅 계산된 실행 시간: ${formatKoreaTime(scheduledTime)}`);
    
    const client = getSupabase();
    
    // 🔥 한국시간대 문자열을 직접 처리하여 시간대 변환 문제 해결
    let kstTimeString: string;
    
    // scheduledTime을 문자열로 변환하여 타입 안전성 확보
    const scheduledTimeStr = String(scheduledTime);
    
    if (scheduledTimeStr.includes('+09:00')) {
      // UI에서 한국시간대 포함 문자열을 받은 경우 (예: "2025-06-30T17:30+09:00")
      // PostgreSQL TIMESTAMPTZ 형태로 변환 (예: "2025-06-30 17:30:00+09:00")
      kstTimeString = scheduledTimeStr.replace('T', ' ');
      
      // 초 부분이 없으면 추가
      if (kstTimeString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}\+09:00$/)) {
        kstTimeString = kstTimeString.replace('+09:00', ':00+09:00');
      }
      
      console.log('✅ 한국시간대 포함 문자열 직접 변환:', {
        원본: scheduledTime,
        변환후: kstTimeString
      });
    } else {
      // Date 객체이거나 시간대 정보가 없는 경우 (반복 스케줄 등)
      const dateObj = scheduledTime instanceof Date ? scheduledTime : new Date(scheduledTime);
      
      // 🔥 calculateNextKoreaScheduleTime 함수가 반환한 Date 객체는 이미 한국시간 값이므로
      // 추가로 9시간을 더할 필요가 없음. 그대로 포맷팅만 수행
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');
      kstTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+09:00`;
      
      console.log('✅ 한국시간 Date 객체 직접 포맷팅:', {
        원본Date: dateObj.toISOString(),
        한국시간문자열: kstTimeString
      });
    }
    
    const currentTime = new Date().toISOString();
    
    // 테스트 작업을 스케줄러에 등록
    const { data: scheduledJob, error: insertError } = await client
      .from('scheduled_jobs')
      .insert({
        workflow_id: workflow.id,
        workflow_data: workflow,
        scheduled_time: kstTimeString, // 🔥 한국시간대를 명시한 문자열
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        created_at: currentTime // 🔥 현재 시간
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ 테스트 스케줄 생성 실패:', insertError);
      return NextResponse.json({
        success: false,
        message: '테스트 스케줄 생성 실패: ' + insertError.message
      }, { status: 500 });
    }
    
    console.log('✅ 테스트 스케줄 생성 완료:', scheduledJob);
    
    return NextResponse.json({
      success: true,
      data: {
        jobId: scheduledJob.id,
        workflowName: workflow.name,
        scheduledTime: formatKoreaTime(scheduledTime),
        message: '테스트 스케줄이 생성되었습니다.'
      }
    });
    
  } catch (error) {
    console.error('❌ 테스트 스케줄 생성 오류:', error);
    return NextResponse.json({
      success: false,
      message: '테스트 스케줄 생성 오류: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
} 