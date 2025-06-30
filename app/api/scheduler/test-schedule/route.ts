import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { getKoreaTime, koreaTimeToUTC, formatKoreaTime } from '@/lib/utils';

// 테스트용 스케줄 생성 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowName, scheduledTime } = body;
    
    if (!workflowName || !scheduledTime) {
      return NextResponse.json({
        success: false,
        message: 'workflowName과 scheduledTime이 필요합니다.'
      }, { status: 400 });
    }
    
    const client = getSupabase();
    const now = getKoreaTime();
    
    // 입력받은 시간을 한국 시간으로 파싱
    const scheduledKoreaTime = new Date(scheduledTime);
    
    // 🔥 간단하게: 입력받은 시간을 그대로 한국시간대로 처리
    const year = scheduledKoreaTime.getFullYear();
    const month = String(scheduledKoreaTime.getMonth() + 1).padStart(2, '0');
    const day = String(scheduledKoreaTime.getDate()).padStart(2, '0');
    const hours = String(scheduledKoreaTime.getHours()).padStart(2, '0');
    const minutes = String(scheduledKoreaTime.getMinutes()).padStart(2, '0');
    const seconds = String(scheduledKoreaTime.getSeconds()).padStart(2, '0');
    
    // 한국시간대로 명시적으로 저장
    const kstTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+09:00`;
    const currentTime = new Date().toISOString();
    
    // 테스트 작업을 scheduled_jobs 테이블에 직접 추가
    const { data: newJob, error } = await client
      .from('scheduled_jobs')
      .insert({
        workflow_id: `test-${Date.now()}`,
        workflow_data: {
          id: `test-${Date.now()}`,
          name: workflowName,
          description: '테스트용 워크플로우',
          message_config: {
            steps: [
              {
                type: 'alimtalk',
                templateCode: 'test_template',
                message: '테스트 메시지입니다.'
              }
            ]
          }
        },
        scheduled_time: kstTimeString, // 🔥 한국시간대를 명시한 문자열
        status: 'pending',
        retry_count: 0,
        max_retries: 1,
        created_at: currentTime // 🔥 현재 시간
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ 테스트 스케줄 생성 실패:', error);
      return NextResponse.json({
        success: false,
        message: '테스트 스케줄 생성 실패: ' + error.message
      }, { status: 500 });
    }
    
    console.log('✅ 테스트 스케줄 생성 완료:', newJob);
    
    return NextResponse.json({
      success: true,
      data: {
        jobId: newJob.id,
        workflowName,
        scheduledTime: formatKoreaTime(scheduledKoreaTime),
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