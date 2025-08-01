const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// CoolSMS API 자격 증명
const COOLSMS_API_KEY = "NCS58351F3F67A86";
const COOLSMS_API_SECRET = "2297F1399AC1B71E68CB517AA55984FF";

// HMAC 서명 생성
function generateSignature(apiSecret, date, salt) {
  return crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
}

// 템플릿 변수 추출
function extractVariables(content) {
  const regex = /#{([^}]+)}/g;
  const matches = content.matchAll(regex);
  const variables = [];
  
  for (const match of matches) {
    variables.push(`#{${match[1]}}`);
  }
  
  return [...new Set(variables)];
}

// 템플릿 이름 파싱
function parseTemplateName(name) {
  const numberMatch = name.match(/^(\d+)\.\s*(.+)$/);
  if (numberMatch) {
    const templateNumber = parseInt(numberMatch[1]);
    const fullTitle = numberMatch[2];
    
    // 서비스 플랫폼 추출
    const platformMatch = fullTitle.match(/\[(슈퍼멤버스|슈퍼차트)\]/);
    const servicePlatform = platformMatch 
      ? (platformMatch[1] === '슈퍼멤버스' ? 'MEMBERS' : 'CHART')
      : 'MEMBERS';
    
    // 템플릿 제목 추출 (플랫폼 태그 제거)
    const templateTitle = fullTitle.replace(/\[[^\]]*\]/g, '').trim();
    
    return {
      templateNumber,
      templateTitle,
      servicePlatform
    };
  }
  
  return {
    templateNumber: 0,
    templateTitle: name,
    servicePlatform: 'MEMBERS'
  };
}

// 채널 ID에서 채널 이름 매핑
const channelMap = {
  'KA01PF201224090944283HjX3BnWfSna': 'CEO',
  'KA01PF240827043524198kVF1UDK9zbb': 'BLOGGER'
};

async function fetchAndGenerateTemplates() {
  const date = new Date().toISOString();
  const salt = Date.now().toString();
  const signature = generateSignature(COOLSMS_API_SECRET, date, salt);
  
  console.log('🔧 CoolSMS 템플릿 조회 시작...');
  
  try {
    const response = await fetch('https://api.coolsms.co.kr/kakao/v2/templates?limit=1000', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `HMAC-SHA256 apiKey=${COOLSMS_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.templateList || data.templateList.length === 0) {
      console.log('템플릿을 찾을 수 없습니다.');
      return;
    }
    
    console.log(`✅ ${data.templateList.length}개의 템플릿을 찾았습니다!`);
    
    // 템플릿 데이터 구조 생성
    const templateById = {};
    const templateByNumber = {};
    const templateByPlatform = {
      CHART: { BLOGGER: {}, CEO: {} },
      MEMBERS: { BLOGGER: {}, CEO: {} },
    };
    
    data.templateList.forEach((template) => {
      const { templateNumber, templateTitle, servicePlatform } = parseTemplateName(template.name);
      const channel = channelMap[template.channelId] || 'CEO';
      
      const templateData = {
        servicePlatform,
        channel,
        channelId: template.channelId,
        templateId: template.templateId,
        content: template.content,
        templateName: template.name,
        templateNumber,
        templateTitle,
        templateParams: extractVariables(template.content)
      };
      
      templateById[template.templateId] = templateData;
      
      if (templateNumber > 0) {
        templateByNumber[templateNumber] = templateData;
        templateByPlatform[servicePlatform][channel][templateNumber] = templateTitle;
      }
    });
    
    // 파일 내용 생성
    let fileContent = `// 이 파일은 CoolSMS API에서 자동으로 생성됩니다. 직접 수정하지 마세요.
// 생성일: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
// 템플릿 수: ${Object.keys(templateById).length}개
// 업데이트 명령어: node scripts/generate-templates-from-api.js

export const KakaoAlimtalkTemplateById = ${JSON.stringify(templateById, null, 2)} as const;

export type KakaoAlimtalkTemplateId = keyof typeof KakaoAlimtalkTemplateById;

export const KakaoAlimtalkTemplateByNumber = ${JSON.stringify(templateByNumber, null, 2)} as const;

export type KakaoAlimtalkTemplateNumber = keyof typeof KakaoAlimtalkTemplateByNumber;

export const KakaoAlimtalkTemplateByPlatform = ${JSON.stringify(templateByPlatform, null, 2)} as const;
`;
    
    // 파일 저장
    const outputPath = path.join(process.cwd(), 'lib/data/kakao-templates.ts');
    fs.writeFileSync(outputPath, fileContent, 'utf-8');
    
    console.log(`\n✅ ${outputPath} 파일이 성공적으로 업데이트되었습니다!`);
    console.log(`📊 템플릿 통계:`);
    console.log(`   - 전체 템플릿: ${Object.keys(templateById).length}개`);
    console.log(`   - 번호가 있는 템플릿: ${Object.keys(templateByNumber).length}개`);
    console.log(`   - 최신 템플릿 번호: ${Math.max(...Object.keys(templateByNumber).map(n => parseInt(n)))}`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

// 실행
fetchAndGenerateTemplates();