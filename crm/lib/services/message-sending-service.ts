/**
 * 📱 메시지 발송 서비스
 * 
 * SMS와 카카오 알림톡 발송을 통합 관리합니다.
 * - CoolSMS API를 통한 실제 발송
 * - 템플릿 기반 알림톡 발송
 * - 발송 결과 로깅
 * - 실패 시 대체 발송 (알림톡 → SMS)
 */

import { COOLSMS_CONFIG, KAKAO_CONFIG, SMS_CONFIG, TEST_CONFIG } from '@/lib/config/messaging';
import { getSupabase } from '@/lib/database/supabase-client';
import { KakaoAlimtalkTemplateById } from '@/lib/data/kakao-templates';

// CoolSMS SDK 임포트
const coolsms = require('coolsms-node-sdk').default;

export interface MessageSendRequest {
  to: string;
  message: string;
  from?: string;
  templateId?: string;
  templateCode?: string;
  variables?: Record<string, string>;
  enableRealSending?: boolean;
  workflowId?: string;
  runId?: string;
}

export interface MessageSendResult {
  success: boolean;
  messageId?: string;
  messageType: 'alimtalk' | 'sms' | 'lms';
  processedMessage: string;
  error?: string;
  fallbackUsed?: boolean;
  timestamp: string;
}

/**
 * 전화번호 형식을 정규화합니다.
 */
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * 전화번호 유효성을 검증합니다.
 */
function validatePhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^01[0-9][0-9]{7,8}$/.test(normalized);
}

/**
 * 메시지 타입을 결정합니다.
 */
function determineMessageType(message: string, hasTemplate: boolean): 'alimtalk' | 'sms' | 'lms' {
  if (hasTemplate && KAKAO_CONFIG.isConfigured) {
    return 'alimtalk';
  }
  
  // SMS: 90바이트 이하 (한글 45자, 영문 90자)
  // LMS: 90바이트 초과
  const messageLength = Buffer.byteLength(message, 'utf8');
  return messageLength <= 90 ? 'sms' : 'lms';
}

/**
 * 카카오 알림톡을 발송합니다.
 */
async function sendAlimtalk(request: MessageSendRequest): Promise<MessageSendResult> {
  try {
    console.log(`📨 카카오 알림톡 발송 시작: ${request.to}`);
    
    if (!KAKAO_CONFIG.isConfigured) {
      throw new Error('카카오 알림톡이 설정되지 않았습니다.');
    }
    
    const template = request.templateId ? KakaoAlimtalkTemplateById[request.templateId] : null;
    if (!template) {
      throw new Error(`템플릿을 찾을 수 없습니다: ${request.templateId}`);
    }
    
    const messageAgent = new coolsms(COOLSMS_CONFIG.apiKey, COOLSMS_CONFIG.apiSecret);
    
    const alimtalkOptions = {
      to: normalizePhoneNumber(request.to),
      from: COOLSMS_CONFIG.sender || '01041513771',
      kakaoOptions: {
        senderKey: KAKAO_CONFIG.senderKey,
        templateCode: template.templateCode,
        message: request.message,
        variables: request.variables || {}
      }
    };
    
    console.log('📤 알림톡 발송 옵션:', {
      to: alimtalkOptions.to,
      templateCode: template.templateCode,
      messageLength: request.message.length
    });
    
    if (request.enableRealSending && !TEST_CONFIG.isTestMode) {
      const result = await messageAgent.send(alimtalkOptions);
      console.log('✅ 알림톡 발송 성공:', result);
      
      return {
        success: true,
        messageId: result.groupId || result.messageId,
        messageType: 'alimtalk',
        processedMessage: request.message,
        timestamp: new Date().toISOString()
      };
    } else {
      console.log('🧪 알림톡 테스트 모드 - 발송 시뮬레이션');
      return {
        success: true,
        messageId: `alimtalk_test_${Date.now()}`,
        messageType: 'alimtalk',
        processedMessage: request.message,
        timestamp: new Date().toISOString()
      };
    }
    
  } catch (error) {
    console.error('❌ 알림톡 발송 실패:', error);
    throw error;
  }
}

