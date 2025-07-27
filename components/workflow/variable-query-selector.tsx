'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  Search, 
  Star, 
  StarOff, 
  Trash2, 
  Plus, 
  Copy, 
  ExternalLink,
  BookOpen,
  RefreshCw,
  Save
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

interface VariableQueryTemplate {
  id: string;
  variableName: string;
  name: string;
  description: string;
  query: string;
  selectedColumn: string;
  category: string;
  tags: string[];
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  isFavorite?: boolean;
  keyColumn?: string;
}

interface VariableQuerySelectorProps {
  variableName: string;
  currentQuery?: string;
  currentSelectedColumn?: string;
  currentMappingKeyColumn?: string;
  onSelect?: (query: string, selectedColumn: string) => void;
  onSave?: (template: VariableQueryTemplate) => void;
}

export default function VariableQuerySelector({
  variableName,
  currentQuery = '',
  currentSelectedColumn = '',
  currentMappingKeyColumn = '',
  onSelect,
  onSave
}: VariableQuerySelectorProps) {
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  
  // 새로운 쿼리 라이브러리 상태
  const [queryLibrary, setQueryLibrary] = useState<QueryLibraryItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  
  // 기존 개별 변수 템플릿 상태 (호환성 유지)
  const [templates, setTemplates] = useState<VariableQueryTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // 저장 폼 데이터
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    category: 'custom' as string,
    tags: [] as string[],
    isPublic: false
  });

  // 새로운 쿼리 라이브러리 로드
  const loadQueryLibrary = async () => {
    setIsLoadingLibrary(true);
    try {
      console.log('📚 쿼리 라이브러리 로드 중...');
      const response = await fetch('/api/queries/library');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const queries = result.data?.queries || [];
          // 각 쿼리 객체의 필수 속성들이 존재하는지 확인하고 기본값 설정
          const normalizedQueries = queries.map((query: any) => ({
            ...query,
            usedInTemplates: query.usedInTemplates || [],
            name: query.name || 'Untitled Query',
            description: query.description || '',
            sql: query.sql || '',
            category: query.category || 'custom',
            usageCount: query.usageCount || 0
          }));
          setQueryLibrary(normalizedQueries);
          console.log('✅ 쿼리 라이브러리 로드 완료:', normalizedQueries.length, '개');
        } else {
          console.error('❌ 쿼리 라이브러리 로드 실패:', result.message);
          setQueryLibrary([]);
        }
      } else {
        console.error('❌ 쿼리 라이브러리 API 호출 실패:', response.status);
        setQueryLibrary([]);
      }
    } catch (error) {
      console.error('❌ 쿼리 라이브러리 로드 오류:', error);
      setQueryLibrary([]);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  // 기존 개별 변수 템플릿 로드 (호환성 유지)
  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/supabase/individual-variables?action=list');
      const result = await response.json();
      
      if (result.success) {
        // 현재 변수명과 일치하는 템플릿만 필터링
        const allTemplates = result.data || [];
        const matchingTemplates = allTemplates.filter((template: any) => 
          template.variableName === variableName
        );
        
        // 템플릿 객체들의 필수 속성 확인 및 기본값 설정
        const normalizedTemplates = matchingTemplates.map((template: any) => ({
          ...template,
          name: template.name || 'Untitled Template',
          description: template.description || '',
          query: template.query || '',
          selectedColumn: template.selectedColumn || '',
          category: template.category || 'custom',
          usageCount: template.usageCount || 0
        }));
        
        setTemplates(normalizedTemplates);
      } else {
        console.error('개별 변수 템플릿 로드 실패:', result.error);
        setTemplates([]);
      }
    } catch (error) {
      console.error('개별 변수 템플릿 로드 오류:', error);
      setTemplates([]);
    }
  };

  // 컴포넌트 마운트 시 로드
  useEffect(() => {
    if (showLibrary) {
      loadQueryLibrary();
      loadTemplates();
    }
  }, [showLibrary, variableName]);

  // 쿼리 라이브러리에서 쿼리 선택
  const handleSelectFromLibrary = (query: QueryLibraryItem) => {
    console.log('쿼리 라이브러리에서 선택:', query);
    
    // 선택된 쿼리를 부모에게 전달
    onSelect?.(query.sql, ''); // 쿼리 라이브러리에는 selectedColumn이 없으므로 빈 문자열
    
    // 라이브러리 닫기
    setShowLibrary(false);
  };

  // 기존 템플릿 선택 (호환성 유지)
  const handleSelectTemplate = async (template: VariableQueryTemplate) => {
    console.log('개별 변수 템플릿 선택:', template);
    
    try {
      await fetch('/api/supabase/individual-variables?action=record-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variableName: template.variableName }),
      });
    } catch (error) {
      console.error('사용 기록 저장 실패:', error);
    }
    
    onSelect?.(template.query, template.selectedColumn || '');
    setShowLibrary(false);
    loadTemplates();
  };

  // 즐겨찾기 토글 (기존 템플릿용)
  const handleToggleFavorite = async (templateId: string) => {
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) return;

      const response = await fetch(`/api/supabase/individual-variables?action=update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: templateId,
          isFavorite: !template.isFavorite
        }),
      });

      const result = await response.json();
      if (result.success) {
        loadTemplates();
      } else {
        console.error('즐겨찾기 토글 실패:', result.error);
      }
    } catch (error) {
      console.error('즐겨찾기 토글 오류:', error);
    }
  };

  // 템플릿 삭제 (기존 템플릿용)
  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('정말로 이 쿼리 템플릿을 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`/api/supabase/individual-variables?action=delete&id=${templateId}`, {
          method: 'DELETE',
        });

        const result = await response.json();
        if (result.success) {
          loadTemplates();
        } else {
          console.error('템플릿 삭제 실패:', result.error);
          alert('삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('템플릿 삭제 오류:', error);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  // 저장 폼 열기
  const handleOpenSaveForm = () => {
    if (!currentQuery.trim()) {
      alert('저장할 쿼리가 없습니다.');
      return;
    }
    
    setSaveForm({
      name: '',
      description: '',
      category: 'custom',
      tags: [],
      isPublic: false
    });
    
    setShowSaveForm(true);
  };

  // 쿼리에서 키 컬럼 자동 추출 함수
  const extractKeyColumns = (query: string): string[] => {
    const keyColumns: string[] = [];
    
    try {
      // 쿼리를 정규화 (개행문자 제거, 공백 정리)
      const normalizedQuery = query.replace(/\s+/g, ' ').trim();
      
      // 1. FROM 절에서 테이블과 별칭 추출 (다양한 패턴 지원)
      const fromPatterns = [
        /FROM\s+(\w+)\s+(?:AS\s+)?(\w+)/i,  // FROM table AS alias 또는 FROM table alias
        /FROM\s+(\w+)(?:\s+(\w+))?/i        // FROM table 또는 FROM table alias
      ];
      
      let tableAlias = '';
      let tableName = '';
      
      for (const pattern of fromPatterns) {
        const fromMatch = normalizedQuery.match(pattern);
        if (fromMatch) {
          tableName = fromMatch[1];
          tableAlias = fromMatch[2] || fromMatch[1]; // 별칭이 없으면 테이블명 사용
          break;
        }
      }
      
      if (tableName) {
        // 2. SELECT 절에서 ID 관련 컬럼 찾기
        const selectMatch = normalizedQuery.match(/SELECT\s+(.*?)\s+FROM/i);
        if (selectMatch) {
          const selectClause = selectMatch[1];
          
          // 다양한 ID 패턴 검색
          const idPatterns = [
            new RegExp(`${tableAlias}\\.(\\w*id\\w*)`, 'gi'),      // alias.id, alias.userId 등
            new RegExp(`${tableName}\\.(\\w*id\\w*)`, 'gi'),       // table.id, table.userId 등
            /\b(\w*id\w*)\b/gi,                                    // 단순 id, userId 등
            /\b(id)\b/gi                                           // 단순 id
          ];
          
          for (const pattern of idPatterns) {
            let match;
            while ((match = pattern.exec(selectClause)) !== null) {
              const columnName = match[1] || match[0];
              // 중복 제거 및 기본 키워드 필터링
              if (!keyColumns.includes(columnName) && 
                  !['SELECT', 'FROM', 'WHERE', 'AS'].includes(columnName.toUpperCase())) {
                keyColumns.push(columnName);
              }
            }
          }
          
          // 3. 첫 번째 컬럼을 키로 사용 (다른 ID가 없는 경우)
          if (keyColumns.length === 0) {
            const firstColumnMatch = selectClause.match(/^\s*(\w+(?:\.\w+)?)/);
            if (firstColumnMatch) {
              keyColumns.push(firstColumnMatch[1]);
            }
          }
        }
      }
      
      console.log('🔍 키 컬럼 추출 결과:', {
        query: normalizedQuery,
        tableName,
        tableAlias,
        keyColumns
      });
      
    } catch (error) {
      console.error('키 컬럼 추출 중 오류:', error);
    }
    
    return keyColumns;
  };

  // 쿼리 저장 (기존 개별 변수 시스템에 저장)
  const handleSaveQuery = async () => {
    if (!saveForm.name.trim()) {
      alert('템플릿 이름을 입력해주세요.');
      return;
    }
    
    if (!saveForm.description.trim()) {
      alert('템플릿 설명을 입력해주세요.');
      return;
    }

    if (!currentSelectedColumn) {
      const proceed = confirm(
        '변수값으로 사용할 컬럼이 선택되지 않았습니다.\n' +
        '쿼리를 테스트하고 컬럼을 선택하는 것을 권장합니다.\n\n' +
        '그래도 저장하시겠습니까?'
      );
      if (!proceed) {
        return;
      }
    }

    try {
      // 사용자가 UI에서 선택한 매핑 키 컬럼 사용 (기본값 없이 실제 선택값만 사용)
      const keyColumn = currentMappingKeyColumn;
      
      console.log('🔑 UI에서 선택된 키 컬럼:', currentMappingKeyColumn);
      console.log('🔑 최종 키 컬럼:', keyColumn);
      console.log('📊 선택된 출력 컬럼:', currentSelectedColumn);

      // 먼저 기존 레코드가 있는지 확인
      console.log('🔍 기존 레코드 확인 중:', variableName);
      const checkResponse = await fetch(`/api/supabase/individual-variables?action=get&variableName=${encodeURIComponent(variableName)}`);
      const checkResult = await checkResponse.json();
      
      let response;
      if (checkResult.success && checkResult.data) {
        // 기존 레코드가 있으면 업데이트
        console.log('🔄 기존 레코드 업데이트 중:', checkResult.data.id);
        response = await fetch('/api/supabase/individual-variables?action=update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: checkResult.data.id,
            displayName: saveForm.name,
            sourceType: 'query',
            sourceField: currentQuery,
            selectedColumn: currentSelectedColumn || '',
            keyColumn: keyColumn,
            formatter: 'text',
            category: saveForm.category,
            tags: saveForm.tags,
            isPublic: saveForm.isPublic
          }),
        });
      } else {
        // 기존 레코드가 없으면 새로 생성
        console.log('🆕 새 레코드 생성 중:', variableName);
        response = await fetch('/api/supabase/individual-variables?action=create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variableName,
            displayName: saveForm.name,
            sourceType: 'query',
            sourceField: currentQuery,
            selectedColumn: currentSelectedColumn || '',
            keyColumn: keyColumn,
            formatter: 'text',
            category: saveForm.category,
            tags: saveForm.tags,
            isPublic: saveForm.isPublic,
            createdBy: 'user'
          }),
        });
      }

      const result = await response.json();
      
      if (result.success) {
        const action = checkResult.success && checkResult.data ? '업데이트' : '저장';
        const keyColumnDisplay = keyColumn || '미선택';
        alert(`쿼리 템플릿이 ${action}되었습니다!\n출력 컬럼: ${currentSelectedColumn || '미선택'}\n키 컬럼: ${keyColumnDisplay}`);
        onSave?.(result.data);
        setShowSaveForm(false);
        
        if (showLibrary) {
          loadTemplates();
          // 쿼리 라이브러리도 새로고침
          loadQueryLibrary();
        }
      } else {
        throw new Error(result.error || '저장 실패');
      }
    } catch (error) {
      console.error('쿼리 저장 오류:', error);
      
      // 구체적인 에러 메시지 제공
      let errorMessage = '저장 중 오류가 발생했습니다.';
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          errorMessage = '이미 동일한 변수명으로 저장된 템플릿이 있습니다. 기존 템플릿을 수정하거나 다른 이름을 사용해주세요.';
        } else if (error.message.includes('23505')) {
          errorMessage = '이미 존재하는 템플릿입니다. 다시 시도해주세요.';
        } else {
          errorMessage = `저장 오류: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    }
  };

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
      '기본조회': 'bg-gray-100 text-gray-800',
      'custom': 'bg-yellow-100 text-yellow-800',
      'performance': 'bg-red-100 text-red-800',
      'general': 'bg-cyan-100 text-cyan-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  // 필터링된 쿼리 라이브러리
  const filteredQueryLibrary = (queryLibrary || []).filter(query => {
    const matchesSearch = !searchTerm || 
      query.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      query.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      query.sql?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || query.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // 필터링된 개별 변수 템플릿
  const filteredTemplates = (templates || []).filter(template => {
    const matchesSearch = !searchTerm || 
      template.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.query?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Dialog open={showLibrary} onOpenChange={setShowLibrary}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Database className="w-4 h-4 mr-2" />
              쿼리 라이브러리
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                쿼리 라이브러리 - {variableName}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* 검색 및 필터 */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="쿼리 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-48">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="카테고리" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="집계">집계</SelectItem>
                      <SelectItem value="통계">통계</SelectItem>
                      <SelectItem value="조인">조인</SelectItem>
                      <SelectItem value="날짜조회">날짜조회</SelectItem>
                      <SelectItem value="정렬">정렬</SelectItem>
                      <SelectItem value="그룹화">그룹화</SelectItem>
                      <SelectItem value="기본조회">기본조회</SelectItem>
                      <SelectItem value="custom">사용자 정의</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    loadQueryLibrary();
                    loadTemplates();
                  }}
                  disabled={isLoadingLibrary}
                >
                  <RefreshCw className={cn("w-4 h-4", isLoadingLibrary && "animate-spin")} />
                </Button>
              </div>

              {/* 탭으로 구분 */}
              <Tabs defaultValue="library" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="library" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    워크플로우 쿼리 라이브러리
                    <Badge variant="secondary">{filteredQueryLibrary.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    개별 변수 템플릿
                    <Badge variant="secondary">{filteredTemplates.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                {/* 워크플로우 쿼리 라이브러리 탭 */}
                <TabsContent value="library" className="space-y-4">
                  {isLoadingLibrary ? (
                    <div className="text-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      <p className="text-muted-foreground">쿼리 라이브러리 로드 중...</p>
                    </div>
                  ) : filteredQueryLibrary.length === 0 ? (
                    <div className="text-center py-8">
                      <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">검색 결과가 없습니다</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        워크플로우에서 사용 중인 쿼리가 자동으로 여기에 나타납니다
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {filteredQueryLibrary.map(query => (
                        <Card key={query.id} className="hover:shadow-md transition-shadow cursor-pointer">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1" onClick={() => handleSelectFromLibrary(query)}>
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-medium">{query.name || 'Untitled Query'}</h4>
                                  <Badge className={getCategoryColor(query.category || 'custom')}>
                                    {query.category || 'custom'}
                                  </Badge>
                                  {(query.usageCount || 0) > 0 && (
                                    <Badge variant="outline">
                                      {query.usageCount || 0}회 사용
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {query.description || 'No description'}
                                </p>
                                <div className="bg-gray-50 rounded p-2 font-mono text-xs">
                                  <pre className="whitespace-pre-wrap line-clamp-3">
                                    {(query.sql || '').length > 150 ? (query.sql || '').substring(0, 150) + '...' : (query.sql || '')}
                                  </pre>
                                </div>
                                {(query.usedInTemplates || []).length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs text-muted-foreground mb-1">사용처:</p>
                                    {(query.usedInTemplates || []).slice(0, 2).map((usage, index) => (
                                      <Badge key={index} variant="outline" className="text-xs mr-1">
                                        {usage.templateName}
                                      </Badge>
                                    ))}
                                    {(query.usedInTemplates || []).length > 2 && (
                                      <span className="text-xs text-muted-foreground">
                                        +{(query.usedInTemplates || []).length - 2}개 더
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copySQL(query.sql || '');
                                  }}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* 개별 변수 템플릿 탭 */}
                <TabsContent value="templates" className="space-y-4">
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center py-8">
                      <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">저장된 템플릿이 없습니다</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        현재 쿼리를 템플릿으로 저장해보세요
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {filteredTemplates.map(template => (
                        <Card key={template.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 cursor-pointer" onClick={() => handleSelectTemplate(template)}>
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-medium">{template.name || 'Untitled Template'}</h4>
                                  <Badge className={getCategoryColor(template.category || 'custom')}>
                                    {template.category || 'custom'}
                                  </Badge>
                                  {(template.usageCount || 0) > 0 && (
                                    <Badge variant="outline">
                                      {template.usageCount || 0}회 사용
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {template.description || 'No description'}
                                </p>
                                <div className="bg-gray-50 rounded p-2 font-mono text-xs">
                                  <pre className="whitespace-pre-wrap line-clamp-3">
                                    {(template.query || '').length > 150 ? (template.query || '').substring(0, 150) + '...' : (template.query || '')}
                                  </pre>
                                </div>
                                {template.selectedColumn && (
                                  <div className="mt-2">
                                    <Badge variant="secondary" className="text-xs mr-1">
                                      출력: {template.selectedColumn}
                                    </Badge>
                                    {template.keyColumn && (
                                      <Badge variant="outline" className="text-xs">
                                        키: {template.keyColumn}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleFavorite(template.id)}
                                >
                                  {template.isFavorite ? (
                                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                  ) : (
                                    <StarOff className="w-3 h-3" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTemplate(template.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showSaveForm} onOpenChange={setShowSaveForm}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={handleOpenSaveForm}>
              <Save className="w-4 h-4 mr-2" />
              템플릿 저장
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>쿼리 템플릿 저장</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="template-name">템플릿 이름</Label>
                <Input
                  id="template-name"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 총 리뷰 수 조회"
                />
              </div>
              
              <div>
                <Label htmlFor="template-description">설명</Label>
                <Textarea
                  id="template-description"
                  value={saveForm.description}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="이 쿼리의 용도를 설명해주세요"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="template-category">카테고리</Label>
                <Select 
                  value={saveForm.category} 
                  onValueChange={(value) => setSaveForm(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">사용자 정의</SelectItem>
                    <SelectItem value="performance">성과 지표</SelectItem>
                    <SelectItem value="general">일반</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="template-public"
                  checked={saveForm.isPublic}
                  onCheckedChange={(checked) => setSaveForm(prev => ({ ...prev, isPublic: checked }))}
                />
                <Label htmlFor="template-public">다른 사용자와 공유</Label>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSaveForm(false)}>
                  취소
                </Button>
                <Button onClick={handleSaveQuery}>
                  저장
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 