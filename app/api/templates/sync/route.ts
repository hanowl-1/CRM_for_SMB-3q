import { NextRequest, NextResponse } from 'next/server'
import { TemplateSyncService } from '@/lib/services/template-sync'

export async function POST(request: NextRequest) {
  try {
    // 수동 동기화 실행
    const result = await TemplateSyncService.performFullSync()
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Templates synced successfully',
      data: {
        totalFetched: result.totalFetched,
        approvedCount: result.approvedCount,
        syncedCount: result.syncedCount
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