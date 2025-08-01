'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Eye, 
  Send, 
  Settings, 
  Lightbulb,
  Copy,
  Download,
  Upload,
  Search,
  BookOpen,
  Zap,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react'

interface TemplateVariable {
  name: string
  description: string
  example: string
  required: boolean
}

interface TemplateData {
  name: string
  title: string
  content: string
  category: string
  channel: string
  variables: TemplateVariable[]
  buttons: Array<{
    name: string
    type: 'WL' | 'AL' | 'DS' | 'BK' | 'MD'
    url?: string
    schemeIos?: string
    schemeAndroid?: string
  }>
}

// 기존 템플릿에서 사용되는 모든 변수들 (총 104개)
const allTemplateVariables = [
  { name: 'adName', description: '광고명', example: '슈퍼멤버스 프리미엄', category: 'CEO' },
  { name: 'adname', description: '광고명', example: '슈퍼멤버스 프리미엄', category: 'CEO' },
  { name: 'adsStart', description: '광고 시작일', example: '2024-06-01', category: 'CEO' },
  { name: 'amount', description: '금액', example: '50,000원', category: 'CEO' },
  { name: 'blog_post_rank', description: '블로그 포스트 순위', example: '2', category: 'CEO' },
  { name: 'companyId', description: '회사 ID', example: 'COMP_001', category: 'CEO' },
  { name: 'failReason', description: '실패 사유', example: '카드 한도 초과', category: 'CEO' },
  { name: 'keyword1', description: '키워드 1', example: '강남 맛집', category: 'CEO' },
  { name: 'keyword2', description: '키워드 2', example: '한식당', category: 'CEO' },
  { name: 'keyword3', description: '키워드 3', example: '점심 맛집', category: 'CEO' },
  { name: 'keyword4', description: '키워드 4', example: '저녁 맛집', category: 'CEO' },
  { name: 'keyword5', description: '키워드 5', example: '회식 장소', category: 'CEO' },
  { name: 'keywordrank1', description: '키워드 순위 1', example: '강남 맛집 - 1위', category: 'CEO' },
  { name: 'keywordrank2', description: '키워드 순위 2', example: '한식당 추천 - 3위', category: 'CEO' },
  { name: 'keywordrank3', description: '키워드 순위 3', example: '점심 맛집 - 5위', category: 'CEO' },
  { name: 'keywordrank4', description: '키워드 순위 4', example: '저녁 맛집 - 7위', category: 'CEO' },
  { name: 'keywordrank5', description: '키워드 순위 5', example: '회식 장소 - 9위', category: 'CEO' },
  { name: 'monthly_review_count', description: '월간 리뷰 수', example: '25', category: 'CEO' },
  { name: 'naver_place_rank', description: '네이버 플레이스 순위', example: '3', category: 'CEO' },
  { name: 'nextpaidat', description: '다음 결제일', example: '2024-07-01', category: 'CEO' },
  { name: 'paymentAmount', description: '결제 금액', example: '99,000원', category: 'CEO' },
  { name: 'placekeyword1', description: '플레이스 키워드 1', example: '강남역 한식', category: 'CEO' },
  { name: 'placekeyword2', description: '플레이스 키워드 2', example: '점심식사', category: 'CEO' },
  { name: 'placekeyword3', description: '플레이스 키워드 3', example: '회식장소', category: 'CEO' },
  { name: 'placekeywordrank1', description: '플레이스 키워드 순위 1', example: '강남역 한식 - 2위', category: 'CEO' },
  { name: 'placekeywordrank2', description: '플레이스 키워드 순위 2', example: '점심식사 - 4위', category: 'CEO' },
  { name: 'placekeywordrank3', description: '플레이스 키워드 순위 3', example: '회식장소 - 6위', category: 'CEO' },
  { name: 'placerank1', description: '플레이스 순위 1', example: '1위', category: 'CEO' },
  { name: 'placerank2', description: '플레이스 순위 2', example: '3위', category: 'CEO' },
  { name: 'placerank3', description: '플레이스 순위 3', example: '5위', category: 'CEO' },
  { name: 'rank1', description: '순위 1', example: '1위', category: 'CEO' },
  { name: 'rank2', description: '순위 2', example: '2위', category: 'CEO' },
  { name: 'rank3', description: '순위 3', example: '3위', category: 'CEO' },
  { name: 'rank4', description: '순위 4', example: '4위', category: 'CEO' },
  { name: 'rank5', description: '순위 5', example: '5위', category: 'CEO' },
  { name: 'rankingchanges1', description: '순위 변화 1', example: '↑2', category: 'CEO' },
  { name: 'rankingchanges2', description: '순위 변화 2', example: '↓1', category: 'CEO' },
  { name: 'rankingchanges3', description: '순위 변화 3', example: '→', category: 'CEO' },
  { name: 'recentorder', description: '최근 주문 개월 수', example: '6', category: 'CEO' },
  { name: 'reviewcountchanges', description: '리뷰 수 변화', example: '+15', category: 'CEO' },
  { name: 'reviewers', description: '리뷰어 수', example: '127', category: 'CEO' },
  { name: 'reviews', description: '리뷰 수', example: '150', category: 'CEO' },
  { name: 'top_5p_reviewers_count', description: '상위 5% 블로거 참여 수', example: '8', category: 'CEO' },
  { name: 'topplacerank', description: '최고 플레이스 순위', example: '1위', category: 'CEO' },
  { name: 'toppostingrank', description: '최고 포스팅 순위', example: '1위', category: 'CEO' },
  { name: 'total_post_views', description: '총 포스트 조회수', example: '12,500', category: 'CEO' },
  { name: 'total_reviews', description: '총 리뷰 수', example: '150', category: 'CEO' },
  { name: 'views', description: '블로그 포스트 조회수', example: '3,240', category: 'CEO' },
  { name: '결제금액', description: '결제금액', example: '99,000원', category: 'CEO' },
  { name: '결제수단', description: '결제수단', example: '신용카드', category: 'CEO' },
  { name: '결제실패일', description: '결제실패일', example: '2024-06-15', category: 'CEO' },
  { name: '결제일', description: '결제일', example: '2024-06-01', category: 'CEO' },
  { name: '광고기간', description: '광고기간', example: '1개월', category: 'CEO' },
  { name: '광고상품', description: '광고상품', example: '슈퍼멤버스 프리미엄', category: 'CEO' },
  { name: '광고제안결과안내', description: '광고제안결과안내', example: '승인됨', category: 'CEO' },
  { name: '노출키워드개수', description: '노출키워드개수', example: '15개', category: 'CEO' },
  { name: '다음결제예정일', description: '다음결제예정일', example: '2024-07-01', category: 'CEO' },
  { name: '리뷰마감일', description: '리뷰마감일', example: '2024-06-30', category: 'CEO' },
  { name: '발송처리필요인원', description: '발송처리필요인원', example: '25명', category: 'CEO' },
  { name: '블로거아이디', description: '블로거아이디', example: 'blogger123', category: 'CEO' },
  { name: '선정 기간', description: '선정 기간', example: '2024-06-01 ~ 2024-06-07', category: 'CEO' },
  { name: '선정마감일', description: '선정마감일', example: '2024-06-07', category: 'CEO' },
  { name: '선정시작일', description: '선정시작일', example: '2024-06-01', category: 'CEO' },
  { name: '신청 기간', description: '신청 기간', example: '2024-05-25 ~ 2024-05-31', category: 'CEO' },
  { name: '신청마감일', description: '신청마감일', example: '2024-05-31', category: 'CEO' },
  { name: '신청시작일', description: '신청시작일', example: '2024-05-25', category: 'CEO' },
  { name: '원고검수필요건수', description: '원고검수필요건수', example: '3건', category: 'CEO' },
  { name: '이용확인처리코드', description: '이용확인처리코드', example: 'CONF_001', category: 'CEO' },
  { name: '자동제안명', description: '자동제안명', example: '맛집 리뷰 캠페인', category: 'CEO' },
  { name: '적립처리필요인원', description: '적립처리필요인원', example: '12명', category: 'CEO' },
  { name: '제품구매링크', description: '제품구매링크', example: 'https://example.com/product', category: 'CEO' },
  { name: '종료예정일', description: '종료예정일', example: '2024-06-30', category: 'CEO' },
  { name: '총수락건수', description: '총수락건수', example: '45건', category: 'CEO' },
  { name: '총제안건수', description: '총제안건수', example: '50건', category: 'CEO' },
  { name: '최소보장인원', description: '최소보장인원', example: '10명', category: 'CEO' },
  { name: '키워드', description: '키워드', example: '강남 맛집', category: 'CEO' },
  { name: '키워드1', description: '키워드1', example: '강남 맛집', category: 'CEO' },
  { name: '키워드1 n위', description: '키워드1 순위', example: '강남 맛집 1위', category: 'CEO' },
  { name: '키워드2', description: '키워드2', example: '한식당', category: 'CEO' },
  { name: '키워드2 n위', description: '키워드2 순위', example: '한식당 3위', category: 'CEO' },
  { name: '키워드3', description: '키워드3', example: '점심 맛집', category: 'CEO' },
  { name: '키워드3 n위', description: '키워드3 순위', example: '점심 맛집 5위', category: 'CEO' },
  { name: '키워드순위', description: '키워드순위', example: '1위', category: 'CEO' },
  { name: '현재이용인원', description: '현재이용인원', example: '127명', category: 'CEO' },
  { name: '회원명', description: '회원명', example: '김사장', category: 'CEO' },
  { name: 'id', description: '캠페인 ID', example: 'CAMP_001', category: 'BLOGGER' },
  { name: 'inquiryId', description: '문의 ID', example: 'INQ_001', category: 'BLOGGER' },
  { name: 'url', description: 'URL', example: 'https://example.com', category: 'BLOGGER' },
  { name: '리뷰등록마감일', description: '리뷰등록마감일', example: '2024-06-20', category: 'BLOGGER' },
  { name: '리뷰작성마감일', description: '리뷰 작성 마감일', example: '2024-06-15', category: 'BLOGGER' },
  { name: '마감날짜-현재날짜', description: '마감까지 남은 일수', example: '3일', category: 'BLOGGER' },
  { name: '이름', description: '이름', example: '김블로거', category: 'BLOGGER' },
  { name: '3일 후_오늘', description: '3일 후 날짜', example: '2024-06-18', category: 'COMMON' },
  { name: '3일후_내일', description: '3일 후 내일', example: '2024-06-19', category: 'COMMON' },
  { name: 'adId', description: '광고 ID', example: 'AD_001', category: 'COMMON' },
  { name: '가맹점명', description: '가맹점 이름', example: '맛있는 한식당', category: 'COMMON' },
  { name: '내일_오늘', description: '내일 날짜', example: '2024-06-16', category: 'COMMON' },
  { name: '등록기한초과일수', description: '등록기한초과일수', example: '2일', category: 'COMMON' },
  { name: '리뷰등록기한초과일수', description: '리뷰등록기한초과일수', example: '1일', category: 'COMMON' },
  { name: '링크수정사유', description: '링크수정사유', example: '잘못된 URL', category: 'COMMON' },
  { name: '방문기한초과일수', description: '방문기한초과일수', example: '3일', category: 'COMMON' },
  { name: '제공항목', description: '제공 항목', example: '메인메뉴 1개 + 사이드 1개', category: 'COMMON' },
  { name: '추가제공포인트', description: '추가 제공 포인트', example: '5,000P', category: 'COMMON' },
  { name: '캠페인명', description: '캠페인 이름', example: '신메뉴 체험단', category: 'COMMON' }
];

