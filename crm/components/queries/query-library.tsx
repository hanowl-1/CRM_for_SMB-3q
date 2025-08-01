'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  RefreshCw, 
  ArrowLeft, 
  Database, 
  Code, 
  Clock, 
  Users,
  BarChart3,
  Filter,
  Copy,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueryLibraryItem {
  id: string;
  name: string;
  description: string;
  sql: string;
  category: string;
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
  usedInTemplates: Array<{
    templateCode: string;
    templateName: string;
    variableName: string;
    workflowId: string;
    workflowName: string;
  }>;
}

interface QueryLibraryStats {
  totalQueries: number;
  categories: Array<{
    name: string;
    count: number;
  }>;
}

export function QueryLibrary() {
  const router = useRouter();
  const [queries, setQueries] = useState<QueryLibraryItem[]>([]);
  const [stats, setStats] = useState<QueryLibraryStats>({
    totalQueries: 0,
    categories: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedQuery, setSelectedQuery] = useState<QueryLibraryItem | null>(null);

  // 쿼리 라이브러리 로드
  const loadQueryLibrary = async () => {
    setIsLoading(true);
    try {
      console.log('📚 쿼리 라이브러리 로드 중...');
      const response = await fetch('/api/queries/library');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setQueries(result.data.queries || []);
          setStats({
            totalQueries: result.data.totalQueries || 0,
            categories: result.data.categories || []
          });
          console.log('✅ 쿼리 라이브러리 로드 완료:', result.data.queries?.length || 0, '개');
        } else {
          console.error('❌ 쿼리 라이브러리 로드 실패:', result.message);
        }
      } else {
        console.error('❌ 쿼리 라이브러리 API 호출 실패:', response.status);
      }
    } catch (error) {
      console.error('❌ 쿼리 라이브러리 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 로드
  useEffect(() => {
    loadQueryLibrary();
  }, []);

  // 필터링된 쿼리
  const filteredQueries = queries.filter(query => {
    const matchesSearch = !searchTerm || 
      query.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      query.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      query.sql.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || query.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // SQL 복사
  const copySQL = (sql: string) => {
    navigator.clipboard.writeText(sql);
    // TODO: 토스트 메시지 표시
  };

  // 카테고리 색상 매핑
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      '집계': 'bg-blue-100 text-blue-800',
      '통계': 'bg-green-100 text-green-800',
      '조인': 'bg-purple-100 text-purple-800',
      '날짜조회': 'bg-orange-100 text-orange-800',
      '정렬': 'bg-pink-100 text-pink-800',
      '그룹화': 'bg-indigo-100 text-indigo-800',
      '기본조회': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
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
            <h1 className="text-2xl font-bold">쿼리 라이브러리</h1>
            <p className="text-muted-foreground">
              템플릿 변수에서 사용되는 SQL 쿼리를 관리하세요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => router.push('/templates')}
            className="flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            템플릿 라이브러리
          </Button>
          <Button onClick={loadQueryLibrary} variant="outline" disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">전체 쿼리</p>
                <p className="text-xl font-bold">{stats.totalQueries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">카테고리</p>
                <p className="text-xl font-bold">{stats.categories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">활성 사용</p>
                <p className="text-xl font-bold">{queries.filter(q => q.usageCount > 0).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">미사용</p>
                <p className="text-xl font-bold">{queries.filter(q => q.usageCount === 0).length}</p>
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
                  placeholder="쿼리 이름, 설명, SQL로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 카테고리</SelectItem>
                  {stats.categories.map(category => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.name} ({category.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 활성 필터 표시 */}
          {(searchTerm || selectedCategory !== 'all') && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">활성 필터:</span>
              {searchTerm && (
                <Badge variant="secondary">
                  검색: {searchTerm}
                </Badge>
              )}
              {selectedCategory !== 'all' && (
                <Badge variant="secondary">
                  카테고리: {selectedCategory}
                </Badge>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
              >
                초기화
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 결과 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredQueries.length}개의 쿼리가 검색되었습니다
        </p>
      </div>

      {/* 쿼리 목록 */}
      {filteredQueries.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">검색 결과가 없습니다</h3>
            <p className="text-muted-foreground">
              다른 검색어나 필터를 사용해보세요
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredQueries.map(query => (
            <Card key={query.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{query.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {query.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getCategoryColor(query.category)}>
                      {query.category}
                    </Badge>
                    {query.usageCount > 0 && (
                      <Badge variant="outline">
                        {query.usageCount}회 사용
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* SQL 코드 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">SQL 쿼리</label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copySQL(query.sql)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        복사
                      </Button>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm overflow-x-auto">
                      <pre className="whitespace-pre-wrap">{query.sql}</pre>
                    </div>
                  </div>

                  {/* 사용처 정보 */}
                  {query.usedInTemplates.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">사용처</label>
                      <div className="space-y-2">
                        {query.usedInTemplates.slice(0, 3).map((usage, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{usage.templateName}</p>
                              <p className="text-xs text-muted-foreground">
                                변수: {usage.variableName} | 워크플로우: {usage.workflowName}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/workflow/${usage.workflowId}`)}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        {query.usedInTemplates.length > 3 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{query.usedInTemplates.length - 3}개 더
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 메타 정보 */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    <span>ID: {query.id}</span>
                    {query.lastUsed && (
                      <span>마지막 사용: {new Date(query.lastUsed).toLocaleDateString('ko-KR')}</span>
                    )}
                    <span>생성일: {new Date(query.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 