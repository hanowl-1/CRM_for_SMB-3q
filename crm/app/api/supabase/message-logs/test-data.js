// 테스트용 메시지 로그 데이터 생성
const testMessageLogs = [
  {
    workflowId: 'wf_001',
    workflowName: '113번 템플릿 발송 워크플로우',
    messageType: 'kakao',
    recipientPhone: '01012345678',
    recipientName: '김철수',
    templateId: 'KA01TP250610072652095M0BPif67w7I',
    templateName: '113. [슈퍼멤버스] [사장님] 1개월 성과 리포트 - 상위 블로거 참여 O',
    messageContent: '[슈퍼멤버스]\n\n안녕하세요! 김철수님\n\n1개월간의 마케팅 성과를 정리해드립니다.\n\n📈 이번 달 성과\n- 총 노출수: 15,000회\n- 클릭수: 450회\n- 전환수: 23건\n\n자세한 내용은 아래 링크에서 확인하세요.',
    variables: {
      customer_name: '김철수',
      exposure_count: '15,000',
      click_count: '450',
      conversion_count: '23'
    },
    status: 'delivered',
    provider: 'coolsms',
    providerMessageId: 'msg_20250115_001',
    costAmount: 15
  },
  {
    workflowId: 'wf_001',
    workflowName: '113번 템플릿 발송 워크플로우',
    messageType: 'kakao',
    recipientPhone: '01087654321',
    recipientName: '박영희',
    templateId: 'KA01TP250610072652095M0BPif67w7I',
    templateName: '113. [슈퍼멤버스] [사장님] 1개월 성과 리포트 - 상위 블로거 참여 O',
    messageContent: '[슈퍼멤버스]\n\n안녕하세요! 박영희님\n\n1개월간의 마케팅 성과를 정리해드립니다.\n\n📈 이번 달 성과\n- 총 노출수: 8,500회\n- 클릭수: 280회\n- 전환수: 12건\n\n자세한 내용은 아래 링크에서 확인하세요.',
    variables: {
      customer_name: '박영희',
      exposure_count: '8,500',
      click_count: '280',
      conversion_count: '12'
    },
    status: 'sent',
    provider: 'coolsms',
    providerMessageId: 'msg_20250115_002',
    costAmount: 15
  },
  {
    workflowId: 'wf_002',
    workflowName: '114번 템플릿 발송 워크플로우',
    messageType: 'kakao',
    recipientPhone: '01055556666',
    recipientName: '이민수',
    templateId: 'KA01TP250610072818571yh2HhLMNLHl',
    templateName: '114. [슈퍼멤버스] [사장님] 1개월 성과 리포트 - 상위 블로거 참여 X',
    messageContent: '[슈퍼멤버스]\n\n안녕하세요! 이민수님\n\n1개월간의 마케팅 성과를 정리해드립니다.\n\n📈 이번 달 성과\n- 총 노출수: 12,000회\n- 클릭수: 320회\n- 전환수: 18건',
    variables: {
      customer_name: '이민수',
      exposure_count: '12,000',
      click_count: '320',
      conversion_count: '18'
    },
    status: 'failed',
    provider: 'coolsms',
    errorMessage: '수신거부 번호',
    costAmount: 0
  },
  {
    workflowId: 'wf_001',
    workflowName: '113번 템플릿 발송 워크플로우',
    messageType: 'kakao',
    recipientPhone: '01099998888',
    recipientName: '최수진',
    templateId: 'KA01TP250610072652095M0BPif67w7I',
    templateName: '113. [슈퍼멤버스] [사장님] 1개월 성과 리포트 - 상위 블로거 참여 O',
    messageContent: '[슈퍼멤버스]\n\n안녕하세요! 최수진님\n\n1개월간의 마케팅 성과를 정리해드립니다.\n\n📈 이번 달 성과\n- 총 노출수: 22,000회\n- 클릭수: 650회\n- 전환수: 35건\n\n자세한 내용은 아래 링크에서 확인하세요.',
    variables: {
      customer_name: '최수진',
      exposure_count: '22,000',
      click_count: '650',
      conversion_count: '35'
    },
    status: 'pending',
    provider: 'coolsms',
    costAmount: 15
  }
];

// 테스트 데이터 생성 함수
export async function createTestMessageLogs() {
  try {
    const response = await fetch('/api/supabase/message-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'bulk_create',
        logs: testMessageLogs
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ ${result.count}개 테스트 메시지 로그 생성 완료`);
      return result;
    } else {
      console.error('❌ 테스트 메시지 로그 생성 실패:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ 테스트 메시지 로그 생성 오류:', error);
    return null;
  }
}

export { testMessageLogs }; 