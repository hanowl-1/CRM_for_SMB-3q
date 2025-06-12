import { KakaoTemplate, TemplateCategory } from '../types/template';
import { KakaoAlimtalkTemplateById, KakaoAlimtalkTemplateByNumber } from './kakao-templates';

// 실제 kakao-alimtalk 템플릿을 KakaoTemplate 형식으로 변환
export const mockTemplates: KakaoTemplate[] = Object.values(KakaoAlimtalkTemplateById).map((template, index) => {
  // 카테고리 매핑
  const getCategoryFromTemplate = (templateName: string, channel: string): string => {
    if (templateName.includes('회원가입') || templateName.includes('가입')) return '001';
    if (templateName.includes('결제') || templateName.includes('구독') || templateName.includes('취소')) return '002';
    if (templateName.includes('광고') || templateName.includes('캠페인')) return '003';
    if (templateName.includes('성과') || templateName.includes('리포트') || templateName.includes('현황')) return '004';
    if (templateName.includes('리뷰') || templateName.includes('블로거')) return '005';
    if (channel === 'CEO') return '006';
    return '007';
  };

  // 버튼 생성 (일부 템플릿에만)
  const generateButtons = (templateName: string, channel: string) => {
    const buttons = [];
    
    if (templateName.includes('회원가입') || templateName.includes('가입')) {
      buttons.push({
        name: "서비스 시작하기",
        type: "WL" as const,
        url_mobile: "https://supermembers.co.kr/start",
        url_pc: "https://supermembers.co.kr/start"
      });
    } else if (templateName.includes('광고') && channel === 'BLOGGER') {
      buttons.push({
        name: "광고 확인하기",
        type: "WL" as const,
        url_mobile: "https://superchart.co.kr/campaign",
        url_pc: "https://superchart.co.kr/campaign"
      });
    } else if (templateName.includes('성과') || templateName.includes('리포트')) {
      buttons.push({
        name: "상세 보고서 보기",
        type: "WL" as const,
        url_mobile: "https://supermembers.co.kr/report",
        url_pc: "https://supermembers.co.kr/report"
      });
    }
    
    return buttons;
  };

  return {
    id: template.templateId,
    templateCode: `${template.servicePlatform}_${template.templateNumber.toString().padStart(3, '0')}`,
    templateName: template.templateName,
    templateContent: template.content,
    templateTitle: template.templateTitle,
    block: "N",
    dormant: false,
    securityFlag: false,
    status: "A", // 모든 템플릿이 승인된 상태로 가정
    inspectionStatus: "APR",
    senderKey: template.channelId,
    categoryCode: getCategoryFromTemplate(template.templateName, template.channel),
    createDate: "2024-01-01T00:00:00Z",
    updateDate: "2024-01-01T00:00:00Z",
    channelKey: template.channel,
    variables: template.templateParams.map(param => param.replace(/#{|}/g, '')),
    buttons: generateButtons(template.templateName, template.channel),
    servicePlatform: template.servicePlatform,
    templateNumber: template.templateNumber
  };
});

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