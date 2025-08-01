import { getSupabase } from '@/lib/database/supabase-client'

export interface CoolSMSTemplate {
  templateId: string
  templateCode: string
  templateName: string
  content: string
  status: string
  inspectionStatus: string
  channel: string
  channelId: string
  buttons: any[]
  variables: string[]
  createdAt: string
  updatedAt: string
}

export class TemplateSyncService {
  // CoolSMS에서 템플릿 목록 가져오기
  static async fetchTemplatesFromCoolSMS(): Promise<CoolSMSTemplate[]> {
    try {
      // 클라이언트 사이드에서 절대 경로로 API 호출
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const response = await fetch(`${baseUrl}/api/templates/coolsms/sync`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch templates')
      }
      
      return result.data
    } catch (error) {
      console.error('Error fetching templates from CoolSMS:', error)
      throw error
    }
  }
  
  // Supabase에 템플릿 동기화
  static async syncTemplatesToDatabase(templates: CoolSMSTemplate[]) {
    const supabase = getSupabase()
    
    const { error: deleteError } = await supabase
      .from('kakao_templates')
      .delete()
      .neq('template_id', '') // 모든 기존 템플릿 삭제
    
    if (deleteError) {
      console.error('Error deleting old templates:', deleteError)
      throw deleteError
    }
    
    // 템플릿 데이터 변환
    const templateRecords = templates.map(template => ({
      template_id: template.templateId,
      template_code: template.templateCode,
      template_name: template.templateName,
      content: template.content,
      status: template.status,
      inspection_status: template.inspectionStatus,
      channel: template.channel,
      channel_id: template.channelId,
      buttons: template.buttons,
      variables: template.variables,
      coolsms_created_at: template.createdAt,
      coolsms_updated_at: template.updatedAt,
      synced_at: new Date().toISOString()
    }))
    
    const { error } = await supabase
      .from('kakao_templates')
      .insert(templateRecords)
    
    if (error) {
      console.error('Error inserting templates:', error)
      throw error
    }
    
    return templateRecords.length
  }
  
  // 전체 동기화 프로세스
  static async performFullSync() {
    try {
      console.log('Starting template sync...')
      
      // 1. CoolSMS에서 템플릿 가져오기
      const templates = await this.fetchTemplatesFromCoolSMS()
      console.log(`Fetched ${templates.length} templates from CoolSMS`)
      
      // 2. 승인된 템플릿만 필터링
      const approvedTemplates = templates.filter(
        t => t.inspectionStatus === 'APPROVED' || t.inspectionStatus === 'REG'
      )
      console.log(`Found ${approvedTemplates.length} approved templates`)
      
      // 3. 데이터베이스에 동기화
      const syncedCount = await this.syncTemplatesToDatabase(approvedTemplates)
      console.log(`Successfully synced ${syncedCount} templates to database`)
      
      return {
        success: true,
        totalFetched: templates.length,
        approvedCount: approvedTemplates.length,
        syncedCount: syncedCount
      }
    } catch (error) {
      console.error('Template sync failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  // 데이터베이스에서 템플릿 조회
  static async getTemplatesFromDatabase(channel?: string) {
    const supabase = getSupabase()
    
    let query = supabase
      .from('kakao_templates')
      .select('*')
      .order('template_name', { ascending: true })
    
    if (channel) {
      query = query.eq('channel', channel)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching templates from database:', error)
      throw error
    }
    
    return data
  }
  
  // 특정 템플릿 조회
  static async getTemplateById(templateId: string) {
    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('kakao_templates')
      .select('*')
      .eq('template_id', templateId)
      .single()
    
    if (error) {
      console.error('Error fetching template:', error)
      throw error
    }
    
    return data
  }
}