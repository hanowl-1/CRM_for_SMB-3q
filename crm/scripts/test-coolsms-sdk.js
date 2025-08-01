const coolsms = require('coolsms-node-sdk').default;
require('dotenv').config({ path: '.env.local' });

async function testCoolSMSWithSDK() {
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  
  console.log('🔧 CoolSMS SDK 테스트');
  console.log('API Key:', apiKey);
  console.log('API Secret:', apiSecret ? '설정됨' : '없음');
  
  if (!apiKey || !apiSecret) {
    console.error('❌ API 키가 설정되지 않았습니다!');
    return;
  }
  
  try {
    // SDK 초기화
    const messageService = new coolsms(apiKey, apiSecret);
    
    // SDK의 request 메서드를 직접 사용하여 템플릿 조회
    console.log('\n📱 카카오 템플릿 조회 시도...');
    
    // SDK 내부 API 호출
    const templatesResponse = await messageService.kakaoMessages.getTemplates({
      limit: 100
    });
    
    console.log('템플릿 응답:', JSON.stringify(templatesResponse, null, 2));
    
  } catch (error) {
    console.error('❌ SDK 에러:', error.message);
    console.error('에러 상세:', error);
    
    // SDK의 raw request 메서드 시도
    try {
      console.log('\n📱 Raw request 시도...');
      const messageService = new coolsms(apiKey, apiSecret);
      
      // getMessageList로 API 연결 테스트
      const messages = await messageService.getMessageList({ limit: 1 });
      console.log('메시지 목록 (API 연결 테스트):', messages);
      
    } catch (rawError) {
      console.error('❌ Raw request 에러:', rawError.message);
    }
  }
}

testCoolSMSWithSDK();