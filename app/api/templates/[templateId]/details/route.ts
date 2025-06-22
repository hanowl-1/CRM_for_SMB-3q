import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// CoolSMS API 인증 헤더 생성
function generateAuthHeaders() {
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    throw new Error('CoolSMS API 키가 설정되지 않았습니다.');
  }

  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex');

  return {
    'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
    'Content-Type': 'application/json'
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;

    // CoolSMS API v2로 템플릿 상세 정보 조회 (pfId 파라미터 제거)
    const authHeaders = generateAuthHeaders();
    const response = await fetch(
      `https://api.solapi.com/kakao/v2/templates/${templateId}`,
      {
        method: 'GET',
        headers: authHeaders
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ CoolSMS API 오류:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      return NextResponse.json({
        success: false,
        error: `CoolSMS API 오류: ${response.status} ${response.statusText}`,
        details: errorData
      }, { status: response.status });
    }

    const templateData = await response.json();
    console.log('✅ CoolSMS API 응답:', templateData);

    // 템플릿 상세 정보 파싱 (v2 API 응답 구조에 맞게 수정)
    const templateDetails = {
      templateId: templateData.templateId,
      name: templateData.name,
      content: templateData.content,
      status: templateData.status,
      categoryCode: templateData.categoryCode,
      
      // 버튼 정보 (링크 포함)
      buttons: templateData.buttons || [],
      
      // 빠른 답장
      quickReplies: templateData.quickReplies || [],
      
      // 추가 정보
      variables: templateData.variables || [],
      emphasizeType: templateData.emphasizeType,
      messageType: templateData.messageType,
      
      // 승인/거부 관련 정보
      comments: templateData.comments || [],
      dateCreated: templateData.dateCreated,
      dateUpdated: templateData.dateUpdated,
      
      // 링크 정보 요약
      linkInfo: {
        hasLinks: (templateData.buttons || []).length > 0 || (templateData.quickReplies || []).length > 0,
        buttonCount: (templateData.buttons || []).length,
        quickReplyCount: (templateData.quickReplies || []).length,
        totalLinkCount: (templateData.buttons || []).length + (templateData.quickReplies || []).length,
        linkTypes: [
          ...(templateData.buttons || []).map((btn: any) => ({
            name: btn.buttonName,
            type: btn.buttonType,
            linkMo: btn.linkMo,
            linkPc: btn.linkPc,
            linkAnd: btn.linkAnd,
            linkIos: btn.linkIos
          })),
          ...(templateData.quickReplies || []).map((qr: any) => ({
            name: qr.name,
            type: qr.linkType,
            linkMo: qr.linkMo,
            linkPc: qr.linkPc,
            linkAnd: qr.linkAnd,
            linkIos: qr.linkIos
          }))
        ]
      }
    };

    return NextResponse.json({
      success: true,
      data: templateDetails
    });

  } catch (error) {
    console.error('❌ 템플릿 상세 정보 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '템플릿 상세 정보를 가져오는 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 