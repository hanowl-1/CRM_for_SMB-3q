const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// CoolSMS API 인증을 위한 HMAC 서명 생성 (올바른 방식)
function generateSignature(method, uri, apiKey, apiSecret, salt, date) {
  // packages/kakao-alimtalk/src/utils.ts에서 확인한 올바른 서명 방식
  return crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
}

// 템플릿 내용에서 변수 추출
function extractVariables(content) {
  const regex = /#{([^}]+)}/g;
  const matches = content.matchAll(regex);
  const variables = [];
  
  for (const match of matches) {
    variables.push(`#{${match[1]}}`);
  }
  
  return [...new Set(variables)]; // 중복 제거
}

// 템플릿 번호와 제목 추출
function parseTemplateName(name) {
  const numberMatch = name.match(/^(\d+)\.\s*(.+)$/);
  if (numberMatch) {
    const templateNumber = parseInt(numberMatch[1]);
    const fullTitle = numberMatch[2];
    
    // 서비스 플랫폼 추출
    const platformMatch = fullTitle.match(/\[(슈퍼멤버스|슈퍼차트)\]/);
    const servicePlatform = platformMatch 
      ? (platformMatch[1] === '슈퍼멤버스' ? 'MEMBERS' : 'CHART')
      : 'MEMBERS'; // 기본값
    
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

async function fetchTemplatesFromCoolSMS() {
  // 환경 변수 로드
  require('dotenv').config({ path: '.env.local' });
  
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    throw new Error('CoolSMS API 키가 설정되지 않았습니다.');
  }
  
  const salt = Date.now().toString();
  const date = new Date().toISOString();
  
  // 발신프로필별로 템플릿 조회
  const pfIds = [
    { channel: 'CEO', pfId: process.env.PFID_CEO || 'KA01PF201224090944283HjX3BnWfSna' },
    { channel: 'BLOGGER', pfId: process.env.PFID_BLOGGER || 'KA01PF240827043524198kVF1UDK9zbb' }
  ];
  
  console.log('🔄 CoolSMS에서 템플릿을 가져오는 중...');
  
  const allTemplates = [];
  
  for (const { channel, pfId } of pfIds) {
    if (!pfId) continue;
    
    const uri = `/kakao/v2/templates?pfId=${pfId}&limit=100`;
    const signature = generateSignature('GET', uri, apiKey, apiSecret, salt, date);
    
    console.log(`📱 ${channel} 채널 템플릿 조회 중...`);
    
    try {
      const response = await fetch(`https://api.coolsms.co.kr${uri}`, {
        method: 'GET',
        headers: {
          'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ ${channel} 채널 API 오류:`, response.status);
        continue;
      }
      
      const data = await response.json();
      
      if (data.templates && Array.isArray(data.templates)) {
        console.log(`✅ ${channel} 채널에서 ${data.templates.length}개 템플릿 발견`);
        
        for (const template of data.templates) {
          const { templateNumber, templateTitle, servicePlatform } = parseTemplateName(template.name || '');
          const templateCode = `${servicePlatform}_${templateNumber}_${template.templateId.substring(20, 28)}`;
          
          allTemplates.push({
            ...template,
            channel,
            channelId: pfId,
            templateNumber,
            templateTitle,
            servicePlatform,
            templateCode,
            templateParams: extractVariables(template.content || '')
          });
        }
      }
    } catch (error) {
      console.error(`❌ ${channel} 채널 조회 중 오류:`, error.message);
    }
  }
  
  return allTemplates;
}

async function generateTemplateFile() {
  try {
    const templates = await fetchTemplatesFromCoolSMS();
    
    if (templates.length === 0) {
      console.log('⚠️ CoolSMS에서 템플릿을 찾을 수 없습니다.');
      return;
    }
    
    console.log(`\n📝 총 ${templates.length}개 템플릿을 파일로 생성 중...`);
    
    // 템플릿 ID를 키로 하는 객체 생성
    const templateById = {};
    
    templates.forEach(template => {
      templateById[template.templateId] = {
        servicePlatform: template.servicePlatform,
        channel: template.channel,
        channelId: template.channelId,
        templateId: template.templateId,
        content: template.content,
        templateName: template.name,
        templateNumber: template.templateNumber,
        templateTitle: template.templateTitle,
        templateParams: template.templateParams
      };
    });
    
    // 파일 내용 생성
    let fileContent = `// 이 파일은 코드 생성 스크립트에 의해 자동 생성됩니다. 직접 수정하지 마세요.
// 생성일: ${new Date().toLocaleString('ko-KR')}

export const KakaoAlimtalkTemplateById = ${JSON.stringify(templateById, null, 2)};

export const KakaoAlimtalkTemplateByNumber = Object.values(KakaoAlimtalkTemplateById).reduce((acc, template) => {
  acc[template.templateNumber] = template;
  return acc;
}, {});

export const KakaoAlimtalkTemplateByCode = Object.values(KakaoAlimtalkTemplateById).reduce((acc, template) => {
  const code = \`\${template.servicePlatform}_\${template.templateNumber}_\${template.templateId.substring(20, 28)}\`;
  acc[code] = template;
  return acc;
}, {});
`;
    
    // 파일 저장
    const outputPath = path.join(__dirname, '../lib/data/kakao-templates.ts');
    fs.writeFileSync(outputPath, fileContent, 'utf-8');
    
    console.log(`✅ ${outputPath} 파일이 성공적으로 생성되었습니다!`);
    console.log(`📊 생성된 템플릿 수: ${Object.keys(templateById).length}개`);
    
  } catch (error) {
    console.error('❌ 템플릿 파일 생성 중 오류:', error);
    process.exit(1);
  }
}

// 스크립트 실행
generateTemplateFile();