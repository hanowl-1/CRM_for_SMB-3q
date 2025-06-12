import { NextRequest, NextResponse } from 'next/server';
import { Workflow } from '@/lib/types/workflow';
import { mockTemplates } from '@/lib/data/mock-templates';

// COOLSMS SDK 임포트
const coolsms = require('coolsms-node-sdk').default;

// COOLSMS API 설정
const COOLSMS_API_KEY = process.env.COOLSMS_API_KEY;
const COOLSMS_API_SECRET = process.env.COOLSMS_API_SECRET;
const KAKAO_SENDER_KEY = process.env.KAKAO_SENDER_KEY;
const TEST_MODE = process.env.TEST_MODE === 'true';
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER;

interface TestRequest {
  workflow: Workflow;
  testPhoneNumber?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { workflow, testPhoneNumber }: TestRequest = await request.json();
    const phoneNumber = testPhoneNumber || TEST_PHONE_NUMBER;

    console.log('워크플로우 테스트 실행:', {
      workflowId: workflow.id,
      workflowName: workflow.name,
      stepsCount: workflow.steps.length,
      phoneNumber,
      testMode: TEST_MODE
    });

    // 워크플로우 단계별 실행
    const results = [];
    
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      console.log(`단계 ${i + 1} 실행:`, step.name);

      if (step.action.type === 'send_alimtalk') {
        // 알림톡 발송
        const template = mockTemplates.find(t => t.id === step.action.templateId);
        if (!template) {
          throw new Error(`템플릿을 찾을 수 없습니다: ${step.action.templateId}`);
        }

        const result = await sendAlimtalk({
          templateCode: template.templateCode,
          templateContent: template.templateContent,
          phoneNumber: phoneNumber!,
          variables: {
            '고객명': '테스트 고객',
            '회사명': '테스트 회사',
            '취소일': '2024-01-20',
            '구독상태': '취소됨',
            '실패사유': '카드 한도 초과',
            '다음결제일': '2024-01-25',
            '블로그제목': '새로운 비즈니스 전략',
            '콘텐츠제목': '마케팅 가이드',
            '콘텐츠설명': '효과적인 마케팅 전략을 알아보세요'
          }
        });

        results.push({
          step: i + 1,
          type: 'alimtalk',
          status: result.success ? 'success' : 'failed',
          message: result.message,
          messageId: result.messageId,
          processedContent: result.processedContent
        });

      } else if (step.action.type === 'send_sms') {
        // SMS 발송
        const template = mockTemplates.find(t => t.id === step.action.templateId);
        if (!template) {
          throw new Error(`템플릿을 찾을 수 없습니다: ${step.action.templateId}`);
        }

        const result = await sendSMS({
          content: template.templateContent,
          phoneNumber: phoneNumber!,
          variables: {
            '고객명': '테스트 고객',
            '회사명': '테스트 회사'
          }
        });

        results.push({
          step: i + 1,
          type: 'sms',
          status: result.success ? 'success' : 'failed',
          message: result.message,
          messageId: result.messageId,
          processedContent: result.processedContent
        });

      } else if (step.action.type === 'wait') {
        // 대기 (테스트에서는 실제로 대기하지 않음)
        results.push({
          step: i + 1,
          type: 'wait',
          status: 'success',
          message: `${step.action.delay}분 대기 (테스트에서는 스킵됨)`
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: '워크플로우 테스트가 완료되었습니다.',
      results,
      executionTime: new Date().toISOString(),
      testMode: TEST_MODE
    });

  } catch (error) {
    console.error('워크플로우 테스트 실행 실패:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        error: error
      },
      { status: 500 }
    );
  }
}

