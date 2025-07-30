/**
 * 📱 메시징 서비스 설정 중앙 관리
 * 
 * SMS, 카카오 알림톡 관련 모든 환경변수와 설정을 한 곳에서 관리합니다.
 */

// 🔧 COOLSMS API 설정
export const COOLSMS_CONFIG = {
  apiKey: process.env.COOLSMS_API_KEY,
  apiSecret: process.env.COOLSMS_API_SECRET,
  sender: process.env.COOLSMS_SENDER,
  isConfigured: !!(process.env.COOLSMS_API_KEY && process.env.COOLSMS_API_SECRET),
} as const;

// 📞 SMS 발송 설정
export const SMS_CONFIG = {
  senderNumber: process.env.SMS_SENDER_NUMBER || '18007710',
  defaultSender: '01041513771',
  isTestMode: process.env.NODE_ENV !== 'production' || process.env.TEST_MODE === 'true',
} as const;

// 💬 카카오 알림톡 설정
export const KAKAO_CONFIG = {
  senderKey: process.env.KAKAO_SENDER_KEY,
  isConfigured: !!process.env.KAKAO_SENDER_KEY,
} as const;

// 🧪 테스트 설정
export const TEST_CONFIG = {
  phoneNumber: process.env.TEST_PHONE_NUMBER,
  isTestMode: process.env.NODE_ENV !== 'production' || process.env.TEST_MODE === 'true',
  enableRealSending: process.env.ENABLE_REAL_SENDING === 'true',
} as const;

// 🔍 설정 검증 헬퍼
export const validateMessagingConfig = () => {
  const issues: string[] = [];
  
  if (!COOLSMS_CONFIG.isConfigured) {
    issues.push('COOLSMS API 설정이 누락되었습니다. (COOLSMS_API_KEY, COOLSMS_API_SECRET)');
  }
  
  if (!KAKAO_CONFIG.isConfigured) {
    issues.push('카카오 알림톡 설정이 누락되었습니다. (KAKAO_SENDER_KEY)');
  }
  
  if (!TEST_CONFIG.phoneNumber && TEST_CONFIG.isTestMode) {
    issues.push('테스트 모드에서 TEST_PHONE_NUMBER가 설정되지 않았습니다.');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    summary: {
      coolsms: COOLSMS_CONFIG.isConfigured,
      kakao: KAKAO_CONFIG.isConfigured,
      testMode: TEST_CONFIG.isTestMode,
      hasTestPhone: !!TEST_CONFIG.phoneNumber,
    }
  };
};

// 📋 전체 메시징 설정 요약
export const getMessagingConfigSummary = () => {
  return {
    coolsms: {
      configured: COOLSMS_CONFIG.isConfigured,
      hasApiKey: !!COOLSMS_CONFIG.apiKey,
      hasApiSecret: !!COOLSMS_CONFIG.apiSecret,
      hasSender: !!COOLSMS_CONFIG.sender,
    },
    sms: {
      senderNumber: SMS_CONFIG.senderNumber,
      defaultSender: SMS_CONFIG.defaultSender,
      testMode: SMS_CONFIG.isTestMode,
    },
    kakao: {
      configured: KAKAO_CONFIG.isConfigured,
      hasSenderKey: !!KAKAO_CONFIG.senderKey,
    },
    test: {
      testMode: TEST_CONFIG.isTestMode,
      hasTestPhone: !!TEST_CONFIG.phoneNumber,
      enableRealSending: TEST_CONFIG.enableRealSending,
    },
    validation: validateMessagingConfig(),
  };
};

// 🚀 개발용 로깅
if (process.env.NODE_ENV === 'development') {
  console.log('📱 메시징 설정 로드됨:', getMessagingConfigSummary());
} 