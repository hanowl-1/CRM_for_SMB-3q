import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { evaluateConditions } from '@/lib/utils/condition-evaluator';

interface WebhookEventData {
  [key: string]: any;
}

interface WebhookParams {
  eventType: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: WebhookParams }
) {
  try {
    const { eventType } = params;
    const eventData: WebhookEventData = await request.json();

    console.log(`🔔 웹훅 이벤트 수신: ${eventType}`, eventData);

    // 이벤트 타입 검증
    const supportedEvents = ['lead_created', 'signup', 'purchase', 'cancel', 'payment_failed'];
    if (!supportedEvents.includes(eventType)) {
      return NextResponse.json({
        success: false,
        message: `지원되지 않는 이벤트 타입: ${eventType}`
      }, { status: 400 });
    }

    // 기본 데이터 검증
    if (!eventData || typeof eventData !== 'object') {
      return NextResponse.json({
        success: false,
        message: '잘못된 이벤트 데이터 형식'
      }, { status: 400 });
    }

    // 웹훅 타입 워크플로우 조회
    const triggeredWorkflows = await triggerWebhookWorkflows(eventType, eventData);

    console.log(`✅ ${eventType} 이벤트 처리 완료: ${triggeredWorkflows.length}개 워크플로우 트리거됨`);

    // 워크플로우 개수에 따른 메시지 생성
    let message;
    if (triggeredWorkflows.length === 0) {
      message = `${eventType} 이벤트를 받았지만, 활성 워크플로우가 없어 알림톡을 발송하지 않았습니다.`;
    } else if (triggeredWorkflows.length === 1) {
      message = `${eventType} 이벤트 처리 완료: 1개 워크플로우가 실행되어 알림톡이 발송됩니다.`;
    } else {
      message = `${eventType} 이벤트 처리 완료: ${triggeredWorkflows.length}개 워크플로우가 실행되어 알림톡이 발송됩니다.`;
    }

    return NextResponse.json({
      success: true,
      message,
      triggered_workflows: triggeredWorkflows,
      event_data: eventData
    });

  } catch (error) {
    console.error('❌ 웹훅 처리 중 오류:', error);
    return NextResponse.json({
      success: false,
      message: '웹훅 처리 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

/**
 * 웹훅 이벤트에 해당하는 워크플로우들을 트리거합니다.
 */
async function triggerWebhookWorkflows(eventType: string, eventData: WebhookEventData) {
  const supabase = getSupabase();
  const triggeredWorkflows = [];

  // webhook 타입이면서 활성 상태인 워크플로우 조회
  const { data: workflows, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('status', 'active')
    .eq('trigger_type', 'webhook');

  if (error) {
    console.error('❌ 워크플로우 조회 실패:', error);
    throw new Error(`워크플로우 조회 실패: ${error.message}`);
  }

  if (!workflows || workflows.length === 0) {
    console.log('📋 활성 웹훅 워크플로우가 없습니다.');
    return triggeredWorkflows;
  }

  console.log(`🔍 활성 웹훅 워크플로우 ${workflows.length}개 발견`);

  for (const workflow of workflows) {
    try {
      const triggerConfig = workflow.trigger_config || {};
      
      // 이벤트 타입 매칭 확인
      const configEventType = triggerConfig.eventType || triggerConfig.type;
      if (configEventType && configEventType !== eventType) {
        console.log(`⏭️ 이벤트 타입 불일치: ${workflow.name} (설정: ${configEventType}, 요청: ${eventType})`);
        continue;
      }

      // 조건 평가
      const conditions = triggerConfig.conditions || [];
      const conditionLogic = triggerConfig.conditionLogic || 'AND';
      
      const conditionsPassed = evaluateConditions(eventData, conditions, conditionLogic);
      
      if (!conditionsPassed) {
        console.log(`❌ 조건 불만족: ${workflow.name}`);
        continue;
      }

      console.log(`✅ 조건 만족: ${workflow.name} - 워크플로우 실행 예약`);

      // 워크플로우 실행 스케줄링
      const scheduledJob = await scheduleWorkflowExecution(workflow, eventData, eventType);
      
      triggeredWorkflows.push({
        workflowId: workflow.id,
        workflowName: workflow.name,
        scheduledJobId: scheduledJob.id,
        conditions: conditions,
        conditionsPassed: true
      });

    } catch (workflowError) {
      console.error(`❌ 워크플로우 처리 실패: ${workflow.name}`, workflowError);
      
      triggeredWorkflows.push({
        workflowId: workflow.id,
        workflowName: workflow.name,
        error: workflowError instanceof Error ? workflowError.message : '알 수 없는 오류',
        conditionsPassed: false
      });
    }
  }

  return triggeredWorkflows;
}

/**
 * 워크플로우 실행을 스케줄링합니다.
 */
async function scheduleWorkflowExecution(
  workflow: any, 
  eventData: WebhookEventData, 
  eventType: string
) {
  const supabase = getSupabase();
  const scheduleConfig = workflow.schedule_config || {};
  
  // 지연 시간 계산 (schedule_config에서 가져옴)
  const delayMinutes = scheduleConfig.delay || 0;
  const scheduledTime = new Date();
  scheduledTime.setMinutes(scheduledTime.getMinutes() + delayMinutes);

  // scheduled_jobs 테이블에 작업 등록
  const { data: scheduledJob, error } = await supabase
    .from('scheduled_jobs')
    .insert({
      workflow_id: workflow.id,
      scheduled_time: scheduledTime.toISOString(),
      status: 'pending',
      workflow_data: {
        ...workflow,
        webhook_trigger: {
          trigger_type: 'webhook',
          webhook_event: eventType,
          event_data: eventData,
          delay_minutes: delayMinutes,
          source: 'webhook_api'
        }
      }
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 워크플로우 스케줄링 실패:', error);
    throw new Error(`워크플로우 스케줄링 실패: ${error.message}`);
  }

  console.log(`📅 워크플로우 스케줄링 완료: ${workflow.name} (${delayMinutes}분 후 실행)`);
  return scheduledJob;
} 