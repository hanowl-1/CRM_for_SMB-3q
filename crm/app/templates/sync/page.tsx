'use client'

import { useState } from 'react'
import { TemplateSelector } from '@/components/templates/template-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TemplateSyncPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            템플릿 목록으로 돌아가기
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CoolSMS 알림톡 템플릿 실시간 연동</CardTitle>
          <CardDescription>
            CoolSMS에 등록된 카카오 알림톡 템플릿을 실시간으로 조회하고 동기화할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateSelector
            onSelect={(template) => {
              setSelectedTemplate(template)
              console.log('선택된 템플릿:', template)
            }}
          />
          
          {selectedTemplate && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">선택된 템플릿 정보</h4>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(selectedTemplate, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}