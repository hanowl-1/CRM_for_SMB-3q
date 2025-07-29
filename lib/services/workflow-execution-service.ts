/**
 * 🚀 워크플로우 실행 서비스
 * 
 * 워크플로우 실행의 핵심 로직을 담당합니다.
 * - 대상 그룹 처리
 * - 메시지 스텝 실행
 * - 실행 결과 집계
 * - 로그 기록
 */

import { Workflow } from '@/lib/types/workflow';
import { getSupabase } from '@/lib/database/supabase-client';
import { personalizeMessage, PersonalizationResult } from './personalization-service';
import { getKoreaTime, formatKoreaTime } from '@/lib/utils/timezone';
import crypto from 'crypto';

export interface ExecutionContext {
  workflow: Workflow;
  runId: string;
  enableRealSending: boolean;
  scheduledExecution?: boolean;
  jobId?: string;
  webhookData?: Record<string, any>;
}

export interface StepExecutionResult {
  step: number;
  stepName: string;
  targetGroup: string;
  status: 'success' | 'failed' | 'partial';
  successCount: number;
  failedCount: number;
  totalTargets: number;
  error?: string;
  details?: any[];
}

export interface WorkflowExecutionResult {
  success: boolean;
  message: string;
  runId: string;
  results: StepExecutionResult[];
  summary: {
    totalSteps: number;
    totalTargetGroups: number;
    successCount: number;
    failedCount: number;
    executionTimeMs: number;
  };
  scheduledExecution?: boolean;
  jobId?: string;
}

/**
 * 웹훅 이벤트에서 대상자를 생성합니다.
 */
export function createWebhookTarget(webhookData: Record<string, any>) {
  return {
    name: webhookData.name || '알 수 없음',
    phone: webhookData.phone || '',
    email: webhookData.email || '',
    company: webhookData.company || '',
    source: webhookData.source || '웹훅',
    message: webhookData.message || '',
    webhook_data: webhookData
  };
}

/**
 * 대상 그룹을 처리하여 실행 가능한 타겟 리스트를 생성합니다.
 */
export async function processTargetGroups(
  workflow: Workflow & { target_config?: any },
  webhookData?: Record<string, any>
): Promise<{ targetGroups: any[], isWebhookExecution: boolean }> {
  console.log('📋 대상 그룹 처리 시작...');
  
  let targetGroups = [];
  const isWebhookExecution = !!(webhookData && Object.keys(webhookData).length > 0);
  
  if (isWebhookExecution) {
    // 웹훅 실행: 웹훅 데이터로 가상 대상 그룹 생성
    console.log('🔔 웹훅 실행 감지 - 가상 대상 그룹 생성');
    const webhookTarget = createWebhookTarget(webhookData);
    
    targetGroups = [{
      id: 'webhook_target_group',
      name: '웹훅 이벤트 대상',
      query: '',
      targets: [webhookTarget],
      targetCount: 1
    }];
    
    console.log(`✅ 웹훅 대상 그룹 생성: ${webhookTarget.name} (${webhookTarget.phone})`);
  } else {
    // 일반 실행: 기존 대상 그룹 사용
    const existingTargetGroups = workflow.targetGroups || workflow.target_config?.targetGroups || [];
    
    if (existingTargetGroups.length === 0) {
      throw new Error('대상 그룹이 설정되지 않았습니다. target_config.targetGroups를 확인해주세요.');
    }
    
    targetGroups = existingTargetGroups;
    console.log(`📋 기존 대상 그룹 ${targetGroups.length}개 사용`);
  }
  
  return { targetGroups, isWebhookExecution };
}

/**
 * 메시지 스텝을 처리하여 실행 가능한 스텝 리스트를 생성합니다.
 */
export function processMessageSteps(
  workflow: Workflow & { message_config?: any }
): any[] {
  console.log('📋 메시지 스텝 처리 시작...');
  
  // message_config 우선, 없으면 기존 steps 사용
  const messageSteps = workflow.message_config?.steps || workflow.steps || [];
  
  if (messageSteps.length === 0) {
    throw new Error('메시지 스텝이 설정되지 않았습니다. message_config.steps를 확인해주세요.');
  }
  
  console.log(`📋 메시지 스텝 ${messageSteps.length}개 추출 완료`);
  return messageSteps;
}

