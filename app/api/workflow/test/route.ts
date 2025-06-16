import { NextRequest, NextResponse } from 'next/server';
import { Workflow } from '@/lib/types/workflow';
import { mockTemplates } from '@/lib/data/mock-templates';
import { KakaoAlimtalkTemplateById } from '@/lib/data/kakao-templates';

// COOLSMS SDK 임포트
const coolsms = require('coolsms-node-sdk').default;

// COOLSMS API 설정
const COOLSMS_API_KEY = process.env.COOLSMS_API_KEY;
const COOLSMS_API_SECRET = process.env.COOLSMS_API_SECRET;
const KAKAO_SENDER_KEY = process.env.KAKAO_SENDER_KEY;
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER;
const SMS_SENDER_NUMBER = process.env.SMS_SENDER_NUMBER || '18007710';

interface TestRequest {
  workflow: Workflow;
}

export async function POST(request: NextRequest) {
  try {
    const { workflow }: TestRequest = await request.json();
    
    // 워크플로우의 테스트 설정 사용
    const testSettings = workflow.testSettings;
    const phoneNumber = testSettings?.testPhoneNumber || TEST_PHONE_NUMBER;
    const enableRealSending = testSettings?.enableRealSending ?? false;
    const fallbackToSMS = testSettings?.fallbackToSMS ?? true;

    // 환경변수 설정 상태 확인
    const envStatus = {
      COOLSMS_API_KEY: !!COOLSMS_API_KEY,
      COOLSMS_API_SECRET: !!COOLSMS_API_SECRET,
      KAKAO_SENDER_KEY: !!KAKAO_SENDER_KEY && KAKAO_SENDER_KEY !== 'your_kakao_sender_key_here',
      TEST_PHONE_NUMBER: !!TEST_PHONE_NUMBER,
      phoneNumber: phoneNumber
    };

    console.log('🔧 환경변수 설정 상태:', envStatus);
    console.log('워크플로우 테스트 실행:', {
      workflowId: workflow.id,
      workflowName: workflow.name,
      stepsCount: workflow.steps.length,
      phoneNumber,
      enableRealSending,
      fallbackToSMS
    });

    // 실제 발송이 활성화되었지만 필수 환경변수가 없는 경우 경고
    if (enableRealSending) {
      const missingEnvVars = [];
      if (!COOLSMS_API_KEY) missingEnvVars.push('COOLSMS_API_KEY');
      if (!COOLSMS_API_SECRET) missingEnvVars.push('COOLSMS_API_SECRET');
      if (!KAKAO_SENDER_KEY || KAKAO_SENDER_KEY === 'your_kakao_sender_key_here') {
        missingEnvVars.push('KAKAO_SENDER_KEY');
      }
      if (!phoneNumber) missingEnvVars.push('TEST_PHONE_NUMBER 또는 testPhoneNumber');

      if (missingEnvVars.length > 0) {
        console.warn('⚠️ 실제 발송 활성화되었지만 필수 환경변수 누락:', missingEnvVars);
        return NextResponse.json({
          success: false,
          message: `실제 발송을 위해 다음 환경변수가 필요합니다: ${missingEnvVars.join(', ')}`,
          missingEnvVars,
          envStatus,
          testSettings: {
            enableRealSending,
            fallbackToSMS,
            phoneNumber
          }
        }, { status: 400 });
      }
    }

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

        // 사용자 정의 변수 사용 (없으면 기본값)
        console.log('🔍 step.action.variables:', step.action.variables);
        
        const defaultVariables = {
          'total_reviews': '1,234',
          'monthly_review_count': '156',
          'top_5p_reviewers_count': '23',
          'total_post_views': '45,678',
          'naver_place_rank': '3',
          'blog_post_rank': '7',
          '고객명': '테스트 고객',
          '회사명': '테스트 회사',
          '취소일': '2024-01-20',
          '구독상태': '취소됨',
          '실패사유': '카드 한도 초과',
          '다음결제일': '2024-01-25',
          '블로그제목': '새로운 비즈니스 전략',
          '콘텐츠제목': '마케팅 가이드',
          '콘텐츠설명': '효과적인 마케팅 전략을 알아보세요'
        };
        
        const variables = step.action.variables && Object.keys(step.action.variables).length > 0 
          ? step.action.variables 
          : defaultVariables;
          
        console.log('🔧 최종 사용할 변수:', variables);

        const result = await sendAlimtalk({
          templateCode: template.templateCode,
          templateContent: template.templateContent,
          phoneNumber: phoneNumber!,
          variables,
          enableRealSending,
          fallbackToSMS
        });

        results.push({
          step: i + 1,
          type: 'alimtalk',
          status: result.success ? 'success' : 'failed',
          message: result.message,
          messageId: result.messageId,
          processedContent: result.processedContent,
          fallbackToSMS: result.fallbackToSMS,
          variables: variables
        });

      } else if (step.action.type === 'send_sms') {
        // SMS 발송
        const template = mockTemplates.find(t => t.id === step.action.templateId);
        if (!template) {
          throw new Error(`템플릿을 찾을 수 없습니다: ${step.action.templateId}`);
        }

        // 사용자 정의 변수 사용
        const variables = step.action.variables || {
          '고객명': '테스트 고객',
          '회사명': '테스트 회사'
        };

        const result = await sendSMS({
          content: template.templateContent,
          phoneNumber: phoneNumber!,
          variables,
          enableRealSending
        });

        results.push({
          step: i + 1,
          type: 'sms',
          status: result.success ? 'success' : 'failed',
          message: result.message,
          messageId: result.messageId,
          processedContent: result.processedContent,
          variables: variables
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
      testSettings: {
        enableRealSending,
        fallbackToSMS,
        phoneNumber
      },
      envStatus,
      realSendingStatus: enableRealSending ? 
        (envStatus.COOLSMS_API_KEY && envStatus.COOLSMS_API_SECRET && envStatus.KAKAO_SENDER_KEY ? 
          '실제 발송 시도됨' : '환경변수 누락으로 테스트 모드로 실행됨') : 
        '테스트 모드로 실행됨'
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
  variables,
  enableRealSending,
  fallbackToSMS
}: {
  templateCode: string;
  templateContent: string;
  phoneNumber: string;
  variables: Record<string, string>;
  enableRealSending: boolean;
  fallbackToSMS: boolean;
}) {
  // 템플릿 코드에서 실제 템플릿 ID 찾기
  const templateId = findTemplateIdByCode(templateCode);
  if (!templateId) {
    throw new Error(`템플릿 코드 ${templateCode}에 해당하는 템플릿 ID를 찾을 수 없습니다.`);
  }

  // 디버깅: 다른 템플릿으로 테스트
  const testTemplateId = "KA01TP250407033755052c3I28hVjXSH"; // 템플릿 108번
  console.log('🔧 디버깅: 원래 템플릿 ID:', templateId);
  console.log('🔧 디버깅: 테스트 템플릿 ID:', testTemplateId);

  // 변수 치환
  let processedContent = templateContent;
  Object.entries(variables).forEach(([key, value]) => {
    processedContent = processedContent.replace(new RegExp(`#{${key}}`, 'g'), value);
  });

  console.log('🔔 알림톡 발송 시도');
  console.log('템플릿 코드:', templateCode);
  console.log('템플릿 ID:', templateId);
  console.log('수신번호:', phoneNumber);
  console.log('사용자 변수:', variables);
  console.log('처리된 메시지:', processedContent);
  console.log('실제 발송:', enableRealSending ? '활성화' : '비활성화');

  if (!enableRealSending) {
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
    
    // 첫 번째 시도: 현재 templateCode 사용 (MEMBERS_113 형식)
    let result;
    try {
      result = await messageService.sendOne({
        to: phoneNumber,
        from: SMS_SENDER_NUMBER,
        type: 'ATA', // 알림톡
        kakaoOptions: {
          senderKey: KAKAO_SENDER_KEY,
          templateCode: templateCode, // 원래 templateCode 사용 (MEMBERS_113 형식)
          // CoolSMS API는 variables 속성 사용, 변수명을 #{변수명} 형식으로 변환
          variables: Object.entries(variables).reduce((acc, [key, value]) => {
            acc[`#{${key}}`] = value;
            return acc;
          }, {} as Record<string, string>)
        }
      });
    } catch (firstError) {
      console.log('첫 번째 시도 실패 (templateCode:', templateCode, '), 두 번째 시도: 실제 템플릿 ID 사용');
      
      // 두 번째 시도: 실제 템플릿 ID를 templateCode로 사용
      result = await messageService.sendOne({
        to: phoneNumber,
        from: SMS_SENDER_NUMBER,
        type: 'ATA', // 알림톡
        kakaoOptions: {
          senderKey: KAKAO_SENDER_KEY,
          templateCode: testTemplateId, // 테스트 템플릿 ID 사용
          // CoolSMS API는 variables 속성 사용, 변수명을 #{변수명} 형식으로 변환
          variables: Object.entries(variables).reduce((acc, [key, value]) => {
            acc[`#{${key}}`] = value;
            return acc;
          }, {} as Record<string, string>)
        }
      });
    }

    console.log('✅ 알림톡 발송 성공:', result);

    return {
      success: true,
      message: '알림톡 발송 완료',
      messageId: result.messageId || `alimtalk_${Date.now()}`,
      processedContent
    };

  } catch (error) {
    console.error('❌ 알림톡 발송 실패:', error);
    
    // 알림톡 실패 시 SMS로 대체 발송 (설정이 활성화된 경우)
    if (fallbackToSMS) {
      console.log('📱 SMS로 대체 발송 시도...');
      
      try {
        const smsResult = await sendSMS({
          content: processedContent,
          phoneNumber,
          variables: variables,
          enableRealSending
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
    } else {
      return {
        success: false,
        message: '알림톡 발송 실패 (SMS 대체 비활성화)',
        error: error,
        processedContent
      };
    }
  }
}

// 템플릿 코드로 템플릿 ID 찾기 함수
function findTemplateIdByCode(templateCode: string): string | null {
  // templateCode 형식: "MEMBERS_113"
  const parts = templateCode.split('_');
  if (parts.length !== 2) return null;
  
  const [servicePlatform, templateNumber] = parts;
  const templateNum = parseInt(templateNumber);
  
  // KakaoAlimtalkTemplateById에서 해당 조건에 맞는 템플릿 찾기
  for (const [templateId, template] of Object.entries(KakaoAlimtalkTemplateById)) {
    if (template.servicePlatform === servicePlatform && template.templateNumber === templateNum) {
      return templateId;
    }
  }
  
  return null;
}

// SMS 발송 함수
async function sendSMS({
  content,
  phoneNumber,
  variables,
  enableRealSending
}: {
  content: string;
  phoneNumber: string;
  variables: Record<string, string>;
  enableRealSending: boolean;
}) {
  // 변수 치환
  let processedContent = content;
  Object.entries(variables).forEach(([key, value]) => {
    processedContent = processedContent.replace(new RegExp(`#{${key}}`, 'g'), value);
  });

  console.log('📱 SMS 발송 시도');
  console.log('수신번호:', phoneNumber);
  console.log('처리된 메시지:', processedContent);
  console.log('실제 발송:', enableRealSending ? '활성화' : '비활성화');

  if (!enableRealSending) {
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
      from: SMS_SENDER_NUMBER,
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