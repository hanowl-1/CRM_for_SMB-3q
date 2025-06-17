'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Database, 
  MessageSquare, 
  FileText, 
  Activity, 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface DashboardStats {
  mysql: {
    totalTables: number;
    activeMappings: number;
    lastSync: string;
  };
  supabase: {
    totalWorkflows: number;
    activeWorkflows: number;
    totalTemplates: number;
    totalMessages: number;
    successRate: number;
  };
  recent: {
    workflows: any[];
    messages: any[];
    templates: any[];
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 대시보드 데이터 로드
  const loadDashboardData = async () => {
    try {
      setRefreshing(true);

      // MySQL 통계 (테이블 매핑)
      const mappingsRes = await fetch('/api/mysql/table-mappings');
      const mappingsData = await mappingsRes.json();

      // Supabase 통계 (워크플로우, 템플릿, 메시지)
      const [workflowsRes, templatesRes, messagesRes] = await Promise.all([
        fetch('/api/supabase/workflows'),
        fetch('/api/supabase/templates'),
        fetch('/api/supabase/message-logs?limit=100')
      ]);

      const workflowsData = await workflowsRes.json();
      const templatesData = await templatesRes.json();
      const messagesData = await messagesRes.json();

      // 통계 계산
      const activeMappings = Object.values(mappingsData.mappings || {})
        .filter((mapping: any) => mapping.enabled).length;

      const activeWorkflows = workflowsData.data?.filter((w: any) => w.status === 'active').length || 0;
      
      const successfulMessages = messagesData.data?.filter((m: any) => m.status === 'sent' || m.status === 'delivered').length || 0;
      const totalMessages = messagesData.data?.length || 0;
      const successRate = totalMessages > 0 ? (successfulMessages / totalMessages) * 100 : 0;

      setStats({
        mysql: {
          totalTables: 123, // 고정값 (실제 DB 테이블 수)
          activeMappings,
          lastSync: new Date().toISOString()
        },
        supabase: {
          totalWorkflows: workflowsData.data?.length || 0,
          activeWorkflows,
          totalTemplates: templatesData.data?.length || 0,
          totalMessages,
          successRate
        },
        recent: {
          workflows: workflowsData.data?.slice(0, 5) || [],
          messages: messagesData.data?.slice(0, 10) || [],
          templates: templatesData.data?.slice(0, 5) || []
        }
      });

    } catch (error) {
      console.error('대시보드 데이터 로드 오류:', error);
      toast.error('대시보드 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>대시보드를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const config = {
      active: { label: '활성', variant: 'default' as const, icon: CheckCircle },
      draft: { label: '초안', variant: 'secondary' as const, icon: Clock },
      paused: { label: '일시정지', variant: 'outline' as const, icon: AlertCircle },
      sent: { label: '발송완료', variant: 'default' as const, icon: CheckCircle },
      failed: { label: '실패', variant: 'destructive' as const, icon: XCircle },
      pending: { label: '대기중', variant: 'secondary' as const, icon: Clock }
    };
    return config[status as keyof typeof config] || config.draft;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">시스템 대시보드</h1>
              <p className="text-gray-600">MySQL + Supabase 하이브리드 시스템 현황</p>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={loadDashboardData} 
                disabled={refreshing}
                variant="outline"
              >
                {refreshing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                새로고침
              </Button>
              <Link href="/">
                <Button variant="ghost">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  홈으로 돌아가기
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 시스템 개요 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">MySQL 테이블</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.mysql.totalTables}</p>
                </div>
                <Database className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">활성 워크플로우</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.supabase.activeWorkflows}</p>
                </div>
                <Activity className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">총 발송 수</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.supabase.totalMessages}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">성공률</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.supabase.successRate.toFixed(1)}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 시스템별 상세 통계 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* MySQL 시스템 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-blue-600" />
                <span>MySQL 데이터 소스</span>
              </CardTitle>
              <CardDescription>읽기 전용 데이터베이스 연결 상태</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats?.mysql.activeMappings}</div>
                  <div className="text-sm text-gray-600">활성 테이블 매핑</div>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>마지막 동기화</span>
                <span>{new Date(stats?.mysql.lastSync || '').toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Supabase 시스템 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                <span>Supabase 기록 시스템</span>
              </CardTitle>
              <CardDescription>워크플로우 및 메시지 기록 저장소</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{stats?.supabase.totalWorkflows}</div>
                  <div className="text-sm text-gray-600">총 워크플로우</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{stats?.supabase.totalTemplates}</div>
                  <div className="text-sm text-gray-600">메시지 템플릿</div>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>발송 성공률</span>
                <span className="font-medium">{stats?.supabase.successRate.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 최근 활동 */}
        <Tabs defaultValue="workflows" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workflows">최근 워크플로우</TabsTrigger>
            <TabsTrigger value="messages">최근 메시지</TabsTrigger>
            <TabsTrigger value="templates">최근 템플릿</TabsTrigger>
          </TabsList>

          <TabsContent value="workflows">
            <Card>
              <CardHeader>
                <CardTitle>최근 워크플로우</CardTitle>
                <CardDescription>최근 생성되거나 수정된 워크플로우 목록</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>트리거</TableHead>
                      <TableHead>생성일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.recent.workflows.map((workflow) => {
                      const statusConfig = getStatusBadge(workflow.status);
                      return (
                        <TableRow key={workflow.id}>
                          <TableCell className="font-medium">{workflow.name}</TableCell>
                          <TableCell>
                            <Badge variant={statusConfig.variant}>
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{workflow.trigger_type}</TableCell>
                          <TableCell>{new Date(workflow.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>최근 메시지</CardTitle>
                <CardDescription>최근 발송된 메시지 기록</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>워크플로우</TableHead>
                      <TableHead>수신자</TableHead>
                      <TableHead>타입</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>발송일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.recent.messages.map((message) => {
                      const statusConfig = getStatusBadge(message.status);
                      return (
                        <TableRow key={message.id}>
                          <TableCell className="font-medium">{message.workflow_name || '-'}</TableCell>
                          <TableCell>{message.recipient_phone || message.recipient_email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{message.message_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig.variant}>
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(message.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>최근 템플릿</CardTitle>
                <CardDescription>최근 생성되거나 수정된 메시지 템플릿</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>카테고리</TableHead>
                      <TableHead>타입</TableHead>
                      <TableHead>사용횟수</TableHead>
                      <TableHead>생성일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.recent.templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{template.message_type}</Badge>
                        </TableCell>
                        <TableCell>{template.usage_count || 0}</TableCell>
                        <TableCell>{new Date(template.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 