/**
 * 단일 스텝을 실행합니다.
 */
export async function executeStep(
  step: any,
  targetGroup: any,
  workflow: Workflow,
  context: ExecutionContext
): Promise<StepExecutionResult> {
  const stepNumber = step.stepNumber || 1;
  const stepName = step.name || step.action?.templateName || `스텝 ${stepNumber}`;
  
  console.log(`\n🚀 스텝 ${stepNumber} 실행 시작: ${stepName}`);
  console.log(`📋 대상 그룹: ${targetGroup.name} (${targetGroup.targets?.length || 0}명)`);
  
  const targets = targetGroup.targets || [];
  let successCount = 0;
  let failedCount = 0;
  const details: any[] = [];
  
  try {
    // 각 대상자에 대해 메시지 개인화 및 발송
    for (const target of targets) {
      try {
        console.log(`📤 ${target.name || '알 수 없음'} (${target.phone}) 처리 중...`);
        
        // 개인화 처리
        const personalizationResult = await personalizeMessage(
          step.action.templateContent || '기본 메시지',
          {
            target,
            webhookData: context.webhookData,
            templateId: step.action.templateId,
            workflowId: workflow.id
          }
        );
        
        if (!personalizationResult.success) {
          console.warn(`⚠️ 개인화 실패: ${personalizationResult.errors?.join(', ')}`);
        }
        
        // 메시지 발송 (여기서는 로그만 기록, 실제 발송은 별도 서비스에서)
        const sendResult = await simulateMessageSending({
          to: target.phone,
          message: personalizationResult.personalizedMessage,
          templateId: step.action.templateId,
          enableRealSending: context.enableRealSending
        });
        
        if (sendResult.success) {
          successCount++;
          console.log(`✅ 발송 성공: ${target.name}`);
        } else {
          failedCount++;
          console.error(`❌ 발송 실패: ${target.name} - ${sendResult.error}`);
        }
        
        details.push({
          target: target.name,
          phone: target.phone,
          status: sendResult.success ? 'success' : 'failed',
          message: personalizationResult.personalizedMessage,
          error: sendResult.error,
          variables: personalizationResult.variables
        });
        
      } catch (targetError) {
        failedCount++;
        const errorMsg = targetError instanceof Error ? targetError.message : String(targetError);
        console.error(`❌ 대상자 처리 실패: ${target.name} - ${errorMsg}`);
        
        details.push({
          target: target.name,
          phone: target.phone,
          status: 'failed',
          error: errorMsg
        });
      }
    }
    
    const totalTargets = targets.length;
    const status = failedCount === 0 ? 'success' : 
                  successCount === 0 ? 'failed' : 'partial';
    
    console.log(`✅ 스텝 ${stepNumber} 완료: ${successCount}/${totalTargets} 성공`);
    
    return {
      step: stepNumber,
      stepName,
      targetGroup: targetGroup.name,
      status,
      successCount,
      failedCount,
      totalTargets,
      details
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ 스텝 ${stepNumber} 실행 실패:`, error);
    
    return {
      step: stepNumber,
      stepName,
      targetGroup: targetGroup.name,
      status: 'failed',
      successCount: 0,
      failedCount: targets.length,
      totalTargets: targets.length,
      error: errorMsg,
      details
    };
  }
}

/**
 * 메시지 발송을 시뮬레이션합니다. (실제 발송 로직은 별도 서비스에서)
 */
async function simulateMessageSending(params: {
  to: string;
  message: string;
  templateId: string;
  enableRealSending: boolean;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  // 전화번호 검증
  if (!params.to || !/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(params.to.replace(/-/g, ''))) {
    return { success: false, error: '올바르지 않은 전화번호' };
  }
  
  // 메시지 길이 검증
  if (!params.message || params.message.length === 0) {
    return { success: false, error: '메시지 내용이 없습니다' };
  }
  
  if (params.enableRealSending) {
    // 실제 발송 로직은 별도 메시지 서비스에서 처리
    console.log(`📱 실제 메시지 발송 예정: ${params.to}`);
    return { success: true, messageId: `msg_${Date.now()}` };
  } else {
    // 테스트 모드
    console.log(`🧪 테스트 모드 - 발송 시뮬레이션: ${params.to}`);
    return { success: true, messageId: `test_${Date.now()}` };
  }
}

/**
 * 워크플로우를 실행합니다.
 */
export async function executeWorkflow(context: ExecutionContext): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();
  const runId = context.runId;
  
  console.log(`\n🚀 === 워크플로우 실행 시작 (${runId}) ===`);
  console.log(`📋 워크플로우: ${context.workflow.name}`);
  console.log(`🔧 실제 발송: ${context.enableRealSending ? '활성화' : '비활성화'}`);
  console.log(`📅 실행 시간: ${formatKoreaTime(getKoreaTime())}`);
  
  try {
    // 1. 대상 그룹 처리
    const { targetGroups, isWebhookExecution } = await processTargetGroups(
      context.workflow as Workflow & { target_config?: any },
      context.webhookData
    );
    
    // 2. 메시지 스텝 처리  
    const messageSteps = processMessageSteps(
      context.workflow as Workflow & { message_config?: any }
    );
    
    console.log(`\n📊 실행 계획:`);
    console.log(`- 대상 그룹: ${targetGroups.length}개`);
    console.log(`- 메시지 스텝: ${messageSteps.length}개`);
    console.log(`- 웹훅 실행: ${isWebhookExecution ? 'Yes' : 'No'}`);
    
    // 3. 각 스텝 실행
    const results: StepExecutionResult[] = [];
    
    for (const step of messageSteps) {
      for (const targetGroup of targetGroups) {
        const stepResult = await executeStep(step, targetGroup, context.workflow, context);
        results.push(stepResult);
      }
    }
    
    // 4. 결과 집계
    const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failedCount, 0);
    const executionTimeMs = Date.now() - startTime;
    
    const summary = {
      totalSteps: messageSteps.length,
      totalTargetGroups: targetGroups.length,
      successCount: totalSuccess,
      failedCount: totalFailed,
      executionTimeMs
    };
    
    console.log(`\n✅ === 워크플로우 실행 완료 ===`);
    console.log(`📊 총 ${totalSuccess + totalFailed}명 중 ${totalSuccess}명 성공 (${(totalSuccess / (totalSuccess + totalFailed) * 100).toFixed(1)}%)`);
    console.log(`⏱️ 실행 시간: ${executionTimeMs}ms`);
    
    return {
      success: totalFailed === 0,
      message: '워크플로우 실행이 완료되었습니다.',
      runId,
      results,
      summary,
      scheduledExecution: context.scheduledExecution,
      jobId: context.jobId
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ 워크플로우 실행 실패:`, error);
    
    return {
      success: false,
      message: `워크플로우 실행 실패: ${errorMsg}`,
      runId,
      results: [],
      summary: {
        totalSteps: 0,
        totalTargetGroups: 0,
        successCount: 0,
        failedCount: 1,
        executionTimeMs: Date.now() - startTime
      },
      scheduledExecution: context.scheduledExecution,
      jobId: context.jobId
    };
  }
}

/**
 * 실행 결과를 로그에 기록합니다.
 */
export async function logExecutionResult(
  result: WorkflowExecutionResult,
  workflowId: string
): Promise<void> {
  try {
    console.log('📝 실행 결과 로그 기록 중...');
    
    const supabase = getSupabase();
    
    // 워크플로우 실행 로그 기록
    const { error: logError } = await supabase
      .from('workflow_execution_logs')
      .insert({
        workflow_id: workflowId,
        run_id: result.runId,
        status: result.success ? 'completed' : 'failed',
        summary: result.summary,
        results: result.results,
        message: result.message,
        execution_time_ms: result.summary.executionTimeMs,
        executed_at: new Date().toISOString()
      });
      
    if (logError) {
      console.error('❌ 실행 로그 기록 실패:', logError);
    } else {
      console.log('✅ 실행 로그 기록 완료');
    }
    
  } catch (error) {
    console.error('❌ 실행 로그 기록 중 오류:', error);
  }
} 