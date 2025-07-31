"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Play,
  Pause,
  MessageSquare,
  Target,
  FileText,
  Monitor,
  Database,
  BarChart3,
  Clock,
  AlertCircle,
  RefreshCw,
  Wrench,
  Zap,
  CheckCircle,
  Settings,
  TrendingUp,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Workflow, WorkflowStep } from "@/lib/types/workflow";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/hooks/useAuth";
import { LoginForm } from "@/components/auth/LoginForm";
import { UserMenu } from "@/components/auth/UserMenu";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardWorkflow {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "archived";
  trigger_type: string;
  sent: number;
  lastRun: string;
  stepsCount: number;
  templateInfo?: {
    templateName: string;
    templateCount: number;
    additionalTemplates: number;
  };
  stats: {
    totalCost: number;
    targetsCount: number;
  };
  estimatedCount?: number;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export default function Dashboard() {
  const { user, loading } = useAuth();

  // 로딩 중이면 로딩 화면 표시
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로그인하지 않은 경우 로그인 폼 표시
  if (!user) {
    return <LoginForm />;
  }

  // 로그인한 경우 기존 대시보드 표시
  return <DashboardContent />;
}

function DashboardContent() {
  const [workflows, setWorkflows] = useState<DashboardWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔥 삭제 관련 상태 추가
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    workflowId: null as string | null,
    workflowName: "",
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // 필터링 상태 추가
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 스케줄러 상태
  const [schedulerStatus, setSchedulerStatus] = useState<{
    isRunning: boolean;
    totalJobs: number;
    pendingJobs: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
    nextJob?: any;
    activeWorkflows: number;
    scheduledWorkflows: number;
    totalExecutions: number;
    todayExecutions: number;
    currentJobs: {
      pending: number;
      running: number;
    };
    lastExecutionTime: string;
  } | null>(null);

  // 상태 추가
  const [executeModal, setExecuteModal] = useState<{
    isOpen: boolean;
    workflowId: string | null;
    workflowName: string;
    estimatedCount?: number;
  }>({
    isOpen: false,
    workflowId: null,
    workflowName: "",
    estimatedCount: 0,
  });

  // Supabase에서 워크플로우 불러오기 (DB 기반만)
  const loadWorkflows = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("📊 Supabase에서 워크플로우 목록 로드 중...");

      const response = await fetch("/api/supabase/workflows");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(result);

      if (!result.success) {
        throw new Error(result.message || "워크플로우 로드에 실패했습니다.");
      }

      const supabaseWorkflows = result.data || [];

      // 워크플로우를 표시용 형태로 변환
      const convertedWorkflows: DashboardWorkflow[] = supabaseWorkflows.map(
        (workflow: any) => ({
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          trigger_type: workflow.trigger_type || "manual",
          sent: workflow.sent || 0,
          lastRun: workflow.lastRun || "-",
          stepsCount: workflow.message_config?.steps?.length || 0, // message_config에서 steps 가져오기
          templateInfo: {
            templateName:
              workflow.message_config?.selectedTemplates?.[0]?.templateName ||
              "", // 첫 번째 템플릿 이름
            templateCount:
              workflow.message_config?.selectedTemplates?.length || 0, // 전체 템플릿 수
            additionalTemplates: Math.max(
              0,
              (workflow.message_config?.selectedTemplates?.length || 0) - 1
            ), // 추가 템플릿 수
          },
          stats: {
            totalCost: workflow.stats?.totalCost || 0,
            targetsCount: workflow.target_config?.targetGroups?.length || 0, // target_config에서 타겟 그룹 수
          },
          estimatedCount:
            workflow.target_config?.targetGroups?.reduce(
              (total: number, group: any) =>
                total + (group.estimatedCount || 0),
              0
            ) || 0, // 모든 타겟 그룹의 예상 수 합계
          steps: workflow.message_config?.steps || [], // message_config에서 steps 가져오기
          createdAt: workflow.created_at || new Date().toISOString(), // 새로운 필드명 사용
          updatedAt: workflow.updated_at || new Date().toISOString(), // 새로운 필드명 사용
        })
      );

      setWorkflows(convertedWorkflows);
    } catch (error) {
      console.error("❌ 워크플로우 목록 로드 실패:", error);
      setError(
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 스케줄러 상태 로드
  const loadSchedulerStatus = async () => {
    try {
      console.log("🔄 스케줄러 상태 로드 시도...");

      // 상대 경로로 단순화
      const url = "/api/scheduler/monitor";
      console.log("📡 요청 URL:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        // 캐시 방지
        cache: "no-store",
      });

      console.log(
        "📡 스케줄러 API 응답:",
        response.status,
        response.statusText
      );

      if (response.ok) {
        const result = await response.json();
        console.log("📊 스케줄러 상태 결과:", result);

        if (result.success && result.data) {
          const { statistics, jobs } = result.data;

          // API 응답 구조에 맞게 상태 설정
          setSchedulerStatus({
            isRunning: statistics.running > 0 || statistics.pending > 0,
            totalJobs: statistics.total,
            pendingJobs: statistics.pending,
            runningJobs: statistics.running,
            completedJobs: statistics.completed,
            failedJobs: statistics.failed,
            activeWorkflows: workflows.filter((w) => w.status === "active")
              .length,
            scheduledWorkflows: statistics.pending, // 대기 중인 작업 수를 스케줄된 워크플로우로 표시
            totalExecutions: statistics.completed + statistics.failed,
            todayExecutions:
              jobs?.filter((j) => {
                const jobDate = new Date(j.scheduled_time).toDateString();
                const today = new Date().toDateString();
                return jobDate === today;
              }).length || 0,
            currentJobs: {
              pending: statistics.pending,
              running: statistics.running,
            },
            lastExecutionTime:
              jobs &&
              jobs.length > 0 &&
              jobs.find((j) => j.status === "completed")
                ? new Date(
                    jobs.find((j) => j.status === "completed").executed_at ||
                      jobs.find((j) => j.status === "completed").scheduled_time
                  ).toISOString()
                : "실행 기록 없음",
            nextJob:
              jobs &&
              jobs.length > 0 &&
              jobs.find((j) => j.status === "pending")
                ? {
                    workflow: {
                      name:
                        jobs.find((j) => j.status === "pending").workflow_data
                          ?.name || "Unknown",
                    },
                    scheduledTime: jobs.find((j) => j.status === "pending")
                      .scheduled_time,
                  }
                : null,
          });

          console.log("✅ 스케줄러 상태 업데이트 완료:", {
            pendingJobs: statistics.pending,
            runningJobs: statistics.running,
            upcomingJobsCount:
              jobs?.filter((j) => j.status === "pending").length || 0,
          });
        } else {
          console.warn("⚠️ 스케줄러 상태 로드 실패:", result.message);
          // 실패 시 기본값 설정
          setSchedulerStatus(getDefaultSchedulerStatus());
        }
      } else {
        console.error(
          "❌ 스케줄러 API 호출 실패:",
          response.status,
          response.statusText
        );

        // 404 오류인 경우 특별 처리
        if (response.status === 404) {
          console.error(
            "❌ API 엔드포인트를 찾을 수 없습니다. 라우트를 확인하세요."
          );
        }

        // HTTP 오류 시 기본값 설정
        setSchedulerStatus(getDefaultSchedulerStatus());
      }
    } catch (error) {
      console.error("❌ 스케줄러 상태 로드 실패:", error);

      // 네트워크 오류나 타임아웃 시 기본값 설정
      setSchedulerStatus(getDefaultSchedulerStatus());
    }
  };

  // 기본 스케줄러 상태 함수
  const getDefaultSchedulerStatus = () => ({
    isRunning: false,
    totalJobs: 0,
    pendingJobs: 0,
    runningJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    activeWorkflows: 0,
    scheduledWorkflows: 0,
    totalExecutions: 0,
    todayExecutions: 0,
    currentJobs: {
      pending: 0,
      running: 0,
    },
    lastExecutionTime: "실행 기록 없음",
    nextJob: null,
  });

  // 워크플로우 상태 변경 핸들러
  const handleToggleWorkflowStatus = async (
    workflowId: string,
    currentStatus: string
  ) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";

    try {
      console.log(
        `🔄 워크플로우 상태 변경: ${workflowId} (${currentStatus} → ${newStatus})`
      );
      const response = await fetch(`/api/supabase/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ 워크플로우 상태 변경 성공: ${newStatus}`);

        // UI 상태 즉시 업데이트
        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === workflowId ? { ...w, status: newStatus } : w
          )
        );

        // 🔥 워크플로우를 활성화할 때 스케줄 등록
        if (newStatus === "active") {
          console.log(`📅 워크플로우 활성화 후 스케줄 등록: ${workflowId}`);

          const scheduleResponse = await fetch("/api/scheduler/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          const scheduleResult = await scheduleResponse.json();

          if (scheduleResult.success) {
            console.log(`✅ 워크플로우 스케줄 등록 성공`);
            toast.success("워크플로우가 활성화되고 스케줄에 등록되었습니다.");
          } else {
            console.error(
              `❌ 워크플로우 스케줄 등록 실패:`,
              scheduleResult.message
            );
            toast.error(
              `워크플로우는 활성화되었지만 스케줄 등록에 실패했습니다: ${scheduleResult.message}`
            );
          }
        } else {
          toast.success("워크플로우가 일시정지되었습니다.");
        }
      } else {
        console.error("❌ 워크플로우 상태 변경 실패:", result.error);
        toast.error(`워크플로우 상태 변경에 실패했습니다: ${result.error}`);
      }
    } catch (error) {
      console.error("❌ 워크플로우 상태 변경 중 오류:", error);
      toast.error("워크플로우 상태 변경 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteClick = (workflow: DashboardWorkflow) => {
    setDeleteModal({
      isOpen: true,
      workflowId: workflow.id,
      workflowName: workflow.name,
    });
  };

  // 삭제 확인 핸들러
  const handleConfirmDelete = async () => {
    if (!deleteModal.workflowId) return;

    setIsDeleting(true);
    try {
      console.log(`🗑️ 워크플로우 삭제 시도: ${deleteModal.workflowId}`);

      const response = await fetch(
        `/api/supabase/workflows/${deleteModal.workflowId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      const result = await response.json();

      if (result.success) {
        console.log("✅ 워크플로우 삭제 성공");

        // UI에서 해당 워크플로우 제거
        setWorkflows((prev) =>
          prev.filter((w) => w.id !== deleteModal.workflowId)
        );

        // 성공 토스트
        toast.success("워크플로우가 삭제되었습니다");

        // 모달 닫기
        setDeleteModal({ isOpen: false, workflowId: null, workflowName: "" });
      } else {
        throw new Error(result.error || "삭제 실패");
      }
    } catch (error) {
      console.error("❌ 워크플로우 삭제 실패:", error);
      toast.error("워크플로우 삭제 중 오류가 발생했습니다");
    } finally {
      setIsDeleting(false);
    }
  };

  // 삭제 취소 핸들러
  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, workflowId: null, workflowName: "" });
  };

  // 즉시 실행 핸들러 추가
  const handleExecuteClick = (workflow: DashboardWorkflow) => {
    setExecuteModal({
      isOpen: true,
      workflowId: workflow.id,
      workflowName: workflow.name,
      estimatedCount: workflow.estimatedCount || 0,
    });
  };

  const handleConfirmExecute = async () => {
    if (!executeModal.workflowId) return;

    try {
      console.log(`🚀 워크플로우 즉시 실행: ${executeModal.workflowId}`);

      const response = await fetch(`/api/workflow/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: executeModal.workflowId,
          enableRealSending: true,
          scheduleConfig: { type: 'immediate' }, // 즉시 실행 명시
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("워크플로우 실행이 시작되었습니다.");
        setExecuteModal({ isOpen: false, workflowId: null, workflowName: "" });
      } else {
        throw new Error(result.error || "실행 실패");
      }
    } catch (error) {
      console.error("❌ 워크플로우 실행 실패:", error);
      toast.error(`워크플로우 실행에 실패했습니다: ${error.message}`);
    }
  };

  useEffect(() => {
    loadWorkflows();
    loadSchedulerStatus();

    // 10초마다 스케줄러 상태만 업데이트 (워크플로우 목록 자동 새로고침 제거)
    const schedulerInterval = setInterval(loadSchedulerStatus, 10000);

    return () => {
      clearInterval(schedulerInterval);
    };
  }, []);

  // 실제 워크플로우 데이터를 기반으로 통계 계산
  const activeWorkflowsCount = workflows.filter(
    (w) => w.status === "active"
  ).length;
  const totalSent = workflows.reduce((sum, w) => sum + w.sent, 0);
  const draftWorkflowsCount = workflows.filter(
    (w) => w.status === "draft"
  ).length;
  const pausedWorkflowsCount = workflows.filter(
    (w) => w.status === "paused"
  ).length;

  // 필터링된 워크플로우 목록
  const filteredWorkflows = workflows.filter((workflow) => {
    const matchesSearch =
      workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workflow.templateInfo?.templateName
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      workflow.trigger_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || workflow.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = [
    {
      title: "전체 워크플로우",
      value: workflows.length,
      icon: Target,
      color: "text-purple-600",
    },
    {
      title: "활성 워크플로우",
      value: activeWorkflowsCount,
      icon: Play,
      color: "text-green-600",
    },
    {
      title: "총 발송 수",
      value: totalSent.toLocaleString(),
      icon: MessageSquare,
      color: "text-blue-600",
    },
    {
      title: "초안",
      value: draftWorkflowsCount,
      icon: FileText,
      color: "text-gray-600",
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: "활성", color: "bg-green-100 text-green-800" },
      paused: { label: "일시정지", color: "bg-yellow-100 text-yellow-800" },
      draft: { label: "초안", color: "bg-gray-100 text-gray-800" },
      archived: { label: "보관됨", color: "bg-red-100 text-red-800" },
    };
    return (
      statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                알림톡 자동화
              </h1>
              <p className="text-gray-600 mt-1">
                워크플로우를 만들어 메시지를 자동으로 발송하세요
              </p>
            </div>

            {/* 주요 액션 버튼 및 사용자 메뉴 */}
            <div className="flex items-center gap-3">
              <Link href="/docs">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  API 문서
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={loadWorkflows}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                {isLoading ? "로딩 중..." : "새로고침"}
              </Button>
              <Link href="/workflow/new">
                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 shadow-lg"
                >
                  <Plus className="w-5 h-5 mr-2" />새 워크플로우
                </Button>
              </Link>
              <UserMenu />
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
                    <p className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>
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
                <Link href="/scheduler" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Clock className="w-4 h-4 mr-2" />
                    스케줄러 모니터링
                  </Button>
                </Link>
                <Link href="/scheduler?tab=health" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    스케줄러 헬스체크
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open("/api/system/cleanup", "_blank")}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  시스템 정리 체크
                </Button>
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
                  템플릿 관리 및 메시지 발송 도구
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/message-logs" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    메시지 발송 로그
                  </Button>
                </Link>
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <span>스케줄러 상태</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadSchedulerStatus}
                    className="text-orange-600 hover:bg-orange-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
                <CardDescription>자동 실행 스케줄러 모니터링</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {schedulerStatus ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">상태</span>
                      <Badge
                        variant={
                          schedulerStatus?.isRunning ? "default" : "secondary"
                        }
                        className="h-5"
                      >
                        {schedulerStatus?.isRunning ? (
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
                        <span className="text-gray-600">활성 워크플로우:</span>
                        <span className="font-medium">
                          {schedulerStatus?.activeWorkflows || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">스케줄 설정:</span>
                        <span className="font-medium text-blue-600">
                          {schedulerStatus?.scheduledWorkflows || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">전체 실행:</span>
                        <span className="font-medium text-green-600">
                          {schedulerStatus?.totalExecutions || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">오늘 실행:</span>
                        <span className="font-medium text-orange-600">
                          {schedulerStatus?.todayExecutions || 0}
                        </span>
                      </div>
                    </div>

                    {/* 현재 작업 상태 (메모리 기반) */}
                    {schedulerStatus?.currentJobs && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <div className="font-medium text-gray-700 mb-1">
                          현재 작업 상태:
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <span>
                            대기:{" "}
                            {schedulerStatus?.currentJobs?.pending ||
                              schedulerStatus?.pendingJobs ||
                              0}
                          </span>
                          <span>
                            실행:{" "}
                            {schedulerStatus?.currentJobs?.running ||
                              schedulerStatus?.runningJobs ||
                              0}
                          </span>
                        </div>
                      </div>
                    )}

                    {schedulerStatus?.nextJob && (
                      <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
                        <div className="font-medium text-blue-800">
                          다음 실행 예정:
                        </div>
                        <div className="text-blue-600">
                          {schedulerStatus.nextJob.workflow.name}
                        </div>
                        <div className="text-blue-500">
                          {new Date(
                            schedulerStatus.nextJob.scheduledTime
                          ).toLocaleString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          (KST)
                        </div>
                      </div>
                    )}

                    {schedulerStatus?.lastExecutionTime && (
                      <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                        <div className="font-medium text-green-800">
                          최근 실행:
                        </div>
                        <div className="text-green-600">
                          {new Date(
                            schedulerStatus.lastExecutionTime
                          ).toLocaleString("ko-KR", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          (KST)
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-sm text-gray-500">
                      상태 확인 중...
                    </span>
                  </div>
                )}

                {/* 스케줄러 모니터링 페이지 링크 */}
                <Link href="/scheduler" className="block mt-3">
                  <Button variant="outline" className="w-full justify-start">
                    <Monitor className="w-4 h-4 mr-2" />
                    상세 모니터링
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* 워크플로우 목록 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              {/* 워크플로우 목록 헤더 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  <span className="text-lg font-semibold">워크플로우 목록</span>
                  <span className="text-sm text-gray-500">
                    자동화된 메시지 워크플로우를 관리하세요
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadWorkflows}
                    className="text-purple-600 hover:bg-purple-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button asChild>
                    <Link href="/workflow/new">
                      <Plus className="w-4 h-4 mr-2" />새 워크플로우
                    </Link>
                  </Button>
                </div>
              </div>

              {/* 검색 및 필터 */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="워크플로우 이름, 템플릿, 트리거로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">모든 상태</option>
                    <option value="active">활성</option>
                    <option value="paused">일시정지</option>
                    <option value="draft">초안</option>
                  </select>

                  {(searchTerm || statusFilter !== "all") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                      }}
                    >
                      초기화
                    </Button>
                  )}
                </div>
              </div>

              {/* 필터링 결과 표시 */}
              {filteredWorkflows.length !== workflows.length && (
                <div className="text-sm text-gray-600 mt-2">
                  총 {workflows.length}개 중 {filteredWorkflows.length}개 표시
                </div>
              )}
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
                    <p className="font-medium">
                      워크플로우 목록을 불러올 수 없습니다
                    </p>
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
                    <p className="font-medium">
                      아직 생성된 워크플로우가 없습니다
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      첫 번째 워크플로우를 만들어보세요!
                    </p>
                  </div>
                  <Link href="/workflow/new">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />새 워크플로우 만들기
                    </Button>
                  </Link>
                </div>
              ) : filteredWorkflows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="text-gray-500 text-center">
                    <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-medium">검색 결과가 없습니다</p>
                    <p className="text-sm text-gray-400 mt-1">
                      다른 검색어나 필터를 시도해보세요
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                    }}
                  >
                    필터 초기화
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredWorkflows.map((workflow) => (
                    <Card
                      key={workflow.id}
                      className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500"
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          {/* 왼쪽: 주요 정보 */}
                          <div className="flex-1">
                            {/* 제목 및 상태 */}
                            <div className="flex items-center gap-3 mb-3">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  workflow.status === "active"
                                    ? "bg-green-500"
                                    : workflow.status === "paused"
                                    ? "bg-yellow-500"
                                    : "bg-gray-400"
                                }`}
                              />
                              <h3 className="text-lg font-semibold text-gray-900">
                                {workflow.name}
                              </h3>
                              <Badge
                                variant={
                                  workflow.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                                className={`${
                                  getStatusBadge(workflow.status).color
                                }`}
                              >
                                {getStatusBadge(workflow.status).label}
                              </Badge>
                            </div>

                            {/* 템플릿 정보 - 눈에 띄게 */}
                            {workflow.templateInfo && (
                              <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="w-4 h-4 text-blue-600" />
                                  <span className="font-medium text-blue-900">
                                    사용 템플릿
                                  </span>
                                </div>
                                <div className="mt-1 text-blue-800">
                                  {workflow.templateInfo.templateName}
                                  {workflow.templateInfo.additionalTemplates >
                                    0 && (
                                    <span className="ml-2 text-sm text-blue-600">
                                      (+
                                      {
                                        workflow.templateInfo
                                          .additionalTemplates
                                      }
                                      개 더)
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* 상세 정보 그리드 */}
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-purple-500" />
                                <div>
                                  <div className="text-gray-500">트리거</div>
                                  <div className="font-medium">
                                    {workflow.trigger_type}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-green-500" />
                                <div>
                                  <div className="text-gray-500">발송 건수</div>
                                  <div className="font-medium">
                                    {workflow.sent.toLocaleString()}건
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-orange-500" />
                                <div>
                                  <div className="text-gray-500">최근 실행</div>
                                  <div className="font-medium text-xs">
                                    {workflow.lastRun}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* 스케줄 정보 - 별도 섹션 */}
                            {/* The original code had a schedule_config check here,
                                but the new loadWorkflows function doesn't return it.
                                Assuming it's no longer needed or will be added back.
                                For now, removing the check as it's not in the new data structure. */}
                            {/*
                            {(workflow as any).schedule_config && (
                              <div className="mt-3 p-2 bg-orange-50 rounded border border-orange-200">
                                <div className="flex items-center gap-2 text-orange-800">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-xs font-medium">
                                    스케줄:
                                  </span>
                                  <span className="text-xs">
                                    {(() => {
                                      const schedule = (workflow as any)
                                        .schedule_config;
                                      switch (schedule.type) {
                                        case "immediate":
                                          return "즉시 발송";
                                        case "delay":
                                          return `지연 발송 (${schedule.delay}분 후)`;
                                        case "scheduled":
                                          const scheduledTime = new Date(
                                            schedule.scheduledTime
                                          );
                                          return `예약 발송 (${scheduledTime.toLocaleString(
                                            "ko-KR",
                                            {
                                              timeZone: "Asia/Seoul",
                                              month: "short",
                                              day: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            }
                                          )})`;
                                        case "recurring":
                                          const pattern =
                                            schedule.recurringPattern;
                                          if (pattern) {
                                            const freq =
                                              pattern.frequency === "daily"
                                                ? "매일"
                                                : pattern.frequency === "weekly"
                                                ? "매주"
                                                : pattern.frequency ===
                                                  "monthly"
                                                ? "매월"
                                                : "반복";
                                            return `${freq} ${pattern.time}`;
                                          }
                                          return "반복 발송";
                                        default:
                                          return "스케줄 설정됨";
                                      }
                                    })()}
                                  </span>
                                </div>
                              </div>
                            )}
                            */}
                          </div>

                          {/* 오른쪽: 액션 버튼 */}
                          <div className="flex flex-col gap-2 ml-6">
                            {workflow.status === "active" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleToggleWorkflowStatus(
                                    workflow.id,
                                    workflow.status
                                  )
                                }
                                className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                              >
                                <Pause className="w-4 h-4 mr-1" />
                                일시정지
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleToggleWorkflowStatus(
                                    workflow.id,
                                    workflow.status
                                  )
                                }
                                className="text-green-600 border-green-200 hover:bg-green-50"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                시작
                              </Button>
                            )}
                            <Link href={`/workflow/${workflow.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full"
                              >
                                <Settings className="w-4 h-4 mr-1" />
                                설정
                              </Button>
                            </Link>
                            {/* 새로 추가할 삭제 버튼 */}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(workflow)}
                              className="w-full text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              삭제
                            </Button>
                            {/* 삭제 확인 모달 */}
                            {deleteModal.isOpen && (
                              <div className="fixed inset-0 z-50">
                                {/* 배경 오버레이 - 클릭하면 닫기 */}
                                <div
                                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                                  onClick={handleCancelDelete}
                                />

                                {/* 모달 컨텐츠 */}
                                <div className="relative flex items-center justify-center min-h-full p-4">
                                  <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
                                    <div className="flex items-center gap-3 mb-4">
                                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                        <Trash2 className="w-5 h-5 text-red-600" />
                                      </div>
                                      <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                          워크플로우 삭제
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                          이 작업은 되돌릴 수 없습니다
                                        </p>
                                      </div>
                                    </div>

                                    <div className="mb-6">
                                      <div className="bg-gray-50 p-3 rounded-lg mb-4">
                                        <p className="font-medium text-sm">
                                          삭제할 워크플로우:
                                        </p>
                                        <p className="text-gray-700">
                                          {deleteModal.workflowName}
                                        </p>
                                      </div>

                                      <div className="text-sm text-gray-600 space-y-1">
                                        <p>
                                          • 워크플로우와 관련된 스케줄이
                                          중단됩니다
                                        </p>
                                        <p>• 실행 기록은 유지됩니다</p>
                                        <p>• 이 작업은 취소할 수 없습니다</p>
                                      </div>
                                    </div>

                                    <div className="flex gap-3">
                                      <Button
                                        variant="outline"
                                        onClick={handleCancelDelete}
                                        className="flex-1"
                                        disabled={isDeleting}
                                      >
                                        취소
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={handleConfirmDelete}
                                        className="flex-1"
                                        disabled={isDeleting}
                                      >
                                        {isDeleting ? "삭제 중..." : "삭제"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {/* 즉시 실행 버튼 (웹훅이 아닐 때만 표시) */}
                            {workflow.trigger_type !== "webhook" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExecuteClick(workflow)}
                                className="bg-orange-50 border-orange-200 hover:bg-orange-100"
                                title="조건에 맞는 모든 대상자에게 즉시 발송"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                즉시 실행
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
                  <h3 className="font-semibold text-gray-900">
                    하이브리드 시스템 운영 중
                  </h3>
                  <p className="text-sm text-gray-600">
                    MySQL(데이터 조회) + Supabase(기록 저장) 아키텍처로 안정적인
                    서비스를 제공합니다
                  </p>
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
      {/* 즉시 실행 확인 다이얼로그 */}
      <Dialog
        open={executeModal.isOpen}
        onOpenChange={(open) =>
          !open &&
          setExecuteModal({ isOpen: false, workflowId: null, workflowName: "" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>워크플로우 즉시 실행</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">
              <span className="font-medium">{executeModal.workflowName}</span>{" "}
              워크플로우를 지금 실행하시겠습니까?
            </p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">실행 시 주의사항</span>
              </div>
              <ul className="mt-2 space-y-1 text-orange-700 text-sm pl-6 list-disc">
                <li>현재 조건에 맞는 모든 대상자에게 메시지가 발송됩니다.</li>
                <li>
                  예상 발송 대상:{" "}
                  {executeModal.estimatedCount?.toLocaleString()}명
                </li>
                <li>실행 후 취소할 수 없습니다.</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setExecuteModal({
                  isOpen: false,
                  workflowId: null,
                  workflowName: "",
                })
              }
            >
              취소
            </Button>
            <Button
              variant="default"
              onClick={handleConfirmExecute}
              className="bg-orange-600 hover:bg-orange-700"
            >
              실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
