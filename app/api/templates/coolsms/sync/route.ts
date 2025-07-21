import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import axios from 'axios'

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
    
    // 발신프로필별로 템플릿 조회
    const pfIds = [
      { channel: 'CEO', pfId: process.env.PFID_CEO },
      { channel: 'BLOGGER', pfId: process.env.PFID_BLOGGER }
    ]
    
    const allTemplates = []
    
    for (const { channel, pfId } of pfIds) {
      if (!pfId) continue
      
      const uri = `/kakao/v1/templates?pfId=${pfId}&limit=100`
      const signature = generateSignature('GET', uri, apiKey, apiSecret, salt, date)
      
      try {
        const response = await axios.get(`https://api.coolsms.co.kr${uri}`, {
          headers: {
            'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.data.templates) {
          const templates = response.data.templates.map((template: any) => ({
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