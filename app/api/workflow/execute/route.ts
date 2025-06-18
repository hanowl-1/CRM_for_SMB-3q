import { NextRequest, NextResponse } from 'next/server';
import { Workflow } from '@/lib/types/workflow';
import { KakaoAlimtalkTemplateById } from '@/packages/kakao-alimtalk/src/generated/template';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';

const COOLSMS_API_KEY = process.env.COOLSMS_API_KEY;
const COOLSMS_API_SECRET = process.env.COOLSMS_API_SECRET;
const KAKAO_SENDER_KEY = process.env.KAKAO_SENDER_KEY;
const SMS_SENDER_NUMBER = process.env.SMS_SENDER_NUMBER;

interface ExecuteRequest {
  workflow: Workflow;
  scheduledExecution?: boolean;
  jobId?: string;
  enableRealSending?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExecuteRequest = await request.json();
    const { workflow, scheduledExecution = false, jobId, enableRealSending = false } = body;

    console.log(`🚀 워크플로우 실행 시작: ${workflow.name} (${scheduledExecution ? '예약 실행' : '수동 실행'})`);

    const results = [];
    let totalSuccessCount = 0;
    let totalFailedCount = 0;

    // 워크플로우 실행 기록 생성
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    try {
      // 각 스텝(템플릿) 실행
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        if (step.action.type !== 'send_alimtalk') {
          console.log(`⏭️ 지원하지 않는 액션 타입: ${step.action.type}`);
          continue;
        }

        console.log(`📤 스텝 ${i + 1} 실행: ${step.name}`);

        // 대상 그룹별로 메시지 발송
        for (const targetGroup of workflow.targetGroups || []) {
          const stepResult = await executeStep(step, targetGroup, workflow, enableRealSending);
          results.push({
            step: i + 1,
            stepName: step.name,
            targetGroup: targetGroup.name,
            ...stepResult
          });

          if (stepResult.status === 'success') {
            totalSuccessCount += stepResult.successCount || 1;
          } else {
            totalFailedCount += stepResult.failedCount || 1;
          }
        }

        // 스텝 간 지연 시간 적용
        if (step.action.delay && step.action.delay > 0) {
          console.log(`⏱️ ${step.action.delay}분 대기 중...`);
          await new Promise(resolve => setTimeout(resolve, step.action.delay! * 60000));
        }
      }

      const endTime = new Date();
      const executionTimeMs = endTime.getTime() - startTime.getTime();

      // 실행 결과를 데이터베이스에 저장
      try {
        await supabaseWorkflowService.createWorkflowRun({
          id: runId,
          workflowId: workflow.id,
          status: totalFailedCount > 0 ? 'partial_success' : 'success',
          triggerType: scheduledExecution ? 'scheduled' : 'manual',
          targetCount: totalSuccessCount + totalFailedCount,
          successCount: totalSuccessCount,
          failedCount: totalFailedCount,
          totalCost: 0, // 비용 계산 로직 추가 필요
          executionTimeMs,
          startedAt: startTime.toISOString(),
          completedAt: endTime.toISOString(),
          logs: results
        });
      } catch (dbError) {
        console.error('워크플로우 실행 기록 저장 실패:', dbError);
      }

      return NextResponse.json({
        success: true,
        message: '워크플로우 실행이 완료되었습니다.',
        runId,
        results,
        summary: {
          totalSteps: workflow.steps.length,
          totalTargetGroups: workflow.targetGroups?.length || 0,
          successCount: totalSuccessCount,
          failedCount: totalFailedCount,
          executionTimeMs
        },
        scheduledExecution,
        jobId
      });

    } catch (error) {
      // 실행 실패 기록
      try {
        await supabaseWorkflowService.createWorkflowRun({
          id: runId,
          workflowId: workflow.id,
          status: 'failed',
          triggerType: scheduledExecution ? 'scheduled' : 'manual',
          targetCount: 0,
          successCount: 0,
          failedCount: 0,
          totalCost: 0,
          executionTimeMs: Date.now() - startTime.getTime(),
          startedAt: startTime.toISOString(),
          errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
          logs: results
        });
      } catch (dbError) {
        console.error('워크플로우 실행 실패 기록 저장 실패:', dbError);
      }

      throw error;
    }

  } catch (error) {
    console.error('워크플로우 실행 실패:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '워크플로우 실행에 실패했습니다.',
        error: error
      },
      { status: 500 }
    );
  }
}