/**
 * SMS/LMS를 발송합니다.
 */
async function sendSmsLms(
  request: MessageSendRequest, 
  messageType: 'sms' | 'lms'
): Promise<MessageSendResult> {
  try {
    console.log(`📱 ${messageType.toUpperCase()} 발송 시작: ${request.to}`);
    
    if (!COOLSMS_CONFIG.isConfigured) {
      throw new Error('COOLSMS가 설정되지 않았습니다.');
    }
    
    const messageAgent = new coolsms(COOLSMS_CONFIG.apiKey, COOLSMS_CONFIG.apiSecret);
    
    const smsOptions = {
      to: normalizePhoneNumber(request.to),
      from: request.from || SMS_CONFIG.senderNumber,
      text: request.message,
      type: messageType.toUpperCase()
    };
    
    console.log('📤 SMS/LMS 발송 옵션:', {
      to: smsOptions.to,
      from: smsOptions.from,
      type: smsOptions.type,
      messageLength: request.message.length
    });
    
    if (request.enableRealSending && !TEST_CONFIG.isTestMode) {
      const result = await messageAgent.send(smsOptions);
      console.log(`✅ ${messageType.toUpperCase()} 발송 성공:`, result);
      
      return {
        success: true,
        messageId: result.groupId || result.messageId,
        messageType,
        processedMessage: request.message,
        timestamp: new Date().toISOString()
      };
    } else {
      console.log(`🧪 ${messageType.toUpperCase()} 테스트 모드 - 발송 시뮬레이션`);
      return {
        success: true,
        messageId: `${messageType}_test_${Date.now()}`,
        messageType,
        processedMessage: request.message,
        timestamp: new Date().toISOString()
      };
    }
    
  } catch (error) {
    console.error(`❌ ${messageType.toUpperCase()} 발송 실패:`, error);
    throw error;
  }
}

/**
 * 메시지를 발송합니다. (알림톡 실패 시 SMS로 자동 대체)
 */
export async function sendMessage(request: MessageSendRequest): Promise<MessageSendResult> {
  const startTime = Date.now();
  
  try {
    console.log(`\n📨 메시지 발송 요청: ${request.to}`);
    console.log(`📋 메시지 길이: ${request.message.length}자`);
    console.log(`🔧 실제 발송: ${request.enableRealSending ? '활성화' : '비활성화'}`);
    
    // 전화번호 검증
    if (!validatePhoneNumber(request.to)) {
      throw new Error('올바르지 않은 전화번호 형식입니다.');
    }
    
    // 메시지 내용 검증
    if (!request.message || request.message.trim().length === 0) {
      throw new Error('메시지 내용이 없습니다.');
    }
    
    const hasTemplate = !!(request.templateId || request.templateCode);
    const messageType = determineMessageType(request.message, hasTemplate);
    
    console.log(`📊 발송 계획: ${messageType.toUpperCase()} ${hasTemplate ? '(템플릿)' : '(일반)'}`);
    
    let result: MessageSendResult;
    
    try {
      // 1차 시도: 알림톡 (템플릿이 있는 경우)
      if (messageType === 'alimtalk') {
        result = await sendAlimtalk(request);
        console.log('✅ 알림톡 발송 완료');
      } else {
        // SMS/LMS 직접 발송
        result = await sendSmsLms(request, messageType);
        console.log(`✅ ${messageType.toUpperCase()} 발송 완료`);
      }
      
    } catch (alimtalkError) {
      // 2차 시도: 알림톡 실패 시 SMS로 대체
      if (messageType === 'alimtalk') {
        console.warn('⚠️ 알림톡 발송 실패, SMS로 대체 발송 시도...');
        console.warn('알림톡 실패 원인:', alimtalkError);
        
        const fallbackType = request.message.length > 45 ? 'lms' : 'sms';
        result = await sendSmsLms(request, fallbackType);
        result.fallbackUsed = true;
        
        console.log(`✅ 대체 ${fallbackType.toUpperCase()} 발송 완료`);
      } else {
        throw alimtalkError;
      }
    }
    
    // 발송 로그 기록
    await logMessageSend(request, result);
    
    const executionTime = Date.now() - startTime;
    console.log(`📊 발송 완료 (${executionTime}ms): ${result.messageType.toUpperCase()} ${result.success ? '성공' : '실패'}`);
    
    return result;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ 메시지 발송 실패:', error);
    
    const failResult: MessageSendResult = {
      success: false,
      messageType: 'sms',
      processedMessage: request.message,
      error: errorMsg,
      timestamp: new Date().toISOString()
    };
    
    // 실패 로그도 기록
    await logMessageSend(request, failResult);
    
    return failResult;
  }
}

