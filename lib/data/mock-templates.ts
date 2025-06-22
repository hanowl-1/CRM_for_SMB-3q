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

// 링크가 포함된 실제 템플릿 추가
export const templatesWithLinks: KakaoTemplate[] = [
  {
    id: 'KA01TP250403102859362zY1qeoq91hR',
    templateCode: 'MEMBERS_102',
    templateName: '102. [슈퍼멤버스] [사장님] 계좌이체 1일 전 알림',
    templateContent: `내일이 #{adname} 광고비 결제 예정일이에요!

- 결제 마감일: #{nextpaidat}
- 결제 금액: #{amount}원 (부가세 포함)
- 입금 계좌: 하나은행 182-910013-06704 (주식회사 마야크루)

입금 완료 후, 아래 링크로 사업자등록증과 입금 정보를 제출해 주세요!

확인 후 세금계산서를 발행해 드립니다.

🚨 광고가 자동 종료되지 않도록 꼭 기한 내 결제 부탁드립니다 :)

감사합니다!`,
    templateTitle: '계좌이체 1일 전 알림',
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
    senderKey: 'KA01PF201224090944283HjX3BnWfSna',
    buttons: [
      {
        name: '서류 제출하기',
        type: 'WL',
        url_mobile: 'https://example.com/submit-mobile',
        url_pc: 'https://example.com/submit-pc'
      }
    ],
    categoryCode: 'payment',
    category: '결제 안내',
    createDate: new Date().toISOString(),
    updateDate: new Date().toISOString(),
    channelKey: 'CEO',
    variables: ['#{adname}', '#{nextpaidat}', '#{amount}'],
    servicePlatform: 'MEMBERS',
    templateNumber: 102
  },
  {
    id: 'KA01TP250403102736476zXSV5piUUPI',
    templateCode: 'MEMBERS_101',
    templateName: '101. [슈퍼멤버스] [사장님] 계좌이체 3일 전 알림',
    templateContent: `#{adname} 광고비 결제 예정일 안내드립니다.

- 결제 예정일: #{nextpaidat}
- 결제 금액: #{amount}원 (부가세 포함)
- 입금 계좌: 하나은행 182-910013-06704 (주식회사 마야크루)

예정일 내 입금 후, 아래 링크로 사업자등록증과 입금 정보를 제출해 주시면 세금계산서를 발행해 드리겠습니다.

🚨 광고 노출이 중단되지 않도록 기한 내 결제 부탁드립니다 :)

감사합니다!`,
    templateTitle: '계좌이체 3일 전 알림',
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
    senderKey: 'KA01PF201224090944283HjX3BnWfSna',
    buttons: [
      {
        name: '서류 제출하기',
        type: 'WL',
        url_mobile: 'https://example.com/submit-mobile',
        url_pc: 'https://example.com/submit-pc'
      }
    ],
    categoryCode: 'payment',
    category: '결제 안내',
    createDate: new Date().toISOString(),
    updateDate: new Date().toISOString(),
    channelKey: 'CEO',
    variables: ['#{adname}', '#{nextpaidat}', '#{amount}'],
    servicePlatform: 'MEMBERS',
    templateNumber: 101
  }
];

// 기존 mockTemplates에 링크 템플릿 추가
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
    
    return {
      id: templateId,
      templateCode: `${template.servicePlatform || 'UNKNOWN'}_${template.templateNumber}`,
      templateName: template.templateName,
      templateTitle: template.templateTitle,
      templateContent: template.content,
      block: 'N',
      dormant: false,
      securityFlag: false,
      status: 'APPROVED',
      inspectionStatus: 'APPROVED',
      senderKey: template.channelId,
      categoryCode: category.code,
      category: category.name,
      createDate: '2024-01-15T00:00:00Z',
      updateDate: '2024-01-15T00:00:00Z',
      channelKey: template.channel,
      variables: [...template.templateParams],
      buttons: buttons, // 버튼 정보 추가
      servicePlatform: template.servicePlatform || undefined,
      templateNumber: template.templateNumber
    };
  }),
  ...templatesWithLinks
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