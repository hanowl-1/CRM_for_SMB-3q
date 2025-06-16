"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, MessageSquare, Users, BarChart3, Play, Pause, Settings, FileText, Wrench, Database, Code, Monitor, Zap, Target, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Workflow } from "@/lib/types/workflow"

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<Array<{
    id: string;
    originalId?: string;
    name: string;
    status: string;
    trigger: string;
    sent: number;
    lastRun: string;
    stepsCount?: number;
    source: string;
  }>>([]);

  // Supabase와 localStorage에서 저장된 워크플로우 불러오기
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        // 1. Supabase에서 워크플로우 불러오기
        let supabaseWorkflows: Workflow[] = [];
        try {
          const response = await fetch('/api/supabase/workflows');
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              supabaseWorkflows = result.data;
              console.log("Supabase에서 불러온 워크플로우:", supabaseWorkflows.length, "개");
            }
          }
        } catch (supabaseError) {
          console.warn("Supabase 워크플로우 로드 실패:", supabaseError);
        }

        // 2. localStorage에서 워크플로우 불러오기 (백업용)
        let localWorkflows: Workflow[] = [];
        try {
          const savedWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]") as Workflow[];
          localWorkflows = savedWorkflows;
          console.log("localStorage에서 불러온 워크플로우:", localWorkflows.length, "개");
        } catch (localError) {
          console.warn("localStorage 워크플로우 로드 실패:", localError);
        }

        // 3. 두 소스의 워크플로우 합치기 (중복 제거)
        const allWorkflows = [...supabaseWorkflows];
        
        // localStorage의 워크플로우 중 Supabase에 없는 것만 추가
        localWorkflows.forEach(localWorkflow => {
          const existsInSupabase = supabaseWorkflows.some(sw => sw.id === localWorkflow.id);
          if (!existsInSupabase) {
            allWorkflows.push(localWorkflow);
          }
        });

        // 워크플로우를 표시용 형태로 변환
        const convertedWorkflows = allWorkflows.map((workflow, index) => ({
          id: workflow.id,
          originalId: workflow.id,
          name: workflow.name || `워크플로우 ${index + 1}`,
          status: workflow.status,
          trigger: workflow.trigger?.name || workflow.trigger?.type || "수동 실행",
          sent: workflow.stats?.totalRuns || 0,
          lastRun: workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }) : "-",
          stepsCount: workflow.steps?.length || 0,
          source: supabaseWorkflows.some(sw => sw.id === workflow.id) ? 'supabase' : 'local'
        }));

        console.log("변환된 워크플로우:", convertedWorkflows);
        
        // DB에서 불러온 워크플로우만 표시 (샘플 데이터 제거)
        setWorkflows(convertedWorkflows);
        
      } catch (error) {
        console.error("워크플로우 로드 실패:", error);
      }
    };

    loadWorkflows();
  }, []);

  // 실제 워크플로우 데이터를 기반으로 통계 계산
  const activeWorkflowsCount = workflows.filter(w => w.status === 'active').length;
  const totalSent = workflows.reduce((sum, w) => sum + w.sent, 0);
  const totalCustomers = 3240; // 대상 고객 수는 별도 계산 필요
  const successRate = 98.5; // 성공률은 별도 계산 필요

  const stats = [
    { title: "활성 워크플로우", value: activeWorkflowsCount.toString(), icon: Play, color: "text-green-600" },
    { title: "총 발송 수", value: totalSent.toLocaleString(), icon: MessageSquare, color: "text-blue-600" },
    { title: "대상 고객", value: totalCustomers.toLocaleString(), icon: Users, color: "text-purple-600" },
    { title: "성공률", value: `${successRate}%`, icon: BarChart3, color: "text-orange-600" },
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
              <h1 className="text-3xl font-bold text-gray-900">알림톡 자동화</h1>
              <p className="text-gray-600 mt-1">워크플로우를 만들어 메시지를 자동으로 발송하세요</p>
            </div>
            
            {/* 주요 액션 버튼 */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const saved = localStorage.getItem("workflows");
                  const count = saved ? JSON.parse(saved).length : 0;
                  alert(`저장된 워크플로우: ${count}개\n\n${saved ? JSON.stringify(JSON.parse(saved), null, 2) : '없음'}`);
                }}
              >
                저장된 워크플로우 확인
              </Button>
              <Link href="/workflow/new">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-lg">
                  <Plus className="w-5 h-5 mr-2" />
                  새 워크플로우
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

        {/* 메인 컨텐츠 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* 빠른 액션 카드들 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 시스템 관리 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Monitor className="h-5 w-5 text-indigo-600" />
                  <span>시스템 관리</span>
                </CardTitle>
                <CardDescription>
                  시스템 현황 모니터링 및 설정 관리
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/admin/dashboard" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    시스템 대시보드
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* 데이터 관리 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-green-600" />
                  <span>데이터 관리</span>
                </CardTitle>
                <CardDescription>
                  MySQL 데이터 연동 및 변수 설정
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/admin/table-mappings" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Database className="w-4 h-4 mr-2" />
                    테이블 매핑 관리
                  </Button>
                </Link>
                <Link href="/admin/custom-queries" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Code className="w-4 h-4 mr-2" />
                    커스텀 쿼리 관리
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* 메시지 도구 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  <span>메시지 도구</span>
                </CardTitle>
                <CardDescription>
                  템플릿 관리 및 단순 발송
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/template-builder" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Wrench className="w-4 h-4 mr-2" />
                    템플릿 빌더
                  </Button>
                </Link>
                <Link href="/templates" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    템플릿 라이브러리
                  </Button>
                </Link>
                <Link href="/sms" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Zap className="w-4 h-4 mr-2" />
                    단순 SMS 발송
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* 워크플로우 목록 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    <span>워크플로우 목록</span>
                  </CardTitle>
                  <CardDescription>자동화된 메시지 발송 워크플로우를 관리하세요</CardDescription>
                </div>
                <Link href="/workflow/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    새 워크플로우
                  </Button>
                </Link>
              </div>
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
                          {workflow.source === 'local' && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              새로 저장됨
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <span>트리거: {workflow.trigger}</span>
                          <span>발송: {workflow.sent.toLocaleString()}건</span>
                          <span>최근 실행: {workflow.lastRun}</span>
                          {workflow.source === 'local' && workflow.stepsCount !== undefined && (
                            <span>단계: {workflow.stepsCount}개</span>
                          )}
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
                      <Link href={`/workflow/${workflow.originalId || workflow.id}`}>
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

        {/* 하단 정보 카드 */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">하이브리드 시스템 운영 중</h3>
                  <p className="text-sm text-gray-600">MySQL(데이터 조회) + Supabase(기록 저장) 아키텍처로 안정적인 서비스를 제공합니다</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">123</div>
                <div className="text-sm text-gray-600">연결된 테이블</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
