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
      console.log("워크플로우 저장 시도:", workflow)
      
      // Supabase API를 통해 워크플로우 저장
      const response = await fetch('/api/supabase/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          ...workflow
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '워크플로우 저장에 실패했습니다.');
      }

      console.log("워크플로우 저장 성공:", result.data);
      
      // 기존 localStorage 저장도 유지 (호환성을 위해)
      const savedWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]")
      savedWorkflows.push(result.data)
      localStorage.setItem("workflows", JSON.stringify(savedWorkflows))
      
      alert("워크플로우가 Supabase에 성공적으로 저장되었습니다!")
      router.push("/")
    } catch (error) {
      console.error("워크플로우 저장 실패:", error)
      
      // Supabase 저장 실패 시 localStorage에라도 저장
      try {
        const savedWorkflows = JSON.parse(localStorage.getItem("workflows") || "[]")
        savedWorkflows.push(workflow)
        localStorage.setItem("workflows", JSON.stringify(savedWorkflows))
        alert("Supabase 저장에 실패했지만 로컬에 임시 저장되었습니다.")
      } catch (localError) {
        alert("저장에 완전히 실패했습니다.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleTest = async (workflow: Workflow) => {
    try {
      console.log("워크플로우 테스트 실행:", workflow)
      
      // 테스트 API 호출
      const response = await fetch('/api/workflow/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workflow })
      });

      const result = await response.json();
      
      if (result.success) {
        alert("테스트가 성공적으로 실행되었습니다!")
        console.log("테스트 결과:", result)
      } else {
        alert(`테스트 실행 실패: ${result.message}`)
      }
    } catch (error) {
      console.error("테스트 실행 실패:", error)
      alert("테스트 실행 중 오류가 발생했습니다.")
    }
  }

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
              <h1 className="text-xl font-semibold text-gray-900">새 워크플로우 만들기</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WorkflowBuilder 
          onSave={handleSave} 
          onTest={handleTest}
        />
      </div>
    </div>
  )
}
