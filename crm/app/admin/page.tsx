"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Database, 
  Server, 
  MessageSquare, 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Play
} from "lucide-react"

interface SupabaseStatus {
  isInitialized: boolean;
  totalTables: number;
  existingTables: string[];
  missingTables: string[];
  workflowCount: number;
}

export default function AdminPage() {
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Supabase 상태 확인
  const checkSupabaseStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/supabase/init');
      const result = await response.json();
      
      if (result.success) {
        setSupabaseStatus(result.data);
      } else {
        console.error('Supabase 상태 확인 실패:', result.message);
      }
    } catch (error) {
      console.error('Supabase 상태 확인 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Supabase 스키마 초기화
  const initializeSupabase = async () => {
    setIsInitializing(true);
    try {
      const response = await fetch('/api/supabase/init', {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        alert(`스키마 초기화 완료!\n${result.message}`);
        // 상태 다시 확인
        await checkSupabaseStatus();
      } else {
        alert(`스키마 초기화 실패: ${result.message}`);
      }
    } catch (error) {
      console.error('스키마 초기화 오류:', error);
      alert('스키마 초기화 중 오류가 발생했습니다.');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    checkSupabaseStatus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold text-gray-900">시스템 관리</h1>
            <Button 
              onClick={checkSupabaseStatus}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              상태 새로고침
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Supabase 데이터베이스 상태 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Supabase 데이터베이스
              </CardTitle>
              <CardDescription>
                워크플로우 데이터 저장소 상태
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : supabaseStatus ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">초기화 상태</span>
                    {supabaseStatus.isInitialized ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        완료
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        미완료
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>총 테이블:</span>
                      <span className="font-medium">{supabaseStatus.totalTables}개</span>
                    </div>
                    <div className="flex justify-between">
                      <span>워크플로우:</span>
                      <span className="font-medium">{supabaseStatus.workflowCount}개</span>
                    </div>
                    {supabaseStatus.missingTables.length > 0 && (
                      <div className="text-red-600">
                        <span>누락된 테이블: {supabaseStatus.missingTables.length}개</span>
                      </div>
                    )}
                  </div>

                  {!supabaseStatus.isInitialized && (
                    <Button 
                      onClick={initializeSupabase}
                      disabled={isInitializing}
                      className="w-full"
                      size="sm"
                    >
                      <Play className={`h-4 w-4 mr-2 ${isInitializing ? 'animate-spin' : ''}`} />
                      {isInitializing ? '초기화 중...' : '스키마 초기화'}
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex items-center text-red-600">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span className="text-sm">상태 확인 실패</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* MySQL 연결 상태 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Server className="h-5 w-5 mr-2" />
                MySQL 데이터베이스
              </CardTitle>
              <CardDescription>
                기존 고객 데이터 읽기 전용 연결
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">연결 상태</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  연결됨
                </Badge>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>호스트:</span>
                  <span className="font-medium text-xs">supermembers-prod</span>
                </div>
                <div className="flex justify-between">
                  <span>데이터베이스:</span>
                  <span className="font-medium">supermembers</span>
                </div>
                <div className="flex justify-between">
                  <span>사용자:</span>
                  <span className="font-medium">readonly</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 메시지 서비스 상태 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                메시지 서비스
              </CardTitle>
              <CardDescription>
                SMS/카카오톡 발송 서비스 상태
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">CoolSMS API</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    활성
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">카카오 알림톡</span>
                  <Badge variant="secondary">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    설정 필요
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>발신번호:</span>
                    <span className="font-medium">1800-7710</span>
                  </div>
                  <div className="flex justify-between">
                    <span>발신키:</span>
                    <span className="font-medium text-xs">KA01PF...</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 시스템 설정 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                시스템 설정
              </CardTitle>
              <CardDescription>
                전체 시스템 구성 및 환경변수
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">환경변수</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    설정됨
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>개발 모드:</span>
                    <span className="font-medium">활성화</span>
                  </div>
                  <div className="flex justify-between">
                    <span>포트:</span>
                    <span className="font-medium">3002</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Node.js:</span>
                    <span className="font-medium">v18+</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 워크플로우 통계 */}
          <Card>
            <CardHeader>
              <CardTitle>워크플로우 통계</CardTitle>
              <CardDescription>
                전체 워크플로우 실행 현황
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>총 워크플로우:</span>
                  <span className="font-medium">{supabaseStatus?.workflowCount || 0}개</span>
                </div>
                <div className="flex justify-between">
                  <span>활성 워크플로우:</span>
                  <span className="font-medium">0개</span>
                </div>
                <div className="flex justify-between">
                  <span>총 발송 건수:</span>
                  <span className="font-medium">0건</span>
                </div>
                <div className="flex justify-between">
                  <span>성공률:</span>
                  <span className="font-medium">-</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 최근 활동 */}
          <Card>
            <CardHeader>
              <CardTitle>최근 활동</CardTitle>
              <CardDescription>
                시스템 로그 및 활동 내역
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <div>• 시스템 시작됨</div>
                <div>• Supabase 연결 확인됨</div>
                <div>• MySQL 연결 확인됨</div>
                <div>• 환경변수 로드됨</div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
} 