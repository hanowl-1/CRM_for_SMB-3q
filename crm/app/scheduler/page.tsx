'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, Play, Pause, CheckCircle, XCircle, AlertCircle, RefreshCw, Home, ArrowLeft, BarChart3 } from 'lucide-react';
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

interface HealthCheckData {
  health_check: {
    timestamp: string;
    korea_time: string;
    check_type: string;
    environment: string;
    aws_lambda_enabled: boolean;
  };
  cron_status: {
    has_signals: boolean;
    last_aws_signal: {
      time: string;
      executed_jobs: number;
      duration_ms: number;
      response_status: number;
    } | null;
    minutes_since_last_signal: number | null;
    is_healthy: boolean;
    recent_signals_count: number;
    hourly_signals_count: number;
    health_status: 'healthy' | 'warning' | 'critical' | 'unknown';
  };
  lambda_status: {
    is_working: boolean;
    last_execution: string | null;
    pending_overdue_count: number;
    recent_execution_count: number;
    cron_signal_health: string;
  };
  statistics: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  recent_activity: {
    recent_jobs: any[];
    recent_executions: any[];
    pending_overdue: any[];
    recent_cron_signals: any[];
  };
  recommendations: Array<{
    level: 'critical' | 'warning' | 'info';
    message: string;
    action: string;
  }>;
}

interface ExecutionLogData {
  logs: Array<{
    id: string;
    execution_id: string;
    job_id?: string;
    workflow_id?: string;
    workflow_name?: string;
    step: string;
    status: 'started' | 'success' | 'failed' | 'warning';
    message: string;
    details?: any;
    error_message?: string;
    duration_ms?: number;
    timestamp: string;
    created_at: string;
  }>;
  execution_groups: { [key: string]: any[] };
  step_statistics: { [key: string]: { total: number; success: number; failed: number; } };
  total_logs: number;
}

