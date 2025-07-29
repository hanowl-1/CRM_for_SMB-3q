import { NextRequest, NextResponse } from 'next/server';
import { 
  COOLSMS_CONFIG, 
  SMS_CONFIG, 
  TEST_CONFIG,
  validateMessagingConfig 
} from '@/lib/config/messaging';

// COOLSMS SDK 임포트
const coolsms = require('coolsms-node-sdk').default;

interface SMSRequest {
  to: string;
  message: string;
  from?: string;
  enableRealSending?: boolean;
  variables?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    // 안전한 JSON 파싱
    const body = await request.text();
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (parseError) {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON format', error: parseError.message },
        { status: 400 }
      );
    }
    
    const { to, message, from = SMS_CONFIG.defaultSender, enableRealSending = false, variables = {} }: SMSRequest = parsedBody;

    console.log('📱 단순 SMS 발송 요청:', {
      to,
      from,
      messageLength: message.length,
      enableRealSending,
      TEST_MODE: TEST_CONFIG.isTestMode,
      hasAPIKey: !!COOLSMS_CONFIG.apiKey,
      hasAPISecret: !!COOLSMS_CONFIG.apiSecret,
      variables: Object.keys(variables).length > 0 ? variables : '없음'
    });

    // 입력 검증
    if (!to || !message) {
      return NextResponse.json(
        { success: false, message: '수신번호와 메시지는 필수입니다.' },
        { status: 400 }
      );
    }

    // 전화번호 형식 검증 (간단한 검증)
    const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
    if (!phoneRegex.test(to.replace(/-/g, ''))) {
      return NextResponse.json(
        { success: false, message: '올바른 전화번호 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    const result = await sendSimpleSMS({
      to,
      from,
      message,
      variables,
      enableRealSending: enableRealSending && !TEST_CONFIG.isTestMode // TEST_MODE가 true면 강제로 테스트 모드
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      messageId: result.messageId,
      messageType: result.messageType,
      processedMessage: result.processedMessage,
      timestamp: new Date().toISOString(),
      testMode: TEST_CONFIG.isTestMode,
      actualSending: enableRealSending && !TEST_CONFIG.isTestMode,
      variables: variables
    });

  } catch (error) {
    console.error('SMS 발송 실패:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// 단순 SMS 발송 함수
async function sendSimpleSMS({
  to,
  from,
  message,
  variables = {},
  enableRealSending
}: {
  to: string;
  from: string;
  message: string;
  variables?: Record<string, string>;
  enableRealSending: boolean;
}) {
  // 변수 치환
  let processedMessage = message;
  if (variables && Object.keys(variables).length > 0) {
    Object.entries(variables).forEach(([key, value]) => {
      processedMessage = processedMessage.replace(new RegExp(`#{${key}}`, 'g'), value);
    });
  }

  const messageType = processedMessage.length > 90 ? 'LMS' : 'SMS';
  
  console.log('📱 SMS 발송 시도');
  console.log('발신번호:', from);
  console.log('수신번호:', to);
  console.log('메시지 타입:', messageType);
  console.log('원본 메시지:', message);
  console.log('변수:', variables);
  console.log('처리된 메시지:', processedMessage);
  console.log('메시지 길이:', processedMessage.length);
  console.log('실제 발송:', enableRealSending ? '활성화' : '비활성화');
      console.log('TEST_MODE:', TEST_CONFIG.isTestMode);
    console.log('API 키 존재:', !!COOLSMS_CONFIG.apiKey);
    console.log('API 시크릿 존재:', !!COOLSMS_CONFIG.apiSecret);

  if (!enableRealSending) {
    // 테스트 모드
    console.log('🧪 테스트 모드 - 실제 발송하지 않음');
    
    return {
      success: true,
      message: `${messageType} 발송 완료 (테스트 모드)`,
      messageId: `test_${messageType.toLowerCase()}_${Date.now()}`,
      messageType,
      processedMessage
    };
  }

  try {
    // 실제 COOLSMS API 호출
    if (!COOLSMS_CONFIG.apiKey || !COOLSMS_CONFIG.apiSecret) {
      throw new Error('COOLSMS API 키가 설정되지 않았습니다. .env.local 파일을 확인해주세요.');
    }

    console.log('🔑 COOLSMS API 초기화 중...');
    const messageService = new coolsms(COOLSMS_CONFIG.apiKey, COOLSMS_CONFIG.apiSecret);
    
    // 발신번호가 1800-7710 형태인 경우 여러 형태로 시도
    const possibleFromNumbers = [];
    
    if (from.includes('1800') || from.includes('7710')) {
      possibleFromNumbers.push(
        '18007710',
        '1800-7710', 
        '021800-7710',
        '0218007710',
        '02-1800-7710'
      );
    } else {
      possibleFromNumbers.push(from.replace(/-/g, ''));
    }
    
    console.log('🔍 시도할 발신번호 형태들:', possibleFromNumbers);
    
    let lastError = null;
    
    // 각 형태를 순서대로 시도
    for (const fromNumber of possibleFromNumbers) {
      try {
        const sendData = {
          to: to.replace(/-/g, ''),
          from: fromNumber,
          text: processedMessage, // 변수가 치환된 메시지 사용
          type: messageType
        };
        
        console.log(`📤 시도 중인 발송 데이터:`, sendData);
        
        const result = await messageService.sendOne(sendData);
        
        console.log(`✅ ${messageType} 발송 성공 (발신번호: ${fromNumber}):`, result);
        
        return {
          success: true,
          message: `${messageType} 발송 완료`,
          messageId: result.messageId || `${messageType.toLowerCase()}_${Date.now()}`,
          messageType,
          processedMessage,
          usedFromNumber: fromNumber
        };
        
      } catch (error) {
        console.log(`❌ 발신번호 ${fromNumber} 실패:`, error instanceof Error ? error.message : error);
        lastError = error;
        continue; // 다음 형태 시도
      }
    }
    
    // 모든 형태 실패
    throw lastError || new Error('모든 발신번호 형태 시도 실패');

  } catch (error) {
    console.error(`❌ ${messageType} 발송 실패:`, error);
    
    // 더 자세한 에러 정보
    let errorMessage = `${messageType} 발송 실패`;
    if (error instanceof Error) {
      if (error.message.includes('발신번호')) {
        errorMessage += `: 발신번호 문제 - COOLSMS 콘솔에서 등록된 발신번호를 확인해주세요`;
      } else {
        errorMessage += `: ${error.message}`;
      }
    }
    
    return {
      success: false,
      message: errorMessage,
      error: error instanceof Error ? error.message : String(error),
      messageType,
      processedMessage
    };
  }
} 