'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Database, Search, RefreshCw, ExternalLink, Code, Loader2 } from 'lucide-react';
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

interface DbVariableSettingsProps {
  onVariablesExtracted: (variables: Record<string, any>) => void;
}

export default function DbVariableSettings({ onVariablesExtracted }: DbVariableSettingsProps) {
  const [mappings, setMappings] = useState<Record<string, TableMapping>>({});
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 테이블 매핑 로드
  const loadMappings = async () => {
    try {
      const response = await fetch('/api/mysql/table-mappings');
      const data = await response.json();
      if (data.success) {
        // 활성화된 매핑만 필터링
        const enabledMappings = Object.fromEntries(
          Object.entries(data.mappings as Record<string, TableMapping>).filter(([_, mapping]) => mapping.enabled)
        ) as Record<string, TableMapping>;
        setMappings(enabledMappings);
      }
    } catch (error) {
      console.error('테이블 매핑 로드 오류:', error);
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

  // 변수 추출 및 전달
  const extractVariables = (record: any) => {
    let extractedVariables: Record<string, any> = {};

    if (selectedTable && mappings[selectedTable]) {
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
    }

    onVariablesExtracted(extractedVariables);
    toast.success(`${Object.keys(extractedVariables).length}개의 변수가 추출되었습니다.`);
  };

  useEffect(() => {
    loadMappings();
  }, []);

  const hasNoData = Object.keys(mappings).length === 0;

  if (hasNoData) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">설정된 테이블 매핑이 없습니다</h3>
          <p className="text-muted-foreground mb-4">
            테이블 매핑을 먼저 설정해주세요.
          </p>
          <Link href="/admin/table-mappings">
            <Button variant="outline">
              <Database className="w-4 h-4 mr-2" />
              테이블 매핑 관리
            </Button>
          </Link>
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
            테이블 매핑을 사용하여 데이터베이스에서 변수를 추출하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">{mapping.icon}</span>
                        <div>
                          <div className="font-medium">{mapping.displayName}</div>
                          <div className="text-xs text-muted-foreground">{mapping.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>검색어</Label>
              <div className="flex space-x-2">
                <Input
                  placeholder="검색할 내용을 입력하세요"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchTableData()}
                />
                <Button onClick={searchTableData} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {selectedTable && mappings[selectedTable] && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">사용 가능한 변수</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(mappings[selectedTable].fields).map(([fieldKey, field]) => (
                  <Badge key={fieldKey} variant="outline" className="justify-start">
                    {field.displayName}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="text-right">
            <Link href="/admin/table-mappings">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                테이블 매핑 관리
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 검색 결과 */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>검색 결과</CardTitle>
            <CardDescription>
              원하는 데이터를 선택하여 변수를 추출하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {searchResults.map((record, index) => (
                <div key={index} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {selectedTable && mappings[selectedTable] && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          {Object.entries(mappings[selectedTable].fields).map(([fieldKey, field]) => (
                            <div key={fieldKey}>
                              <span className="font-medium text-muted-foreground">{field.displayName}:</span>
                              <span className="ml-1">{record[fieldKey] || '-'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button size="sm" onClick={() => extractVariables(record)}>
                      변수 추출
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 