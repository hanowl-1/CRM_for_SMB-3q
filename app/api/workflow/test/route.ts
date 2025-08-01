import { NextRequest, NextResponse } from 'next/server';
import { Workflow } from '@/lib/types/workflow';
import { KakaoAlimtalkTemplateById, KakaoAlimtalkTemplateByNumber } from '@/lib/data/kakao-templates';
import { getSupabase } from '@/lib/database/supabase-client';

// COOLSMS SDK 임포트
const coolsms = require('coolsms-node-sdk').default;

// MySQL 연결
import mysql from 'mysql2/promise';

// MySQL 연결 설정
const dbConfig = {
  host: process.env.MYSQL_READONLY_HOST || 'supermembers-prod.cluster-cy8cnze5wxti.ap-northeast-2.rds.amazonaws.com',
  port: parseInt(process.env.MYSQL_READONLY_PORT || '3306'),
  user: process.env.MYSQL_READONLY_USER || 'readonly',
  password: process.env.MYSQL_READONLY_PASSWORD || 'phozphoz1!',
  database: process.env.MYSQL_READONLY_DATABASE || 'supermembers',
  charset: 'utf8mb4',
  timezone: '+09:00',
  ssl: {
    rejectUnauthorized: false
  }
};

// COOLSMS API 설정
const COOLSMS_API_KEY = process.env.COOLSMS_API_KEY;
const COOLSMS_API_SECRET = process.env.COOLSMS_API_SECRET;
const KAKAO_SENDER_KEY = process.env.KAKAO_SENDER_KEY;
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER;
const SMS_SENDER_NUMBER = process.env.SMS_SENDER_NUMBER || '18007710';

// Mock 템플릿 데이터 (SMS 발송용)
const mockTemplates = [
  {
    id: 'sms_template_1',
    name: '기본 SMS 템플릿',
    templateCode: 'SMS_BASIC',
    templateContent: '안녕하세요 #{고객명}님, #{회사명}에서 보내는 메시지입니다.'
  },
  {
    id: 'sms_template_2',
    name: '테스트 SMS 템플릿',
    templateCode: 'SMS_TEST',
    templateContent: '테스트 메시지입니다. #{고객명}님께 발송됩니다.'
  }
];

interface TestRequest {
  workflow: Workflow;
}

