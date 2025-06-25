import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';

// 한국시간 헬퍼 함수
function getKoreaTime(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const koreaTime = new Date(utc + (9 * 3600000)); // UTC+9
  return koreaTime;
}

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
        scheduled_time: new Date(scheduledTime).toISOString(),
        status: 'pending',
        retry_count: 0,
        max_retries: 1,
        created_at: now.toISOString()
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
        scheduledTime: new Date(scheduledTime).toLocaleString('ko-KR'),
        message: '테스트 스케줄이 생성되었습니다.'
      }
    });
    
  } catch (error) {
    console.error('❌ 테스트 스케줄 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '테스트 스케줄 생성 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
} 