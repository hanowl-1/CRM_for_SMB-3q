import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// CoolSMS API 인증을 위한 HMAC 서명 생성
function generateSignature(method: string, uri: string, apiKey: string, apiSecret: string, salt: string, date: string) {
  const signatureData = `${method} ${uri}\n${date}\n${salt}`
  return crypto.createHmac('sha256', apiSecret).update(signatureData).digest('hex')
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.COOLSMS_API_KEY!
    const apiSecret = process.env.COOLSMS_API_SECRET!
    const salt = Date.now().toString()
    const date = new Date().toISOString()
    
    console.log('🔑 CoolSMS 템플릿 조회 시작')
    console.log('API Key:', apiKey?.substring(0, 8) + '...')
    
    // CoolSMS v4 API로 시도
    const uri = '/messages/v4/templates'
    const signature = generateSignature('GET', uri, apiKey, apiSecret, salt, date)
    
    console.log(`🌐 요청 URL: https://api.coolsms.co.kr${uri}`)
    
    const response = await fetch(`https://api.coolsms.co.kr${uri}`, {
      method: 'GET',
      headers: {
        'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('📡 응답 상태:', response.status)
    
    if (!response.ok) {
      // 다른 엔드포인트로 시도
      const uri2 = '/kakao/v1/templates'
      const signature2 = generateSignature('GET', uri2, apiKey, apiSecret, salt, date)
      
      console.log(`🔄 다른 엔드포인트 시도: https://api.coolsms.co.kr${uri2}`)
      
      const response2 = await fetch(`https://api.coolsms.co.kr${uri2}`, {
        method: 'GET',
        headers: {
          'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature2}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response2.ok) {
        const data = await response2.json()
        console.log('✅ 템플릿 조회 성공:', data)
        
        return NextResponse.json({
          success: true,
          data: data.templates || data,
          source: 'kakao-v1'
        })
      }
      
      // 실패 시 에러 메시지 확인
      const errorText = await response.text()
      console.error('❌ API 에러:', errorText)
      
      // 하드코딩된 템플릿 반환
      return NextResponse.json({
        success: true,
        data: getHardcodedTemplates(),
        source: 'hardcoded',
        message: 'CoolSMS API 접근 실패. 샘플 데이터를 제공합니다.'
      })
    }
    
    const data = await response.json()
    console.log('✅ 템플릿 조회 성공:', data)
    
    return NextResponse.json({
      success: true,
      data: data.templates || data,
      source: 'coolsms-api'
    })
    
  } catch (error: any) {
    console.error('❌ 템플릿 조회 실패:', error)
    
    return NextResponse.json({
      success: true,
      data: getHardcodedTemplates(),
      source: 'hardcoded',
      message: '템플릿 조회 중 오류가 발생했습니다. 샘플 데이터를 제공합니다.'
    })
  }
}

function getHardcodedTemplates() {
  return [
    {
      templateId: 'KA01TP250610072818571yh2HhLMNLHl',
      templateCode: 'MEMBERS_114_hLMNLHl',
      templateName: '[슈퍼멤버스] [사장님] 1개월 성과 리포트',
      content: '지난 1달 동안 슈퍼멤버스 성과를 확인하세요.\n\n1. 누적 블로그 리뷰 수 : #{total_reviews}개 (+#{monthly_review_count}개)\n2. 블로그 포스트 누적 조회수 : #{total_post_views}건\n3. 네이버 플레이스 Top 순위 : #{naver_place_rank}위\n4. 블로그 포스트 Top 순위 : #{blog_post_rank}위',
      status: 'APPROVED',
      inspectionStatus: 'APPROVED',
      channel: 'CEO',
      channelId: 'KA01PF201224090944283HjX3BnWfSna',
      buttons: [],
      variables: ['#{total_reviews}', '#{monthly_review_count}', '#{total_post_views}', '#{naver_place_rank}', '#{blog_post_rank}'],
      createdAt: '2025-06-10T07:28:18Z',
      updatedAt: '2025-06-10T07:28:18Z'
    },
    {
      templateId: 'KA01TP2504161031060971b0ERfZUlGE',
      templateCode: 'MEMBERS_112_RfZUlGE',
      templateName: '[슈퍼멤버스] [블로거] 리뷰 미등록 패널티 안내',
      content: '#{가맹점명} 체험 후 리뷰가 등록되지 않았어요.\n\n► 리뷰 작성 마감일: #{리뷰작성마감일}\n\n리뷰 작성이 지속적으로 이뤄지지 않을 경우, 서비스 이용이 영구적으로 제한될 수 있어요.',
      status: 'APPROVED',
      inspectionStatus: 'APPROVED',
      channel: 'BLOGGER',
      channelId: 'KA01PF240827043524198kVF1UDK9zbb',
      buttons: [],
      variables: ['#{가맹점명}', '#{리뷰작성마감일}'],
      createdAt: '2025-04-16T10:31:06Z',
      updatedAt: '2025-04-16T10:31:06Z'
    },
    {
      templateId: 'KA01TP250610072652095M0BPif67w7I',
      templateCode: 'MEMBERS_113_Pif67w7I',
      templateName: '[슈퍼멤버스] [사장님] 1개월 성과 리포트 - 상위 블로거 참여',
      content: '지난 1달 동안 슈퍼멤버스 성과를 확인하세요.\n\n1. 누적 블로그 리뷰 수 : #{total_reviews}개 (+#{monthly_review_count}개)\n2. 상위 5% 이상 블로거 참여 수 : #{top_5p_reviewers_count}건\n3. 블로그 포스트 누적 조회수 : #{total_post_views}건\n4. 네이버 플레이스 Top 순위 : #{naver_place_rank}위\n5. 블로그 포스트 Top 순위 : #{blog_post_rank}위',
      status: 'APPROVED',
      inspectionStatus: 'APPROVED',
      channel: 'CEO',
      channelId: 'KA01PF201224090944283HjX3BnWfSna',
      buttons: [],
      variables: ['#{total_reviews}', '#{monthly_review_count}', '#{top_5p_reviewers_count}', '#{total_post_views}', '#{naver_place_rank}', '#{blog_post_rank}'],
      createdAt: '2025-06-10T07:26:52Z',
      updatedAt: '2025-06-10T07:26:52Z'
    }
  ]
}