// 스케줄러 메인 컴포넌트 (Suspense 내부)
function SchedulerMonitorComponent() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'overview';
  
  const [schedulerData, setSchedulerData] = useState<SchedulerData | null>(null);
  const [healthData, setHealthData] = useState<HealthCheckData | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
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

  // 헬스체크 데이터 로드
  const loadHealthCheck = async () => {
    try {
      setHealthLoading(true);
      setHealthError(null);
      const response = await fetch('/api/scheduler/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setHealthData(result.data);
        } else {
          setHealthError(result.message || '헬스체크 실패');
        }
      } else {
        setHealthError(`API 호출 실패: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      setHealthError('네트워크 오류: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setHealthLoading(false);
    }
  };

  // 실행 로그 데이터 로드
  const loadExecutionLogs = async () => {
    try {
      setLogsLoading(true);
      setLogsError(null);
      
      // 최근 1시간 로그만 조회
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const response = await fetch(`/api/scheduler/execution-logs?limit=200&since=${since}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setExecutionLogs(result.data);
        } else {
          setLogsError(result.message || '실행 로그 로드 실패');
        }
      } else {
        setLogsError(`API 호출 실패: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      setLogsError('네트워크 오류: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLogsLoading(false);
    }
  };

  // 자동 새로고침
  useEffect(() => {
    loadSchedulerData();
    loadHealthCheck();
    loadExecutionLogs();
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadSchedulerData();
        loadHealthCheck();
        loadExecutionLogs();
      }, 10000); // 10초마다 새로고침
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
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="health">헬스체크</TabsTrigger>
          <TabsTrigger value="upcoming">
            임박한 작업 ({schedulerData?.summary.upcoming_count || 0})
          </TabsTrigger>
          <TabsTrigger value="delayed">
            지연된 작업 ({schedulerData?.summary.delayed_count || 0})
          </TabsTrigger>
          <TabsTrigger value="recent">
            최근 완료 ({schedulerData?.summary.recent_completed_count || 0})
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

        {/* 헬스체크 탭 */}
        <TabsContent value="health">
          <div className="space-y-6">
            {/* 헬스체크 헤더 */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">스케줄러 헬스체크</h2>
                <p className="text-gray-600">AWS Lambda 스케줄러 상태 및 시스템 건강도 점검</p>
              </div>
              <Button
                onClick={loadHealthCheck}
                variant="outline"
                size="sm"
                disabled={healthLoading}
              >
                {healthLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                새로고침
              </Button>
            </div>

            {healthError && (
              <Card className="border-red-200">
                <CardContent className="pt-6">
                  <div className="flex items-center text-red-600">
                    <XCircle className="h-5 w-5 mr-2" />
                    <span>{healthError}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {healthLoading && !healthData && (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-8 w-8 animate-spin mr-2" />
                <span>헬스체크 데이터 로드 중...</span>
              </div>
            )}

            {healthData && (
              <>
                {/* 전체 상태 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Lambda 상태 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className={`flex items-center gap-2 ${
                        healthData.lambda_status.is_working ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {healthData.lambda_status.is_working ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                        AWS Lambda 상태
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>실행 상태:</span>
                          <Badge variant={healthData.lambda_status.is_working ? "default" : "destructive"}>
                            {healthData.lambda_status.is_working ? "정상" : "문제 발생"}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>환경:</span>
                          <span className="font-mono text-sm">{healthData.health_check.environment}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>AWS Lambda 활성화:</span>
                          <Badge variant={healthData.health_check.aws_lambda_enabled ? "default" : "secondary"}>
                            {healthData.health_check.aws_lambda_enabled ? "ON" : "OFF"}
                          </Badge>
                        </div>
                        
                        {/* 🔔 크론 신호 상태 추가 */}
                        <div className="border-t pt-2 mt-2">
                          <div className="text-sm font-medium text-gray-700 mb-2">크론 신호 모니터링</div>
                          <div className="flex justify-between">
                            <span>신호 상태:</span>
                            <Badge variant={
                              healthData.cron_status.health_status === 'healthy' ? 'default' : 
                              healthData.cron_status.health_status === 'warning' ? 'secondary' : 
                              'destructive'
                            }>
                              {healthData.cron_status.health_status === 'healthy' ? '정상' :
                               healthData.cron_status.health_status === 'warning' ? '경고' : 
                               healthData.cron_status.health_status === 'critical' ? '위험' : '알 수 없음'}
                            </Badge>
                          </div>
                          {healthData.cron_status.last_aws_signal ? (
                            <>
                              <div className="flex justify-between">
                                <span>마지막 신호:</span>
                                <span className="font-mono text-xs">
                                  {healthData.cron_status.last_aws_signal.time}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>신호 간격:</span>
                                <span className={`font-medium text-sm ${
                                  (healthData.cron_status.minutes_since_last_signal || 0) <= 7 ? 'text-green-600' :
                                  (healthData.cron_status.minutes_since_last_signal || 0) <= 15 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {healthData.cron_status.minutes_since_last_signal}분 전
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>마지막 실행 작업:</span>
                                <span className="font-medium text-sm text-blue-600">
                                  {healthData.cron_status.last_aws_signal.executed_jobs}개
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>실행 시간:</span>
                                <span className="font-mono text-xs text-gray-600">
                                  {healthData.cron_status.last_aws_signal.duration_ms}ms
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="text-center text-sm text-red-600 py-2">
                              {healthData.cron_status.has_signals ? '최근 AWS Lambda 신호 없음' : '크론 신호 기록 없음'}
                            </div>
                          )}
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>최근 10분:</span>
                            <span>{healthData.cron_status.recent_signals_count}회</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>최근 1시간:</span>
                            <span>{healthData.cron_status.hourly_signals_count}회</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between">
                          <span>지연된 작업:</span>
                          <span className={`font-medium ${
                            healthData.lambda_status.pending_overdue_count > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {healthData.lambda_status.pending_overdue_count}개
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>최근 실행 횟수:</span>
                          <span className="font-medium text-blue-600">
                            {healthData.lambda_status.recent_execution_count}회
                          </span>
                        </div>
                        {healthData.lambda_status.last_execution && (
                          <div className="mt-2 text-xs text-gray-600">
                            <div>최근 실행:</div>
                            <div className="font-mono">
                              {new Date(healthData.lambda_status.last_execution).toLocaleString('ko-KR')}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 체크 정보 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-600" />
                        체크 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>체크 시간 (한국):</span>
                          <span className="font-mono text-sm">{healthData.health_check.korea_time}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>체크 타입:</span>
                          <span className="text-sm">{healthData.health_check.check_type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>UTC 시간:</span>
                          <span className="font-mono text-xs text-gray-600">
                            {new Date(healthData.health_check.timestamp).toISOString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 작업 통계 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-purple-600" />
                        작업 통계
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>전체:</span>
                          <span className="font-medium">{healthData.statistics.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>대기:</span>
                          <span className="font-medium text-yellow-600">{healthData.statistics.pending}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>실행중:</span>
                          <span className="font-medium text-blue-600">{healthData.statistics.running}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>완료:</span>
                          <span className="font-medium text-green-600">{healthData.statistics.completed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>실패:</span>
                          <span className="font-medium text-red-600">{healthData.statistics.failed}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 권장사항 */}
                {healthData.recommendations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-600" />
                        권장사항
                      </CardTitle>
                      <CardDescription>시스템 최적화를 위한 권장사항입니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {healthData.recommendations.map((rec, index) => {
                          const getLevelColor = (level: string) => {
                            switch (level) {
                              case 'critical': return 'border-red-200 bg-red-50 text-red-800';
                              case 'warning': return 'border-orange-200 bg-orange-50 text-orange-800';
                              case 'info': return 'border-blue-200 bg-blue-50 text-blue-800';
                              default: return 'border-gray-200 bg-gray-50 text-gray-800';
                            }
                          };
                          
                          const getLevelIcon = (level: string) => {
                            switch (level) {
                              case 'critical': return <XCircle className="h-4 w-4" />;
                              case 'warning': return <AlertCircle className="h-4 w-4" />;
                              case 'info': return <Clock className="h-4 w-4" />;
                              default: return <AlertCircle className="h-4 w-4" />;
                            }
                          };

                          return (
                            <div key={index} className={`p-3 rounded border ${getLevelColor(rec.level)}`}>
                              <div className="flex items-start gap-2">
                                {getLevelIcon(rec.level)}
                                <div className="flex-1">
                                  <div className="font-medium text-sm">
                                    {rec.level === 'critical' ? '🚨 중요' : 
                                     rec.level === 'warning' ? '⚠️ 경고' : 
                                     '💡 정보'}
                                  </div>
                                  <div className="text-sm mt-1">{rec.message}</div>
                                  <div className="text-xs mt-1 opacity-75">
                                    작업: {rec.action}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 최근 활동 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* 최근 생성된 작업 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">최근 생성된 작업</CardTitle>
                      <CardDescription>5분 내 생성된 작업들</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {healthData.recent_activity.recent_jobs.length > 0 ? (
                        <div className="space-y-2">
                          {healthData.recent_activity.recent_jobs.map((job, index) => (
                            <div key={index} className="text-sm border-b pb-2 last:border-b-0">
                              <div className="font-medium">{job.workflow_name || job.id}</div>
                              <div className="text-xs text-gray-600">
                                {new Date(job.created_at).toLocaleString('ko-KR')}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">최근 생성된 작업이 없습니다.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* 최근 실행된 작업 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">최근 실행된 작업</CardTitle>
                      <CardDescription>5분 내 실행된 작업들</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {healthData.recent_activity.recent_executions.length > 0 ? (
                        <div className="space-y-2">
                          {healthData.recent_activity.recent_executions.map((job, index) => (
                            <div key={index} className="text-sm border-b pb-2 last:border-b-0">
                              <div className="font-medium">{job.workflow_name || job.id}</div>
                              <div className="text-xs text-gray-600">
                                {job.executed_at && new Date(job.executed_at).toLocaleString('ko-KR')}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">최근 실행된 작업이 없습니다.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* 지연된 작업 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">지연된 작업</CardTitle>
                      <CardDescription>실행 시간이 지난 대기 중인 작업들</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {healthData.recent_activity.pending_overdue.length > 0 ? (
                        <div className="space-y-2">
                          {healthData.recent_activity.pending_overdue.map((job, index) => (
                            <div key={index} className="text-sm border-b pb-2 last:border-b-0">
                              <div className="font-medium text-red-600">{job.workflow_name || job.id}</div>
                              <div className="text-xs text-gray-600">
                                예정: {new Date(job.scheduled_time).toLocaleString('ko-KR')}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">지연된 작업이 없습니다.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* 실행 로그 분석 */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">실행 로그 분석</h3>
                    <Button
                      onClick={loadExecutionLogs}
                      variant="outline"
                      size="sm"
                      disabled={logsLoading}
                    >
                      {logsLoading ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      로그 새로고침
                    </Button>
                  </div>

                  {logsError && (
                    <Card className="border-red-200">
                      <CardContent className="pt-6">
                        <div className="flex items-center text-red-600">
                          <XCircle className="h-5 w-5 mr-2" />
                          <span>{logsError}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {logsLoading && !executionLogs && (
                    <div className="flex items-center justify-center h-32">
                      <RefreshCw className="h-8 w-8 animate-spin mr-2" />
                      <span>실행 로그 로드 중...</span>
                    </div>
                  )}

                  {executionLogs && (
                    <>
                      {/* 단계별 성공률 통계 */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-purple-600" />
                            단계별 성공률 (최근 1시간)
                          </CardTitle>
                          <CardDescription>각 실행 단계별 성공/실패 통계</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {Object.keys(executionLogs.step_statistics).length > 0 ? (
                            <div className="space-y-3">
                              {Object.entries(executionLogs.step_statistics).map(([step, stats]) => {
                                const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
                                const getStepName = (step: string) => {
                                  const stepNames: { [key: string]: string } = {
                                    cron_trigger: '크론 트리거',
                                    scheduler_detect: '스케줄러 감지',
                                    jobs_query: '작업 조회',
                                    workflow_query: '워크플로우 조회',
                                    workflow_execute: '워크플로우 실행',
                                    target_extract: '대상자 추출',
                                    template_mapping: '템플릿 매핑',
                                    message_generate: '메시지 생성',
                                    sms_api_call: 'SMS API 호출',
                                    result_process: '결과 처리',
                                    status_update: '상태 업데이트'
                                  };
                                  return stepNames[step] || step;
                                };
                                
                                return (
                                  <div key={step} className="flex items-center justify-between p-3 border rounded">
                                    <div className="flex-1">
                                      <div className="font-medium">{getStepName(step)}</div>
                                      <div className="text-sm text-gray-600">
                                        전체: {stats.total}, 성공: {stats.success}, 실패: {stats.failed}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className={`text-lg font-bold ${
                                        successRate >= 90 ? 'text-green-600' :
                                        successRate >= 70 ? 'text-yellow-600' : 'text-red-600'
                                      }`}>
                                        {successRate}%
                                      </div>
                                      <div className="w-20 bg-gray-200 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full ${
                                            successRate >= 90 ? 'bg-green-500' :
                                            successRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                          }`}
                                          style={{ width: `${successRate}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-center py-8 text-gray-500">최근 실행 로그가 없습니다.</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* 최근 실행 로그 */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-blue-600" />
                            최근 실행 로그 ({executionLogs.total_logs}개)
                          </CardTitle>
                          <CardDescription>최근 1시간 내 스케줄러 실행 과정</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {executionLogs.logs.length > 0 ? (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {executionLogs.logs.slice(0, 50).map((log) => {
                                const getStatusColor = (status: string) => {
                                  switch (status) {
                                    case 'success': return 'text-green-600 bg-green-50';
                                    case 'failed': return 'text-red-600 bg-red-50';
                                    case 'warning': return 'text-yellow-600 bg-yellow-50';
                                    case 'started': return 'text-blue-600 bg-blue-50';
                                    default: return 'text-gray-600 bg-gray-50';
                                  }
                                };
                                
                                const getStatusIcon = (status: string) => {
                                  switch (status) {
                                    case 'success': return '✅';
                                    case 'failed': return '❌';
                                    case 'warning': return '⚠️';
                                    case 'started': return '🚀';
                                    default: return '📋';
                                  }
                                };

                                return (
                                  <div key={log.id} className="text-sm border rounded p-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-lg">{getStatusIcon(log.status)}</span>
                                          <span className="font-medium">{log.workflow_name || 'Unknown'}</span>
                                          <Badge variant="outline" className={getStatusColor(log.status)}>
                                            {log.step}
                                          </Badge>
                                        </div>
                                        <div className="mt-1 text-gray-700">{log.message}</div>
                                        {log.error_message && (
                                          <div className="mt-1 text-red-600 text-xs">
                                            오류: {log.error_message}
                                          </div>
                                        )}
                                        {log.duration_ms && (
                                          <div className="mt-1 text-gray-500 text-xs">
                                            소요시간: {log.duration_ms}ms
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 ml-4">
                                        {new Date(log.created_at).toLocaleString('ko-KR')}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-center py-8 text-gray-500">최근 실행 로그가 없습니다.</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* 실행 그룹별 진행 상황 */}
                      {Object.keys(executionLogs.execution_groups).length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Play className="h-5 w-5 text-green-600" />
                              실행 세션별 진행 상황
                            </CardTitle>
                            <CardDescription>각 실행 세션의 단계별 진행 현황</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {Object.entries(executionLogs.execution_groups).slice(0, 10).map(([executionId, logs]) => {
                                const sortedLogs = logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                const firstLog = sortedLogs[0];
                                const lastLog = sortedLogs[sortedLogs.length - 1];
                                const hasFailure = logs.some(log => log.status === 'failed');
                                const totalSteps = logs.length;
                                const successSteps = logs.filter(log => log.status === 'success').length;
                                
                                return (
                                  <div key={executionId} className="border rounded p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div>
                                        <div className="font-medium">{firstLog?.workflow_name || 'Unknown'}</div>
                                        <div className="text-xs text-gray-600">실행 ID: {executionId}</div>
                                      </div>
                                      <div className="text-right">
                                        <Badge variant={hasFailure ? "destructive" : "default"}>
                                          {hasFailure ? '실패' : '성공'} ({successSteps}/{totalSteps})
                                        </Badge>
                                        <div className="text-xs text-gray-600 mt-1">
                                          {new Date(firstLog?.created_at).toLocaleString('ko-KR')}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {sortedLogs.map((log, index) => (
                                        <div
                                          key={index}
                                          className={`w-3 h-3 rounded-full ${
                                            log.status === 'success' ? 'bg-green-500' :
                                            log.status === 'failed' ? 'bg-red-500' :
                                            log.status === 'warning' ? 'bg-yellow-500' :
                                            'bg-blue-500'
                                          }`}
                                          title={`${log.step}: ${log.status}`}
                                        ></div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
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

// 로딩 컴포넌트
function SchedulerLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-gray-600">스케줄러 데이터를 로딩 중...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 메인 export 함수 (Suspense로 감싼 버전)
export default function SchedulerMonitorPage() {
  return (
    <Suspense fallback={<SchedulerLoading />}>
      <SchedulerMonitorComponent />
    </Suspense>
  );
} 