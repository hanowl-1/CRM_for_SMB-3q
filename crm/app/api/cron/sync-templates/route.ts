import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/database/supabase-client'

// 템플릿 동기화 크론 작업
export async function GET(request: NextRequest) {
  // Vercel Cron Secret 검증
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET_TOKEN
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    console.log('🔄 카카오 알림톡 템플릿 자동 동기화 시작...')
    
    // 템플릿 데이터 가져오기
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/templates/coolsms/real`)
    const result = await response.json()
    
    if (!result.success) {
      throw new Error('템플릿 API 호출 실패')
    }
    
    console.log(`📦 ${result.data.length}개 템플릿 발견`)
    
    // Supabase에 동기화
    const supabase = getSupabase()
    
    // 기존 템플릿 삭제
    const { error: deleteError } = await supabase
      .from('kakao_templates')
      .delete()
      .neq('template_id', '') // 모든 레코드 삭제
    
    if (deleteError) {
      console.error('기존 템플릿 삭제 실패:', deleteError)
    }
    
    // 새 템플릿 삽입
    if (result.data.length > 0) {
      const templates = result.data.map((template: any) => ({
        template_id: template.templateId,
        template_code: template.templateCode,
        template_name: template.templateName,
        content: template.content,
        channel: template.channel,
        channel_id: template.channelId,
        service_platform: template.servicePlatform,
        template_number: template.templateNumber,
        template_title: template.templateTitle,
        variables: template.variables || [],
        status: template.status || 'APPROVED',
        inspection_status: template.inspectionStatus || 'APPROVED',
        buttons: template.buttons || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
      
      const { data, error: insertError } = await supabase
        .from('kakao_templates')
        .insert(templates)
        .select()
      
      if (insertError) {
        throw new Error(`템플릿 저장 실패: ${insertError.message}`)
      }
      
      console.log(`✅ ${data?.length || 0}개 템플릿 동기화 완료`)
      
      return NextResponse.json({
        success: true,
        message: `${data?.length || 0}개 템플릿이 성공적으로 동기화되었습니다.`,
        syncedAt: new Date().toISOString(),
        count: data?.length || 0
      })
    }
    
    return NextResponse.json({
      success: true,
      message: '동기화할 템플릿이 없습니다.',
      syncedAt: new Date().toISOString(),
      count: 0
    })
    
  } catch (error: any) {
    console.error('❌ 템플릿 동기화 실패:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || '템플릿 동기화 중 오류가 발생했습니다.'
      },
      { status: 500 }
    )
  }
}