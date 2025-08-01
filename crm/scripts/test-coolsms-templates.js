const crypto = require('crypto');

// CoolSMS API 자격 증명 (packages/kakao-alimtalk/src/const.ts에서 가져옴)
const COOLSMS_API_KEY = "NCS58351F3F67A86";
const COOLSMS_API_SECRET = "2297F1399AC1B71E68CB517AA55984FF";

// HMAC 서명 생성 (올바른 방식)
function generateSignature(apiSecret, date, salt) {
  return crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
}

async function fetchTemplates() {
  const date = new Date().toISOString();
  const salt = Date.now().toString();
  const signature = generateSignature(COOLSMS_API_SECRET, date, salt);
  
  console.log('🔧 CoolSMS 템플릿 조회 시작');
  console.log('Date:', date);
  console.log('Salt:', salt);
  console.log('Signature:', signature.substring(0, 16) + '...');
  
  try {
    const response = await fetch('https://api.coolsms.co.kr/kakao/v2/templates?limit=1000', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `HMAC-SHA256 apiKey=${COOLSMS_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`
      }
    });
    
    console.log('응답 상태:', response.status);
    console.log('응답 헤더:', response.headers);
    
    const text = await response.text();
    console.log('응답 내용:', text);
    
    if (response.ok) {
      const data = JSON.parse(text);
      if (data.templateList && data.templateList.length > 0) {
        console.log(`\n✅ ${data.templateList.length}개의 템플릿을 찾았습니다!`);
        
        // 최신 템플릿 몇 개 출력
        console.log('\n최신 템플릿 5개:');
        data.templateList.slice(0, 5).forEach((template, index) => {
          console.log(`\n${index + 1}. ${template.name}`);
          console.log(`   ID: ${template.templateId}`);
          console.log(`   채널: ${template.channelId}`);
          console.log(`   상태: ${template.status}`);
        });
        
        // 템플릿 번호 확인
        const templateNumbers = data.templateList
          .map(t => {
            const match = t.name.match(/^(\d+)\./);
            return match ? parseInt(match[1]) : 0;
          })
          .filter(n => n > 0)
          .sort((a, b) => b - a);
        
        console.log(`\n📊 템플릿 번호 범위: ${Math.min(...templateNumbers)} ~ ${Math.max(...templateNumbers)}`);
        console.log(`최신 템플릿 번호: ${templateNumbers.slice(0, 5).join(', ')}`);
        
        return data.templateList;
      }
    }
    
    return [];
  } catch (error) {
    console.error('❌ 오류:', error);
    return [];
  }
}

// 실행
fetchTemplates();