export default function TemplateBuilderPage() {
  const router = useRouter()
  const [template, setTemplate] = useState<TemplateData>({
    name: '',
    title: '',
    content: '',
    category: 'MEMBERS',
    channel: 'CEO',
    variables: [],
    buttons: []
  })

  const [previewData, setPreviewData] = useState<Record<string, string>>({})
  const [showVariableHelper, setShowVariableHelper] = useState(true)
  const [variableSearch, setVariableSearch] = useState('')

  // 현재 채널에 맞는 변수들 필터링
  const filteredVariables = allTemplateVariables.filter(variable => 
    (variable.category === template.channel || variable.category === 'COMMON') &&
    variable.name.toLowerCase().includes(variableSearch.toLowerCase())
  )

  // 템플릿 내용에서 변수 자동 감지
  const detectVariables = useCallback((content: string) => {
    const variableRegex = /#{([^}]+)}/g
    const matches = content.match(variableRegex) || []
    const uniqueVariables = [...new Set(matches)]
    
    return uniqueVariables.map(variable => {
      const name = variable.replace(/#{|}/g, '')
      const existing = template.variables.find(v => v.name === name)
      
      // 기존 변수 정보가 있으면 사용
      if (existing) {
        return existing
      }
      
      // 공통 변수에서 찾기
      const commonVar = allTemplateVariables.find(v => v.name === name)
      if (commonVar) {
        return {
          name,
          description: commonVar.description,
          example: commonVar.example,
          required: true
        }
      }
      
      return {
        name,
        description: '',
        example: '',
        required: true
      }
    })
  }, [template.variables])

  // 템플릿 내용 변경 시 변수 자동 업데이트
  const handleContentChange = (content: string) => {
    setTemplate(prev => ({
      ...prev,
      content,
      variables: detectVariables(content)
    }))
  }

  // 변수 설정 업데이트
  const updateVariable = (index: number, field: keyof TemplateVariable, value: string | boolean) => {
    setTemplate(prev => ({
      ...prev,
      variables: prev.variables.map((variable, i) => 
        i === index ? { ...variable, [field]: value } : variable
      )
    }))
  }

  // 변수 삽입 함수
  const insertVariable = (variableName: string) => {
    const variableText = `#{${variableName}}`
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const currentContent = template.content
      const newContent = currentContent.substring(0, start) + variableText + currentContent.substring(end)
      
      handleContentChange(newContent)
      
      // 커서 위치 조정
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variableText.length, start + variableText.length)
      }, 0)
    }
    setShowVariableHelper(false)
  }

  // 버튼 추가
  const addButton = () => {
    setTemplate(prev => ({
      ...prev,
      buttons: [...prev.buttons, { name: '', type: 'WL', url: '' }]
    }))
  }

  // 버튼 제거
  const removeButton = (index: number) => {
    setTemplate(prev => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index)
    }))
  }

  // 미리보기 텍스트 생성
  const generatePreview = () => {
    let preview = template.content
    template.variables.forEach(variable => {
      const value = previewData[variable.name] || variable.example || `[${variable.name}]`
      preview = preview.replace(new RegExp(`#{${variable.name}}`, 'g'), value)
    })
    return preview
  }

  // 템플릿 내보내기
  const exportTemplate = () => {
    const exportData = {
      ...template,
      generatedAt: new Date().toISOString(),
      coolsmsFormat: {
        templateId: `TEMPLATE_${Date.now()}`,
        templateName: template.name,
        templateContent: template.content,
        templateTitle: template.title,
        templateParams: template.variables.map(v => `#{${v.name}}`),
        buttons: template.buttons
      }
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template_${template.name.replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 뒤로가기 버튼 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-white/50"
          >
            <ArrowLeft className="h-4 w-4" />
            메인으로 돌아가기
          </Button>
        </div>

        {/* 페이지 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">알림톡 템플릿 빌더</h1>
          <p className="text-lg text-gray-600">누구나 쉽게 카카오톡 알림톡 템플릿을 생성하고 변수를 설정할 수 있습니다</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 템플릿 편집기 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  기본 설정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">서비스 플랫폼</Label>
                    <Select value={template.category} onValueChange={(value) => 
                      setTemplate(prev => ({ ...prev, category: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBERS">슈퍼멤버스</SelectItem>
                        <SelectItem value="CHART">슈퍼차트</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="channel">발송 대상</Label>
                    <Select value={template.channel} onValueChange={(value) => 
                      setTemplate(prev => ({ ...prev, channel: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CEO">사장님</SelectItem>
                        <SelectItem value="BLOGGER">블로거</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="name">템플릿 이름</Label>
                  <Input
                    id="name"
                    placeholder="예: 월간 성과 리포트"
                    value={template.name}
                    onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="title">템플릿 제목</Label>
                  <Input
                    id="title"
                    placeholder="예: 1개월 성과 리포트"
                    value={template.title}
                    onChange={(e) => setTemplate(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  메시지 내용
                </CardTitle>
                <CardDescription>
                  변수는 #&#123;변수명&#125; 형태로 입력하세요. 자동으로 감지됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Textarea
                    placeholder="안녕하세요! #{고객명}님의 #{기간} 성과를 알려드립니다.&#10;&#10;총 리뷰 수: #{총리뷰수}개&#10;조회수: #{조회수}건"
                    className="min-h-[200px] font-mono"
                    value={template.content}
                    onChange={(e) => handleContentChange(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setShowVariableHelper(!showVariableHelper)}
                  >
                    <BookOpen className="h-4 w-4 mr-1" />
                    {showVariableHelper ? '변수 숨기기' : '변수 참고'}
                  </Button>
                </div>
                
                {/* 변수 도우미 패널 */}
                {showVariableHelper && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        기존 템플릿 변수 참고 (총 {allTemplateVariables.length}개)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        실제 운영 중인 114개 템플릿에서 사용되는 모든 변수들입니다. 
                        {template.channel === 'CEO' ? 'CEO' : template.channel === 'BLOGGER' ? 'BLOGGER' : '모든'} 채널과 공통 변수를 표시합니다.
                      </CardDescription>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="변수 검색..."
                          className="pl-9"
                          value={variableSearch}
                          onChange={(e) => setVariableSearch(e.target.value)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {filteredVariables.map((variable, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-white rounded border hover:bg-gray-50 cursor-pointer"
                            onClick={() => insertVariable(variable.name)}
                          >
                            <div className="flex-1">
                              <div className="font-mono text-sm text-blue-600">#{variable.name}</div>
                              <div className="text-xs text-gray-600">{variable.description}</div>
                              <div className="text-xs text-gray-400">예시: {variable.example}</div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {filteredVariables.length === 0 && (
                          <div className="text-center text-gray-500 py-4">
                            검색 결과가 없습니다
                          </div>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                        표시된 변수: {filteredVariables.length}개 / 전체: {allTemplateVariables.length}개
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {template.variables.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium">감지된 변수</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {template.variables.map((variable, index) => (
                        <Badge key={index} variant="secondary">
                          #{variable.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 변수 설정 */}
            {template.variables.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    변수 설정
                  </CardTitle>
                  <CardDescription>
                    각 변수에 대한 설명과 예시를 입력하세요
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {template.variables.map((variable, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">#{variable.name}</Badge>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">필수</Label>
                          <input
                            type="checkbox"
                            checked={variable.required}
                            onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm">설명</Label>
                        <Input
                          placeholder="이 변수가 무엇을 나타내는지 설명하세요"
                          value={variable.description}
                          onChange={(e) => updateVariable(index, 'description', e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm">예시 값</Label>
                        <Input
                          placeholder="예시 데이터를 입력하세요"
                          value={variable.example}
                          onChange={(e) => updateVariable(index, 'example', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 버튼 설정 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  버튼 설정
                </CardTitle>
                <CardDescription>
                  템플릿에 버튼을 추가할 수 있습니다 (최대 5개)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {template.buttons.map((button, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>버튼 {index + 1}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeButton(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">버튼명</Label>
                        <Input
                          placeholder="버튼 텍스트"
                          value={button.name}
                          onChange={(e) => {
                            const newButtons = [...template.buttons]
                            newButtons[index].name = e.target.value
                            setTemplate(prev => ({ ...prev, buttons: newButtons }))
                          }}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm">타입</Label>
                        <Select
                          value={button.type}
                          onValueChange={(value: any) => {
                            const newButtons = [...template.buttons]
                            newButtons[index].type = value
                            setTemplate(prev => ({ ...prev, buttons: newButtons }))
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WL">웹링크</SelectItem>
                            <SelectItem value="AL">앱링크</SelectItem>
                            <SelectItem value="DS">배송조회</SelectItem>
                            <SelectItem value="BK">봇키워드</SelectItem>
                            <SelectItem value="MD">메시지전달</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {(button.type === 'WL' || button.type === 'AL') && (
                      <div>
                        <Label className="text-sm">URL</Label>
                        <Input
                          placeholder="https://example.com"
                          value={button.url || ''}
                          onChange={(e) => {
                            const newButtons = [...template.buttons]
                            newButtons[index].url = e.target.value
                            setTemplate(prev => ({ ...prev, buttons: newButtons }))
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                
                {template.buttons.length < 5 && (
                  <Button
                    variant="outline"
                    onClick={addButton}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    버튼 추가
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 미리보기 및 가이드 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  실시간 미리보기
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="preview">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preview">미리보기</TabsTrigger>
                    <TabsTrigger value="test">테스트 데이터</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="preview" className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="bg-white p-4 rounded-lg shadow-sm border">
                        <div className="text-sm text-muted-foreground mb-2">
                          {template.category} • {template.channel}
                        </div>
                        <div className="font-medium mb-2">{template.title || '템플릿 제목'}</div>
                        <div className="whitespace-pre-wrap text-sm">
                          {generatePreview() || '메시지 내용을 입력하세요'}
                        </div>
                        
                        {template.buttons.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {template.buttons.map((button, index) => (
                              <div
                                key={index}
                                className="bg-blue-50 text-blue-700 px-3 py-2 rounded text-sm text-center border border-blue-200"
                              >
                                {button.name || `버튼 ${index + 1}`}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="test" className="space-y-4">
                    <div className="space-y-3">
                      {template.variables.map((variable, index) => (
                        <div key={index}>
                          <Label className="text-sm">#{variable.name}</Label>
                          <Input
                            placeholder={variable.example || `${variable.name} 값 입력`}
                            value={previewData[variable.name] || ''}
                            onChange={(e) => setPreviewData(prev => ({
                              ...prev,
                              [variable.name]: e.target.value
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* CoolSMS 등록 가이드 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  CoolSMS 등록 가이드
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">템플릿 생성 후 CoolSMS에 등록하는 방법</span>
                  </div>
                </div>
                
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                    <div>
                      <div className="font-medium mb-1">템플릿 내보내기</div>
                      <div className="text-muted-foreground">아래 "템플릿 내보내기" 버튼으로 JSON 파일을 다운로드하세요</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                    <div>
                      <div className="font-medium mb-1">CoolSMS 콘솔 접속</div>
                      <div className="text-muted-foreground">console.coolsms.co.kr → 알림톡 → 템플릿 관리</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                    <div>
                      <div className="font-medium mb-1">템플릿 등록</div>
                      <div className="text-muted-foreground">생성된 내용을 복사하여 새 템플릿으로 등록</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</div>
                    <div>
                      <div className="font-medium mb-1">승인 대기</div>
                      <div className="text-muted-foreground">카카오 검수 완료 후 사용 가능 (1-3일 소요)</div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-amber-800 mb-1">주의사항</div>
                      <ul className="text-amber-700 space-y-1 text-xs">
                        <li>• 템플릿 내용은 카카오 정책에 따라 검수됩니다</li>
                        <li>• 변수명은 영문, 숫자, 한글만 사용 가능합니다</li>
                        <li>• 버튼은 최대 5개까지 추가할 수 있습니다</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 액션 버튼들 */}
            <div className="space-y-3">
              <Button onClick={exportTemplate} className="w-full" size="lg">
                <Download className="h-4 w-4 mr-2" />
                템플릿 내보내기
              </Button>
              
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(template, null, 2))
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  JSON 복사
                </Button>
                
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  템플릿 불러오기
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 