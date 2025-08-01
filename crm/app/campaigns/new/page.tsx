"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Plus, X, Eye, Send } from "lucide-react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import Link from "next/link"

export default function NewCampaign() {
  const [campaignName, setCampaignName] = useState("")
  const [messageType, setMessageType] = useState("")
  const [messageContent, setMessageContent] = useState("")
  const [variables, setVariables] = useState<string[]>(["고객명", "상품명"])
  const [newVariable, setNewVariable] = useState("")
  const [targetCondition, setTargetCondition] = useState("")
  const [triggerEvent, setTriggerEvent] = useState("")
  const [delayTime, setDelayTime] = useState("")
  const [delayUnit, setDelayUnit] = useState("minutes")
  const [scheduleDate, setScheduleDate] = useState<Date>()
  const [isScheduled, setIsScheduled] = useState(false)

  const addVariable = () => {
    if (newVariable && !variables.includes(newVariable)) {
      setVariables([...variables, newVariable])
      setNewVariable("")
    }
  }

  const removeVariable = (variable: string) => {
    setVariables(variables.filter((v) => v !== variable))
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById("message-content") as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = messageContent
      const before = text.substring(0, start)
      const after = text.substring(end, text.length)
      const newText = before + `{{${variable}}}` + after
      setMessageContent(newText)

      // 커서 위치 조정
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4)
      }, 0)
    }
  }

  const previewMessage = () => {
    let preview = messageContent
    variables.forEach((variable) => {
      const sampleData: { [key: string]: string } = {
        고객명: "홍길동",
        상품명: "프리미엄 상품",
        할인율: "20%",
        만료일: "2024-01-31",
      }
      preview = preview.replace(new RegExp(`{{${variable}}}`, "g"), sampleData[variable] || `[${variable}]`)
    })
    return preview
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">새 캠페인 만들기</h1>
              <p className="text-gray-600">메시지 자동화 캠페인을 설정하세요</p>
            </div>
            <div className="flex gap-3">
              <Link href="/">
                <Button variant="outline">취소</Button>
              </Link>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Send className="w-4 h-4 mr-2" />
                캠페인 저장
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="message" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="message">메시지</TabsTrigger>
                <TabsTrigger value="target">대상</TabsTrigger>
                <TabsTrigger value="timing">시점</TabsTrigger>
                <TabsTrigger value="schedule">스케줄</TabsTrigger>
              </TabsList>

              <TabsContent value="message" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>기본 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="campaign-name">캠페인 이름</Label>
                      <Input
                        id="campaign-name"
                        placeholder="예: 신규 회원 환영 메시지"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="message-type">메시지 유형</Label>
                      <Select value={messageType} onValueChange={setMessageType}>
                        <SelectTrigger>
                          <SelectValue placeholder="메시지 유형을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alimtalk">카카오 알림톡</SelectItem>
                          <SelectItem value="sms">문자 메시지 (SMS)</SelectItem>
                          <SelectItem value="lms">장문 메시지 (LMS)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>메시지 내용</CardTitle>
                    <CardDescription>변수를 사용하여 개인화된 메시지를 작성하세요</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="message-content">메시지 내용</Label>
                      <Textarea
                        id="message-content"
                        placeholder="안녕하세요 {{고객명}}님! 특별한 혜택을 준비했습니다..."
                        className="min-h-[120px]"
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>사용 가능한 변수</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {variables.map((variable) => (
                          <Badge
                            key={variable}
                            variant="secondary"
                            className="cursor-pointer hover:bg-blue-100"
                            onClick={() => insertVariable(variable)}
                          >
                            {variable}
                            <X
                              className="w-3 h-3 ml-1 hover:text-red-500"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeVariable(variable)
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Input
                          placeholder="새 변수 추가"
                          value={newVariable}
                          onChange={(e) => setNewVariable(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && addVariable()}
                        />
                        <Button onClick={addVariable} size="sm">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="target" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>대상 고객</CardTitle>
                    <CardDescription>메시지를 받을 고객 조건을 설정하세요</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>고객 조건</Label>
                      <Select value={targetCondition} onValueChange={setTargetCondition}>
                        <SelectTrigger>
                          <SelectValue placeholder="대상 조건을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">전체 고객</SelectItem>
                          <SelectItem value="new">신규 가입 고객</SelectItem>
                          <SelectItem value="cart-abandoned">장바구니 미완료 고객</SelectItem>
                          <SelectItem value="purchased">구매 완료 고객</SelectItem>
                          <SelectItem value="vip">VIP 고객</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="timing" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>발송 시점</CardTitle>
                    <CardDescription>언제 메시지를 발송할지 설정하세요</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>트리거 이벤트</Label>
                      <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                        <SelectTrigger>
                          <SelectValue placeholder="발송 트리거를 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="signup">회원 가입 시</SelectItem>
                          <SelectItem value="cart-add">장바구니 추가 시</SelectItem>
                          <SelectItem value="purchase">구매 완료 시</SelectItem>
                          <SelectItem value="login">로그인 시</SelectItem>
                          <SelectItem value="manual">수동 발송</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>대기 시간</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={delayTime}
                          onChange={(e) => setDelayTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>단위</Label>
                        <Select value={delayUnit} onValueChange={setDelayUnit}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">분</SelectItem>
                            <SelectItem value="hours">시간</SelectItem>
                            <SelectItem value="days">일</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>스케줄 설정</CardTitle>
                    <CardDescription>메시지 발송 일정을 관리하세요</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch id="schedule-mode" checked={isScheduled} onCheckedChange={setIsScheduled} />
                      <Label htmlFor="schedule-mode">예약 발송</Label>
                    </div>

                    {isScheduled && (
                      <div>
                        <Label>발송 날짜</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {scheduleDate ? format(scheduleDate, "PPP", { locale: ko }) : "날짜를 선택하세요"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} initialFocus />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  미리보기
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <div className="text-xs text-gray-500 mb-2">
                      {messageType === "alimtalk"
                        ? "카카오 알림톡"
                        : messageType === "sms"
                          ? "SMS"
                          : messageType === "lms"
                            ? "LMS"
                            : "메시지 유형"}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {messageContent ? previewMessage() : "메시지 내용을 입력하세요..."}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <div>
                    <strong>캠페인:</strong> {campaignName || "이름 없음"}
                  </div>
                  <div>
                    <strong>대상:</strong> {targetCondition || "미설정"}
                  </div>
                  <div>
                    <strong>트리거:</strong> {triggerEvent || "미설정"}
                  </div>
                  {delayTime && (
                    <div>
                      <strong>대기:</strong> {delayTime}
                      {delayUnit === "minutes" ? "분" : delayUnit === "hours" ? "시간" : "일"}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
