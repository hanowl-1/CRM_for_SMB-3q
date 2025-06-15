import { KakaoTemplate, TemplateCategory } from '../types/template';
import { KakaoAlimtalkTemplateById, KakaoAlimtalkTemplateByNumber } from './kakao-templates';

// 실제 kakao-alimtalk 템플릿을 KakaoTemplate 형식으로 변환
export const mockTemplates: KakaoTemplate[] = [
  {
    id: 'template_1',
    templateCode: 'MEMBERS_001',
    templateName: '1. 월간 성과 리포트 [슈퍼멤버스]',
    templateTitle: '월간 성과 리포트',
    templateContent: `안녕하세요! #{companyName}님의 이번 달 성과를 알려드립니다.

📊 이번 달 성과
• 총 리뷰 수: #{total_reviews}개
• 월간 리뷰 수: #{monthly_review_count}개  
• 상위 5% 블로거 참여: #{top_5p_reviewers_count}명
• 총 포스트 조회수: #{total_post_views}회

🏆 순위 현황
• 네이버 플레이스 순위: #{naver_place_rank}위
• 블로그 포스트 순위: #{blog_post_rank}위

지속적인 성장을 위해 최선을 다하겠습니다!`,
    block: 'N',
    dormant: false,
    securityFlag: false,
    status: 'APPROVED',
    inspectionStatus: 'APPROVED',
    senderKey: 'CEO_CHANNEL_ID',
    categoryCode: '004',
    category: '성과 리포트',
    createDate: '2024-01-15T00:00:00Z',
    updateDate: '2024-01-15T00:00:00Z',
    channelKey: 'CEO',
    variables: ['companyName', 'total_reviews', 'monthly_review_count', 'top_5p_reviewers_count', 'total_post_views', 'naver_place_rank', 'blog_post_rank'],
    buttons: [],
    servicePlatform: 'MEMBERS',
    templateNumber: 1
  },
  {
    id: 'template_2',
    templateCode: 'MEMBERS_002',
    templateName: '2. 신규 회원 환영 메시지 [슈퍼멤버스]',
    templateTitle: '신규 회원 환영',
    templateContent: `#{companyName}님, 슈퍼멤버스에 가입해주셔서 감사합니다! 🎉

앞으로 #{companyName}님의 비즈니스 성장을 위해 최고의 서비스를 제공하겠습니다.

📞 문의사항이 있으시면 언제든 연락주세요.
연락처: #{contact}`,
    block: 'N',
    dormant: false,
    securityFlag: false,
    status: 'APPROVED',
    inspectionStatus: 'APPROVED',
    senderKey: 'CEO_CHANNEL_ID',
    categoryCode: '001',
    category: '환영 메시지',
    createDate: '2024-01-15T00:00:00Z',
    updateDate: '2024-01-15T00:00:00Z',
    channelKey: 'CEO',
    variables: ['companyName', 'contact'],
    buttons: [
      {
        name: '서비스 시작하기',
        type: 'WL',
        url_mobile: 'https://supermembers.co.kr/start',
        url_pc: 'https://supermembers.co.kr/start'
      }
    ],
    servicePlatform: 'MEMBERS',
    templateNumber: 2
  },
  {
    id: 'template_3',
    templateCode: 'MEMBERS_003',
    templateName: '3. 결제 완료 안내 [슈퍼멤버스]',
    templateTitle: '결제 완료 안내',
    templateContent: `#{companyName}님의 결제가 완료되었습니다. ✅

💳 결제 정보
• 상품명: #{productName}
• 결제 금액: #{amount}원
• 결제일: #{paymentDate}
• 다음 결제일: #{nextPaymentDate}

서비스 이용에 문제가 있으시면 고객센터로 연락주세요.`,
    block: 'N',
    dormant: false,
    securityFlag: false,
    status: 'APPROVED',
    inspectionStatus: 'APPROVED',
    senderKey: 'CEO_CHANNEL_ID',
    categoryCode: '002',
    category: '결제 안내',
    createDate: '2024-01-15T00:00:00Z',
    updateDate: '2024-01-15T00:00:00Z',
    channelKey: 'CEO',
    variables: ['companyName', 'productName', 'amount', 'paymentDate', 'nextPaymentDate'],
    buttons: [],
    servicePlatform: 'MEMBERS',
    templateNumber: 3
  },
  {
    id: 'template_4',
    templateCode: 'CHART_001',
    templateName: '4. 키워드 순위 변동 알림 [슈퍼차트]',
    templateTitle: '키워드 순위 변동',
    templateContent: `#{companyName}님의 키워드 순위에 변동이 있습니다! 📈

🔍 주요 키워드 순위
• #{keyword1}: #{rank1}위 (#{rankChange1})
• #{keyword2}: #{rank2}위 (#{rankChange2})  
• #{keyword3}: #{rank3}위 (#{rankChange3})

순위 상승을 위한 맞춤 전략을 제안드리겠습니다.`,
    block: 'N',
    dormant: false,
    securityFlag: false,
    status: 'APPROVED',
    inspectionStatus: 'APPROVED',
    senderKey: 'BLOGGER_CHANNEL_ID',
    categoryCode: '005',
    category: '순위 알림',
    createDate: '2024-01-15T00:00:00Z',
    updateDate: '2024-01-15T00:00:00Z',
    channelKey: 'BLOGGER',
    variables: ['companyName', 'keyword1', 'rank1', 'rankChange1', 'keyword2', 'rank2', 'rankChange2', 'keyword3', 'rank3', 'rankChange3'],
    buttons: [
      {
        name: '상세 분석 보기',
        type: 'WL',
        url_mobile: 'https://superchart.co.kr/analysis',
        url_pc: 'https://superchart.co.kr/analysis'
      }
    ],
    servicePlatform: 'CHART',
    templateNumber: 4
  },
  {
    id: 'template_5',
    templateCode: 'MEMBERS_004',
    templateName: '5. 변수 없는 일반 메시지',
    templateTitle: '일반 안내',
    templateContent: `안녕하세요! 

이 템플릿에는 변수가 포함되어 있지 않습니다.
모든 고객에게 동일한 메시지가 발송됩니다.

감사합니다.`,
    block: 'N',
    dormant: false,
    securityFlag: false,
    status: 'APPROVED',
    inspectionStatus: 'APPROVED',
    senderKey: 'CEO_CHANNEL_ID',
    categoryCode: '007',
    category: '일반 안내',
    createDate: '2024-01-15T00:00:00Z',
    updateDate: '2024-01-15T00:00:00Z',
    channelKey: 'CEO',
    variables: [],
    buttons: [],
    servicePlatform: 'MEMBERS',
    templateNumber: 5
  }
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