export async function POST(request: NextRequest) {
  try {
    const { workflow }: TestRequest = await request.json();
    
    // 워크플로우의 테스트 설정 사용
    const testSettings = workflow.testSettings;
    const enableRealSending = testSettings?.enableRealSending ?? false;
    const fallbackToSMS = testSettings?.fallbackToSMS ?? true;

    // 스케줄 설정 확인
    const scheduleSettings = workflow.scheduleSettings;
    const isScheduledTest = scheduleSettings && scheduleSettings.type !== 'immediate';
    
    // 스케줄러에서 실행되는 경우 확인 (testMode가 false인 경우)
    const isSchedulerExecution = testSettings?.testMode === false;

    console.log('📅 실행 모드 확인:', {
      scheduleType: scheduleSettings?.type,
      isScheduledTest,
      isSchedulerExecution,
      testMode: testSettings?.testMode,
      enableRealSending,
      scheduleSettings
    });

    // 전화번호 설정 로직 개선
    let phoneNumber: string | undefined;
    let useRealTargets = false;

    if (isSchedulerExecution && enableRealSending) {
      // 스케줄러 실행 시에는 실제 타겟 그룹 사용
      console.log('🎯 스케줄러 실행 모드: 실제 타겟 그룹 연락처 사용');
      useRealTargets = true;
      phoneNumber = 'TARGET_GROUP'; // 특수 값으로 표시
    } else {
      // 테스트 모드에서는 테스트 번호 사용
      phoneNumber = testSettings?.testPhoneNumber || TEST_PHONE_NUMBER;
      console.log('🧪 테스트 모드: 테스트 번호 사용 -', phoneNumber);
    }

    // 환경변수 설정 상태 확인
    const envStatus = {
      COOLSMS_API_KEY: !!COOLSMS_API_KEY,
      COOLSMS_API_SECRET: !!COOLSMS_API_SECRET,
      KAKAO_SENDER_KEY: !!KAKAO_SENDER_KEY && KAKAO_SENDER_KEY !== 'your_kakao_sender_key_here',
      TEST_PHONE_NUMBER: !!TEST_PHONE_NUMBER,
      phoneNumber: phoneNumber,
      useRealTargets
    };

    console.log('🔧 환경변수 설정 상태:', envStatus);
    console.log('워크플로우 테스트 실행:', {
      workflowId: workflow.id,
      workflowName: workflow.name,
      stepsCount: workflow.steps.length,
      phoneNumber,
      enableRealSending,
      fallbackToSMS,
      isScheduledTest,
      isSchedulerExecution,
      useRealTargets
    });

    // 스케줄 테스트인 경우 스케줄러에 등록
    if (isScheduledTest) {
      console.log('📅 스케줄 테스트 모드: 스케줄러에 등록 중...');
      
      // 크론잡 기반 시스템에서는 스케줄 테스트를 위해 별도 처리 필요
      console.log('ℹ️ 크론잡 기반 스케줄러에서는 스케줄 테스트가 지원되지 않습니다.');
      
      return NextResponse.json({
        success: true,
        message: '스케줄 설정이 확인되었습니다. 실제 스케줄 실행은 워크플로우를 저장하고 활성화해주세요.',
        scheduledTest: true,
        scheduleInfo: {
          type: scheduleSettings.type,
          scheduledTime: scheduleSettings.scheduledTime,
          delay: scheduleSettings.delay,
          recurringPattern: scheduleSettings.recurringPattern,
          timezone: scheduleSettings.timezone
        },
        executionTime: new Date().toISOString(),
        testSettings: {
          enableRealSending,
          fallbackToSMS,
          phoneNumber
        },
        envStatus,
        realSendingStatus: '스케줄 설정 확인됨 - 워크플로우 저장 후 활성화 시 스케줄러에 등록됩니다'
      });
    }

    // 즉시 테스트 실행 (기존 로직)
    console.log('🚀 즉시 테스트 모드: 바로 실행 중...');

    // 실제 발송이 활성화되었지만 필수 환경변수가 없는 경우 경고
    if (enableRealSending) {
      const missingEnvVars = [];
      if (!COOLSMS_API_KEY) missingEnvVars.push('COOLSMS_API_KEY');
      if (!COOLSMS_API_SECRET) missingEnvVars.push('COOLSMS_API_SECRET');
      if (!KAKAO_SENDER_KEY || KAKAO_SENDER_KEY === 'your_kakao_sender_key_here') {
        missingEnvVars.push('KAKAO_SENDER_KEY');
      }
      
      // 실제 타겟 그룹을 사용하지 않는 경우에만 테스트 번호 확인
      if (!useRealTargets && !phoneNumber) {
        missingEnvVars.push('TEST_PHONE_NUMBER 또는 testPhoneNumber');
      }

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
            phoneNumber,
            useRealTargets
          }
        }, { status: 400 });
      }
    }

    // 워크플로우 단계별 실행
    const results = [];
    
    // 실제 타겟 그룹 연락처 조회 (스케줄러 실행 시)
    let targetContacts: Array<{
      name: string;
      phone: string;
      company?: string;
      data: any;
    }> = [];

    if (useRealTargets && workflow.targetGroups && workflow.targetGroups.length > 0) {
      console.log('🎯 실제 타겟 그룹에서 연락처 조회 중...');
      targetContacts = await getContactsFromTargetGroups(workflow.targetGroups);
      
      if (targetContacts.length === 0) {
        console.warn('⚠️ 실제 타겟 그룹에서 조회된 연락처가 없습니다.');
        return NextResponse.json({
          success: false,
          message: '실제 타겟 그룹에서 조회된 연락처가 없습니다.',
          targetContactsCount: 0,
          envStatus,
          testSettings: {
            enableRealSending,
            fallbackToSMS,
            phoneNumber,
            useRealTargets
          }
        }, { status: 400 });
      }
      
      console.log(`✅ 실제 타겟 그룹에서 ${targetContacts.length}개 연락처 조회 완료`);
    }
    
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      console.log(`단계 ${i + 1} 실행:`, step.name);

      if (step.action.type === 'send_alimtalk') {
        // 알림톡 발송
        console.log('🔍 알림톡 템플릿 검색:', {
          templateId: step.action.templateId,
          templateCode: step.action.templateCode,
          templateName: step.action.templateName
        });

        // 템플릿 정보 구성
        let template: any;
        
        // 먼저 mockTemplates에서 찾기 (테스트용)
        template = mockTemplates.find(t => t.id === step.action.templateId);
        
        if (!template && step.action.templateId) {
          // mockTemplates에 없으면 실제 카카오 템플릿에서 찾기
          const realTemplate = KakaoAlimtalkTemplateById[step.action.templateId as keyof typeof KakaoAlimtalkTemplateById];
          
          if (realTemplate) {
            template = {
              id: step.action.templateId,
              name: realTemplate.templateName,
              templateCode: step.action.templateCode || `MEMBERS_${realTemplate.templateNumber}`,
              templateContent: realTemplate.content
            };
          }
        }
        
        if (!template) {
          throw new Error(`템플릿을 찾을 수 없습니다: ${step.action.templateId}`);
        }

        // 실제 타겟 그룹 사용 시 각 연락처에 개별 발송
        if (useRealTargets && targetContacts.length > 0) {
          console.log(`🎯 실제 타겟 그룹 ${targetContacts.length}명에게 개별 발송 시작`);
          
          for (const contact of targetContacts) {
            try {
              // PersonalizationService를 사용하여 개인화 수행
              let variables: Record<string, string> = {};
              
              if (step.action.personalization?.enabled) {
                console.log(`🎯 ${contact.name} 개인화 처리 중...`);
                
                try {
                  const { personalizationService } = await import('@/lib/services/personalization-service');
                  
                  // 개인화된 메시지 생성
                  const personalizedMessages = await personalizationService.generatePersonalizedMessages(
                    [{ contact: contact.phone, data: contact.data }],
                    template.templateContent,
                    step.action.personalization
                  );
                  
                  if (personalizedMessages.length > 0 && !personalizedMessages[0].error) {
                    // 개인화된 메시지에서 변수 추출
                    variables = extractVariablesFromPersonalization(
                      template.templateContent,
                      personalizedMessages[0].personalizedContent,
                      contact.data
                    );
                    console.log(`✅ ${contact.name} 개인화 완료:`, variables);
                  } else {
                    console.warn(`⚠️ ${contact.name} 개인화 실패, 기본값 사용`);
                    variables = getContactVariables(contact);
                  }
                } catch (personalizationError) {
                  console.error(`❌ ${contact.name} 개인화 처리 실패:`, personalizationError);
                  variables = getContactVariables(contact);
                }
              } else {
                console.log(`🔧 ${contact.name} 개인화 비활성화 - 기본 변수 사용`);
                variables = getContactVariables(contact);
              }
              
              // 설정된 변수로 덮어쓰기
              if (step.action.variables && Object.keys(step.action.variables).length > 0) {
                variables = { ...variables, ...step.action.variables };
              }
                
              console.log(`📤 ${contact.name} (${contact.phone})에게 발송 중...`);

              const result = await sendAlimtalk({
                templateCode: template.templateCode,
                templateContent: template.templateContent,
                phoneNumber: contact.phone,
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
                variables: variables,
                recipient: {
                  name: contact.name,
                  phone: contact.phone,
                  company: contact.company
                }
              });

            } catch (contactError) {
              console.error(`❌ ${contact.name} (${contact.phone}) 발송 실패:`, contactError);
              results.push({
                step: i + 1,
                type: 'alimtalk',
                status: 'failed',
                message: contactError instanceof Error ? contactError.message : '발송 실패',
                recipient: {
                  name: contact.name,
                  phone: contact.phone,
                  company: contact.company
                }
              });
            }
          }
          
        } else {
          // 테스트 모드: 단일 번호로 발송
          console.log(`🧪 테스트 모드: ${phoneNumber}로 발송`);
          
          // PersonalizationService를 사용하여 실제 개인화 수행
          let variables: Record<string, string> = {};
          
          if (step.action.personalization?.enabled && workflow.targetGroups?.length > 0) {
            console.log('🎯 개인화 활성화됨 - PersonalizationService 사용');
            
            try {
              // 타겟 그룹에서 테스트용 데이터 샘플 1개 추출
              const sampleTargets = await getContactsFromTargetGroups(workflow.targetGroups);
              
              if (sampleTargets.length > 0) {
                const sampleTarget = sampleTargets[0];
                console.log('📊 샘플 타겟 데이터:', sampleTarget);
                
                // PersonalizationService import 추가 필요
                const { personalizationService } = await import('@/lib/services/personalization-service');
                
                // 개인화된 메시지 생성
                const personalizedMessages = await personalizationService.generatePersonalizedMessages(
                  [{ contact: sampleTarget.phone, data: sampleTarget.data }],
                  template.templateContent,
                  step.action.personalization
                );
                
                if (personalizedMessages.length > 0 && !personalizedMessages[0].error) {
                  // 개인화된 메시지에서 변수 추출
                  variables = extractVariablesFromPersonalization(
                    template.templateContent,
                    personalizedMessages[0].personalizedContent,
                    sampleTarget.data
                  );
                  console.log('✅ 개인화된 변수 생성:', variables);
                } else {
                  console.warn('⚠️ 개인화 실패, 기본값 사용');
                  variables = getDefaultVariables();
                }
              } else {
                console.warn('⚠️ 타겟 그룹에서 샘플 데이터 없음, 기본값 사용');
                variables = getDefaultVariables();
              }
            } catch (personalizationError) {
              console.error('❌ 개인화 처리 실패:', personalizationError);
              variables = getDefaultVariables();
            }
          } else {
            console.log('🔧 개인화 비활성화 - 설정된 변수 또는 기본값 사용');
            variables = step.action.variables && Object.keys(step.action.variables).length > 0 
              ? step.action.variables 
              : getDefaultVariables();
          }
            
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
        }

      } else if (step.action.type === 'send_sms') {
        // SMS 발송
        // 기본 템플릿 정의 (안전한 방식)
        const defaultTemplates = [
          {
            id: 'sms_template_1',
            name: '기본 SMS 템플릿',
            templateCode: 'SMS_BASIC',
            templateContent: '안녕하세요 #{고객명}님, #{회사명}에서 보내는 메시지입니다.'
          },
          {
            id: 'sms_template_2',
            name: '테스트 SMS 템플릿',
            templateCode: 'SMS_TEST',
            templateContent: '테스트 메시지입니다. #{고객명}님께 발송됩니다.'
          },
          {
            id: 'fallback',
            name: '기본 템플릿',
            templateCode: 'SMS_FALLBACK',
            templateContent: '테스트 메시지입니다.'
          }
        ];

        // 템플릿 찾기 (안전한 방식)
        let template = defaultTemplates.find(t => t.id === step.action.templateId);
        if (!template) {
          // mockTemplates에서 찾기 시도 (있는 경우에만)
          if (typeof mockTemplates !== 'undefined' && Array.isArray(mockTemplates)) {
            template = mockTemplates.find(t => t.id === step.action.templateId);
          }
        }
        
        // 최종 fallback
        if (!template) {
          template = defaultTemplates[0];
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
    
    // 기본 메시지 옵션
    const baseMessageOptions: any = {
      to: phoneNumber,
      from: SMS_SENDER_NUMBER,
      type: 'ATA', // 알림톡
      kakaoOptions: {
        pfId: getPfIdForTemplate(templateId),
        templateId: templateId, // 실제 템플릿 ID 사용
        // CoolSMS API는 variables 속성에서 #{변수명} 형식 사용
        variables: Object.entries(variables).reduce((acc, [key, value]) => {
          acc[`#{${key}}`] = value;
          return acc;
        }, {} as Record<string, string>)
      }
    };
    
    console.log('📤 CoolSMS API 호출 옵션:', {
      to: phoneNumber,
      from: SMS_SENDER_NUMBER,
      type: 'ATA',
      pfId: getPfIdForTemplate(templateId),
      templateId: templateId,
      variables: baseMessageOptions.kakaoOptions.variables
    });
    
    // 실제 템플릿 ID로 발송 시도
    const result = await messageService.sendOne(baseMessageOptions);

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
  
  console.log('🔍 템플릿 검색:', { servicePlatform, templateNum });
  
  // 113번 템플릿의 경우 직접 ID 반환
  if (servicePlatform === 'MEMBERS' && templateNum === 113) {
    const templateId = 'KA01TP250610072652095M0BPif67w7I';
    console.log('✅ 113번 템플릿 발견:', templateId);
    return templateId;
  }
  
  // KakaoAlimtalkTemplateById에서 해당 조건에 맞는 템플릿 찾기
  for (const [templateId, template] of Object.entries(KakaoAlimtalkTemplateById)) {
    if (template.servicePlatform === servicePlatform && template.templateNumber === templateNum) {
      console.log('✅ 템플릿 매칭 성공:', { templateId, templateName: template.templateName });
      return templateId;
    }
  }
  
  console.log('❌ 템플릿을 찾을 수 없음:', templateCode);
  return null;
}

// 템플릿에 맞는 발신프로필 키 선택 함수
function getPfIdForTemplate(templateId: string): string {
  // KakaoAlimtalkTemplateById에서 템플릿 정보 찾기
  const templateInfo = KakaoAlimtalkTemplateById[templateId as keyof typeof KakaoAlimtalkTemplateById];
  
  if (templateInfo) {
    const channel = templateInfo.channel;
    console.log('🔍 템플릿 정보:', {
      templateId,
      templateName: templateInfo.templateName,
      channel,
      channelId: templateInfo.channelId
    });
    
    // channel 속성에 따라 발신프로필 선택
    if (channel === 'CEO') {
      const pfId = process.env.PFID_CEO || templateInfo.channelId || KAKAO_SENDER_KEY || '';
      console.log('🔑 CEO 채널 발신프로필 사용:', pfId);
      return pfId;
    } else if (channel === 'BLOGGER') {
      const pfId = process.env.PFID_BLOGGER || templateInfo.channelId || KAKAO_SENDER_KEY || '';
      console.log('🔑 BLOGGER 채널 발신프로필 사용:', pfId);
      return pfId;
    }
  }
  
  // 템플릿 정보를 찾을 수 없는 경우 기본값 사용
  const pfId = KAKAO_SENDER_KEY || '';
  console.log('⚠️ 템플릿 정보 없음, 기본 발신프로필 사용:', pfId);
  return pfId;
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
// 연락처별 기본 변수값 반환 함수
function getContactVariables(contact: any): Record<string, string> {
  const defaultVars = getDefaultVariables();
  const contactVariables: Record<string, string> = {
    ...defaultVars,
    '고객명': contact.name || defaultVars['고객명'],
    '회사명': contact.company || defaultVars['회사명']
  };
  
  // 연락처 데이터에서 변수 매핑
  if (contact.data) {
    Object.entries(contact.data).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        contactVariables[key] = String(value);
      }
    });
  }
  
  return contactVariables;
}

