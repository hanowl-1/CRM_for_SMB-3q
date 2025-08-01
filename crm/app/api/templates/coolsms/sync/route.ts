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
    
    console.log('🔑 API Key exists:', !!apiKey)
    console.log('🔒 API Secret exists:', !!apiSecret)
    
    // 발신프로필별로 템플릿 조회
    const pfIds = [
      { channel: 'CEO', pfId: process.env.PFID_CEO },
      { channel: 'BLOGGER', pfId: process.env.PFID_BLOGGER }
    ]
    
    console.log('📱 발신프로필:', pfIds)
    
    const allTemplates = []
    
    for (const { channel, pfId } of pfIds) {
      if (!pfId) continue
      
      const uri = `/kakao/v1/templates?pfId=${pfId}&limit=100`
      const signature = generateSignature('GET', uri, apiKey, apiSecret, salt, date)
      
      try {
        console.log(`🌐 요청 URL: https://api.coolsms.co.kr${uri}`)
        console.log(`🔐 인증 헤더:`, {
          apiKey: apiKey.substring(0, 8) + '...',
          date,
          salt,
          signature: signature.substring(0, 16) + '...'
        })
        
        const response = await fetch(`https://api.coolsms.co.kr${uri}`, {
          method: 'GET',
          headers: {
            'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
            'Content-Type': 'application/json'
          }
        })
        
        console.log(`📡 응답 상태 (${channel}):`, response.status)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ CoolSMS API error for ${channel}:`, response.status, errorText)
          continue
        }
        
        const data = await response.json()
        console.log(`📦 응답 데이터 (${channel}):`, data)
        
        if (data.templates) {
          const templates = data.templates.map((template: any) => ({
            templateId: template.templateId,
            templateCode: template.templateCode,
            templateName: template.templateName,
            content: template.content,
            status: template.status,
            inspectionStatus: template.inspectionStatus,
            channel: channel,
            channelId: pfId,
            buttons: template.buttons || [],
            variables: extractVariables(template.content),
            createdAt: template.createdAt,
            updatedAt: template.updatedAt
          }))
          
          allTemplates.push(...templates)
        }
      } catch (error: any) {
        console.error(`Failed to fetch templates for ${channel}:`, error.message)
      }
    }
    
    // 템플릿이 없으면 하드코딩된 샘플 데이터 제공
    if (allTemplates.length === 0) {
      console.log('⚠️ CoolSMS에서 템플릿을 찾을 수 없습니다. 샘플 데이터를 제공합니다.')
      
      // kakao-templates.ts에서 샘플 데이터 가져오기
      const sampleTemplates = [
        {
          templateId: 'KA01TP250610072818571yh2HhLMNLHl',
          templateCode: 'MEMBERS_114',
          templateName: '[슈퍼멤버스] 1개월 성과 리포트',
          content: '지난 1달 동안 슈퍼멤버스 성과를 확인하세요.\n\n1. 누적 블로그 리뷰 수 : #{total_reviews}개 (+#{monthly_review_count}개)\n2. 블로그 포스트 누적 조회수 : #{total_post_views}건\n3. 네이버 플레이스 Top 순위 : #{naver_place_rank}위\n4. 블로그 포스트 Top 순위 : #{blog_post_rank}위',
          status: 'APPROVED',
          inspectionStatus: 'APPROVED',
          channel: 'CEO',
          channelId: process.env.PFID_CEO || 'KA01PF201224090944283HjX3BnWfSna',
          buttons: [],
          variables: ['#{total_reviews}', '#{monthly_review_count}', '#{total_post_views}', '#{naver_place_rank}', '#{blog_post_rank}'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          templateId: 'KA01TP2504161031060971b0ERfZUlGE',
          templateCode: 'MEMBERS_112',
          templateName: '[슈퍼멤버스] 리뷰 미등록 패널티 안내',
          content: '#{가맹점명} 체험 후 리뷰가 등록되지 않았어요.\n\n► 리뷰 작성 마감일: #{리뷰작성마감일}\n\n리뷰 작성이 지속적으로 이뤄지지 않을 경우, 서비스 이용이 영구적으로 제한될 수 있어요.',
          status: 'APPROVED',
          inspectionStatus: 'APPROVED',
          channel: 'BLOGGER',
          channelId: process.env.PFID_BLOGGER || 'KA01PF240827043524198kVF1UDK9zbb',
          buttons: [],
          variables: ['#{가맹점명}', '#{리뷰작성마감일}'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
      
      return NextResponse.json({ 
        success: true, 
        data: sampleTemplates,
        count: sampleTemplates.length,
        message: 'CoolSMS API에서 템플릿을 찾을 수 없어 샘플 데이터를 제공합니다.'
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      data: allTemplates,
      count: allTemplates.length
    })
    
  } catch (error: any) {
    console.error('Template sync error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

// 템플릿 내용에서 변수 추출
function extractVariables(content: string): string[] {
  const regex = /#{([^}]+)}/g
  const matches = content.matchAll(regex)
  const variables = []
  
  for (const match of matches) {
    variables.push(`#{${match[1]}}`)
  }
  
  return [...new Set(variables)] // 중복 제거
}