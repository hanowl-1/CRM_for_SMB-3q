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
    
    // 먼저 발신프로필 목록을 조회해봅니다
    const uri = '/kakao/v1/plus-friends'
    const signature = generateSignature('GET', uri, apiKey, apiSecret, salt, date)
    
    console.log('🔍 발신프로필 목록 조회 중...')
    
    const response = await fetch(`https://api.coolsms.co.kr${uri}`, {
      method: 'GET',
      headers: {
        'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('📡 응답 상태:', response.status)
    const data = await response.json()
    console.log('📦 발신프로필 데이터:', data)
    
    // 발신프로필이 있으면 각각의 템플릿 조회
    const allTemplates = []
    
    if (data.plusFriends && Array.isArray(data.plusFriends)) {
      for (const pf of data.plusFriends) {
        console.log(`\n🔍 ${pf.plusFriendId}의 템플릿 조회 중...`)
        
        const templateUri = `/kakao/v2/templates?pfId=${pf.plusFriendId}&limit=100`
        const templateSignature = generateSignature('GET', templateUri, apiKey, apiSecret, salt, date)
        
        const templateResponse = await fetch(`https://api.coolsms.co.kr${templateUri}`, {
          method: 'GET',
          headers: {
            'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${templateSignature}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (templateResponse.ok) {
          const templateData = await templateResponse.json()
          console.log(`✅ 템플릿 개수:`, templateData.templates?.length || 0)
          
          if (templateData.templates) {
            allTemplates.push(...templateData.templates.map((t: any) => ({
              ...t,
              channelName: pf.plusFriendName,
              channelId: pf.plusFriendId
            })))
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      plusFriends: data.plusFriends || [],
      templates: allTemplates,
      totalTemplates: allTemplates.length
    })
    
  } catch (error: any) {
    console.error('테스트 실패:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}