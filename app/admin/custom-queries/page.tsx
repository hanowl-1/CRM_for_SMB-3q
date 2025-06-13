'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  Database, 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  RefreshCw, 
  Code, 
  CheckCircle, 
  XCircle,
  ArrowLeft,
  Save,
  TestTube
} from 'lucide-react';
import Link from 'next/link';

interface CustomQueryVariable {
  field: string;
  variable: string;
  description: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'url' | 'date' | 'datetime' | 'boolean' | 'select';
}

interface CustomQuery {
  queryName: string;
  displayName: string;
  description: string;
  query: string;
  variables: CustomQueryVariable[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  variableCount?: number;
}

export default function CustomQueriesPage() {
  const [queries, setQueries] = useState<CustomQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingQuery, setEditingQuery] = useState<CustomQuery | null>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testLoading, setTestLoading] = useState(false);

  // 새 쿼리 생성용 상태
  const [newQuery, setNewQuery] = useState<Partial<CustomQuery>>({
    queryName: '',
    displayName: '',
    description: '',
    query: '',
    variables: [],
    enabled: true
  });

  // 쿼리 목록 로드
  const loadQueries = async () => {
    try {
      const response = await fetch('/api/mysql/custom-queries?action=list');
      const data = await response.json();
      if (data.success) {
        setQueries(data.queries);
      }
    } catch (error) {
      console.error('쿼리 목록 로드 오류:', error);
      toast.error('쿼리 목록을 불러오는데 실패했습니다.');
    }
  };

  // 쿼리 저장
  const saveQuery = async (queryData: Partial<CustomQuery>) => {
    if (!queryData.queryName || !queryData.displayName || !queryData.query) {
      toast.error('필수 필드를 모두 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/mysql/custom-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          queryName: queryData.queryName,
          queryConfig: queryData
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        await loadQueries();
        setEditingQuery(null);
        setNewQuery({
          queryName: '',
          displayName: '',
          description: '',
          query: '',
          variables: [],
          enabled: true
        });
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error('쿼리 저장 오류:', error);
      toast.error('쿼리 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 쿼리 테스트
  const testQuery = async (queryName: string) => {
    setTestLoading(true);
    try {
      const response = await fetch(`/api/mysql/custom-queries?action=test&query=${queryName}`);
      const data = await response.json();
      
      if (data.success) {
        setTestResults(data.testResults);
        toast.success(`테스트 완료: ${data.count}개 결과`);
      } else {
        toast.error(`테스트 실패: ${data.error}`);
        setTestResults([]);
      }
    } catch (error) {
      console.error('쿼리 테스트 오류:', error);
      toast.error('쿼리 테스트에 실패했습니다.');
      setTestResults([]);
    } finally {
      setTestLoading(false);
    }
  };

  // 쿼리 토글
  const toggleQuery = async (queryName: string) => {
    try {
      const response = await fetch('/api/mysql/custom-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          queryName
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        await loadQueries();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error('쿼리 토글 오류:', error);
      toast.error('쿼리 상태 변경에 실패했습니다.');
    }
  };

  // 쿼리 삭제
  const deleteQuery = async (queryName: string) => {
    if (!confirm(`${queryName} 쿼리를 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch('/api/mysql/custom-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          queryName
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        await loadQueries();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error('쿼리 삭제 오류:', error);
      toast.error('쿼리 삭제에 실패했습니다.');
    }
  };

  // 변수 추가
  const addVariable = (queryData: Partial<CustomQuery>, setQueryData: (data: Partial<CustomQuery>) => void) => {
    const newVariable: CustomQueryVariable = {
      field: '',
      variable: '',
      description: '',
      type: 'text'
    };
    
    setQueryData({
      ...queryData,
      variables: [...(queryData.variables || []), newVariable]
    });
  };

  // 변수 제거
  const removeVariable = (index: number, queryData: Partial<CustomQuery>, setQueryData: (data: Partial<CustomQuery>) => void) => {
    const updatedVariables = [...(queryData.variables || [])];
    updatedVariables.splice(index, 1);
    setQueryData({
      ...queryData,
      variables: updatedVariables
    });
  };

  // 변수 업데이트
  const updateVariable = (index: number, field: keyof CustomQueryVariable, value: string, queryData: Partial<CustomQuery>, setQueryData: (data: Partial<CustomQuery>) => void) => {
    const updatedVariables = [...(queryData.variables || [])];
    updatedVariables[index] = { ...updatedVariables[index], [field]: value };
    setQueryData({
      ...queryData,
      variables: updatedVariables
    });
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await loadQueries();
      setLoading(false);
    };
    initData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>데이터를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  const QueryEditor = ({ queryData, setQueryData, onSave, title }: {
    queryData: Partial<CustomQuery>;
    setQueryData: (data: Partial<CustomQuery>) => void;
    onSave: () => void;
    title: string;
  }) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button onClick={onSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>쿼리 이름 (영문)</Label>
          <Input
            value={queryData.queryName || ''}
            onChange={(e) => setQueryData({ ...queryData, queryName: e.target.value })}
            placeholder="subscription_contacts"
          />
        </div>
        <div>
          <Label>표시 이름</Label>
          <Input
            value={queryData.displayName || ''}
            onChange={(e) => setQueryData({ ...queryData, displayName: e.target.value })}
            placeholder="구독중인 가맹점 연락처"
          />
        </div>
      </div>

      <div>
        <Label>설명</Label>
        <Input
          value={queryData.description || ''}
          onChange={(e) => setQueryData({ ...queryData, description: e.target.value })}
          placeholder="이 쿼리의 용도를 설명해주세요"
        />
      </div>

      <div>
        <Label>SQL 쿼리</Label>
        <Textarea
          value={queryData.query || ''}
          onChange={(e) => setQueryData({ ...queryData, query: e.target.value })}
          placeholder="SELECT ... FROM ... WHERE ..."
          rows={8}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          보안상 SELECT 문만 허용됩니다. JOIN, WHERE 등을 자유롭게 사용할 수 있습니다.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <Label>변수 매핑</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addVariable(queryData, setQueryData)}
          >
            <Plus className="w-4 h-4 mr-2" />
            변수 추가
          </Button>
        </div>

        <div className="space-y-3">
          {(queryData.variables || []).map((variable, index) => (
            <div key={index} className="grid grid-cols-5 gap-2 items-end">
              <div>
                <Label className="text-xs">필드명</Label>
                <Input
                  value={variable.field}
                  onChange={(e) => updateVariable(index, 'field', e.target.value, queryData, setQueryData)}
                  placeholder="company_name"
                />
              </div>
              <div>
                <Label className="text-xs">변수명</Label>
                <Input
                  value={variable.variable}
                  onChange={(e) => updateVariable(index, 'variable', e.target.value, queryData, setQueryData)}
                  placeholder="회사명"
                />
              </div>
              <div>
                <Label className="text-xs">설명</Label>
                <Input
                  value={variable.description}
                  onChange={(e) => updateVariable(index, 'description', e.target.value, queryData, setQueryData)}
                  placeholder="회사 이름"
                />
              </div>
              <div>
                <Label className="text-xs">타입</Label>
                <select
                  value={variable.type}
                  onChange={(e) => updateVariable(index, 'type', e.target.value as any, queryData, setQueryData)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="text">텍스트</option>
                  <option value="number">숫자</option>
                  <option value="email">이메일</option>
                  <option value="phone">전화번호</option>
                  <option value="url">URL</option>
                  <option value="date">날짜</option>
                  <option value="datetime">날짜시간</option>
                  <option value="boolean">불린</option>
                  <option value="select">선택</option>
                </select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeVariable(index, queryData, setQueryData)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link href="/admin/table-mappings">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  테이블 매핑으로 돌아가기
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">커스텀 쿼리 관리</h1>
                <p className="text-gray-600">복합 JOIN 쿼리를 생성하여 고급 데이터 추출을 수행하세요</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="queries" className="space-y-6">
          <TabsList>
            <TabsTrigger value="queries">커스텀 쿼리 목록</TabsTrigger>
            <TabsTrigger value="create">새 쿼리 생성</TabsTrigger>
          </TabsList>

          <TabsContent value="queries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5" />
                  <span>커스텀 쿼리 ({queries.length}개)</span>
                </CardTitle>
                <CardDescription>
                  복합 JOIN 쿼리를 사용하여 여러 테이블의 데이터를 조합할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queries.map((query) => (
                    <div
                      key={query.queryName}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{query.displayName}</h3>
                          <Badge variant={query.enabled ? "default" : "secondary"}>
                            {query.enabled ? "활성" : "비활성"}
                          </Badge>
                          <Badge variant="outline">
                            {query.variableCount || 0}개 변수
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {query.description}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          최종 수정: {new Date(query.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testQuery(query.queryName)}
                          disabled={testLoading}
                        >
                          <TestTube className="w-4 h-4 mr-1" />
                          테스트
                        </Button>
                        <Switch
                          checked={query.enabled}
                          onCheckedChange={() => toggleQuery(query.queryName)}
                        />
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>쿼리 편집: {query.displayName}</DialogTitle>
                              <DialogDescription>
                                커스텀 쿼리를 수정할 수 있습니다.
                              </DialogDescription>
                            </DialogHeader>
                            <QueryEditor
                              queryData={editingQuery || query}
                              setQueryData={(data) => setEditingQuery(data as CustomQuery)}
                              onSave={() => saveQuery(editingQuery || query)}
                              title="쿼리 편집"
                            />
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteQuery(query.queryName)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {queries.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>아직 생성된 커스텀 쿼리가 없습니다.</p>
                      <p className="text-sm">새 쿼리 생성 탭에서 첫 번째 쿼리를 만들어보세요.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 테스트 결과 */}
            {testResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>테스트 결과</CardTitle>
                  <CardDescription>
                    쿼리 실행 결과 (최대 3개 행)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(testResults[0] || {}).map((key) => (
                            <TableHead key={key}>{key}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {testResults.map((row, index) => (
                          <TableRow key={index}>
                            {Object.values(row).map((value: any, cellIndex) => (
                              <TableCell key={cellIndex}>
                                {value === null ? (
                                  <span className="text-muted-foreground italic">null</span>
                                ) : (
                                  String(value)
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>새 커스텀 쿼리 생성</CardTitle>
                <CardDescription>
                  복합 JOIN 쿼리를 생성하여 여러 테이블의 데이터를 조합하세요.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QueryEditor
                  queryData={newQuery}
                  setQueryData={setNewQuery}
                  onSave={() => saveQuery(newQuery)}
                  title="새 쿼리 생성"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 