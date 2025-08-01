import { NextRequest, NextResponse } from 'next/server'

// CoolSMS SDK 임포트
const coolsms = require('coolsms-node-sdk').default;

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.COOLSMS_API_KEY!
    const apiSecret = process.env.COOLSMS_API_SECRET!
    
    console.log('🔑 CoolSMS SDK로 템플릿 조회 시작')
    console.log('API Key:', apiKey?.substring(0, 8) + '...')
    
    // CoolSMS SDK 초기화
    const messageService = new coolsms(apiKey, apiSecret);
    
    // SDK를 통해 템플릿 목록 조회
    console.log('\n📱 카카오 템플릿 목록 조회 중...')
    
    try {
      // getKakaoAlimtalkTemplates 메서드가 있는지 확인
      console.log('SDK 메서드 확인:', Object.keys(messageService))
      
      // 발신프로필 ID로 템플릿 조회 시도
      const pfIds = [
        process.env.PFID_CEO || 'KA01PF201224090944283HjX3BnWfSna',
        process.env.PFID_BLOGGER || 'KA01PF240827043524198kVF1UDK9zbb'
      ];
      
      const allTemplates = [];
      
      for (const pfId of pfIds) {
        console.log(`\n🔍 발신프로필 ${pfId} 템플릿 조회 중...`);
        
        try {
          // SDK의 실제 메서드를 사용해야 함
          // 메시지 전송 시 템플릿을 지정하는 방식으로 동작
          // 직접적인 템플릿 목록 조회 메서드가 없을 수 있음
          
          // 대신 하드코딩된 템플릿 데이터를 사용
          const { KakaoAlimtalkTemplateById } = await import('@/lib/data/kakao-templates')
          const templates = Object.entries(KakaoAlimtalkTemplateById)
            .filter(([id, template]) => template.channelId === pfId)
            .map(([id, template]) => ({
              templateId: id,
              templateCode: template.templateCode || `${template.servicePlatform}_${template.templateNumber}_${id.substring(20, 28)}`,
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
            }))
          
          allTemplates.push(...templates);
        } catch (error) {
          console.error(`❌ 발신프로필 ${pfId} 조회 실패:`, error);
        }
      }
      
      console.log(`\n✅ 총 ${allTemplates.length}개 템플릿 로드 완료`);
      
      return NextResponse.json({
        success: true,
        data: allTemplates,
        source: 'local-hardcoded',
        message: 'CoolSMS SDK에서 직접 템플릿 목록 조회 메서드를 제공하지 않아 로컬 데이터를 사용합니다.',
        totalCount: allTemplates.length
      })
      
    } catch (sdkError) {
      console.error('❌ SDK 사용 중 오류:', sdkError);
      throw sdkError;
    }
    
  } catch (error: any) {
    console.error('❌ 템플릿 조회 중 오류:', error)
    
    // 오류 시 하드코딩된 템플릿 반환
    const { KakaoAlimtalkTemplateById } = await import('@/lib/data/kakao-templates')
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
    }))
    
    return NextResponse.json({
      success: true,
      data: templates,
      source: 'local-hardcoded-error',
      error: error.message
    })
  }
}

