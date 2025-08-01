import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// CoolSMS API 인증을 위한 HMAC 서명 생성
function generateSignature(method: string, uri: string, apiKey: string, apiSecret: string, salt: string, date: string) {
  const signatureData = `${method} ${uri}\n${date}\n${salt}`
  return crypto.createHmac('sha256', apiSecret).update(signatureData).digest('hex')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params
    const apiKey = process.env.COOLSMS_API_KEY!
    const apiSecret = process.env.COOLSMS_API_SECRET!
    const salt = Date.now().toString()
    const date = new Date().toISOString()
    
    const uri = `/kakao/v1/templates/${templateId}`
    const signature = generateSignature('GET', uri, apiKey, apiSecret, salt, date)
    
    const response = await fetch(`https://api.coolsms.co.kr${uri}`, {
      method: 'GET',
      headers: {
        'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`CoolSMS API error: ${response.status}`)
    }
    
    const template = await response.json()
    
    // 변수 추출 및 정리
    const variables = extractVariables(template.content)
    
    const templateData = {
      templateId: template.templateId,
      templateCode: template.templateCode,
      templateName: template.templateName,
      content: template.content,
      status: template.status,
      inspectionStatus: template.inspectionStatus,
      buttons: template.buttons || [],
      variables: variables,
      variableDetails: variables.map(variable => ({
        name: variable,
        required: true,
        description: getVariableDescription(variable)
      })),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }
    
    return NextResponse.json({ 
      success: true, 
      data: templateData
    })
    
  } catch (error: any) {
    console.error('Template fetch error:', error)
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

// 변수명으로부터 설명 생성 (추후 매핑 테이블로 개선 가능)
function getVariableDescription(variable: string): string {
  const descriptions: Record<string, string> = {
    '#{가맹점명}': '가맹점의 이름',
    '#{리뷰작성마감일}': '리뷰 작성 마감 날짜',
    '#{total_reviews}': '누적 블로그 리뷰 수',
    '#{monthly_review_count}': '월간 신규 리뷰 수',
    '#{total_post_views}': '블로그 포스트 누적 조회수',
    '#{naver_place_rank}': '네이버 플레이스 순위',
    '#{blog_post_rank}': '블로그 포스트 순위',
    '#{top_5p_reviewers_count}': '상위 5% 블로거 참여 수'
  }
  
  return descriptions[variable] || '사용자 정의 변수'
}