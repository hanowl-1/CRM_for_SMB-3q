'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Database, Search, RefreshCw, ExternalLink, Code } from 'lucide-react';
import Link from 'next/link';

interface TableField {
  displayName: string;
  description: string;
  type: string;
  filterable: boolean;
}

interface TableMapping {
  tableName: string;
  displayName: string;
  description: string;
  icon: string;
  enabled: boolean;
  fields: Record<string, TableField>;
}

interface CustomQuery {
  queryName: string;
  displayName: string;
  description: string;
  variableCount: number;
  enabled: boolean;
  updatedAt: string;
}

interface DbVariableSettingsProps {
  onVariablesExtracted: (variables: Record<string, any>) => void;
}

export default function DbVariableSettings({ onVariablesExtracted }: DbVariableSettingsProps) {
  const [mappings, setMappings] = useState<Record<string, TableMapping>>({});
  const [customQueries, setCustomQueries] = useState<CustomQuery[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedQuery, setSelectedQuery] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tables' | 'queries'>('tables');

  // 테이블 매핑 로드
  const loadMappings = async () => {
    try {
      const response = await fetch('/api/mysql/table-mappings');
      const data = await response.json();
      if (data.success) {
        // 활성화된 매핑만 필터링
        const enabledMappings = Object.fromEntries(
          Object.entries(data.mappings as Record<string, TableMapping>).filter(([_, mapping]) => mapping.enabled)
        );
        setMappings(enabledMappings);
      }
    } catch (error) {
      console.error('매핑 로드 오류:', error);
    }
  };

  // 커스텀 쿼리 로드
  const loadCustomQueries = async () => {
    try {
      const response = await fetch('/api/mysql/custom-queries?action=list');
      const data = await response.json();
      if (data.success) {
        // 활성화된 쿼리만 필터링
        const enabledQueries = data.queries.filter((query: CustomQuery) => query.enabled);
        setCustomQueries(enabledQueries);
      }
    } catch (error) {
      console.error('커스텀 쿼리 로드 오류:', error);
    }
  };

  // 테이블 데이터 검색
  const searchTableData = async () => {
    if (!selectedTable || !searchTerm.trim()) {
      toast.error('테이블과 검색어를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/mysql/variables?action=search&table=${selectedTable}&term=${encodeURIComponent(searchTerm)}&limit=10`);
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.results);
        toast.success(`${data.count}개의 결과를 찾았습니다.`);
      } else {
        toast.error(data.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('검색 오류:', error);
      toast.error('데이터 검색에 실패했습니다.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 커스텀 쿼리 실행
  const executeCustomQuery = async () => {
    if (!selectedQuery) {
      toast.error('커스텀 쿼리를 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/mysql/custom-queries?action=execute&query=${selectedQuery}&limit=10`);
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.results);
        toast.success(`${data.count}개의 결과를 찾았습니다.`);
      } else {
        toast.error(data.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('쿼리 실행 오류:', error);
      toast.error('쿼리 실행에 실패했습니다.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 변수 추출 및 전달
  const extractVariables = (record: any) => {
    let extractedVariables: Record<string, any> = {};

    if (activeTab === 'tables' && selectedTable && mappings[selectedTable]) {
      // 테이블 매핑 기반 변수 추출
      const mapping = mappings[selectedTable];
      Object.entries(mapping.fields).forEach(([fieldKey, fieldConfig]) => {
        if (record[fieldKey] !== undefined) {
          let value = record[fieldKey];
          
          // 타입별 데이터 변환
          if (fieldConfig.type === 'date' && value) {
            value = new Date(value).toLocaleDateString();
          } else if (fieldConfig.type === 'datetime' && value) {
            value = new Date(value).toLocaleString();
          } else if (fieldConfig.type === 'number' && value !== null) {
            value = Number(value).toLocaleString();
          } else if (fieldConfig.type === 'boolean') {
            value = value ? '예' : '아니오';
          }
          
          extractedVariables[fieldConfig.displayName] = value || '';
        }
      });
    } else if (activeTab === 'queries' && selectedQuery) {
      // 커스텀 쿼리 기반 변수 추출
      const queryConfig = customQueries.find(q => q.queryName === selectedQuery);
      if (queryConfig) {
        // 모든 필드를 변수로 추출 (커스텀 쿼리는 이미 필요한 필드만 SELECT)
        Object.entries(record).forEach(([key, value]) => {
          let processedValue = value;
          
          // 기본적인 데이터 변환
          if (value instanceof Date) {
            processedValue = value.toLocaleString();
          } else if (typeof value === 'number') {
            processedValue = value.toLocaleString();
          } else if (typeof value === 'boolean') {
            processedValue = value ? '예' : '아니오';
          }
          
          extractedVariables[key] = processedValue || '';
        });
      }
    }

    onVariablesExtracted(extractedVariables);
    toast.success(`${Object.keys(extractedVariables).length}개의 변수가 추출되었습니다.`);
  };

  useEffect(() => {
    loadMappings();
    loadCustomQueries();
  }, []);

  const hasNoData = Object.keys(mappings).length === 0 && customQueries.length === 0;

  if (hasNoData) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">설정된 데이터 소스가 없습니다</h3>
          <p className="text-muted-foreground mb-4">
            테이블 매핑이나 커스텀 쿼리를 먼저 설정해주세요.
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/admin/table-mappings">
              <Button variant="outline">
                <Database className="w-4 h-4 mr-2" />
                테이블 매핑 관리
              </Button>
            </Link>
            <Link href="/admin/custom-queries">
              <Button variant="outline">
                <Code className="w-4 h-4 mr-2" />
                커스텀 쿼리 관리
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>데이터베이스 변수 설정</span>
          </CardTitle>
          <CardDescription>
            테이블 매핑 또는 커스텀 쿼리를 사용하여 데이터베이스에서 변수를 추출하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'tables' | 'queries')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tables" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                테이블 매핑 ({Object.keys(mappings).length})
              </TabsTrigger>
              <TabsTrigger value="queries" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                커스텀 쿼리 ({customQueries.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tables" className="space-y-4 mt-4">
              {Object.keys(mappings).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>활성화된 테이블 매핑이 없습니다.</p>
                  <Link href="/admin/table-mappings">
                    <Button variant="outline" className="mt-2">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      테이블 매핑 관리
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>테이블 선택</Label>
                      <Select value={selectedTable} onValueChange={setSelectedTable}>
                        <SelectTrigger>
                          <SelectValue placeholder="테이블을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(mappings).map(([tableName, mapping]) => (
                            <SelectItem key={tableName} value={tableName}>
                              {mapping.displayName} ({Object.keys(mapping.fields).length}개 필드)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>검색어</Label>
                      <div className="flex gap-2">
                        <Input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="회사명, 연락처 등..."
                          onKeyPress={(e) => e.key === 'Enter' && searchTableData()}
                        />
                        <Button onClick={searchTableData} disabled={loading}>
                          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {selectedTable && mappings[selectedTable] && (
                    <div>
                      <Label className="text-sm font-medium">사용 가능한 변수</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(mappings[selectedTable].fields).map(([fieldKey, fieldConfig]) => (
                          <Badge key={fieldKey} variant="outline">
                            {fieldConfig.displayName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="queries" className="space-y-4 mt-4">
              {customQueries.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>활성화된 커스텀 쿼리가 없습니다.</p>
                  <Link href="/admin/custom-queries">
                    <Button variant="outline" className="mt-2">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      커스텀 쿼리 관리
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <Label>커스텀 쿼리 선택</Label>
                    <Select value={selectedQuery} onValueChange={setSelectedQuery}>
                      <SelectTrigger>
                        <SelectValue placeholder="커스텀 쿼리를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {customQueries.map((query) => (
                          <SelectItem key={query.queryName} value={query.queryName}>
                            {query.displayName} ({query.variableCount}개 변수)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      {selectedQuery && (
                        <p className="text-sm text-muted-foreground">
                          {customQueries.find(q => q.queryName === selectedQuery)?.description}
                        </p>
                      )}
                    </div>
                    <Button onClick={executeCustomQuery} disabled={loading || !selectedQuery}>
                      {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                      쿼리 실행
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 검색 결과 */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>검색 결과</CardTitle>
            <CardDescription>
              {activeTab === 'tables' ? '테이블 검색' : '커스텀 쿼리'} 결과입니다. 원하는 레코드를 클릭하여 변수를 추출하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(searchResults[0] || {}).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                    <TableHead>액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((record, index) => (
                    <TableRow key={index} className="hover:bg-muted/50">
                      {Object.values(record).map((value: any, cellIndex) => (
                        <TableCell key={cellIndex}>
                          {value === null ? (
                            <span className="text-muted-foreground italic">null</span>
                          ) : (
                            String(value)
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => extractVariables(record)}
                        >
                          변수 추출
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 