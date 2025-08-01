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
  { params }: { params: Promise<WebhookParams> }
) {
  try {
    const { eventType } = await params;
    const eventData: WebhookEventData = await request.json();

    console.log(`🔔 웹훅 이벤트 수신: ${eventType}`, eventData);

    // 이벤트 타입 매핑 (하이픈 → 언더스코어)
    const eventTypeMapping: Record<string, string> = {
      'lead-created': 'lead_created',
      'lead_created': 'lead_created',
      'signup': 'signup',
      'purchase': 'purchase',
      'cancel': 'cancel',
      'payment-failed': 'payment_failed',
      'payment_failed': 'payment_failed'
    };

    const normalizedEventType = eventTypeMapping[eventType];
    if (!normalizedEventType) {
      return NextResponse.json({
        success: false,
        message: `지원되지 않는 이벤트 타입: ${eventType}`
      }, { status: 400 });
    }

    console.log(`🔄 이벤트 타입 변환: ${eventType} → ${normalizedEventType}`);

    // 기본 데이터 검증
    if (!eventData || typeof eventData !== 'object') {
      return NextResponse.json({
        success: false,
        message: '잘못된 이벤트 데이터 형식'
      }, { status: 400 });
    }

    // 웹훅 타입 워크플로우 조회
    const triggeredWorkflows = await triggerWebhookWorkflows(normalizedEventType, eventData);

    console.log(`✅ ${normalizedEventType} 이벤트 처리 완료: ${triggeredWorkflows.length}개 워크플로우 트리거됨`);

    // 워크플로우 개수에 따른 메시지 생성
    const immediateCount = triggeredWorkflows.filter(w => w.executionType === 'immediate').length;
    const delayedCount = triggeredWorkflows.filter(w => w.executionType === 'delayed').length;
    
    let message;
    if (triggeredWorkflows.length === 0) {
      message = `${normalizedEventType} 이벤트를 받았지만, 활성 워크플로우가 없어 알림톡을 발송하지 않았습니다.`;
    } else {
      const parts = [];
      if (immediateCount > 0) {
        parts.push(`${immediateCount}개 즉시실행`);
      }
      if (delayedCount > 0) {
        parts.push(`${delayedCount}개 지연실행`);
      }
      message = `${normalizedEventType} 이벤트 처리 완료: ${parts.join(', ')} 워크플로우가 처리되었습니다.`;
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

      console.log(`✅ 조건 만족: ${workflow.name} - 워크플로우 실행 처리`);

      // 스케줄 설정에 따른 실행 방식 결정
      const scheduleConfig = workflow.schedule_config || {};
      
      if (scheduleConfig.type === 'immediate') {
        // 즉시실행: 바로 워크플로우 실행
        const executionResult = await executeWorkflowImmediately(workflow, eventData, eventType);
        triggeredWorkflows.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          executionType: 'immediate',
          executionResult: executionResult,
          conditions: conditions,
          conditionsPassed: true
        });
      } else if (scheduleConfig.type === 'delay') {
        // 지연실행: scheduled_jobs에 추가
        const scheduledJob = await scheduleDelayedExecution(workflow, eventData, eventType);
        triggeredWorkflows.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          executionType: 'delayed',
          scheduledJobId: scheduledJob.id,
          conditions: conditions,
          conditionsPassed: true
        });
      } else {
        console.log(`⚠️ 지원되지 않는 스케줄 타입: ${scheduleConfig.type} - ${workflow.name}`);
      }

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
 * 워크플로우를 즉시 실행합니다.
 */
async function executeWorkflowImmediately(
  workflow: any, 
  eventData: WebhookEventData, 
  eventType: string
) {
  const supabase = getSupabase();
  const startTime = Date.now();
  
  console.log(`🚀 즉시실행 시작: ${workflow.name}`);
  
  try {
    // 워크플로우 실행 API 호출
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/workflow/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scheduler-internal': 'true',
      },
      body: JSON.stringify({
        workflowId: workflow.id,
        webhook_data: eventData,
        webhook_event: eventType,
        schedule_config: workflow.schedule_config,
        target_config: workflow.target_config,
        message_config: workflow.message_config,
        variables: workflow.variables,
        enableRealSending: workflow.variables?.testSettings?.enableRealSending || false,
        webhookExecution: true  // 웹훅 실행임을 명시
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`워크플로우 실행 실패: ${errorText}`);
    }

    const executionResult = await response.json();
    const responseTime = Date.now() - startTime;

    console.log(`✅ 즉시실행 완료: ${workflow.name} (${responseTime}ms)`);
    return executionResult;

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ 즉시실행 실패: ${workflow.name}`, error);
    throw error;
  }
}

/**
 * 워크플로우 실행을 지연 스케줄링합니다.
 */
async function scheduleDelayedExecution(
  workflow: any, 
  eventData: WebhookEventData, 
  eventType: string
) {
  const supabase = getSupabase();
  const scheduleConfig = workflow.schedule_config || {};
  
  // 지연 시간 계산 (안전한 접근)
  const delayMinutes = scheduleConfig?.delay || 0;
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

  console.log(`📅 지연실행 스케줄링 완료: ${workflow.name} (${delayMinutes}분 후 실행)`);
  return scheduledJob;
} 