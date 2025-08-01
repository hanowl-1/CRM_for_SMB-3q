'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KakaoTemplate, TemplateFilter, TemplateStats } from '@/lib/types/template';
import { mockTemplates, templateCategories, calculateTemplateStats } from '@/lib/data/mock-templates';
import { TemplateCard } from './template-card';
import { TemplatePreviewDialog } from './template-preview-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  BarChart3, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Clock,
  Image,
  ExternalLink,
  ArrowLeft,
  Home,
  Activity,
  Pause,
  Archive,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateUsage {
  templateCode: string;
  templateName: string;
  servicePlatform: string;
  usageCount: number;
  workflows: Array<{
    id: string;
    name: string;
    status: string;
    lastRun?: string;
  }>;
  status: 'active' | 'pending' | 'deprecated';
}

interface TemplateBrowserProps {
  onSelect?: (template: KakaoTemplate) => void;
  showSelectButton?: boolean;
  selectedTemplateId?: string;
  isDialogMode?: boolean;
}

export function TemplateBrowser({ 
  onSelect, 
  showSelectButton = false, 
  selectedTemplateId,
  isDialogMode = false
}: TemplateBrowserProps) {
  const router = useRouter();
  const [templates] = useState<KakaoTemplate[]>(mockTemplates);

  const [filter, setFilter] = useState<TemplateFilter>({});
  const [previewTemplate, setPreviewTemplate] = useState<KakaoTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // 템플릿 사용 현황 상태
  const [templateUsage, setTemplateUsage] = useState<TemplateUsage[]>([]);
  const [usageStats, setUsageStats] = useState({
    totalTemplates: 0,
    activeTemplates: 0,
    pendingTemplates: 0,
    deprecatedTemplates: 0
  });
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  // 통계 계산
  const stats: TemplateStats = useMemo(() => calculateTemplateStats(templates), [templates]);

  // 템플릿 사용 현황 로드
  const loadTemplateUsage = async () => {
    setIsLoadingUsage(true);
    try {
      console.log('📊 템플릿 사용 현황 로드 중...');
      const response = await fetch('/api/templates/usage');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setTemplateUsage(result.data.usage || []);
          setUsageStats({
            totalTemplates: result.data.totalTemplates || 0,
            activeTemplates: result.data.activeTemplates || 0,
            pendingTemplates: result.data.pendingTemplates || 0,
            deprecatedTemplates: result.data.deprecatedTemplates || 0
          });
          console.log('✅ 템플릿 사용 현황 로드 완료:', result.data.usage?.length || 0, '개');
        } else {
          console.error('❌ 템플릿 사용 현황 로드 실패:', result.message);
        }
      } else {
        console.error('❌ 템플릿 사용 현황 API 호출 실패:', response.status);
      }
    } catch (error) {
      console.error('❌ 템플릿 사용 현황 로드 오류:', error);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  // 컴포넌트 마운트 시 사용 현황 로드
  useEffect(() => {
    if (!isDialogMode) {
      loadTemplateUsage();
    }
  }, [isDialogMode]);

  // 템플릿의 사용 현황 조회 (개선된 매칭 로직)
  const getTemplateUsageStatus = (templateCode: string) => {
    // 템플릿 코드에서 접미사 제거 (예: MEMBERS_113_Pil67w7I -> MEMBERS_113)
    const baseTemplateCode = templateCode.replace(/_[A-Za-z0-9]{8}$/, '');
    const usage = templateUsage.find(u => u.templateCode === baseTemplateCode);
    return usage?.status || 'deprecated';
  };

  // 템플릿의 사용 횟수 조회 (개선된 매칭 로직)
  const getTemplateUsageCount = (templateCode: string) => {
    // 템플릿 코드에서 접미사 제거 (예: MEMBERS_113_Pil67w7I -> MEMBERS_113)
    const baseTemplateCode = templateCode.replace(/_[A-Za-z0-9]{8}$/, '');
    const usage = templateUsage.find(u => u.templateCode === baseTemplateCode);
    return usage?.usageCount || 0;
  };

  // 사용 상태 배지 렌더링
  const renderUsageStatusBadge = (templateCode: string) => {
    const status = getTemplateUsageStatus(templateCode);
    const count = getTemplateUsageCount(templateCode);
    
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <Activity className="w-3 h-3 mr-1" />
            사용중 ({count})
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Pause className="w-3 h-3 mr-1" />
            대기중 ({count})
          </Badge>
        );
      case 'deprecated':
      default:
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
            <Archive className="w-3 h-3 mr-1" />
            미사용
          </Badge>
        );
    }
  };

  // 필터링된 템플릿
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      // 검색어 필터
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matchesSearch = 
          template.templateName.toLowerCase().includes(searchLower) ||
          template.templateContent.toLowerCase().includes(searchLower) ||
          template.templateCode.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // 카테고리 필터
      if (filter.category && filter.category !== 'all') {
        if (template.categoryCode !== filter.category) return false;
      }

      // 상태 필터
      if (filter.status && filter.status !== 'all') {
        if (filter.status === 'approved' && (template.status !== 'A' || template.inspectionStatus !== 'APR')) return false;
        if (filter.status === 'rejected' && template.status !== 'R') return false;
        if (filter.status === 'pending' && template.inspectionStatus !== 'REQ') return false;
      }

      // 플랫폼 필터
      if (filter.platform && filter.platform !== 'all') {
        if (template.channelKey !== filter.platform) return false;
      }

      // 서비스 플랫폼 필터 추가
      if (filter.servicePlatform && filter.servicePlatform !== 'all') {
        if (template.servicePlatform !== filter.servicePlatform) return false;
      }

      // 버튼 필터
      if (filter.hasButtons !== undefined) {
        const hasButtons = template.buttons && template.buttons.length > 0;
        if (filter.hasButtons !== hasButtons) return false;
      }

      // 이미지 필터
      if (filter.hasImages !== undefined) {
        const hasImages = !!template.templateImageUrl;
        if (filter.hasImages !== hasImages) return false;
      }

      return true;
    });
  }, [templates, filter]);

  const handlePreview = (template: KakaoTemplate) => {
    console.log('미리보기 클릭됨:', template.templateName);
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleRefresh = () => {
    // 실제 구현에서는 API 호출로 템플릿 목록을 새로고침
    console.log('템플릿 목록 새로고침');
    loadTemplateUsage(); // 사용 현황도 함께 새로고침
  };

  const clearFilters = () => {
    setFilter({});
  };

  const getChannelName = (channelKey: string) => {
    const channelNames: Record<string, string> = {
      'MEMBERS': '회원',
      'CHART': '차트',
      'CEO': 'CEO',
      'BLOGGER': '블로거'
    };
    return channelNames[channelKey] || channelKey;
  };

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      {!isDialogMode && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleGoHome}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              홈으로
            </Button>
            <div>
              <h1 className="text-2xl font-bold">템플릿 라이브러리</h1>
              <p className="text-muted-foreground">
                카카오톡 알림톡 템플릿을 검색하고 선택하세요
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => router.push('/queries')}
              className="flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              쿼리 라이브러리
            </Button>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              새로고침
            </Button>
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      {!isDialogMode && (
        <div className="space-y-4">
          {/* 기본 템플릿 통계 */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">전체</p>
                    <p className="text-xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">승인됨</p>
                    <p className="text-xl font-bold">{stats.approved}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">검토중</p>
                    <p className="text-xl font-bold">{stats.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">거부됨</p>
                    <p className="text-xl font-bold">{stats.rejected}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">버튼</p>
                    <p className="text-xl font-bold">{stats.withButtons}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">이미지</p>
                    <p className="text-xl font-bold">{stats.withImages}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 사용 현황 통계 */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <BarChart3 className="w-5 h-5" />
                템플릿 사용 현황
                {isLoadingUsage && (
                  <RefreshCw className="w-4 h-4 animate-spin ml-2" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Activity className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">활성 사용</p>
                    <p className="text-xl font-bold text-green-700">{usageStats.activeTemplates}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Pause className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">대기 중</p>
                    <p className="text-xl font-bold text-yellow-700">{usageStats.pendingTemplates}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Archive className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">미사용</p>
                    <p className="text-xl font-bold text-gray-700">{stats.total - usageStats.totalTemplates}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">사용된 템플릿</p>
                    <p className="text-xl font-bold text-blue-700">{usageStats.totalTemplates}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 필터 및 검색 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            필터 및 검색
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 검색 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="템플릿 이름, 내용, 코드로 검색..."
                value={filter.search || ''}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            {Object.keys(filter).length > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                필터 초기화
              </Button>
            )}
          </div>

          {/* 필터 옵션 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">카테고리</label>
              <Select
                value={filter.category || 'all'}
                onValueChange={(value) => setFilter(prev => ({ 
                  ...prev, 
                  category: value === 'all' ? undefined : value 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {templateCategories.map(category => (
                    <SelectItem key={category.code} value={category.code}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">상태</label>
              <Select
                value={filter.status || 'all'}
                onValueChange={(value) => setFilter(prev => ({ 
                  ...prev, 
                  status: value === 'all' ? undefined : value 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="approved">승인됨</SelectItem>
                  <SelectItem value="pending">검토중</SelectItem>
                  <SelectItem value="rejected">거부됨</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">채널</label>
              <Select
                value={filter.platform || 'all'}
                onValueChange={(value) => setFilter(prev => ({ 
                  ...prev, 
                  platform: value === 'all' ? undefined : value 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="채널 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="MEMBERS">회원</SelectItem>
                  <SelectItem value="CHART">차트</SelectItem>
                  <SelectItem value="CEO">CEO</SelectItem>
                  <SelectItem value="BLOGGER">블로거</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">서비스</label>
              <Select
                value={filter.servicePlatform || 'all'}
                onValueChange={(value) => setFilter(prev => ({ 
                  ...prev, 
                  servicePlatform: value === 'all' ? undefined : value 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="서비스 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="MEMBERS">MEMBERS</SelectItem>
                  <SelectItem value="CHART">CHART</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">기능</label>
              <div className="flex gap-2">
                <Button
                  variant={filter.hasButtons === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(prev => ({ 
                    ...prev, 
                    hasButtons: prev.hasButtons === true ? undefined : true 
                  }))}
                >
                  버튼
                </Button>
                <Button
                  variant={filter.hasImages === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(prev => ({ 
                    ...prev, 
                    hasImages: prev.hasImages === true ? undefined : true 
                  }))}
                >
                  이미지
                </Button>
              </div>
            </div>
          </div>

          {/* 활성 필터 표시 */}
          {Object.keys(filter).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filter.search && (
                <Badge variant="secondary">
                  검색: {filter.search}
                </Badge>
              )}
              {filter.category && (
                <Badge variant="secondary">
                  카테고리: {templateCategories.find(c => c.code === filter.category)?.name}
                </Badge>
              )}
              {filter.status && (
                <Badge variant="secondary">
                  상태: {filter.status === 'approved' ? '승인됨' : filter.status === 'pending' ? '검토중' : '거부됨'}
                </Badge>
              )}
              {filter.platform && (
                <Badge variant="secondary">
                  채널: {getChannelName(filter.platform)}
                </Badge>
              )}
              {filter.servicePlatform && (
                <Badge variant="secondary">
                  서비스: {filter.servicePlatform}
                </Badge>
              )}
              {filter.hasButtons && (
                <Badge variant="secondary">버튼 포함</Badge>
              )}
              {filter.hasImages && (
                <Badge variant="secondary">이미지 포함</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 결과 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredTemplates.length}개의 템플릿이 검색되었습니다
        </p>
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'grid' | 'list')}>
          <TabsList>
            <TabsTrigger value="grid">그리드</TabsTrigger>
            <TabsTrigger value="list">리스트</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 템플릿 목록 */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">검색 결과가 없습니다</h3>
            <p className="text-muted-foreground">
              다른 검색어나 필터를 사용해보세요
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-4",
          isDialogMode && "max-h-[60vh] overflow-y-auto pr-2"
        )}>
          {filteredTemplates.map((template, index) => (
            <TemplateCard
              key={`${template.id}-${template.templateCode || 'unknown'}-${index}`}
              template={template}
              onPreview={handlePreview}
              onSelect={onSelect}
              isSelected={selectedTemplateId === template.id}
              showSelectButton={showSelectButton}
              usageStatusBadge={renderUsageStatusBadge(template.templateCode)}
            />
          ))}
        </div>
      )}

      {/* 미리보기 다이얼로그 */}
      <TemplatePreviewDialog
        template={previewTemplate}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onSelect={onSelect}
        showSelectButton={showSelectButton}
      />
    </div>
  );
} 