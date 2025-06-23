import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import persistentSchedulerService from '@/lib/services/persistent-scheduler-service';

// 테스트용 스케줄 설정 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, time } = body;
    
    if (!workflowId || !time) {
      return NextResponse.json({
        success: false,
        message: 'workflowId와 time이 필요합니다.'
      }, { status: 400 });
    }

    const client = getSupabase();
    
    // 스케줄 설정 업데이트
    const scheduleSettings = {
      type: 'recurring',
      timezone: 'Asia/Seoul',
      recurringPattern: {
        time: time,
        interval: 1,
        frequency: 'daily'
      }
    };

    console.log(`📅 워크플로우 ${workflowId} 스케줄을 ${time}으로 설정 중...`);

    // 1. 워크플로우 업데이트
    const { data: workflow, error: updateError } = await client
      .from('workflows')
      .update({ 
        schedule_settings: scheduleSettings,
        status: 'active'
      })
      .eq('id', workflowId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ 워크플로우 업데이트 실패:', updateError);
      return NextResponse.json({
        success: false,
        message: '워크플로우 업데이트 실패: ' + updateError.message
      }, { status: 500 });
    }

    console.log('✅ 워크플로우 업데이트 완료:', workflow);

    // 2. 기존 예약된 작업들 취소
    await persistentSchedulerService.cancelWorkflowJobs(workflowId);

    // 3. 새로운 스케줄로 작업 예약
    const newWorkflow = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description || '',
      status: 'active' as const,
      trigger: workflow.trigger || { type: 'schedule' },
      steps: workflow.steps || [],
      scheduleSettings: scheduleSettings,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at
    };

    const jobId = await persistentSchedulerService.scheduleWorkflow(newWorkflow as any);

    console.log(`✅ 새로운 스케줄 작업 예약 완료: ${jobId}`);

    return NextResponse.json({
      success: true,
      message: `워크플로우가 ${time}으로 스케줄되었습니다.`,
      data: {
        workflowId,
        scheduledTime: time,
        jobId
      }
    });

  } catch (error) {
    console.error('❌ 테스트 스케줄 설정 실패:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 