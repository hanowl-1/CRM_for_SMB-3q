'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  RefreshCw,
  Search,
  MessageSquare,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Filter,
  Download,
  Calendar,
  User,
  FileText,
  TrendingUp,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageLog {
  id: string;
  workflow_id: string;
  workflow_name: string;
  message_type: 'sms' | 'kakao' | 'email';
  recipient_phone?: string;
  recipient_email?: string;
  recipient_name?: string;
  template_id: string;
  template_name: string;
  message_content: string;
  variables: Record<string, any>;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  provider: string;
  provider_message_id?: string;
  error_message?: string;
  cost_amount?: number;
  sent_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
}

interface MessageStats {
  status: string;
  message_type: string;
  count: number;
}

export default function MessageLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [stats, setStats] = useState<MessageStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    hasMore: false
  });

  // 메시지 로그 로드
  const loadMessageLogs = async (reset = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: reset ? '0' : pagination.offset.toString()
      });

      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('message_type', typeFilter);
      if (workflowFilter !== 'all') params.append('workflow_id', workflowFilter);

      const response = await fetch(`/api/supabase/message-logs?${params}`);
      const result = await response.json();

      if (result.success) {
        if (reset) {
          setLogs(result.data);
          setPagination(prev => ({ ...prev, offset: 0, hasMore: result.pagination.hasMore }));
        } else {
          setLogs(prev => [...prev, ...result.data]);
          setPagination(prev => ({ ...prev, hasMore: result.pagination.hasMore }));
        }
        setStats(result.stats || []);
      } else {
        console.error('메시지 로그 로드 실패:', result.error);
      }
    } catch (error) {
      console.error('메시지 로그 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 페이지 로드 시 데이터 로드
  useEffect(() => {
    loadMessageLogs(true);
  }, [statusFilter, typeFilter, workflowFilter]);

  // 더 보기
  const loadMore = () => {
    setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
    loadMessageLogs();
  };

  // 필터링된 로그
  const filteredLogs = logs.filter(log => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        log.workflow_name.toLowerCase().includes(searchLower) ||
        log.template_name.toLowerCase().includes(searchLower) ||
        log.recipient_name?.toLowerCase().includes(searchLower) ||
        log.recipient_phone?.includes(searchTerm) ||
        log.recipient_email?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // 상태별 통계 계산
  const statusStats = {
    total: logs.length,
    sent: logs.filter(log => log.status === 'sent').length,
    delivered: logs.filter(log => log.status === 'delivered').length,
    failed: logs.filter(log => log.status === 'failed').length,
    pending: logs.filter(log => log.status === 'pending').length
  };

  // 타입별 통계
  const typeStats = {
    sms: logs.filter(log => log.message_type === 'sms').length,
    kakao: logs.filter(log => log.message_type === 'kakao').length,
    email: logs.filter(log => log.message_type === 'email').length
  };

  // 상태 배지 렌더링
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            전송완료
          </Badge>
        );
      case 'sent':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Activity className="w-3 h-3 mr-1" />
            발송됨
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            실패
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            대기중
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  // 메시지 타입 아이콘
  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'sms':
        return <Phone className="w-4 h-4" />;
      case 'kakao':
        return <MessageSquare className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로
          </Button>
          <div>
            <h1 className="text-2xl font-bold">메시지 발송 로그</h1>
            <p className="text-muted-foreground">
              워크플로우로 발송된 메시지들의 상태를 확인하세요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => loadMessageLogs(true)} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            내보내기
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">전체</p>
                <p className="text-xl font-bold">{statusStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">전송완료</p>
                <p className="text-xl font-bold">{statusStats.delivered}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">발송됨</p>
                <p className="text-xl font-bold">{statusStats.sent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">실패</p>
                <p className="text-xl font-bold">{statusStats.failed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">대기중</p>
                <p className="text-xl font-bold">{statusStats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">성공률</p>
                <p className="text-xl font-bold">
                  {statusStats.total > 0 
                    ? Math.round((statusStats.delivered / statusStats.total) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 검색 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            필터 및 검색
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="워크플로우명, 템플릿명, 수신자 정보로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="상태 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="delivered">전송완료</SelectItem>
                <SelectItem value="sent">발송됨</SelectItem>
                <SelectItem value="failed">실패</SelectItem>
                <SelectItem value="pending">대기중</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="타입 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 타입</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="kakao">카카오톡</SelectItem>
                <SelectItem value="email">이메일</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 메시지 로그 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>메시지 발송 기록</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">발송 기록이 없습니다</h3>
              <p className="text-muted-foreground">
                워크플로우를 실행하여 메시지를 발송해보세요
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {getMessageTypeIcon(log.message_type)}
                      </div>
                      <div>
                        <h4 className="font-medium">{log.workflow_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {log.template_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStatusBadge(log.status)}
                      <Badge variant="outline" className="text-xs">
                        {log.message_type.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{log.recipient_name || '이름 없음'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.message_type === 'email' ? (
                        <Mail className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Phone className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span>{log.recipient_phone || log.recipient_email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{new Date(log.created_at).toLocaleString('ko-KR')}</span>
                    </div>
                  </div>

                  {log.error_message && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="text-sm text-red-800">
                        <strong>오류:</strong> {log.error_message}
                      </p>
                    </div>
                  )}

                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-sm font-medium mb-1">메시지 내용</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {log.message_content}
                    </p>
                  </div>
                </div>
              ))}

              {pagination.hasMore && (
                <div className="text-center pt-4">
                  <Button 
                    onClick={loadMore} 
                    variant="outline" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        로딩 중...
                      </>
                    ) : (
                      '더 보기'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 