// 개별 스텝 실행
async function executeStep(step: any, targetGroup: any, workflow: Workflow, enableRealSending: boolean) {
  try {
    const templateId = step.action.templateId;
    const templateCode = step.action.templateCode;
    
    // 템플릿 정보 조회
    const templateInfo = KakaoAlimtalkTemplateById[templateId as keyof typeof KakaoAlimtalkTemplateById];
    if (!templateInfo) {
      throw new Error(`템플릿을 찾을 수 없습니다: ${templateId}`);
    }

    // 대상 그룹에서 실제 대상자 조회 (현재는 테스트용 더미 데이터)
    const targets = await getTargetsFromGroup(targetGroup);
    
    let successCount = 0;
    let failedCount = 0;
    const messageResults = [];

    for (const target of targets) {
      try {
        // 변수 치환
        const variables = { ...step.action.variables };
        for (const [key, value] of Object.entries(variables)) {
          if (typeof value === 'string' && value.includes('{{')) {
            // 동적 변수 치환 (예: {{customer_name}} -> target.name)
            variables[key] = value.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
              return (target as any)[fieldName] || match;
            });
          }
        }

        const result = await sendAlimtalk({
          templateId,
          templateContent: templateInfo.content,
          phoneNumber: target.phoneNumber,
          variables,
          enableRealSending
        });

        messageResults.push({
          target: target.name || target.phoneNumber,
          status: 'success',
          messageId: result.messageId,
          variables
        });
        successCount++;

      } catch (error) {
        messageResults.push({
          target: target.name || target.phoneNumber,
          status: 'failed',
          error: error instanceof Error ? error.message : '발송 실패'
        });
        failedCount++;
      }
    }

    return {
      status: failedCount === 0 ? 'success' : 'partial_success',
      successCount,
      failedCount,
      totalTargets: targets.length,
      messageResults
    };

  } catch (error) {
    return {
      status: 'failed',
      successCount: 0,
      failedCount: 1,
      totalTargets: 0,
      error: error instanceof Error ? error.message : '스텝 실행 실패'
    };
  }
}

// 대상 그룹에서 실제 대상자 목록 조회
async function getTargetsFromGroup(targetGroup: any) {
  // 현재는 테스트용 더미 데이터
  // 실제로는 MySQL 쿼리나 정적 목록에서 조회
  return [
    {
      id: 1,
      name: '테스트 고객',
      phoneNumber: '01012345678',
      email: 'test@example.com'
    }
  ];
}

// 알림톡 발송
async function sendAlimtalk({
  templateId,
  templateContent,
  phoneNumber,
  variables,
  enableRealSending
}: {
  templateId: string;
  templateContent: string;
  phoneNumber: string;
  variables: Record<string, string>;
  enableRealSending: boolean;
}) {
  if (!enableRealSending) {
    // 테스트 모드
    console.log('📱 테스트 모드 - 알림톡 발송 시뮬레이션');
    return {
      messageId: `test_${Date.now()}`,
      processedContent: templateContent.replace(/#{(\w+)}/g, (match, key) => variables[key] || match)
    };
  }

  // 실제 발송
  const templateInfo = KakaoAlimtalkTemplateById[templateId as keyof typeof KakaoAlimtalkTemplateById];
  const pfId = getPfIdForTemplate(templateId);

  const messageData = {
    to: phoneNumber,
    from: SMS_SENDER_NUMBER,
    type: 'ATA',
    kakaoOptions: {
      pfId: pfId,
      templateId: templateId,
      variables: variables
    }
  };

  const response = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
    method: 'POST',
    headers: {
      'Authorization': `HMAC-SHA256 apiKey=${COOLSMS_API_KEY}, date=${new Date().toISOString()}, salt=${Date.now()}, signature=${generateSignature()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: messageData
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CoolSMS API 오류: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return {
    messageId: result.groupId || result.messageId,
    processedContent: templateContent.replace(/#{(\w+)}/g, (match, key) => variables[key] || match)
  };
}

// 발신프로필 선택
function getPfIdForTemplate(templateId: string): string {
  const templateInfo = KakaoAlimtalkTemplateById[templateId as keyof typeof KakaoAlimtalkTemplateById];
  
  if (templateInfo) {
    const channel = templateInfo.channel;
    
    if (channel === 'CEO') {
      return process.env.PFID_CEO || templateInfo.channelId || KAKAO_SENDER_KEY || '';
    } else if (channel === 'BLOGGER') {
      return process.env.PFID_BLOGGER || templateInfo.channelId || KAKAO_SENDER_KEY || '';
    }
  }
  
  return KAKAO_SENDER_KEY || '';
}

// CoolSMS 서명 생성 (간단 버전)
function generateSignature(): string {
  return 'dummy_signature'; // 실제로는 HMAC-SHA256 계산 필요
} 