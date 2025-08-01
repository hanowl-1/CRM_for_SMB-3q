const CryptoJS = require('crypto-js');
require('dotenv').config({ path: '.env.local' });

// CoolSMS API 정확한 서명 생성 (SDK 내부 방식 참고)
function getAuth(apiKey, apiSecret) {
  const salt = Date.now().toString();
  const date = (new Date()).toISOString();
  return { salt, date, apiKey, apiSecret };
}

function getHeaders(auth, method = 'GET', uri = '/messages/v4/list') {
  const hmacData = `${method} ${uri}\n${auth.date}\n${auth.salt}`;
  const signature = CryptoJS.HmacSHA256(hmacData, auth.apiSecret).toString();
  
  return {
    'Authorization': `HMAC-SHA256 apiKey=${auth.apiKey}, date=${auth.date}, salt=${auth.salt}, signature=${signature}`,
    'Content-Type': 'application/json; charset=utf-8'
  };
}

async function testCoolSMSAPI() {
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  
  console.log('🔧 CoolSMS API 테스트 시작 (crypto-js 사용)');
  console.log('API Key:', apiKey);
  console.log('API Secret:', apiSecret ? '설정됨' : '없음');
  
  if (!apiKey || !apiSecret) {
    console.error('❌ API 키가 설정되지 않았습니다!');
    return;
  }
  
  // 1. 메시지 목록 조회로 API 연결 테스트
  console.log('\n📱 1. 메시지 목록 조회 (API 연결 테스트)');
  try {
    const auth = getAuth(apiKey, apiSecret);
    const uri = '/messages/v4/list';
    const headers = getHeaders(auth, 'GET', uri);
    
    console.log('Headers:', headers);
    
    const response = await fetch(`https://api.coolsms.co.kr${uri}?limit=1`, {
      method: 'GET',
      headers: headers
    });
    
    console.log('응답 상태:', response.status);
    const data = await response.json();
    console.log('응답 데이터:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('API 호출 실패:', error.message);
  }
  
  // 2. 카카오 템플릿 조회
  console.log('\n📱 2. 카카오 템플릿 조회');
  try {
    const auth = getAuth(apiKey, apiSecret);
    const uri = '/kakao/v2/templates';
    const headers = getHeaders(auth, 'GET', uri);
    
    const response = await fetch(`https://api.coolsms.co.kr${uri}`, {
      method: 'GET',
      headers: headers
    });
    
    console.log('응답 상태:', response.status);
    const data = await response.json();
    console.log('템플릿 응답:', JSON.stringify(data, null, 2));
    
    if (data.templates) {
      console.log(`\n✅ 총 ${data.templates.length}개 템플릿 발견`);
      data.templates.forEach((template, index) => {
        console.log(`\n템플릿 ${index + 1}:`);
        console.log(`- ID: ${template.templateId}`);
        console.log(`- 이름: ${template.name}`);
        console.log(`- 상태: ${template.status}`);
        console.log(`- 내용: ${template.content?.substring(0, 50)}...`);
      });
    }
  } catch (error) {
    console.error('템플릿 조회 실패:', error.message);
  }
}

// crypto-js 설치 확인
try {
  const CryptoJS = require('crypto-js');
  console.log('✅ crypto-js 모듈 로드 성공');
  testCoolSMSAPI();
} catch (error) {
  console.error('❌ crypto-js 모듈이 없습니다. 설치가 필요합니다:');
  console.log('npm install crypto-js');
}