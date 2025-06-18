"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, MessageSquare, Users, BarChart3, Play, Pause, Settings, FileText, Wrench, Database, Code, Monitor, Zap, Target, TrendingUp, RefreshCw, Clock, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Workflow } from "@/lib/types/workflow"
import { Badge } from "@/components/ui/badge"

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<Array<{
    id: string;
    name: string;
    status: string;
    trigger: string;
    sent: number;
    lastRun: string;
    stepsCount: number;
    description?: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 스케줄러 상태 추가
  const [schedulerStatus, setSchedulerStatus] = useState<{
    isRunning: boolean;
    totalJobs: number;
    pendingJobs: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
    nextJob?: any;
  } | null>(null);

  // Supabase에서 워크플로우 불러오기 (DB 기반만)
  const loadWorkflows = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("📊 Supabase에서 워크플로우 목록 로드 중...");
      
      const response = await fetch('/api/supabase/workflows');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '워크플로우 로드에 실패했습니다.');
      }

      const supabaseWorkflows: Workflow[] = result.data || [];
      console.log("✅ Supabase에서 불러온 워크플로우:", supabaseWorkflows.length, "개");

      // 워크플로우를 표시용 형태로 변환
      const convertedWorkflows = supabaseWorkflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name || '이름 없는 워크플로우',
        status: workflow.status || 'draft',
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
        description: workflow.description
      }));

      console.log("🔄 변환된 워크플로우:", convertedWorkflows);
      setWorkflows(convertedWorkflows);
      
    } catch (error) {
      console.error("❌ 워크플로우 로드 실패:", error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 스케줄러 상태 로드
  const loadSchedulerStatus = async () => {
    try {
      const response = await fetch('/api/scheduler?action=status');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSchedulerStatus(result.data);
        }
      }
    } catch (error) {
      console.error('스케줄러 상태 로드 실패:', error);
    }
  };

  useEffect(() => {
    loadWorkflows();
    loadSchedulerStatus();
    
    // 30초마다 스케줄러 상태 업데이트
    const interval = setInterval(loadSchedulerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // 실제 워크플로우 데이터를 기반으로 통계 계산
  const activeWorkflowsCount = workflows.filter(w => w.status === 'active').length;
  const totalSent = workflows.reduce((sum, w) => sum + w.sent, 0);
  const draftWorkflowsCount = workflows.filter(w => w.status === 'draft').length;
  const pausedWorkflowsCount = workflows.filter(w => w.status === 'paused').length;

  const stats = [
    { title: "전체 워크플로우", value: workflows.length.toString(), icon: Target, color: "text-purple-600" },
    { title: "활성 워크플로우", value: activeWorkflowsCount.toString(), icon: Play, color: "text-green-600" },
    { title: "총 발송 수", value: totalSent.toLocaleString(), icon: MessageSquare, color: "text-blue-600" },
    { title: "초안", value: draftWorkflowsCount.toString(), icon: FileText, color: "text-gray-600" },
  ]

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: "활성", color: "bg-green-100 text-green-800" },
      paused: { label: "일시정지", color: "bg-yellow-100 text-yellow-800" },
      draft: { label: "초안", color: "bg-gray-100 text-gray-800" },
      archived: { label: "보관됨", color: "bg-red-100 text-red-800" },
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
                onClick={loadWorkflows}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? '로딩 중...' : '새로고침'}
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

            {/* 스케줄러 상태 카드 추가 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <span>스케줄러 상태</span>
                </CardTitle>
                <CardDescription>
                  자동 실행 스케줄러 모니터링
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {schedulerStatus ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">상태</span>
                      <Badge variant={schedulerStatus.isRunning ? "default" : "secondary"}>
                        {schedulerStatus.isRunning ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            실행 중
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3 mr-1" />
                            중지됨
                          </>
                        )}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">총 작업:</span>
                        <span className="font-medium">{schedulerStatus.totalJobs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">대기 중:</span>
                        <span className="font-medium text-blue-600">{schedulerStatus.pendingJobs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">실행 중:</span>
                        <span className="font-medium text-orange-600">{schedulerStatus.runningJobs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">완료:</span>
                        <span className="font-medium text-green-600">{schedulerStatus.completedJobs}</span>
                      </div>
                    </div>

                    {schedulerStatus.nextJob && (
                      <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
                        <div className="font-medium text-blue-800">다음 실행 예정:</div>
                        <div className="text-blue-600">
                          {schedulerStatus.nextJob.workflow.name}
                        </div>
                        <div className="text-blue-500">
                          {new Date(schedulerStatus.nextJob.scheduledTime).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-sm text-gray-500">상태 확인 중...</span>
                  </div>
                )}
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
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center space-x-2 text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>워크플로우 목록을 불러오는 중...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="text-red-500 text-center">
                    <p className="font-medium">워크플로우 목록을 불러올 수 없습니다</p>
                    <p className="text-sm text-gray-600 mt-1">{error}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadWorkflows}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    다시 시도
                  </Button>
                </div>
              ) : workflows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="text-gray-500 text-center">
                    <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-medium">아직 생성된 워크플로우가 없습니다</p>
                    <p className="text-sm text-gray-400 mt-1">첫 번째 워크플로우를 만들어보세요!</p>
                  </div>
                  <Link href="/workflow/new">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      새 워크플로우 만들기
                    </Button>
                  </Link>
                </div>
              ) : (
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
                            <span>단계: {workflow.stepsCount}개</span>
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
              )}
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
