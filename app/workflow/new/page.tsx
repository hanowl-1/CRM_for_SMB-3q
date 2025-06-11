"use client"

import React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, MessageSquare, Users, Zap, Clock, Filter, Settings, Target, Plus, X, Database } from "lucide-react"
import Link from "next/link"

export default function NewWorkflow() {
  const [currentStep, setCurrentStep] = useState(1)
  const [workflowName, setWorkflowName] = useState("")

  // 메시지 관련 상태
  const [messageType, setMessageType] = useState("")
  const [messageContent, setMessageContent] = useState("")
  const [variables, setVariables] = useState<string[]>([])
  const [selectedVariables, setSelectedVariables] = useState<string[]>([])

  // 대상 고객 관련 상태
  const [targetCondition, setTargetCondition] = useState("")
  const [customConditions, setCustomConditions] = useState<Array<{ field: string; operator: string; value: string }>>(
    [],
  )

  // 트리거 이벤트 관련 상태
  const [triggerEvent, setTriggerEvent] = useState("")
  const [eventConditions, setEventConditions] = useState<Array<{ field: string; operator: string; value: string }>>([])

  // 대기 시간 관련 상태
  const [delayEnabled, setDelayEnabled] = useState(false)
  const [delayTime, setDelayTime] = useState("")
  const [delayUnit, setDelayUnit] = useState("minutes")

  // 추가 필터 관련 상태
  const [additionalFilters, setAdditionalFilters] = useState<Array<{ field: string; operator: string; value: string }>>(
    [],
  )

  // 운영 설정 관련 상태
  const [operationDays, setOperationDays] = useState(7)
  const [operationHours, setOperationHours] = useState("24hours")
  const [maxSends, setMaxSends] = useState("")

  // 목표 설정 관련 상태
  const [goalEnabled, setGoalEnabled] = useState(false)
  const [goalConditions, setGoalConditions] = useState<Array<{ field: string; operator: string; value: string }>>([])

  // DB 필드 목록 (실제로는 API에서 가져올 데이터)
  const dbFields = [
    { name: "user_name", label: "고객명", type: "string" },
    { name: "user_email", label: "이메일", type: "string" },
    { name: "user_phone", label: "전화번호", type: "string" },
    { name: "cart_total", label: "장바구니 금액", type: "number" },
    { name: "last_login", label: "최근 로그인", type: "date" },
    { name: "membership_level", label: "회원등급", type: "string" },
    { name: "purchase_count", label: "구매횟수", type: "number" },
    { name: "total_spent", label: "총 구매금액", type: "number" },
  ]

  const addCondition = (type: "target" | "event" | "filter" | "goal") => {
    const newCondition = { field: "", operator: "", value: "" }

    switch (type) {
      case "target":
        setCustomConditions([...customConditions, newCondition])
        break
      case "event":
        setEventConditions([...eventConditions, newCondition])
        break
      case "filter":
        setAdditionalFilters([...additionalFilters, newCondition])
        break
      case "goal":
        setGoalConditions([...goalConditions, newCondition])
        break
    }
  }

  const removeCondition = (type: "target" | "event" | "filter" | "goal", index: number) => {
    switch (type) {
      case "target":
        setCustomConditions(customConditions.filter((_, i) => i !== index))
        break
      case "event":
        setEventConditions(eventConditions.filter((_, i) => i !== index))
        break
      case "filter":
        setAdditionalFilters(additionalFilters.filter((_, i) => i !== index))
        break
      case "goal":
        setGoalConditions(goalConditions.filter((_, i) => i !== index))
        break
    }
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

      if (!selectedVariables.includes(variable)) {
        setSelectedVariables([...selectedVariables, variable])
      }
    }
  }

  const steps = [
    { number: 1, title: "메시지", icon: MessageSquare, description: "발송할 메시지를 작성하세요" },
    { number: 2, title: "대상 고객", icon: Users, description: "메시지를 받을 고객을 선택하세요" },
    { number: 3, title: "시작 이벤트", icon: Zap, description: "언제 메시지를 발송할지 설정하세요" },
    { number: 4, title: "대기 시간", icon: Clock, description: "발송 전 대기 시간을 설정하세요" },
    { number: 5, title: "추가 이벤트 필터", icon: Filter, description: "추가 조건을 설정하세요" },
    { number: 6, title: "운영", icon: Settings, description: "운영 시간과 제한을 설정하세요" },
    { number: 7, title: "목표", icon: Target, description: "워크플로우의 목표를 설정하세요" },
  ]

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="workflow-name">워크플로우 이름</Label>
              <Input
                id="workflow-name"
                placeholder="예: 신규 회원 환영 메시지"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label>메시지 유형</Label>
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="메시지 유형을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alimtalk">카카오 알림톡</SelectItem>
                  <SelectItem value="sms">문자 메시지 (SMS)</SelectItem>
                  <SelectItem value="lms">장문 메시지 (LMS)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="message-content">메시지 내용</Label>
              <Textarea
                id="message-content"
                placeholder="안녕하세요! 메시지를 입력하세요..."
                className="min-h-[200px] mt-2"
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
              />
            </div>

            <div>
              <Label>사용 가능한 변수 (DB 필드)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 p-4 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
                {dbFields.map((field) => (
                  <Button
                    key={field.name}
                    variant="ghost"
                    size="sm"
                    className="justify-start h-auto p-2 text-left"
                    onClick={() => insertVariable(field.name)}
                  >
                    <Database className="w-3 h-3 mr-2 text-blue-500" />
                    <div>
                      <div className="text-sm font-medium">{field.label}</div>
                      <div className="text-xs text-gray-500">{field.name}</div>
                    </div>
                  </Button>
                ))}
              </div>

              {selectedVariables.length > 0 && (
                <div className="mt-3">
                  <Label className="text-sm">선택된 변수:</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedVariables.map((variable) => (
                      <Badge key={variable} variant="secondary" className="text-xs">
                        {`{{${variable}}}`}
                        <X
                          className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500"
                          onClick={() => setSelectedVariables(selectedVariables.filter((v) => v !== variable))}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label>기본 대상 조건</Label>
              <Select value={targetCondition} onValueChange={setTargetCondition}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="대상 조건을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 고객</SelectItem>
                  <SelectItem value="new_members">신규 회원</SelectItem>
                  <SelectItem value="vip_members">VIP 회원</SelectItem>
                  <SelectItem value="cart_abandoned">장바구니 미완료</SelectItem>
                  <SelectItem value="custom">사용자 정의</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(targetCondition === "custom" || customConditions.length > 0) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>상세 조건</Label>
                  <Button variant="outline" size="sm" onClick={() => addCondition("target")}>
                    <Plus className="w-4 h-4 mr-1" />
                    조건 추가
                  </Button>
                </div>

                <div className="space-y-3">
                  {customConditions.map((condition, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <Select
                        value={condition.field}
                        onValueChange={(value) => {
                          const newConditions = [...customConditions]
                          newConditions[index].field = value
                          setCustomConditions(newConditions)
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="필드 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {dbFields.map((field) => (
                            <SelectItem key={field.name} value={field.name}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={condition.operator}
                        onValueChange={(value) => {
                          const newConditions = [...customConditions]
                          newConditions[index].operator = value
                          setCustomConditions(newConditions)
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="조건" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">같음</SelectItem>
                          <SelectItem value="not_equals">다름</SelectItem>
                          <SelectItem value="greater">초과</SelectItem>
                          <SelectItem value="less">미만</SelectItem>
                          <SelectItem value="contains">포함</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="값"
                        value={condition.value}
                        onChange={(e) => {
                          const newConditions = [...customConditions]
                          newConditions[index].value = e.target.value
                          setCustomConditions(newConditions)
                        }}
                        className="flex-1"
                      />

                      <Button variant="ghost" size="sm" onClick={() => removeCondition("target", index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label>트리거 이벤트</Label>
              <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="발송 트리거를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signup">회원 가입</SelectItem>
                  <SelectItem value="login">로그인</SelectItem>
                  <SelectItem value="cart_add">장바구니 추가</SelectItem>
                  <SelectItem value="purchase">구매 완료</SelectItem>
                  <SelectItem value="page_view">페이지 조회</SelectItem>
                  <SelectItem value="custom_event">사용자 정의 이벤트</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>이벤트 조건</Label>
                <Button variant="outline" size="sm" onClick={() => addCondition("event")}>
                  <Plus className="w-4 h-4 mr-1" />
                  조건 추가
                </Button>
              </div>

              <div className="space-y-3">
                {eventConditions.map((condition, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Select
                      value={condition.field}
                      onValueChange={(value) => {
                        const newConditions = [...eventConditions]
                        newConditions[index].field = value
                        setEventConditions(newConditions)
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="이벤트 속성" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="page_url">페이지 URL</SelectItem>
                        <SelectItem value="product_id">상품 ID</SelectItem>
                        <SelectItem value="category">카테고리</SelectItem>
                        <SelectItem value="amount">금액</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={condition.operator}
                      onValueChange={(value) => {
                        const newConditions = [...eventConditions]
                        newConditions[index].operator = value
                        setEventConditions(newConditions)
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="조건" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">같음</SelectItem>
                        <SelectItem value="contains">포함</SelectItem>
                        <SelectItem value="starts_with">시작</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="값"
                      value={condition.value}
                      onChange={(e) => {
                        const newConditions = [...eventConditions]
                        newConditions[index].value = e.target.value
                        setEventConditions(newConditions)
                      }}
                      className="flex-1"
                    />

                    <Button variant="ghost" size="sm" onClick={() => removeCondition("event", index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <Switch id="delay-enabled" checked={delayEnabled} onCheckedChange={setDelayEnabled} />
              <Label htmlFor="delay-enabled">대기 시간 설정</Label>
            </div>

            {delayEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>대기 시간</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={delayTime}
                    onChange={(e) => setDelayTime(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>단위</Label>
                  <Select value={delayUnit} onValueChange={setDelayUnit}>
                    <SelectTrigger className="mt-2">
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
            )}

            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                {delayEnabled
                  ? `이벤트 발생 후 ${delayTime || "0"}${delayUnit === "minutes" ? "분" : delayUnit === "hours" ? "시간" : "일"} 후에 메시지가 발송됩니다.`
                  : "이벤트 발생 즉시 메시지가 발송됩니다."}
              </p>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label>추가 이벤트 필터</Label>
                  <p className="text-sm text-gray-600 mt-1">메시지 발송 전 추가로 확인할 조건을 설정하세요</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => addCondition("filter")}>
                  <Plus className="w-4 h-4 mr-1" />
                  필터 추가
                </Button>
              </div>

              <div className="space-y-3">
                {additionalFilters.map((filter, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200"
                  >
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    <Select
                      value={filter.field}
                      onValueChange={(value) => {
                        const newFilters = [...additionalFilters]
                        newFilters[index].field = value
                        setAdditionalFilters(newFilters)
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="필터 조건" />
                      </SelectTrigger>
                      <SelectContent>
                        {dbFields.map((field) => (
                          <SelectItem key={field.name} value={field.name}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filter.operator}
                      onValueChange={(value) => {
                        const newFilters = [...additionalFilters]
                        newFilters[index].operator = value
                        setAdditionalFilters(newFilters)
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="조건" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">같음</SelectItem>
                        <SelectItem value="not_equals">다름</SelectItem>
                        <SelectItem value="greater">초과</SelectItem>
                        <SelectItem value="less">미만</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="값"
                      value={filter.value}
                      onChange={(e) => {
                        const newFilters = [...additionalFilters]
                        newFilters[index].value = e.target.value
                        setAdditionalFilters(newFilters)
                      }}
                      className="flex-1"
                    />

                    <Button variant="ghost" size="sm" onClick={() => removeCondition("filter", index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {additionalFilters.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>추가 필터가 설정되지 않았습니다</p>
                  <p className="text-sm">모든 조건을 만족하는 고객에게 메시지가 발송됩니다</p>
                </div>
              )}
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <Label>운영 기간</Label>
              <Select
                value={operationDays.toString()}
                onValueChange={(value) => setOperationDays(Number.parseInt(value))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1일</SelectItem>
                  <SelectItem value="7">7일</SelectItem>
                  <SelectItem value="30">30일</SelectItem>
                  <SelectItem value="365">1년</SelectItem>
                  <SelectItem value="-1">무제한</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>운영 시간</Label>
              <Select value={operationHours} onValueChange={setOperationHours}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24hours">24시간 아무 때나</SelectItem>
                  <SelectItem value="business">업무시간 (9-18시)</SelectItem>
                  <SelectItem value="custom">사용자 정의</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>최대 발송 수 (선택사항)</Label>
              <Input
                type="number"
                placeholder="제한 없음"
                value={maxSends}
                onChange={(e) => setMaxSends(e.target.value)}
                className="mt-2"
              />
              <p className="text-sm text-gray-600 mt-1">설정하지 않으면 조건을 만족하는 모든 고객에게 발송됩니다</p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">운영 설정 요약</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• 운영 기간: {operationDays === -1 ? "무제한" : `${operationDays}일`}</li>
                <li>
                  • 운영 시간:{" "}
                  {operationHours === "24hours" ? "24시간" : operationHours === "business" ? "업무시간" : "사용자 정의"}
                </li>
                <li>• 최대 발송: {maxSends || "제한 없음"}</li>
              </ul>
            </div>
          </div>
        )

      case 7:
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <Switch id="goal-enabled" checked={goalEnabled} onCheckedChange={setGoalEnabled} />
              <Label htmlFor="goal-enabled">목표 설정</Label>
            </div>

            {goalEnabled && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Label>목표 조건</Label>
                    <p className="text-sm text-gray-600 mt-1">워크플로우의 성공을 측정할 조건을 설정하세요</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => addCondition("goal")}>
                    <Plus className="w-4 h-4 mr-1" />
                    목표 추가
                  </Button>
                </div>

                <div className="space-y-3">
                  {goalConditions.map((goal, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200"
                    >
                      <Target className="w-4 h-4 text-purple-500" />
                      <Select
                        value={goal.field}
                        onValueChange={(value) => {
                          const newGoals = [...goalConditions]
                          newGoals[index].field = value
                          setGoalConditions(newGoals)
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="목표 이벤트" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="page_view">페이지 조회</SelectItem>
                          <SelectItem value="purchase">구매 완료</SelectItem>
                          <SelectItem value="signup">회원가입</SelectItem>
                          <SelectItem value="download">다운로드</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={goal.operator}
                        onValueChange={(value) => {
                          const newGoals = [...goalConditions]
                          newGoals[index].operator = value
                          setGoalConditions(newGoals)
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="조건" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="occurs">발생</SelectItem>
                          <SelectItem value="contains">포함</SelectItem>
                          <SelectItem value="equals">같음</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="값 (선택사항)"
                        value={goal.value}
                        onChange={(e) => {
                          const newGoals = [...goalConditions]
                          newGoals[index].value = e.target.value
                          setGoalConditions(newGoals)
                        }}
                        className="flex-1"
                      />

                      <Button variant="ghost" size="sm" onClick={() => removeCondition("goal", index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!goalEnabled && (
              <div className="text-center py-8 text-gray-500">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>목표가 설정되지 않았습니다</p>
                <p className="text-sm">메시지 발송 수와 전송률로만 성과를 측정합니다</p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  돌아가기
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">새 워크플로우 만들기</h1>
                <p className="text-gray-600">단계별로 메시지 자동화를 설정하세요</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline">임시저장</Button>
              <Button className="bg-blue-600 hover:bg-blue-700">워크플로우 저장</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Steps Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-2">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    currentStep === step.number
                      ? "bg-blue-50 border border-blue-200"
                      : currentStep > step.number
                        ? "bg-green-50 border border-green-200"
                        : "bg-white border border-gray-200 hover:bg-gray-50"
                  }`}
                  onClick={() => setCurrentStep(step.number)}
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      currentStep === step.number
                        ? "bg-blue-600 text-white"
                        : currentStep > step.number
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {currentStep > step.number ? "✓" : step.number}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-medium ${
                        currentStep === step.number
                          ? "text-blue-900"
                          : currentStep > step.number
                            ? "text-green-900"
                            : "text-gray-900"
                      }`}
                    >
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                    {React.createElement(steps[currentStep - 1].icon, {
                      className: "w-5 h-5 text-blue-600",
                    })}
                  </div>
                  <div>
                    <CardTitle>{steps[currentStep - 1].title}</CardTitle>
                    <CardDescription>{steps[currentStep - 1].description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>{renderStepContent()}</CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
              >
                이전
              </Button>
              <Button
                onClick={() => setCurrentStep(Math.min(7, currentStep + 1))}
                disabled={currentStep === 7}
                className="bg-blue-600 hover:bg-blue-700"
              >
                다음
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
