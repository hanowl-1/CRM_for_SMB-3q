import { KakaoTemplate, TemplateCategory } from '../types/template';
import { KakaoAlimtalkTemplateById, KakaoAlimtalkTemplateByNumber } from './kakao-templates';

// 카테고리 매핑 함수
function getCategoryFromTemplate(template: any): { code: string; name: string } {
  const servicePlatform = template.servicePlatform;
  const channel = template.channel;
  const templateName = template.templateName.toLowerCase();

  if (templateName.includes('성과') || templateName.includes('리포트') || templateName.includes('현황')) {
    return { code: '004', name: '성과 리포트' };
  }
  if (templateName.includes('광고') || templateName.includes('캠페인') || templateName.includes('제안')) {
    return { code: '003', name: '광고/캠페인' };
  }
  if (templateName.includes('리뷰') || templateName.includes('블로거') || templateName.includes('체험')) {
    return { code: '005', name: '리뷰/블로거' };
  }
  if (templateName.includes('결제') || templateName.includes('구독') || templateName.includes('입금')) {
    return { code: '002', name: '결제/구독' };
  }
  if (templateName.includes('가입') || templateName.includes('환영') || templateName.includes('완료')) {
    return { code: '001', name: '회원가입/환영' };
  }
  if (channel === 'CEO') {
    return { code: '006', name: 'CEO/관리' };
  }
  
  return { code: '007', name: '기타' };
}

// 기존 mockTemplates에 링크 템플릿 추가 (중복 제거)
export const mockTemplates: KakaoTemplate[] = [
  ...Object.entries(KakaoAlimtalkTemplateById).map(([templateId, template]) => {
    const category = getCategoryFromTemplate(template);
    
    // 특정 템플릿들에 버튼 정보 추가
    let buttons: any[] = [];
    
    // 114번 템플릿 - 성과 리포트에 "자세히 보기" 버튼 추가
    if (template.templateNumber === 114) {
      buttons = [
        {
          name: '자세히 보기',
          type: 'WL',
          url_mobile: 'https://supermembers.co.kr/report/114',
          url_pc: 'https://supermembers.co.kr/report/114'
        }
      ];
    }
    
    // 113번 템플릿 - 성과 리포트에 "자세히 보기" 버튼 추가
    if (template.templateNumber === 113) {
      buttons = [
        {
          name: '성과 확인하기',
          type: 'WL',
          url_mobile: 'https://supermembers.co.kr/report/113',
          url_pc: 'https://supermembers.co.kr/report/113'
        }
      ];
    }
    
    // 110번, 109번 템플릿 - 광고 제안에 "광고 수락하기" 버튼 추가
    if (template.templateNumber === 110 || template.templateNumber === 109) {
      buttons = [
        {
          name: '광고 수락하기',
          type: 'AL',
          url_mobile: 'superchart://accept-ad',
          url_pc: 'https://superchart.co.kr/accept-ad',
          scheme_android: 'superchart://accept-ad',
          scheme_ios: 'superchart://accept-ad'
        },
        {
          name: '광고 거절하기',
          type: 'AL',
          url_mobile: 'superchart://reject-ad',
          url_pc: 'https://superchart.co.kr/reject-ad',
          scheme_android: 'superchart://reject-ad',
          scheme_ios: 'superchart://reject-ad'
        }
      ];
    }
    
    // 112번, 111번 템플릿 - 리뷰 관련에 "1:1 문의하기" 버튼 추가
    if (template.templateNumber === 112 || template.templateNumber === 111) {
      buttons = [
        {
          name: '1:1 문의하기',
          type: 'WL',
          url_mobile: 'https://supermembers.co.kr/support',
          url_pc: 'https://supermembers.co.kr/support'
        }
      ];
    }
    
    // 성과 리포트 템플릿들 (103-108)에 "성과 보기" 버튼 추가
    if (template.templateNumber >= 103 && template.templateNumber <= 108) {
      buttons = [
        {
          name: '성과 보기',
          type: 'WL',
          url_mobile: `https://supermembers.co.kr/report/${template.templateNumber}`,
          url_pc: `https://supermembers.co.kr/report/${template.templateNumber}`
        }
      ];
    }

    // 결제 관련 템플릿들 (101-102)에 "서류 제출하기" 버튼 추가
    if (template.templateNumber === 101 || template.templateNumber === 102) {
      buttons = [
        {
          name: '서류 제출하기',
          type: 'WL',
          url_mobile: 'https://supermembers.co.kr/submit-documents',
          url_pc: 'https://supermembers.co.kr/submit-documents'
        }
      ];
    }

    // 중복 방지를 위해 templateId를 기본 키로 사용하고, 템플릿 코드를 고유하게 생성
    const templateCode = `${template.servicePlatform || 'UNKNOWN'}_${template.templateNumber}_${templateId.slice(-8)}`;

    return {
      id: templateId,
      templateCode: templateCode,
      templateName: template.templateName,
      templateContent: template.content,
      templateTitle: template.templateTitle || '',
      templateSubtitle: '',
      templateExtra: '',
      templateAd: '',
      templateImageName: '',
      templateImageUrl: '',
      block: 'N',
      dormant: false,
      securityFlag: false,
      status: 'A',
      inspectionStatus: 'APR',
      senderKey: template.channelId,
      buttons: buttons, // 추가된 버튼 정보
      categoryCode: category.code,
      category: category.name,
      createDate: '2024-01-15T00:00:00Z',
      updateDate: '2024-01-15T00:00:00Z',
      channelKey: template.channel,
      variables: [...template.templateParams],
      servicePlatform: template.servicePlatform || undefined,
      templateNumber: template.templateNumber
    };
  })
];

export const templateCategories: TemplateCategory[] = [
  { code: "001", name: "회원가입/환영", description: "신규 회원 가입 및 환영 메시지" },
  { code: "002", name: "결제/구독", description: "결제, 구독 관련 알림 메시지" },
  { code: "003", name: "광고/캠페인", description: "광고 및 캠페인 관련 메시지" },
  { code: "004", name: "성과/리포트", description: "성과 보고서 및 현황 알림" },
  { code: "005", name: "리뷰/블로거", description: "리뷰 및 블로거 관련 메시지" },
  { code: "006", name: "CEO/관리", description: "CEO 및 관리자 메시지" },
  { code: "007", name: "기타", description: "기타 메시지" }
];

// 템플릿에서 변수 추출 함수
export function extractVariables(content: string): string[] {
  const variableRegex = /#{([^}]+)}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = variableRegex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
}

// 템플릿 통계 계산 함수
export function calculateTemplateStats(templates: KakaoTemplate[]) {
  return {
    total: templates.length,
    approved: templates.filter(t => t.status === 'A').length,
    pending: templates.filter(t => t.inspectionStatus === 'REQ').length,
    rejected: templates.filter(t => t.status === 'R').length,
    withButtons: templates.filter(t => t.buttons && t.buttons.length > 0).length,
    withImages: templates.filter(t => t.templateImageUrl).length
  };
} 