// 기본 변수값 반환 함수
function getDefaultVariables(): Record<string, string> {
  return {
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
}

// 개인화된 메시지에서 변수 추출 함수
function extractVariablesFromPersonalization(
  originalTemplate: string,
  personalizedContent: string,
  targetData: any
): Record<string, string> {
  const variables: Record<string, string> = {};
  
  // 템플릿에서 변수 패턴 찾기 (#{변수명})
  const variablePattern = /#{([^}]+)}/g;
  let match;
  
  while ((match = variablePattern.exec(originalTemplate)) !== null) {
    const variableName = match[1];
    
    // 타겟 데이터에서 해당 변수값 찾기
    let value = targetData[variableName];
    
    if (value !== undefined && value !== null) {
      variables[variableName] = String(value);
    } else {
      // 기본값 설정
      const defaultVars = getDefaultVariables();
      variables[variableName] = defaultVars[variableName] || `[${variableName}]`;
    }
  }
  
  return variables;
}

// 실제 타겟 그룹에서 연락처 조회
async function getContactsFromTargetGroups(targetGroups: any[]): Promise<Array<{
  name: string;
  phone: string;
  company?: string;
  data: any;
}>> {
  const allContacts: Array<{
    name: string;
    phone: string;
    company?: string;
    data: any;
  }> = [];

  for (const group of targetGroups) {
    try {
      console.log(`🔍 그룹 "${group.name}" 연락처 조회 시작:`, {
        id: group.id,
        type: group.type,
        hasDynamicQuery: !!group.dynamicQuery
      });

      // 동적 쿼리만 처리 (정적 그룹은 제외)
      if (group.type !== 'dynamic' || !group.dynamicQuery?.sql) {
        console.log(`⏭️ 그룹 "${group.name}"은 동적 쿼리가 아니므로 건너뜀`);
        continue;
      }

      // MySQL 연결
      const connection = await mysql.createConnection(dbConfig);
      
      try {
        // 동적 쿼리 실행하여 실제 연락처 데이터 가져오기
        let cleanQuery = group.dynamicQuery.sql.trim();
        if (cleanQuery.endsWith(';')) {
          cleanQuery = cleanQuery.slice(0, -1);
        }
        
        console.log(`📊 쿼리 실행:`, { 
          groupName: group.name,
          query: cleanQuery
        });
        
        const [rows] = await connection.execute(cleanQuery);
        const contacts = rows as any[];

        console.log(`📋 쿼리 결과:`, {
          groupName: group.name,
          rowsCount: contacts?.length || 0,
          sampleFields: contacts?.[0] ? Object.keys(contacts[0]) : []
        });

        if (!contacts || contacts.length === 0) {
          console.log(`❌ 그룹 "${group.name}"에서 조회된 연락처가 없음`);
          continue;
        }

        // 연락처 데이터 매핑
        for (const contact of contacts) {
          const mappedContact = {
            name: String(contact.name || contact.companyName || contact.title || contact.company || contact.advertiser || '이름 없음'),
            phone: String(contact.contacts || contact.phone || contact.phoneNumber || contact.mobile || contact.tel || contact.contact || '번호 없음'),
            company: contact.company || contact.companyName || contact.advertiser || contact.business,
            data: contact
          };

          // 전화번호가 있는 경우만 추가
          if (mappedContact.phone && mappedContact.phone !== '번호 없음' && mappedContact.phone !== '') {
            allContacts.push(mappedContact);
            console.log(`✅ 연락처 추가: ${mappedContact.name} (${mappedContact.phone})`);
          } else {
            console.log(`⚠️ 전화번호 없어서 제외: ${mappedContact.name} - 확인된 필드: ${Object.keys(contact).join(', ')}`);
          }
        }

        console.log(`✅ 그룹 "${group.name}"에서 ${contacts.length}개 연락처 중 ${allContacts.length}개 유효 연락처 추가`);

      } finally {
        await connection.end();
      }

    } catch (groupError) {
      console.error(`❌ 그룹 "${group.name}" 처리 중 오류:`, groupError);
      continue;
    }
  }

  console.log(`🎯 전체 조회된 연락처: ${allContacts.length}개`);
  return allContacts;
}

