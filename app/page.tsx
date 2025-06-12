"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, MessageSquare, Users, BarChart3, Play, Pause, Settings, FileText, Wrench } from "lucide-react"
import Link from "next/link"

export default function Dashboard() {
  const [workflows] = useState([
    {
      id: 1,
      name: "신규 회원 환영 워크플로우",
      status: "active",
      trigger: "회원가입 완료",
      sent: 1250,
      lastRun: "2024-01-15 14:30",
    },
    {
      id: 2,
      name: "장바구니 미완료 알림",
      status: "paused",
      trigger: "장바구니 추가 후 1시간",
      sent: 890,
      lastRun: "2024-01-14 16:20",
    },
    {
      id: 3,
      name: "VIP 고객 특별 혜택",
      status: "draft",
      trigger: "구매 금액 100만원 이상",
      sent: 0,
      lastRun: "-",
    },
  ])

  const stats = [
    { title: "활성 워크플로우", value: "5", icon: Play, color: "text-green-600" },
    { title: "총 발송 수", value: "12,450", icon: MessageSquare, color: "text-blue-600" },
    { title: "대상 고객", value: "3,240", icon: Users, color: "text-purple-600" },
    { title: "성공률", value: "98.5%", icon: BarChart3, color: "text-orange-600" },
  ]

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: "활성", variant: "default" as const, color: "bg-green-100 text-green-800" },
      paused: { label: "일시정지", variant: "secondary" as const, color: "bg-yellow-100 text-yellow-800" },
      draft: { label: "초안", variant: "outline" as const, color: "bg-gray-100 text-gray-800" },
    }
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">알림톡 자동화</h1>
              <p className="text-gray-600">워크플로우를 만들어 메시지를 자동으로 발송하세요</p>
            </div>
            <div className="flex gap-3">
              <Link href="/template-builder">
                <Button variant="outline" className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:from-blue-100 hover:to-purple-100">
                  <Wrench className="w-4 h-4 mr-2" />템플릿 빌더
                </Button>
              </Link>
              <Link href="/sms">
                <Button variant="outline">
                  <MessageSquare className="w-4 h-4 mr-2" />단순 SMS 발송
                </Button>
              </Link>
              <Link href="/templates">
                <Button variant="outline">
                  <FileText className="w-4 h-4 mr-2" />템플릿 라이브러리
                </Button>
              </Link>
              <Link href="/workflow/new">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />새 워크플로우
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-full bg-gray-50`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Workflows */}
        <Card>
          <CardHeader>
            <CardTitle>워크플로우 목록</CardTitle>
            <CardDescription>자동화된 메시지 발송 워크플로우를 관리하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-center justify-between p-6 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        workflow.status === "active"
                          ? "bg-green-500"
                          : workflow.status === "paused"
                            ? "bg-yellow-500"
                            : "bg-gray-400"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(workflow.status).color}`}
                        >
                          {getStatusBadge(workflow.status).label}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <span>트리거: {workflow.trigger}</span>
                        <span>발송: {workflow.sent.toLocaleString()}건</span>
                        <span>최근 실행: {workflow.lastRun}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {workflow.status === "active" ? (
                      <Button variant="outline" size="sm">
                        <Pause className="w-4 h-4 mr-1" />
                        일시정지
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm">
                        <Play className="w-4 h-4 mr-1" />
                        시작
                      </Button>
                    )}
                    <Link href={`/workflow/${workflow.id}`}>
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4 mr-1" />
                        설정
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
