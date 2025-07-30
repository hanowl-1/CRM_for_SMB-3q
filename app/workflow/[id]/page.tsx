"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { WorkflowBuilder } from "@/components/workflow/workflow-builder";
import { Workflow } from "@/lib/types/workflow";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        const workflowId = params.id as string;

        // 1. Supabase에서 워크플로우 조회
        try {
          console.log("📊 Supabase에서 워크플로우 조회 중...", workflowId);

          const response = await fetch(`/api/supabase/workflows/${workflowId}`);

          if (response.ok) {
            const result = await response.json();

            if (result.success && result.data) {
              console.log("✅ Supabase에서 워크플로우 찾음:", result.data);
              // const convertedWorkflow = convertSupabaseToWorkflow(result.data);
              setWorkflow(result.data);
              setIsLoading(false);
              return;
            }
          }
        } catch (supabaseError) {
          console.error("Supabase 워크플로우 조회 실패:", supabaseError);
        }

        // 3. 샘플 워크플로우인지 확인 (실제로는 없지만 UI에서 링크가 있음)
        const sampleWorkflows = [
          { id: "1", name: "신규 회원 환영 워크플로우" },
          { id: "2", name: "장바구니 미완료 알림" },
          { id: "3", name: "VIP 고객 특별 혜택" },
          { id: "4", name: "생일 축하 메시지" },
          { id: "5", name: "구매 후 리뷰 요청" },
          { id: "6", name: "재구매 유도 메시지" },
          { id: "7", name: "이벤트 참여 안내" },
        ];

        const sampleWorkflow = sampleWorkflows.find((w) => w.id === workflowId);
        if (sampleWorkflow) {
          // 샘플 워크플로우는 편집할 수 없음을 알림
          setNotFound(true);
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error("워크플로우 로드 실패:", error);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkflow();
  }, [params.id]);

  // 워크플로우 업데이트
  const handleUpdate = async (updatedWorkflow: Workflow) => {
    console.log(updatedWorkflow);

    setIsSaving(true);
    try {
      // Supabase 워크플로우 업데이트
      console.log("🌐 Supabase API 호출 준비 중...");
      console.log("📊 Supabase 워크플로우 업데이트 중...", updatedWorkflow.id);

      // 🔥 스케줄 설정만 별도로 전송 (백엔드 API가 scheduleSettings 필드를 별도 처리하기 때문)
      const updatePayload = {
        name: updatedWorkflow.name,
        description: updatedWorkflow.description,
        status: updatedWorkflow.status,
        message_config: updatedWorkflow.message_config,
        target_config: updatedWorkflow.target_config,
        variables: updatedWorkflow.variables,
        schedule_config: updatedWorkflow.schedule_config,
        trigger_config: updatedWorkflow.trigger_config,
      };

      // console.log("📤 전송할 스케줄 설정:", updatePayload.scheduleSettings);
      // console.log("📤 전송할 전체 데이터:", updatePayload);

      const apiUrl = `/api/supabase/workflows/${updatedWorkflow.id}`;

      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      console.log("📨 API 응답 받음:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (response.ok) {
        const result = await response.json();
        console.log("📋 API 응답 데이터:", result);

        if (result.success) {
          console.log("✅ Supabase 워크플로우 업데이트 성공");
          alert("워크플로우가 업데이트되었습니다!");
          router.push("/");
          return;
        } else {
          throw new Error(result.message || "Supabase 업데이트 실패");
        }
      } else {
        const errorText = await response.text();
        console.error("❌ API 응답 오류:", {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl,
          body: errorText,
          headers: Object.fromEntries(response.headers.entries()),
        });
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`
        );
      }
    } catch (error) {
      console.error("❌ 워크플로우 업데이트 실패:", error);
      console.error("❌ 전체 오류 정보:", {
        message: error instanceof Error ? error.message : "알 수 없는 오류",
        stack: error instanceof Error ? error.stack : "스택 없음",
        error,
      });
      alert(
        `업데이트에 실패했습니다.\n\n오류: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 워크플로우 테스트
  const handleTest = async (workflow: Workflow) => {
    setIsSaving(true);
    try {
      // 테스트 실행 API 호출
      const response = await fetch("/api/workflow/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflow,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // 스케줄 테스트인 경우
        if (result.scheduledTest) {
          let message = `⏰ 스케줄 테스트가 등록되었습니다!\n\n`;

          // 스케줄 정보
          if (result.scheduleInfo) {
            message += `📅 스케줄 정보:\n`;
            message += `• 타입: ${
              result.scheduleInfo.type === "delay"
                ? "지연 발송"
                : result.scheduleInfo.type === "scheduled"
                ? "예약 발송"
                : result.scheduleInfo.type === "recurring"
                ? "반복 발송"
                : "즉시 발송"
            }\n`;

            if (result.scheduleInfo.type === "delay") {
              message += `• 지연 시간: ${result.scheduleInfo.delay}분\n`;
            } else if (result.scheduleInfo.type === "scheduled") {
              message += `• 예약 시간: ${new Date(
                result.scheduleInfo.scheduledTime
              ).toLocaleString("ko-KR")}\n`;
            } else if (result.scheduleInfo.type === "recurring") {
              const pattern = result.scheduleInfo.recurringPattern;
              if (pattern) {
                message += `• 반복 주기: ${
                  pattern.frequency === "daily"
                    ? "매일"
                    : pattern.frequency === "weekly"
                    ? "매주"
                    : pattern.frequency === "monthly"
                    ? "매월"
                    : "기타"
                }\n`;
                message += `• 발송 시간: ${pattern.time}\n`;
              }
            }

            message += `• 타임존: ${result.scheduleInfo.timezone}\n\n`;
          }

          // 테스트 설정 정보
          message += `📋 테스트 설정:\n`;
          message += `• 수신번호: ${result.testSettings.phoneNumber}\n`;
          message += `• 실제 발송: ${
            result.testSettings.enableRealSending ? "✅ 활성화" : "❌ 비활성화"
          }\n`;
          message += `• SMS 대체: ${
            result.testSettings.fallbackToSMS ? "✅ 활성화" : "❌ 비활성화"
          }\n\n`;

          // 스케줄러 등록 정보
          if (result.jobId) {
            message += `🔧 스케줄러 정보:\n`;
            message += `• Job ID: ${result.jobId}\n`;
          }
          message += `• 등록 시간: ${new Date(
            result.executionTime
          ).toLocaleString("ko-KR")}\n\n`;

          // 발송 상태
          message += `📡 상태: ${result.realSendingStatus}\n\n`;

          message += `✨ 설정된 시간에 테스트 메시지가 자동으로 발송됩니다.`;

          alert(message);
          return;
        }

        // 즉시 테스트 결과 (기존 로직)
        let message = `🎯 워크플로우 테스트 완료!\n\n`;

        // 테스트 설정 정보
        message += `📋 테스트 설정:\n`;
        message += `• 수신번호: ${result.testSettings.phoneNumber}\n`;
        message += `• 실제 발송: ${
          result.testSettings.enableRealSending ? "✅ 활성화" : "❌ 비활성화"
        }\n`;
        message += `• SMS 대체: ${
          result.testSettings.fallbackToSMS ? "✅ 활성화" : "❌ 비활성화"
        }\n`;
        message += `• 실행 시간: ${new Date(
          result.executionTime
        ).toLocaleString("ko-KR")}\n\n`;

        // 환경변수 상태 정보 추가
        if (result.envStatus) {
          message += `🔧 환경변수 상태:\n`;
          message += `• COOLSMS API 키: ${
            result.envStatus.COOLSMS_API_KEY ? "✅ 설정됨" : "❌ 누락"
          }\n`;
          message += `• COOLSMS API 시크릿: ${
            result.envStatus.COOLSMS_API_SECRET ? "✅ 설정됨" : "❌ 누락"
          }\n`;
          message += `• 카카오 발신키: ${
            result.envStatus.KAKAO_SENDER_KEY ? "✅ 설정됨" : "❌ 누락"
          }\n`;
          message += `• 테스트 전화번호: ${
            result.envStatus.phoneNumber || "❌ 누락"
          }\n\n`;
        }

        // 실제 발송 상태
        if (result.realSendingStatus) {
          message += `📡 발송 상태: ${result.realSendingStatus}\n\n`;
        }

        // 각 단계별 결과
        message += `📊 실행 결과:\n`;
        result.results.forEach((step: any) => {
          const statusIcon = step.status === "success" ? "✅" : "❌";
          message += `${statusIcon} 단계 ${step.step}: ${step.message}\n`;

          if (step.variables && Object.keys(step.variables).length > 0) {
            message += `   🔧 사용된 변수: ${
              Object.keys(step.variables).length
            }개\n`;
          }

          if (step.processedContent) {
            const preview =
              step.processedContent.length > 50
                ? step.processedContent.substring(0, 50) + "..."
                : step.processedContent;
            message += `   💬 메시지: ${preview}\n`;
          }

          if (step.fallbackToSMS) {
            message += `   📱 SMS 대체 발송됨\n`;
          }

          message += `\n`;
        });

        // 성공/실패 요약
        const successCount = result.results.filter(
          (r: any) => r.status === "success"
        ).length;
        const totalCount = result.results.length;
        message += `📈 요약: ${successCount}/${totalCount} 단계 성공`;

        alert(message);
      } else {
        const errorResult = await response.json();
        throw new Error(errorResult.message || "테스트 실행 실패");
      }
    } catch (error) {
      console.error("테스트 실행 실패:", error);
      alert(
        `❌ 테스트 실행에 실패했습니다.\n\n오류: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>워크플로우를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center py-6">
              <Link href="/">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  돌아가기
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  워크플로우를 찾을 수 없습니다
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                워크플로우를 찾을 수 없습니다
              </h2>
              <p className="text-gray-600 text-center mb-6">
                요청하신 워크플로우가 존재하지 않거나 삭제되었을 수 있습니다.
                <br />
                샘플 워크플로우는 편집할 수 없습니다.
              </p>
              <div className="flex gap-3">
                <Link href="/">
                  <Button variant="outline">메인으로 돌아가기</Button>
                </Link>
                <Link href="/workflow/new">
                  <Button>새 워크플로우 만들기</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mr-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                돌아가기
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                워크플로우 설정
              </h1>
              <p className="text-gray-600">{workflow?.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {workflow && (
          <WorkflowBuilder
            workflow={workflow}
            onSave={handleUpdate}
            onTest={handleTest}
          />
        )}
      </div>

      {/* Loading Overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-center">처리 중...</p>
          </div>
        </div>
      )}
    </div>
  );
}
