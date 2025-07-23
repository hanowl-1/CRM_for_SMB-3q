'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Template {
  id: string
  template_id: string
  template_name: string
  content: string
  channel: string
  variables: string[]
  inspection_status: string
}

interface TemplateSelectorProps {
  channel?: 'CEO' | 'BLOGGER'
  onSelect: (template: Template) => void
  selectedTemplateId?: string
}

export function TemplateSelector({ channel, onSelect, selectedTemplateId }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  // 템플릿 목록 불러오기
  const fetchTemplates = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('🔄 CoolSMS 템플릿 조회 시작...')
      // 하드코딩된 템플릿 데이터 가져오기
      const response = await fetch('/api/templates/coolsms/real')
      console.log('📡 API 응답 상태:', response.status)
      
      const result = await response.json()
      console.log('📦 API 응답 데이터:', result)
      
      if (result.success && result.data) {
        // API 응답 데이터를 UI 형식으로 변환
        const formattedTemplates = result.data.map((t: any) => ({
          id: t.templateId,
          template_id: t.templateId,
          template_name: t.templateName,
          content: t.content,
          channel: t.channel,
          variables: t.variables,
          inspection_status: t.inspectionStatus
        }))
        
        console.log(`✅ ${formattedTemplates.length}개 템플릿 로드 완료`)
        setTemplates(formattedTemplates)
        
        // 선택된 템플릿이 있으면 자동 선택
        if (selectedTemplateId) {
          const template = formattedTemplates.find((t: Template) => t.template_id === selectedTemplateId)
          if (template) {
            setSelectedTemplate(template)
          }
        }
      } else {
        const errorMsg = result.error || '템플릿을 불러오는데 실패했습니다.'
        console.error('❌ 템플릿 로드 실패:', errorMsg)
        setError(errorMsg)
      }
    } catch (error) {
      const errorMsg = '템플릿을 불러오는 중 오류가 발생했습니다.'
      setError(errorMsg)
      console.error('❌ Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  // CoolSMS에서 최신 템플릿 동기화
  const syncTemplates = async () => {
    setSyncing(true)
    setError(null)
    
    try {
      // CoolSMS API에서 직접 템플릿 가져오기
      await fetchTemplates()
      setLastSyncTime(new Date())
    } catch (error) {
      console.error('Error syncing templates:', error)
    } finally {
      setSyncing(false)
    }
  }

  // 템플릿 선택 처리
  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.template_id === templateId)
    if (template) {
      setSelectedTemplate(template)
      onSelect(template)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [channel])

  return (
    <div className="space-y-4">
      {/* 동기화 버튼 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">카카오 알림톡 템플릿</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={syncTemplates}
          disabled={syncing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '동기화 중...' : 'CoolSMS 동기화'}
        </Button>
      </div>

      {lastSyncTime && (
        <p className="text-sm text-muted-foreground">
          마지막 동기화: {lastSyncTime.toLocaleString('ko-KR')}
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 템플릿 선택 드롭다운 */}
      {templates.length === 0 && !loading ? (
        <div className="p-8 text-center border-2 border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">
            템플릿이 없습니다. 동기화 버튼을 클릭해주세요.
          </p>
          <Button onClick={syncTemplates} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            템플릿 동기화
          </Button>
        </div>
      ) : (
        <Select
          value={selectedTemplate?.template_id}
          onValueChange={handleTemplateSelect}
          disabled={loading || templates.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={
              loading ? "불러오는 중..." : 
              templates.length === 0 ? "템플릿이 없습니다" : 
              "템플릿을 선택하세요"
            } />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.template_id} value={template.template_id}>
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm">{template.template_name}</span>
                  <Badge variant="outline" className="text-xs ml-2">
                    {template.channel}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 선택된 템플릿 미리보기 */}
      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selectedTemplate.template_name}</CardTitle>
            <CardDescription>
              템플릿 ID: {selectedTemplate.template_id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-1">내용</h4>
              <pre className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                {selectedTemplate.content}
              </pre>
            </div>
            
            {selectedTemplate.variables.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1">필수 변수</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.variables.map((variable, index) => (
                    <Badge key={`${selectedTemplate.template_id}-var-${index}`} variant="secondary">
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}