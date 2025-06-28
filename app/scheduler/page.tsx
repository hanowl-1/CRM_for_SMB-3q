'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, Play, Pause, CheckCircle, XCircle, AlertCircle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ScheduledJob {
  id: string;
  workflow_name: string;
  scheduled_time_kst: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  created_at_kst: string;
  started_at_kst?: string;
  completed_at_kst?: string;
  failed_at_kst?: string;
  time_status: string;
  minutes_diff: number;
  error_message?: string;
}

interface SchedulerData {
  current_time: {
    korea_time: string;
    utc_time: string;
  };
  statistics: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  jobs: ScheduledJob[];
  upcoming_jobs: ScheduledJob[];
  delayed_jobs: ScheduledJob[];
  recent_completed_jobs: ScheduledJob[];
  summary: {
    total_jobs: number;
    active_jobs: number;
    upcoming_count: number;
    delayed_count: number;
    recent_completed_count: number;
  };
}

export default function SchedulerMonitorPage() {
  const [schedulerData, setSchedulerData] = useState<SchedulerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 스케줄러 데이터 로드
  const loadSchedulerData = async () => {
    try {
      setError(null);
      const response = await fetch('/api/scheduler/monitor', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setSchedulerData(result.data);
        } else {
          setError(result.message || '데이터 로드 실패');
        }
      } else {
        setError(`API 호출 실패: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      setError('네트워크 오류: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // 자동 새로고침
  useEffect(() => {
    loadSchedulerData();
    
    if (autoRefresh) {
      const interval = setInterval(loadSchedulerData, 10000); // 10초마다 새로고침
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // 상태별 색상 및 아이콘
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: '대기' };
      case 'running':
        return { color: 'bg-blue-100 text-blue-800', icon: Play, label: '실행중' };
      case 'completed':
        return { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: '완료' };
      case 'failed':
        return { color: 'bg-red-100 text-red-800', icon: XCircle, label: '실패' };
      case 'cancelled':
        return { color: 'bg-gray-100 text-gray-800', icon: Pause, label: '취소' };
      default:
        return { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: '알 수 없음' };
    }
  };

  // 시간 차이에 따른 색상
  const getTimeDiffColor = (minutesDiff: number, status: string) => {
    if (status !== 'pending') return '';
    if (minutesDiff > 5) return 'text-blue-600'; // 미래
    if (minutesDiff > 0) return 'text-orange-600'; // 곧 실행
    if (minutesDiff > -5) return 'text-red-600'; // 실행 시간 도달
    return 'text-red-800'; // 지연
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">스케줄러 데이터 로드 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">오류 발생</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadSchedulerData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!schedulerData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p>스케줄러 데이터가 없습니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">스케줄러 모니터링</h1>
          <p className="text-gray-600 mt-2">
            한국 시간 기준 스케줄 작업 상태 및 AWS Lambda 실행 현황
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <Home className="h-4 w-4 mr-2" />
              홈
            </Button>
          </Link>
          <div className="text-sm text-gray-600">
            <div>현재 시간 (한국): <span className="font-mono">{schedulerData.current_time.korea_time}</span></div>
            <div>UTC 시간: <span className="font-mono">{new Date(schedulerData.current_time.utc_time).toISOString()}</span></div>
          </div>
          <Button
            onClick={loadSchedulerData}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            {autoRefresh ? "자동 새로고침 ON" : "자동 새로고침 OFF"}
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">전체 작업</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedulerData.statistics.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-600">대기중</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{schedulerData.statistics.pending}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-600">실행중</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{schedulerData.statistics.running}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-600">완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{schedulerData.statistics.completed}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600">실패</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{schedulerData.statistics.failed}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">취소</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{schedulerData.statistics.cancelled}</div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 영역 */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="upcoming">
            임박한 작업 ({schedulerData.summary.upcoming_count})
          </TabsTrigger>
          <TabsTrigger value="delayed">
            지연된 작업 ({schedulerData.summary.delayed_count})
          </TabsTrigger>
          <TabsTrigger value="recent">
            최근 완료 ({schedulerData.summary.recent_completed_count})
          </TabsTrigger>
          <TabsTrigger value="all">전체 작업</TabsTrigger>
        </TabsList>

        {/* 개요 탭 */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* AWS Lambda 상태 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  AWS Lambda 스케줄러
                </CardTitle>
                <CardDescription>5분마다 자동 실행</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>활성 작업:</span>
                    <Badge variant="outline">{schedulerData.summary.active_jobs}개</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>다음 실행:</span>
                    <span className="text-sm text-gray-600">매 5분마다</span>
                  </div>
                  <div className="flex justify-between">
                    <span>상태:</span>
                    <Badge variant={schedulerData.summary.active_jobs > 0 ? "default" : "secondary"}>
                      {schedulerData.summary.active_jobs > 0 ? "활성" : "대기"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 임박한 작업 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  임박한 작업
                </CardTitle>
                <CardDescription>30분 이내 실행 예정</CardDescription>
              </CardHeader>
              <CardContent>
                {schedulerData.upcoming_jobs.length > 0 ? (
                  <div className="space-y-2">
                    {schedulerData.upcoming_jobs.slice(0, 3).map((job) => (
                      <div key={job.id} className="flex justify-between items-center">
                        <span className="text-sm truncate">{job.workflow_name}</span>
                        <span className="text-xs text-orange-600">
                          {job.minutes_diff}분 후
                        </span>
                      </div>
                    ))}
                    {schedulerData.upcoming_jobs.length > 3 && (
                      <p className="text-xs text-gray-500">
                        +{schedulerData.upcoming_jobs.length - 3}개 더
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">임박한 작업이 없습니다.</p>
                )}
              </CardContent>
            </Card>

            {/* 지연된 작업 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  지연된 작업
                </CardTitle>
                <CardDescription>5분 이상 지연</CardDescription>
              </CardHeader>
              <CardContent>
                {schedulerData.delayed_jobs.length > 0 ? (
                  <div className="space-y-2">
                    {schedulerData.delayed_jobs.slice(0, 3).map((job) => (
                      <div key={job.id} className="flex justify-between items-center">
                        <span className="text-sm truncate">{job.workflow_name}</span>
                        <span className="text-xs text-red-600">
                          {Math.abs(job.minutes_diff)}분 지연
                        </span>
                      </div>
                    ))}
                    {schedulerData.delayed_jobs.length > 3 && (
                      <p className="text-xs text-gray-500">
                        +{schedulerData.delayed_jobs.length - 3}개 더
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">지연된 작업이 없습니다.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 임박한 작업 탭 */}
        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle>임박한 작업 (30분 이내)</CardTitle>
              <CardDescription>곧 실행될 예정인 작업들입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {schedulerData.upcoming_jobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>워크플로우명</TableHead>
                      <TableHead>예정 시간 (한국)</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>시간 차이</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedulerData.upcoming_jobs.map((job) => {
                      const statusInfo = getStatusInfo(job.status);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.workflow_name}</TableCell>
                          <TableCell className="font-mono text-sm">{job.scheduled_time_kst}</TableCell>
                          <TableCell>
                            <Badge className={statusInfo.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className={getTimeDiffColor(job.minutes_diff, job.status)}>
                            {job.time_status}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-gray-500">임박한 작업이 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 지연된 작업 탭 */}
        <TabsContent value="delayed">
          <Card>
            <CardHeader>
              <CardTitle>지연된 작업 (5분 이상)</CardTitle>
              <CardDescription>실행 시간이 지났지만 아직 실행되지 않은 작업들입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {schedulerData.delayed_jobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>워크플로우명</TableHead>
                      <TableHead>예정 시간 (한국)</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>지연 시간</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedulerData.delayed_jobs.map((job) => {
                      const statusInfo = getStatusInfo(job.status);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.workflow_name}</TableCell>
                          <TableCell className="font-mono text-sm">{job.scheduled_time_kst}</TableCell>
                          <TableCell>
                            <Badge className={statusInfo.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-red-600 font-medium">
                            {Math.abs(job.minutes_diff)}분 지연
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-gray-500">지연된 작업이 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 최근 완료 탭 */}
        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>최근 완료된 작업 (1시간 이내)</CardTitle>
              <CardDescription>최근에 완료된 작업들의 실행 결과입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {schedulerData.recent_completed_jobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>워크플로우명</TableHead>
                      <TableHead>예정 시간 (한국)</TableHead>
                      <TableHead>완료 시간 (한국)</TableHead>
                      <TableHead>상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedulerData.recent_completed_jobs.map((job) => {
                      const statusInfo = getStatusInfo(job.status);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.workflow_name}</TableCell>
                          <TableCell className="font-mono text-sm">{job.scheduled_time_kst}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {job.completed_at_kst || job.failed_at_kst || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusInfo.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-gray-500">최근 완료된 작업이 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 전체 작업 탭 */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>전체 스케줄 작업</CardTitle>
              <CardDescription>모든 스케줄 작업의 상태를 확인할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>워크플로우명</TableHead>
                    <TableHead>예정 시간 (한국)</TableHead>
                    <TableHead>생성 시간 (한국)</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>시간 정보</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedulerData.jobs.map((job) => {
                    const statusInfo = getStatusInfo(job.status);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">{job.workflow_name}</TableCell>
                        <TableCell className="font-mono text-sm">{job.scheduled_time_kst}</TableCell>
                        <TableCell className="font-mono text-sm">{job.created_at_kst}</TableCell>
                        <TableCell>
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className={getTimeDiffColor(job.minutes_diff, job.status)}>
                          {job.time_status || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 