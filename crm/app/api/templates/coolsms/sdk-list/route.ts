import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const coolsms = require('coolsms-node-sdk').default;
    
    const apiKey = process.env.COOLSMS_API_KEY!
    const apiSecret = process.env.COOLSMS_API_SECRET!
    
    console.log('🔑 CoolSMS SDK로 템플릿 조회 시작')
    console.log('API Key:', apiKey?.substring(0, 8) + '...')
    
    // CoolSMS SDK 초기화
    const messageService = new coolsms(apiKey, apiSecret);
    
    // SDK에는 템플릿 조회 메서드가 없으므로, 직접 API 호출
    // 기존 하드코딩된 템플릿에서 실제 데이터 가져오기
    const { KakaoAlimtalkTemplateById } = await import('@/lib/data/kakao-templates');
    
    // 템플릿 객체를 배열로 변환
    const templates = Object.entries(KakaoAlimtalkTemplateById).map(([id, template]) => ({
      templateId: id,
      templateCode: `${template.servicePlatform}_${template.templateNumber}_${id.substring(20, 28)}`,
      templateName: template.templateName,
      content: template.content,
      status: 'APPROVED',
      inspectionStatus: 'APPROVED',
      channel: template.channel,
      channelId: template.channelId,
      buttons: [],
      variables: template.templateParams,
      servicePlatform: template.servicePlatform,
      templateNumber: template.templateNumber,
      templateTitle: template.templateTitle
    }));
    
    console.log(`✅ ${templates.length}개 템플릿 로드 완료`)
    
    return NextResponse.json({
      success: true,
      data: templates,
      source: 'local-hardcoded',
      message: '로컬 하드코딩된 템플릿 데이터를 사용합니다.'
    })
    
  } catch (error: any) {
    console.error('❌ 템플릿 조회 실패:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message || '템플릿 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}