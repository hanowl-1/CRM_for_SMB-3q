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
      const url = channel 
        ? `/api/templates/sync?channel=${channel}`
        : '/api/templates/sync'
        
      const response = await fetch(url)
      const result = await response.json()
      
      if (result.success) {
        setTemplates(result.data)
        
        // 선택된 템플릿이 있으면 자동 선택
        if (selectedTemplateId) {
          const template = result.data.find((t: Template) => t.template_id === selectedTemplateId)
          if (template) {
            setSelectedTemplate(template)
          }
        }
      } else {
        setError(result.error || '템플릿을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      setError('템플릿을 불러오는 중 오류가 발생했습니다.')
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  // CoolSMS에서 최신 템플릿 동기화
  const syncTemplates = async () => {
    setSyncing(true)
    setError(null)
    
    try {
      const response = await fetch('/api/templates/sync', {
        method: 'POST'
      })
      const result = await response.json()
      
      if (result.success) {
        setLastSyncTime(new Date())
        await fetchTemplates() // 동기화 후 목록 다시 불러오기
      } else {
        setError(result.error || '템플릿 동기화에 실패했습니다.')
      }
    } catch (error) {
      setError('템플릿 동기화 중 오류가 발생했습니다.')
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
      <Select
        value={selectedTemplate?.template_id}
        onValueChange={handleTemplateSelect}
        disabled={loading || templates.length === 0}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "불러오는 중..." : "템플릿을 선택하세요"} />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.template_id} value={template.template_id}>
              <div className="flex items-center gap-2">
                <span>{template.template_name}</span>
                <Badge variant="outline" className="text-xs">
                  {template.channel}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
                  {selectedTemplate.variables.map((variable) => (
                    <Badge key={variable} variant="secondary">
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