/**
 * 메시지 발송 로그를 기록합니다.
 */
async function logMessageSend(
  request: MessageSendRequest,
  result: MessageSendResult
): Promise<void> {
  try {
    console.log('📝 메시지 발송 로그 기록 중...');
    
    const supabase = getSupabase();
    
    const logData = {
      workflow_id: request.workflowId,
      run_id: request.runId,
      to_phone: request.to,
      from_phone: request.from || SMS_CONFIG.senderNumber,
      message_type: result.messageType,
      message_content: request.message,
      processed_message: result.processedMessage,
      template_id: request.templateId,
      template_code: request.templateCode,
      variables: request.variables,
      status: result.success ? 'sent' : 'failed',
      message_id: result.messageId,
      error_message: result.error,
      fallback_used: result.fallbackUsed || false,
      enable_real_sending: request.enableRealSending || false,
      sent_at: result.timestamp
    };
    
    const { error } = await supabase
      .from('message_logs')
      .insert(logData);
      
    if (error) {
      console.error('❌ 메시지 로그 기록 실패:', error);
    } else {
      console.log('✅ 메시지 로그 기록 완료');
    }
    
  } catch (error) {
    console.error('❌ 메시지 로그 기록 중 오류:', error);
  }
}

/**
 * 일괄 메시지 발송을 수행합니다.
 */
export async function sendMessageBatch(
  requests: MessageSendRequest[]
): Promise<MessageSendResult[]> {
  console.log(`📨 일괄 메시지 발송 시작: ${requests.length}건`);
  
  const results: MessageSendResult[] = [];
  
  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    console.log(`📋 ${i + 1}/${requests.length} 발송 처리 중...`);
    
    try {
      const result = await sendMessage(request);
      results.push(result);
      
      // 발송 간격 조절 (API 제한 방지)
      if (i < requests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 대기
      }
      
    } catch (error) {
      console.error(`❌ ${i + 1}번째 메시지 발송 실패:`, error);
      results.push({
        success: false,
        messageType: 'sms',
        processedMessage: request.message,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  
  console.log(`✅ 일괄 발송 완료: ${successCount}/${results.length} 성공 (${failCount}건 실패)`);
  
  return results;
}

/**
 * 메시지 발송 설정을 검증합니다.
 */
export function validateMessageConfig(): { 
  isValid: boolean; 
  issues: string[]; 
  capabilities: string[] 
} {
  const issues: string[] = [];
  const capabilities: string[] = [];
  
  if (!COOLSMS_CONFIG.isConfigured) {
    issues.push('COOLSMS API 설정이 누락되었습니다.');
  } else {
    capabilities.push('SMS/LMS 발송 가능');
  }
  
  if (!KAKAO_CONFIG.isConfigured) {
    issues.push('카카오 알림톡 설정이 누락되었습니다.');
  } else {
    capabilities.push('카카오 알림톡 발송 가능');
  }
  
  if (TEST_CONFIG.isTestMode) {
    capabilities.push('테스트 모드 활성화');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    capabilities
  };
} 