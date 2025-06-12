"use client"

import React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { WorkflowBuilder } from "@/components/workflow/workflow-builder"
import { Workflow } from "@/lib/types/workflow"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NewWorkflowPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async (workflow: Workflow) => {
    setIsLoading(true)
    try {
      // 실제 구현에서는 API 호출
      console.log("워크플로우 저장:", workflow)
      
      // 로컬 스토리지에 임시 저장 (개발용)
      const savedWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]")
      savedWorkflows.push(workflow)
      localStorage.setItem("workflows", JSON.stringify(savedWorkflows))
      
      alert("워크플로우가 저장되었습니다!")
      router.push("/")
    } catch (error) {
      console.error("워크플로우 저장 실패:", error)
      alert("저장에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleTest = async (workflow: Workflow) => {
    setIsLoading(true)
    try {
      // 테스트 실행 API 호출
      const response = await fetch("/api/workflow/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflow
          // testPhoneNumber는 서버에서 환경변수로 처리
        }),
      })

      if (response.ok) {
        const result = await response.json()
        
        // 결과를 더 자세히 표시
        let message = `테스트 실행 완료!\n\n`;
        message += `테스트 모드: ${result.testMode ? '활성화' : '비활성화'}\n`;
        message += `실행 시간: ${new Date(result.executionTime).toLocaleString()}\n\n`;
        
        result.results.forEach((step: any, index: number) => {
          message += `단계 ${step.step}: ${step.status === 'success' ? '✅' : '❌'} ${step.message}\n`;
          if (step.processedContent) {
            message += `메시지: ${step.processedContent.substring(0, 50)}...\n`;
          }
          if (step.fallbackToSMS) {
            message += `📱 SMS 대체 발송됨\n`;
          }
          message += `\n`;
        });
        
        alert(message)
      } else {
        throw new Error("테스트 실행 실패")
      }
    } catch (error) {
      console.error("테스트 실행 실패:", error)
      alert("테스트 실행에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
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
              <h1 className="text-2xl font-bold text-gray-900">새 워크플로우 만들기</h1>
              <p className="text-gray-600">자동화된 메시지 발송 워크플로우를 설정하세요</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WorkflowBuilder
          onSave={handleSave}
          onTest={handleTest}
        />
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-center">처리 중...</p>
          </div>
        </div>
      )}
    </div>
  )
}
