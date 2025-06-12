import { KakaoTemplate, TemplateCategory } from '../types/template';

// 실제 kakao-alimtalk packages의 템플릿을 참조한 모크 데이터
export const mockTemplates: KakaoTemplate[] = [
  {
    id: "1",
    templateCode: "MEMBERS_001",
    templateName: "회원가입 환영 메시지",
    templateContent: "안녕하세요 #{고객명}님!\n\n#{회사명}에 가입해주셔서 감사합니다.\n\n구독 서비스를 통해 더 나은 경험을 제공해드리겠습니다.\n\n문의사항이 있으시면 언제든 연락주세요.",
    templateTitle: "회원가입 완료",
    block: "N",
    dormant: false,
    securityFlag: false,
    status: "A",
    inspectionStatus: "APR",
    senderKey: "MEMBERS_KEY",
    categoryCode: "001",
    createDate: "2024-01-15T09:00:00Z",
    updateDate: "2024-01-15T09:00:00Z",
    channelKey: "MEMBERS",
    variables: ["고객명", "회사명"],
    buttons: [
      {
        name: "서비스 시작하기",
        type: "WL",
        url_mobile: "https://example.com/start",
        url_pc: "https://example.com/start"
      }
    ]
  },
  {
    id: "2",
    templateCode: "MEMBERS_002",
    templateName: "구독 취소 안내",
    templateContent: "#{고객명}님의 구독이 취소되었습니다.\n\n취소일: #{취소일}\n구독상태: #{구독상태}\n\n언제든 다시 구독하실 수 있습니다.\n\n감사합니다.",
    templateTitle: "구독 취소 완료",
    block: "N",
    dormant: false,
    securityFlag: false,
    status: "A",
    inspectionStatus: "APR",
    senderKey: "MEMBERS_KEY",
    categoryCode: "002",
    createDate: "2024-01-16T10:30:00Z",
    updateDate: "2024-01-16T10:30:00Z",
    channelKey: "MEMBERS",
    variables: ["고객명", "취소일", "구독상태"],
    buttons: [
      {
        name: "재구독하기",
        type: "WL",
        url_mobile: "https://example.com/resubscribe",
        url_pc: "https://example.com/resubscribe"
      }
    ]
  },
  {
    id: "3",
    templateCode: "CHART_001",
    templateName: "결제 실패 알림",
    templateContent: "#{고객명}님, 결제가 실패했습니다.\n\n실패 사유: #{실패사유}\n다음 결제 시도일: #{다음결제일}\n\n결제 정보를 확인해주세요.",
    templateTitle: "결제 실패",
    block: "N",
    dormant: false,
    securityFlag: false,
    status: "A",
    inspectionStatus: "APR",
    senderKey: "CHART_KEY",
    categoryCode: "003",
    createDate: "2024-01-17T14:15:00Z",
    updateDate: "2024-01-17T14:15:00Z",
    channelKey: "CHART",
    variables: ["고객명", "실패사유", "다음결제일"],
    buttons: [
      {
        name: "결제 정보 수정",
        type: "WL",
        url_mobile: "https://example.com/payment",
        url_pc: "https://example.com/payment"
      }
    ]
  },
  {
    id: "4",
    templateCode: "CEO_001",
    templateName: "CEO 블로그 업데이트",
    templateContent: "#{고객명}님, 새로운 CEO 블로그가 업데이트되었습니다.\n\n제목: #{블로그제목}\n\n비즈니스 인사이트를 확인해보세요!",
    templateTitle: "CEO 블로그 업데이트",
    templateImageName: "ceo_blog_thumb.jpg",
    templateImageUrl: "https://example.com/images/ceo_blog_thumb.jpg",
    block: "N",
    dormant: false,
    securityFlag: false,
    status: "A",
    inspectionStatus: "APR",
    senderKey: "CEO_KEY",
    categoryCode: "004",
    createDate: "2024-01-18T16:45:00Z",
    updateDate: "2024-01-18T16:45:00Z",
    channelKey: "CEO",
    variables: ["고객명", "블로그제목"],
    buttons: [
      {
        name: "블로그 읽기",
        type: "WL",
        url_mobile: "https://example.com/blog",
        url_pc: "https://example.com/blog"
      }
    ]
  },
  {
    id: "5",
    templateCode: "BLOGGER_001",
    templateName: "블로거 콘텐츠 추천",
    templateContent: "#{고객명}님께 추천하는 콘텐츠입니다.\n\n#{콘텐츠제목}\n\n#{콘텐츠설명}\n\n지금 확인해보세요!",
    templateTitle: "추천 콘텐츠",
    block: "N",
    dormant: false,
    securityFlag: false,
    status: "R",
    inspectionStatus: "REJ",
    senderKey: "BLOGGER_KEY",
    categoryCode: "005",
    createDate: "2024-01-19T11:20:00Z",
    updateDate: "2024-01-19T11:20:00Z",
    channelKey: "BLOGGER",
    variables: ["고객명", "콘텐츠제목", "콘텐츠설명"]
  }
];

export const templateCategories: TemplateCategory[] = [
  { code: "001", name: "회원가입/환영", description: "신규 회원 가입 관련 템플릿" },
  { code: "002", name: "구독 관리", description: "구독 시작, 취소, 변경 관련 템플릿" },
  { code: "003", name: "결제/청구", description: "결제 성공, 실패, 청구 관련 템플릿" },
  { code: "004", name: "콘텐츠 알림", description: "새로운 콘텐츠 업데이트 알림" },
  { code: "005", name: "마케팅", description: "프로모션 및 마케팅 메시지" },
  { code: "006", name: "고객 지원", description: "고객 서비스 및 지원 관련 템플릿" }
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