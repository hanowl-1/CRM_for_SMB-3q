"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { ArrowLeft, Pause, Edit, Trash2 } from "lucide-react"
import Link from "next/link"

export default function CampaignDetail({ params }: { params: { id: string } }) {
  const [campaign] = useState({
    id: 1,
    name: "신규 회원 환영 메시지",
    status: "active",
    type: "알림톡",
    messageContent: "안녕하세요 {{고객명}}님! 회원가입을 환영합니다. 특별 할인 혜택을 확인해보세요!",
    sent: 1250,
    delivered: 1230,
    opened: 980,
    clicked: 156,
    scheduled: "즉시 발송",
    createdAt: "2024-01-15",
  })

  const analyticsData = [
    { name: "1월 1주", sent: 240, delivered: 235, opened: 180, clicked: 32 },
    { name: "1월 2주", sent: 320, delivered: 315, opened: 250, clicked: 45 },
    { name: "1월 3주", sent: 290, delivered: 285, opened: 220, clicked: 38 },
    { name: "1월 4주", sent: 400, delivered: 395, opened: 330, clicked: 41 },
  ]

  const recentSends = [
    { id: 1, recipient: "010-1234-5678", status: "delivered", sentAt: "2024-01-15 14:30" },
    { id: 2, recipient: "010-2345-6789", status: "opened", sentAt: "2024-01-15 14:25" },
    { id: 3, recipient: "010-3456-7890", status: "clicked", sentAt: "2024-01-15 14:20" },
    { id: 4, recipient: "010-4567-8901", status: "delivered", sentAt: "2024-01-15 14:15" },
  ]

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      delivered: { label: "전송완료", variant: "default" as const },
      opened: { label: "읽음", variant: "secondary" as const },
      clicked: { label: "클릭", variant: "outline" as const },
      failed: { label: "실패", variant: "destructive" as const },
    }
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.delivered
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
                <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default">활성</Badge>
                  <Badge variant="outline">{campaign.type}</Badge>
                  <span className="text-sm text-gray-600">생성일: {campaign.createdAt}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline">
                <Edit className="w-4 h-4 mr-2" />
                수정
              </Button>
              <Button variant="outline">
                <Pause className="w-4 h-4 mr-2" />
                일시정지
              </Button>
              <Button variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                삭제
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-gray-900">{campaign.sent.toLocaleString()}</div>
              <p className="text-sm text-gray-600">총 발송</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-green-600">{campaign.delivered.toLocaleString()}</div>
              <p className="text-sm text-gray-600">전송 완료</p>
              <p className="text-xs text-gray-500">{((campaign.delivered / campaign.sent) * 100).toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">{campaign.opened.toLocaleString()}</div>
              <p className="text-sm text-gray-600">읽음</p>
              <p className="text-xs text-gray-500">{((campaign.opened / campaign.delivered) * 100).toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-purple-600">{campaign.clicked.toLocaleString()}</div>
              <p className="text-sm text-gray-600">클릭</p>
              <p className="text-xs text-gray-500">{((campaign.clicked / campaign.opened) * 100).toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="analytics" className="w-full">
          <TabsList>
            <TabsTrigger value="analytics">분석</TabsTrigger>
            <TabsTrigger value="message">메시지</TabsTrigger>
            <TabsTrigger value="history">발송 내역</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>발송 성과 분석</CardTitle>
                <CardDescription>주간별 메시지 발송 및 반응 현황</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sent" fill="#3b82f6" name="발송" />
                    <Bar dataKey="delivered" fill="#10b981" name="전송완료" />
                    <Bar dataKey="opened" fill="#8b5cf6" name="읽음" />
                    <Bar dataKey="clicked" fill="#f59e0b" name="클릭" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>성과 추이</CardTitle>
                <CardDescription>시간별 성과 변화</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="opened" stroke="#8b5cf6" name="읽음률" />
                    <Line type="monotone" dataKey="clicked" stroke="#f59e0b" name="클릭률" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="message">
            <Card>
              <CardHeader>
                <CardTitle>메시지 내용</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-xs text-gray-500 mb-2">카카오 알림톡</div>
                    <div className="whitespace-pre-wrap">{campaign.messageContent}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>최근 발송 내역</CardTitle>
                <CardDescription>최근 발송된 메시지들의 상태를 확인하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentSends.map((send) => (
                    <div key={send.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="font-medium">{send.recipient}</div>
                          <div className="text-sm text-gray-600">{send.sentAt}</div>
                        </div>
                      </div>
                      <Badge variant={getStatusBadge(send.status).variant}>{getStatusBadge(send.status).label}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