// 알림톡 발송 함수
async function sendAlimtalk({
  templateCode,
  templateContent,
  phoneNumber,
  variables
}: {
  templateCode: string;
  templateContent: string;
  phoneNumber: string;
  variables: Record<string, string>;
}) {
  // 변수 치환
  let processedContent = templateContent;
  Object.entries(variables).forEach(([key, value]) => {
    processedContent = processedContent.replace(new RegExp(`#{${key}}`, 'g'), value);
  });

  console.log('🔔 알림톡 발송 시도');
  console.log('템플릿 코드:', templateCode);
  console.log('수신번호:', phoneNumber);
  console.log('처리된 메시지:', processedContent);

  if (TEST_MODE) {
    // 테스트 모드: 실제 발송하지 않고 성공 응답 반환
    console.log('🧪 테스트 모드 - 실제 발송하지 않음');
    
    return {
      success: true,
      message: '알림톡 발송 완료 (테스트 모드)',
      messageId: `test_alimtalk_${Date.now()}`,
      processedContent
    };
  }

  try {
    // 실제 COOLSMS API 호출
    if (!COOLSMS_API_KEY || !COOLSMS_API_SECRET || !KAKAO_SENDER_KEY) {
      throw new Error('COOLSMS API 키 또는 카카오 발신키가 설정되지 않았습니다.');
    }

    const messageService = new coolsms(COOLSMS_API_KEY, COOLSMS_API_SECRET);
    
    const result = await messageService.sendOne({
      to: phoneNumber,
      from: KAKAO_SENDER_KEY,
      text: processedContent,
      type: 'ATA', // 알림톡
      kakaoOptions: {
        senderKey: KAKAO_SENDER_KEY,
        templateCode: templateCode,
        // 변수가 있는 경우 추가
        ...(Object.keys(variables).length > 0 && {
          variables: Object.entries(variables).reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {} as Record<string, string>)
        })
      }
    });

    console.log('✅ 알림톡 발송 성공:', result);

    return {
      success: true,
      message: '알림톡 발송 완료',
      messageId: result.messageId || `alimtalk_${Date.now()}`,
      processedContent
    };

  } catch (error) {
    console.error('❌ 알림톡 발송 실패:', error);
    
    // 알림톡 실패 시 SMS로 대체 발송
    console.log('📱 SMS로 대체 발송 시도...');
    
    try {
      const smsResult = await sendSMS({
        content: processedContent,
        phoneNumber,
        variables: {}
      });
      
      return {
        success: true,
        message: '알림톡 실패 → SMS 대체 발송 완료',
        messageId: smsResult.messageId,
        processedContent,
        fallbackToSMS: true
      };
    } catch (smsError) {
      return {
        success: false,
        message: '알림톡 및 SMS 발송 모두 실패',
        error: { alimtalk: error, sms: smsError },
        processedContent
      };
    }
  }
}

// SMS 발송 함수
async function sendSMS({
  content,
  phoneNumber,
  variables
}: {
  content: string;
  phoneNumber: string;
  variables: Record<string, string>;
}) {
  // 변수 치환
  let processedContent = content;
  Object.entries(variables).forEach(([key, value]) => {
    processedContent = processedContent.replace(new RegExp(`#{${key}}`, 'g'), value);
  });

  console.log('📱 SMS 발송 시도');
  console.log('수신번호:', phoneNumber);
  console.log('처리된 메시지:', processedContent);

  if (TEST_MODE) {
    // 테스트 모드: 실제 발송하지 않고 성공 응답 반환
    console.log('🧪 테스트 모드 - 실제 발송하지 않음');
    
    return {
      success: true,
      message: 'SMS 발송 완료 (테스트 모드)',
      messageId: `test_sms_${Date.now()}`,
      processedContent
    };
  }

  try {
    // 실제 COOLSMS API 호출
    if (!COOLSMS_API_KEY || !COOLSMS_API_SECRET) {
      throw new Error('COOLSMS API 키가 설정되지 않았습니다.');
    }

    const messageService = new coolsms(COOLSMS_API_KEY, COOLSMS_API_SECRET);
    
    const result = await messageService.sendOne({
      to: phoneNumber,
      from: '01041513771', // 발신번호 (등록된 번호 사용)
      text: processedContent,
      type: processedContent.length > 90 ? 'LMS' : 'SMS' // 90자 초과시 LMS
    });

    console.log('✅ SMS 발송 성공:', result);

    return {
      success: true,
      message: 'SMS 발송 완료',
      messageId: result.messageId || `sms_${Date.now()}`,
      processedContent
    };

  } catch (error) {
    console.error('❌ SMS 발송 실패:', error);
    return {
      success: false,
      message: 'SMS 발송 실패',
      error,
      processedContent
    };
  }
} 