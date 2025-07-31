"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkflowBuilder } from "@/components/workflow/workflow-builder";
import { Workflow } from "@/lib/types/workflow";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// UUID 생성 함수 추가
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (workflow: Workflow) => {
    setIsSaving(true);
    try {
      const requestData = {
        name: workflow.name,
        description: workflow.description,
        trigger_type: workflow.trigger_type,
        status: workflow.status,
        message_config: workflow.message_config,
        target_config: workflow.target_config,
        variables: workflow.variables,
        schedule_config: workflow.schedule_config,
        trigger_config: workflow.trigger_config,
        createdBy: "user",
      };

      // console.log("API 요청 데이터:", requestData);

      // Supabase에 워크플로우 저장
      const response = await fetch("/api/supabase/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log("✅ Supabase 저장 성공:", result.data.id);
          alert("워크플로우가 성공적으로 저장되었습니다!");
          router.push("/");
          return;
        } else {
          throw new Error(result.message || "Supabase 저장 실패");
        }
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error("❌ 워크플로우 저장 실패:", error);
      alert(
        `저장에 실패했습니다.\n\n오류: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (workflow: Workflow) => {
    setIsSaving(true);
    try {
      console.log("🔍 테스트할 워크플로우 데이터:", {
        name: workflow.name,
        status: workflow.status,
        trigger_type: workflow.trigger_type,
        message_config: workflow.message_config,
        target_config: workflow.target_config,
        variables: workflow.variables,
        schedule_config: workflow.schedule_config,
      });

      // 테스트 실행 API 호출
      const response = await fetch("/api/workflow/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workflow }),
      });

      const result = await response.json();

      if (result.success) {
        alert("테스트가 성공적으로 실행되었습니다!");
        console.log("테스트 결과:", result);
      } else {
        alert(`테스트 실행 실패: ${result.message}`);
      }
    } catch (error) {
      console.error("테스트 실행 실패:", error);
      alert("테스트 실행 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  돌아가기
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">
                새 워크플로우 만들기
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WorkflowBuilder onSave={handleSave} onTest={handleTest} />
      </div>
    </div>
  );
}
