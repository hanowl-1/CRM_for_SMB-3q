"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MessageSquare, Send, Zap, Trash2, Plus } from "lucide-react"
import Link from "next/link"

export default function SMSPage() {
  const [to, setTo] = useState("")
  const [from, setFrom] = useState("1800-7710")
  const [message, setMessage] = useState("")
  const [enableRealSending, setEnableRealSending] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [newVariableKey, setNewVariableKey] = useState("")
  const [newVariableValue, setNewVariableValue] = useState("")

  const messageType = message.length > 90 ? "LMS" : "SMS"
  const remainingChars = messageType === "SMS" ? 90 - message.length : 2000 - message.length

  // 템플릿에서 변수 추출 (#{변수명} 형태)
  const extractVariablesFromMessage = (content: string): string[] => {
    const matches = content.match(/#{([^}]+)}/g);
    if (!matches) return [];
    return [...new Set(matches.map(match => match.replace(/#{|}/g, '')))];
  };

  const messageVariables = extractVariablesFromMessage(message);

  // 변수 치환된 미리보기 메시지
  const getPreviewMessage = () => {
    let preview = message;
    Object.entries(variables).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`#{${key}}`, 'g'), value);
    });
    return preview;
  };

  const addVariable = () => {
    if (newVariableKey && newVariableValue) {
      setVariables({
        ...variables,
        [newVariableKey]: newVariableValue
      });
      setNewVariableKey("");
      setNewVariableValue("");
    }
  };

  const removeVariable = (key: string) => {
    const newVariables = { ...variables };
    delete newVariables[key];
    setVariables(newVariables);
  };

  const updateVariable = (key: string, value: string) => {
    setVariables({
      ...variables,
      [key]: value
    });
  };

  const autoFillVariables = () => {
    const defaultValues: Record<string, string> = {
      '고객명': '홍길동',
      '회사명': '테스트 회사',
      '상품명': '프리미엄 플랜',
      '금액': '29,000원',
      '날짜': new Date().toLocaleDateString(),
      '시간': new Date().toLocaleTimeString(),
      '링크': 'https://example.com',
      '코드': 'ABC123',
      '번호': '12345'
    };

    const autoFilledVariables: Record<string, string> = {};
    messageVariables.forEach(varName => {
      autoFilledVariables[varName] = defaultValues[varName] || `[${varName} 값]`;
    });

    setVariables({
      ...variables,
      ...autoFilledVariables
    });
  };

  const handleSend = async () => {
    if (!to || !message) {
      alert("수신번호와 메시지를 입력해주세요.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          from,
          message,
          enableRealSending,
          variables
        }),
      })

      const result = await response.json()

      if (result.success) {
        let alertMessage = `🎉 ${result.messageType} 발송 완료!\n\n`
        alertMessage += `📱 수신번호: ${to}\n`
        alertMessage += `📝 메시지 타입: ${result.messageType}\n`
        alertMessage += `🆔 메시지 ID: ${result.messageId}\n`
        alertMessage += `⏰ 발송 시간: ${new Date(result.timestamp).toLocaleString()}\n`
        
        // 변수 정보 추가
        if (Object.keys(variables).length > 0) {
          alertMessage += `🔧 사용된 변수: ${Object.keys(variables).length}개\n`
        }
        
        // 테스트 모드 정보 추가
        if (result.testMode) {
          alertMessage += `🧪 환경변수 TEST_MODE: 활성화 (강제 테스트 모드)\n`
        }
        alertMessage += `🔧 실제 발송: ${result.actualSending ? "활성화" : "테스트 모드"}`
        
        alert(alertMessage)
        
        // 성공 시 메시지 초기화 (실제 발송된 경우에만)
        if (result.actualSending) {
          setMessage("")
          setVariables({})
        }
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      console.error("SMS 발송 실패:", error)
      alert(`❌ SMS 발송에 실패했습니다.\n\n오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const insertTemplate = (template: string) => {
    setMessage(template)
  }

  const templates = [
    "안녕하세요! 테스트 메시지입니다.",
    "#{고객명}님, 안녕하세요! #{회사명}에서 새로운 소식을 전해드립니다.",
    "#{고객명}님의 주문이 완료되었습니다. 상품: #{상품명}, 금액: #{금액}",
    "#{고객명}님, 결제가 완료되었습니다. 금액: #{금액}, 결제일: #{날짜}",
    "#{고객명}님의 예약이 확정되었습니다. 일시: #{날짜} #{시간}",
    "인증번호는 #{코드}입니다. 3분 내에 입력해주세요.",
    "#{회사명} 할인 쿠폰이 발급되었습니다! 할인율: #{금액}, 링크: #{링크}"
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mr-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                돌아가기
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <MessageSquare className="w-6 h-6 mr-3" />
                단순 SMS 발송
              </h1>
              <p className="text-gray-600">간단하게 SMS/LMS를 발송하세요</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 메인 발송 폼 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 발송 정보 */}
            <Card>
              <CardHeader>
                <CardTitle>발송 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">발신번호</Label>
                    <Input
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      placeholder="010-1234-5678"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">수신번호</Label>
                    <Input
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="010-1234-5678"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 메시지 작성 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>메시지 작성</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={messageType === "SMS" ? "default" : "secondary"}>
                      {messageType}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {remainingChars >= 0 ? `${remainingChars}자 남음` : `${Math.abs(remainingChars)}자 초과`}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  rows={6}
                  className="resize-none"
                />
                
                <div className="text-xs text-muted-foreground">
                  • SMS: 90자 이하 (한글 45자)
                  • LMS: 2000자 이하 (한글 1000자)
                  • 90자 초과시 자동으로 LMS로 발송됩니다
                </div>
              </CardContent>
            </Card>

            {/* 변수 설정 */}
            {(messageVariables.length > 0 || Object.keys(variables).length > 0) && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>변수 설정</CardTitle>
                    {messageVariables.length > 0 && (
                      <Button onClick={autoFillVariables} variant="outline" size="sm">
                        <Zap className="w-4 h-4 mr-2" />
                        자동 채우기
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 메시지에서 발견된 변수들 */}
                  {messageVariables.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">메시지에서 발견된 변수</Label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {messageVariables.map(varName => (
                          <Badge key={varName} variant="secondary">
                            #{varName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 기존 변수들 */}
                  {Object.entries(variables).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium">#{key}</Label>
                          <Input
                            value={key}
                            onChange={(e) => {
                              const newVariables = { ...variables };
                              delete newVariables[key];
                              newVariables[e.target.value] = value;
                              setVariables(newVariables);
                            }}
                            placeholder="변수명"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">값</Label>
                          <Input
                            value={value}
                            onChange={(e) => updateVariable(key, e.target.value)}
                            placeholder="변수 값"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariable(key)}
                        className="mt-6"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}

                  {/* 새 변수 추가 */}
                  <div className="border-t pt-4">
                    <div className="flex items-end gap-3">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium">새 변수명</Label>
                          <Input
                            value={newVariableKey}
                            onChange={(e) => setNewVariableKey(e.target.value)}
                            placeholder="예: 고객명"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">값</Label>
                          <Input
                            value={newVariableValue}
                            onChange={(e) => setNewVariableValue(e.target.value)}
                            placeholder="예: 홍길동"
                          />
                        </div>
                      </div>
                      <Button onClick={addVariable} disabled={!newVariableKey || !newVariableValue}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 메시지 미리보기 */}
            {message && Object.keys(variables).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>메시지 미리보기</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <Textarea
                      value={getPreviewMessage()}
                      readOnly
                      rows={4}
                      className="bg-transparent border-none resize-none"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    변수가 치환된 최종 메시지입니다.
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 발송 설정 */}
            <Card>
              <CardHeader>
                <CardTitle>발송 설정</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">실제 발송 활성화</Label>
                    <p className="text-xs text-muted-foreground">
                      비활성화 시 콘솔에만 로그가 출력됩니다
                    </p>
                  </div>
                  <Switch
                    checked={enableRealSending}
                    onCheckedChange={setEnableRealSending}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 발송 버튼 */}
            <Button 
              onClick={handleSend} 
              disabled={isLoading || !to || !message}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {messageType} 발송
            </Button>
          </div>

          {/* 사이드바 - 템플릿 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">빠른 템플릿</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {templates.map((template, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => insertTemplate(template)}
                    className="w-full text-left justify-start h-auto p-3"
                  >
                    <div className="text-xs text-muted-foreground truncate">
                      {template}
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">변수 사용법</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <p className="font-medium mb-2">변수 형태:</p>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    #{`{변수명}`}
                  </code>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>예시: #{`{고객명}`}, #{`{회사명}`}, #{`{금액}`}</p>
                  <p>• 메시지에 변수를 입력하면 자동으로 감지됩니다</p>
                  <p>• "자동 채우기"로 기본값을 빠르게 설정할 수 있습니다</p>
                  <p>• 실시간 미리보기로 최종 메시지를 확인하세요</p>
                </div>
                
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">자주 사용하는 변수:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <div>• #{`{고객명}`}</div>
                    <div>• #{`{회사명}`}</div>
                    <div>• #{`{상품명}`}</div>
                    <div>• #{`{금액}`}</div>
                    <div>• #{`{날짜}`}</div>
                    <div>• #{`{시간}`}</div>
                    <div>• #{`{코드}`}</div>
                    <div>• #{`{링크}`}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-center">발송 중...</p>
          </div>
        </div>
      )}
    </div>
  )
} 