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
}

interface VariableQuerySelectorProps {
  variableName: string;
  currentQuery?: string;
  currentSelectedColumn?: string;
  onSelect?: (query: string, selectedColumn: string) => void;
  onSave?: (template: VariableQueryTemplate) => void;
}

export default function VariableQuerySelector({
  variableName,
  currentQuery = '',
  currentSelectedColumn = '',
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
          setQueryLibrary(result.data.queries || []);
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
        const matchingTemplates = result.data.filter((template: any) => 
          template.variableName === variableName
        );
        setTemplates(matchingTemplates || []);
      } else {
        console.error('개별 변수 템플릿 로드 실패:', result.error);
      }
    } catch (error) {
      console.error('개별 변수 템플릿 로드 오류:', error);
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

  // 쿼리 저장 (기존 개별 변수 시스템에 저장)
  const handleSaveQuery = async () => {
    if (!saveForm.name.trim()) {
      alert('쿼리 이름을 입력해주세요.');
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
      // 중복 체크: 같은 변수명으로 이미 저장된 쿼리가 있는지 확인
      const existingTemplate = templates.find(t => 
        t.variableName === variableName && t.name === saveForm.name.trim()
      );
      
      if (existingTemplate) {
        const proceed = confirm(
          `"${saveForm.name}" 이름으로 이미 저장된 쿼리가 있습니다.\n` +
          '덮어쓰시겠습니까?'
        );
        if (!proceed) {
          return;
        }
        
        // 기존 쿼리 업데이트
        const response = await fetch('/api/supabase/individual-variables?action=update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: existingTemplate.id,
            variableName,
            displayName: saveForm.name,
            sourceType: 'query',
            sourceField: currentQuery,
            selectedColumn: currentSelectedColumn || '',
            formatter: 'text',
            category: saveForm.category,
            tags: saveForm.tags,
            isPublic: saveForm.isPublic,
            description: saveForm.description || '', // 비고는 선택사항
            createdBy: 'user'
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          alert(`쿼리가 업데이트되었습니다!\n${currentSelectedColumn ? `선택된 컬럼: ${currentSelectedColumn}` : '컬럼: 미선택'}`);
          onSave?.(result.data);
          setShowSaveForm(false);
          
          if (showLibrary) {
            loadTemplates();
            loadQueryLibrary();
          }
        } else {
          throw new Error(result.error || '업데이트 실패');
        }
      } else {
        // 새 쿼리 생성
        const response = await fetch('/api/supabase/individual-variables?action=create', {
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
            formatter: 'text',
            category: saveForm.category,
            tags: saveForm.tags,
            isPublic: saveForm.isPublic,
            description: saveForm.description || '', // 비고는 선택사항
            createdBy: 'user'
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          alert(`쿼리가 저장되었습니다!\n${currentSelectedColumn ? `선택된 컬럼: ${currentSelectedColumn}` : '컬럼: 미선택'}`);
          onSave?.(result.data);
          setShowSaveForm(false);
          
          if (showLibrary) {
            loadTemplates();
            loadQueryLibrary();
          }
        } else {
          throw new Error(result.error || '저장 실패');
        }
      }
    } catch (error) {
      console.error('쿼리 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
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
  const filteredQueryLibrary = queryLibrary.filter(query => {
    const matchesSearch = !searchTerm || 
      query.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      query.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      query.sql.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || query.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // 필터링된 개별 변수 템플릿
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchTerm || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.query.toLowerCase().includes(searchTerm.toLowerCase());
    
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
                    저장된 쿼리
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
                                  <h4 className="font-medium">{query.name}</h4>
                                  <Badge className={getCategoryColor(query.category)}>
                                    {query.category}
                                  </Badge>
                                  {query.usageCount > 0 && (
                                    <Badge variant="outline">
                                      {query.usageCount}회 사용
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {query.description}
                                </p>
                                <div className="bg-gray-50 rounded p-2 font-mono text-xs">
                                  <pre className="whitespace-pre-wrap line-clamp-3">
                                    {query.sql.length > 150 ? query.sql.substring(0, 150) + '...' : query.sql}
                                  </pre>
                                </div>
                                {query.usedInTemplates.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs text-muted-foreground mb-1">사용처:</p>
                                    {query.usedInTemplates.slice(0, 2).map((usage, index) => (
                                      <Badge key={index} variant="outline" className="text-xs mr-1">
                                        {usage.templateName}
                                      </Badge>
                                    ))}
                                    {query.usedInTemplates.length > 2 && (
                                      <span className="text-xs text-muted-foreground">
                                        +{query.usedInTemplates.length - 2}개 더
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
                                    copySQL(query.sql);
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
                      <p className="text-muted-foreground">저장된 쿼리가 없습니다</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        현재 쿼리를 저장해보세요
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
                                  <h4 className="font-medium">{template.name}</h4>
                                  <Badge className={getCategoryColor(template.category)}>
                                    {template.category}
                                  </Badge>
                                  {template.usageCount > 0 && (
                                    <Badge variant="outline">
                                      {template.usageCount}회 사용
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {template.description}
                                </p>
                                <div className="bg-gray-50 rounded p-2 font-mono text-xs">
                                  <pre className="whitespace-pre-wrap line-clamp-3">
                                    {template.query.length > 150 ? template.query.substring(0, 150) + '...' : template.query}
                                  </pre>
                                </div>
                                {template.selectedColumn && (
                                  <div className="mt-2">
                                    <Badge variant="secondary" className="text-xs">
                                      컬럼: {template.selectedColumn}
                                    </Badge>
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
              쿼리 저장
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>쿼리 저장</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* SQL 코드 정보 표시 */}
              <div>
                <Label>저장할 SQL 쿼리</Label>
                <div className="bg-gray-50 border rounded-lg p-3 mt-1">
                  <pre className="text-sm font-mono whitespace-pre-wrap text-gray-800">
                    {currentQuery || '쿼리가 입력되지 않았습니다'}
                  </pre>
                </div>
                {currentSelectedColumn && (
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      선택된 컬럼: {currentSelectedColumn}
                    </Badge>
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="query-name">쿼리 이름 *</Label>
                <Input
                  id="query-name"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 총 리뷰 수 조회"
                />
              </div>
              
              <div>
                <Label htmlFor="query-notes">비고 (선택사항)</Label>
                <Textarea
                  id="query-notes"
                  value={saveForm.description}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="필요시 추가 설명을 입력하세요"
                  rows={2}
                />
              </div>
              
              <div>
                <Label htmlFor="query-category">카테고리</Label>
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
                  id="query-public"
                  checked={saveForm.isPublic}
                  onCheckedChange={(checked) => setSaveForm(prev => ({ ...prev, isPublic: checked }))}
                />
                <Label htmlFor="query-public">다른 사용자와 공유</Label>
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