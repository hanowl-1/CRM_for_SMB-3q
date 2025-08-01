import { NextRequest, NextResponse } from 'next/server'
import { TemplateSyncService } from '@/lib/services/template-sync'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // CoolSMS API 호출을 서버에서 직접 처리
    const apiKey = process.env.COOLSMS_API_KEY!
    const apiSecret = process.env.COOLSMS_API_SECRET!
    const salt = Date.now().toString()
    const date = new Date().toISOString()
    
    // 인증 서명 생성
    const generateSignature = (method: string, uri: string, apiKey: string, apiSecret: string, salt: string, date: string) => {
      const signatureData = `${method} ${uri}\n${date}\n${salt}`
      return crypto.createHmac('sha256', apiSecret).update(signatureData).digest('hex')
    }
    
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
        const response = await fetch(`https://api.coolsms.co.kr${uri}`, {
          method: 'GET',
          headers: {
            'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
            'Content-Type': 'application/json'
          }
        })
        
        const data = await response.json()
        
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
    
    // 승인된 템플릿만 필터링
    const approvedTemplates = allTemplates.filter(
      t => t.inspectionStatus === 'APPROVED' || t.inspectionStatus === 'REG'
    )
    
    // 데이터베이스에 동기화
    const syncedCount = await TemplateSyncService.syncTemplatesToDatabase(approvedTemplates)
    
    return NextResponse.json({
      success: true,
      message: 'Templates synced successfully',
      data: {
        totalFetched: allTemplates.length,
        approvedCount: approvedTemplates.length,
        syncedCount: syncedCount
      }
    })
  } catch (error: any) {
    console.error('Template sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to sync templates'
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

// 데이터베이스에서 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel') || undefined
    
    const templates = await TemplateSyncService.getTemplatesFromDatabase(channel)
    
    return NextResponse.json({
      success: true,
      data: templates,
      count: templates.length
    })
  } catch (error: any) {
    console.error('Template fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch templates'
    }, { status: 500 })
  }
}