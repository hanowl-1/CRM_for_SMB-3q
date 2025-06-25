import { NextRequest, NextResponse } from 'next/server';
import { Workflow } from '@/lib/types/workflow';
import { KakaoAlimtalkTemplateById } from '@/packages/kakao-alimtalk/src/generated/template';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';
import crypto from 'crypto';

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
    // 🔥 Vercel Protection 우회를 위한 응답 헤더 설정
    const headers = new Headers();
    headers.set('x-vercel-bypass-protection', 'true');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // 🔥 스케줄러 내부 호출인지 확인 (Vercel 인증 우회)
    const isSchedulerInternal = request.headers.get('x-scheduler-internal') === 'true';
    const bypassSecret = request.headers.get('x-vercel-protection-bypass');
    
    if (isSchedulerInternal) {
      console.log('📋 스케줄러 내부 호출 감지됨');
      
      // Vercel Protection Bypass 검증
      if (bypassSecret && process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
        if (bypassSecret === process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
          console.log('✅ Vercel 인증 우회 성공');
        } else {
          console.warn('⚠️ Vercel 인증 우회 secret 불일치');
        }
      } else {
        console.warn('⚠️ Vercel 인증 우회 정보 누락');
        console.log('Environment VERCEL_AUTOMATION_BYPASS_SECRET:', process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? '설정됨' : '설정되지 않음');
        console.log('Bypass secret from header:', bypassSecret ? '전달됨' : '전달되지 않음');
      }
    }
    
    const body: ExecuteRequest = await request.json();
    const { workflow, scheduledExecution = false, jobId, enableRealSending = false } = body;

    console.log(`🚀 워크플로우 실행 시작: ${workflow.name} (${scheduledExecution ? '예약 실행' : '수동 실행'})`);

    const results = [];
    let totalSuccessCount = 0;
    let totalFailedCount = 0;
    const allMessageLogs = []; // 메시지 로그 저장용 배열 추가

    // 워크플로우 실행 기록 생성
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    try {
      // 🔥 워크플로우 객체에서 실행에 필요한 정보 추출
      const workflowWithSupabaseProps = workflow as Workflow & {
        target_config?: any;
        message_config?: any;
      };
      
      console.log('📋 워크플로우 실행 시작:', {
        id: workflow.id,
        name: workflow.name,
        targetGroupsCount: workflow.targetGroups?.length || 0,
        stepsCount: workflow.steps?.length || 0,
        hasTargetConfig: !!workflowWithSupabaseProps.target_config,
        hasMessageConfig: !!workflowWithSupabaseProps.message_config
      });
      
      // 🔥 타겟 그룹 정보 결정: workflow.targetGroups 우선, 없으면 target_config에서 추출
      let targetGroups = workflow.targetGroups || [];
      if (targetGroups.length === 0 && workflowWithSupabaseProps.target_config?.targetGroups) {
        targetGroups = workflowWithSupabaseProps.target_config.targetGroups;
        console.log('📋 target_config에서 타겟 그룹 추출:', targetGroups.length, '개');
      }
      
      // 🔥 메시지 스텝 정보 결정: workflow.steps 우선, 없으면 message_config에서 추출
      let messageSteps = workflow.steps || [];
      if (messageSteps.length === 0 && workflowWithSupabaseProps.message_config?.steps) {
        messageSteps = workflowWithSupabaseProps.message_config.steps;
        console.log('📋 message_config에서 메시지 스텝 추출:', messageSteps.length, '개');
      }

      // 각 스텝(템플릿) 실행
      for (let i = 0; i < messageSteps.length; i++) {
        const step = messageSteps[i];
        
        if (step.action.type !== 'send_alimtalk') {
          console.log(`⏭️ 지원하지 않는 액션 타입: ${step.action.type}`);
          continue;
        }

        console.log(`📤 스텝 ${i + 1} 실행: ${step.name}`);

        // 대상 그룹별로 메시지 발송
        for (const targetGroup of targetGroups) {
          const stepResult = await executeStep(step, targetGroup, workflow, enableRealSending);
          results.push({
            step: i + 1,
            stepName: step.name,
            targetGroup: targetGroup.name,
            ...stepResult
          });

          // 메시지 로그 수집
          if (stepResult.messageLogs) {
            allMessageLogs.push(...stepResult.messageLogs);
          }

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

        // 메시지 로그 저장
        if (allMessageLogs.length > 0) {
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || (process.env.NODE_ENV === 'production' 
              ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-domain.vercel.app')
              : 'http://localhost:3000')}/api/supabase/message-logs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'bulk_create',
                logs: allMessageLogs
              })
            });

            if (!response.ok) {
              console.error('메시지 로그 저장 실패:', await response.text());
            } else {
              console.log(`✅ ${allMessageLogs.length}개 메시지 로그 저장 완료`);
            }
          } catch (logError) {
            console.error('메시지 로그 저장 오류:', logError);
          }
        }
      } catch (dbError) {
        console.error('워크플로우 실행 기록 저장 실패:', dbError);
      }

      return NextResponse.json({
        success: true,
        message: '워크플로우 실행이 완료되었습니다.',
        runId,
        results,
        summary: {
          totalSteps: messageSteps.length,
          totalTargetGroups: targetGroups.length,
          successCount: totalSuccessCount,
          failedCount: totalFailedCount,
          executionTimeMs
        },
        scheduledExecution,
        jobId
      }, {
        headers: {
          'x-vercel-bypass-protection': 'true',
          'x-vercel-set-bypass-cookie': 'true',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
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

    // 대상 그룹에서 실제 대상자 조회
    const targets = await getTargetsFromGroup(targetGroup);
    
    let successCount = 0;
    let failedCount = 0;
    const messageResults = [];
    const messageLogs = []; // 메시지 로그 배열 추가

    for (const target of targets) {
      try {
        // 변수 치환
        const variables = { ...step.action.variables };
        for (const [key, value] of Object.entries(variables)) {
          if (typeof value === 'string' && value.includes('{{')) {
            // 동적 변수 치환 (예: {{customer_name}} -> target.name)
            const rawData = target.rawData || target;
            variables[key] = value.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
              return rawData[fieldName] || target[fieldName] || match;
            });
          }
        }

        console.log(`📤 대상자: ${target.name} (${target.phoneNumber})`);
        console.log(`📋 변수 치환 결과:`, variables);

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

        // 메시지 로그 생성
        messageLogs.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          messageType: 'kakao',
          recipientPhone: target.phoneNumber,
          recipientEmail: target.email || null,
          recipientName: target.name || null,
          templateId: templateId,
          templateName: templateInfo.templateName || step.name,
          messageContent: result.processedContent || templateInfo.content,
          variables: variables,
          status: enableRealSending ? 'sent' : 'pending',
          provider: 'coolsms',
          providerMessageId: result.messageId,
          costAmount: 15, // 카카오 알림톡 기본 비용
          sentAt: enableRealSending ? new Date().toISOString() : null
        });

        successCount++;

      } catch (error) {
        messageResults.push({
          target: target.name || target.phoneNumber,
          status: 'failed',
          error: error instanceof Error ? error.message : '발송 실패'
        });

        // 실패한 메시지 로그도 생성
        messageLogs.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          messageType: 'kakao',
          recipientPhone: target.phoneNumber,
          recipientEmail: target.email || null,
          recipientName: target.name || null,
          templateId: templateId,
          templateName: templateInfo.templateName || step.name,
          messageContent: templateInfo.content,
          variables: step.action.variables,
          status: 'failed',
          provider: 'coolsms',
          errorMessage: error instanceof Error ? error.message : '발송 실패',
          costAmount: 0
        });

        failedCount++;
      }
    }

    return {
      status: failedCount === 0 ? 'success' : 'partial_success',
      successCount,
      failedCount,
      totalTargets: targets.length,
      messageResults,
      messageLogs // 메시지 로그 반환
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
  try {
    // MySQL 동적 쿼리 실행하여 실제 대상자 조회
    if (targetGroup.type === 'dynamic' && targetGroup.dynamicQuery?.sql) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/mysql/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: targetGroup.dynamicQuery.sql
        })
      });

      if (!response.ok) {
        throw new Error(`MySQL 쿼리 실행 실패: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(`MySQL 쿼리 결과 없음: ${result.message}`);
      }

      // MySQL 결과를 대상자 형식으로 변환
      return result.data.map((row: any, index: number) => {
        // 연락처 필드 찾기 (contacts, phone, phoneNumber 등)
        const phoneNumber = row.contacts || row.phone || row.phoneNumber || '01000000000';
        const name = row.name || row.company || row.title || `대상자${index + 1}`;
        const email = row.email || null;

        return {
          id: row.id || index + 1,
          name: name,
          phoneNumber: phoneNumber,
          email: email,
          rawData: row // 원본 데이터 보관 (변수 치환용)
        };
      });
    }
  } catch (error) {
    console.error('대상자 조회 실패:', error);
    // 에러 발생 시 빈 배열 반환
    return [];
  }

  // fallback으로 테스트 데이터 사용
  console.log('⚠️ fallback 테스트 데이터 사용');
  return [
    {
      id: 1,
      name: '테스트 고객',
      phoneNumber: '01012345678',
      email: 'test@example.com',
      rawData: { id: 1, name: '테스트 고객' }
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
  
  const date = new Date().toISOString();
  const salt = Date.now().toString();
  const signature = generateSignature(COOLSMS_API_KEY!, COOLSMS_API_SECRET!, date, salt);

  // 변수 치환된 메시지 내용 생성
  const processedContent = templateContent.replace(/#{(\w+)}/g, (match, key) => variables[key] || match);

  const messageData = {
    to: phoneNumber,
    from: SMS_SENDER_NUMBER,
    type: 'ATA',
    text: processedContent,
    kakaoOptions: {
      pfId: pfId,
      templateId: templateId,
      variables: variables
    }
  };

  console.log(`📱 실제 알림톡 발송: ${phoneNumber} - 템플릿: ${templateId}`);
  console.log(`📋 메시지 내용: ${processedContent}`);
  console.log(`🔑 발신프로필: ${pfId}`);

  const response = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
    method: 'POST',
    headers: {
      'Authorization': `HMAC-SHA256 apiKey=${COOLSMS_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: messageData
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ CoolSMS API 오류: ${response.status} - ${errorText}`);
    throw new Error(`CoolSMS API 오류: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`✅ 알림톡 발송 성공: ${result.groupId || result.messageId}`);
  
  return {
    messageId: result.groupId || result.messageId,
    processedContent: processedContent
  };
}

// CoolSMS HMAC-SHA256 서명 생성
function generateSignature(apiKey: string, apiSecret: string, date: string, salt: string): string {
  const data = `${date}${salt}`;
  return crypto.createHmac('sha256', apiSecret).update(data).digest('hex');
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