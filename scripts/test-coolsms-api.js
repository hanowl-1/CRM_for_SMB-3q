const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

// HMAC 서명 생성
function generateSignature(method, uri, apiKey, apiSecret, salt, date) {
  // CoolSMS 서명 생성 규칙: method + " " + uri + "\n" + date + "\n" + salt
  const message = method + ' ' + uri + '\n' + date + '\n' + salt;
  const hmac = crypto.createHmac('sha256', apiSecret);
  hmac.update(message);
  return hmac.digest('hex');
}

async function testCoolSMSAPI() {
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  
  console.log('🔧 CoolSMS API 테스트 시작');
  console.log('API Key:', apiKey);
  console.log('API Secret:', apiSecret ? '설정됨' : '없음');
  console.log('PFID_CEO:', process.env.PFID_CEO);
  console.log('PFID_BLOGGER:', process.env.PFID_BLOGGER);
  
  if (!apiKey || !apiSecret) {
    console.error('❌ API 키가 설정되지 않았습니다!');
    return;
  }
  
  const salt = Date.now().toString();
  const date = new Date().toISOString();
  
  // 1. 계정 정보 확인
  console.log('\n📱 1. 계정 정보 확인');
  try {
    const uri = '/messages/v4/accounts/self';
    const signature = generateSignature('GET', uri, apiKey, apiSecret, salt, date);
    
    const response = await fetch(`https://api.coolsms.co.kr${uri}`, {
      method: 'GET',
      headers: {
        'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('응답 상태:', response.status);
    const data = await response.json();
    console.log('계정 정보:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('계정 정보 조회 실패:', error.message);
  }
  
  // 2. 발신프로필 목록 조회
  console.log('\n📱 2. 발신프로필 목록 조회');
  try {
    const uri = '/kakao/v2/senders';
    const signature = generateSignature('GET', uri, apiKey, apiSecret, salt, date);
    
    const response = await fetch(`https://api.coolsms.co.kr${uri}`, {
      method: 'GET',
      headers: {
        'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('응답 상태:', response.status);
    const data = await response.json();
    console.log('발신프로필:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('발신프로필 조회 실패:', error.message);
  }
  
  // 3. 템플릿 목록 조회 (v2)
  console.log('\n📱 3. 템플릿 목록 조회 (v2 API)');
  try {
    const uri = '/kakao/v2/templates';
    const signature = generateSignature('GET', uri, apiKey, apiSecret, salt, date);
    
    const response = await fetch(`https://api.coolsms.co.kr${uri}`, {
      method: 'GET',
      headers: {
        'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('응답 상태:', response.status);
    const text = await response.text();
    console.log('응답 내용:', text);
    
    try {
      const data = JSON.parse(text);
      console.log('템플릿 수:', data.templates?.length || 0);
      if (data.templates && data.templates.length > 0) {
        console.log('첫 번째 템플릿:', JSON.stringify(data.templates[0], null, 2));
      }
    } catch (e) {
      console.log('JSON 파싱 실패:', e.message);
    }
  } catch (error) {
    console.error('템플릿 조회 실패:', error.message);
  }
  
  // 4. 템플릿 목록 조회 (v1)
  console.log('\n📱 4. 템플릿 목록 조회 (v1 API)');
  try {
    const uri = '/kakao/v1/templates';
    const signature = generateSignature('GET', uri, apiKey, apiSecret, salt, date);
    
    const response = await fetch(`https://api.coolsms.co.kr${uri}`, {
      method: 'GET',
      headers: {
        'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('응답 상태:', response.status);
    const text = await response.text();
    console.log('응답 내용:', text);
  } catch (error) {
    console.error('템플릿 조회 실패:', error.message);
  }
}

testCoolSMSAPI();