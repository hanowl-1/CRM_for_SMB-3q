'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Search, 
  Filter,
  Target,
  Building,
  FileText,
  CheckCircle,
  AlertTriangle,
  Download,
  Upload
} from 'lucide-react';

interface TargetSelectionProps {
  onTargetsChange: (targets: TargetGroup[]) => void;
  currentTargets: TargetGroup[];
}

interface TargetGroup {
  id: string;
  name: string;
  table: string;
  conditions: FilterCondition[];
  estimatedCount: number;
  selectedRecords?: any[];
}

interface FilterCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_list';
  value: string;
}

export function TargetSelection({ onTargetsChange, currentTargets }: TargetSelectionProps) {
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [estimatedCount, setEstimatedCount] = useState<number>(0);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const tables = [
    { value: 'Companies', label: '회사 정보', icon: Building, description: '등록된 회사들' },
    { value: 'MarketingLead', label: '마케팅 리드', icon: Target, description: '잠재 고객들' },
    { value: 'Ads', label: '광고 정보', icon: FileText, description: '광고 등록 업체들' },
    { value: 'Contracts', label: '계약 정보', icon: Users, description: '계약 체결 고객들' },
    { value: 'Channels', label: '구독 채널 관리', icon: Users, description: '구독 중인 인플루언서 채널들' }
  ];

  const filterFields = {
    Companies: [
      { field: 'name', label: '회사명', type: 'text' },
      { field: 'email', label: '이메일', type: 'text' },
      { field: 'contacts', label: '연락처', type: 'text' },
      { field: 'route', label: '유입경로', type: 'select', options: ['BI', 'AA', 'Z'] },
      { field: 'agree_to_mail', label: '메일수신동의', type: 'boolean' },
      { field: 'createdAt', label: '가입일', type: 'date' }
    ],
    MarketingLead: [
      { field: 'companyName', label: '회사명', type: 'text' },
      { field: 'contact', label: '연락처', type: 'text' },
      { field: 'adCategory', label: '광고카테고리', type: 'text' },
      { field: 'assignee', label: '담당자', type: 'text' },
      { field: 'agreeToMarketing', label: '마케팅동의', type: 'boolean' },
      { field: 'callTemperature', label: '콜온도', type: 'number' }
    ],
    Ads: [
      { field: 'name', label: '광고명', type: 'text' },
      { field: 'companyName', label: '회사명', type: 'text' },
      { field: 'category', label: '카테고리', type: 'text' },
      { field: 'step', label: '진행단계', type: 'number' },
      { field: 'verified', label: '인증여부', type: 'boolean' }
    ],
    Channels: [
      { field: 'name', label: '채널명', type: 'text' },
      { field: 'description', label: '채널설명', type: 'text' },
      { field: 'platform', label: '플랫폼', type: 'text' },
      { field: 'available', label: '구독상태', type: 'select', options: ['0', '1', '2'] },
      { field: 'followers', label: '팔로워수', type: 'number' },
      { field: 'engagement', label: '참여율', type: 'number' },
      { field: 'location', label: '활동지역', type: 'text' },
      { field: 'price', label: '제공금액', type: 'number' }
    ]
  };

  const addFilterCondition = () => {
    setFilterConditions([
      ...filterConditions,
      { field: '', operator: 'equals', value: '' }
    ]);
  };

  const updateFilterCondition = (index: number, updates: Partial<FilterCondition>) => {
    const newConditions = [...filterConditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setFilterConditions(newConditions);
  };

  const removeFilterCondition = (index: number) => {
    setFilterConditions(filterConditions.filter((_, i) => i !== index));
  };

  const previewTargets = async () => {
    if (!selectedTable) return;

    setLoading(true);
    try {
      // API 호출로 필터 조건에 맞는 대상 미리보기
      const response = await fetch('/api/mysql/targets/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: selectedTable,
          conditions: filterConditions
        })
      });

      const data = await response.json();
      if (data.success) {
        setEstimatedCount(data.count);
        setPreviewData(data.preview);
      }
    } catch (error) {
      console.error('대상 미리보기 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTargetGroup = () => {
    if (!selectedTable || filterConditions.length === 0) return;

    const newTargetGroup: TargetGroup = {
      id: Date.now().toString(),
      name: `${tables.find(t => t.value === selectedTable)?.label} 그룹`,
      table: selectedTable,
      conditions: filterConditions,
      estimatedCount
    };

    onTargetsChange([...currentTargets, newTargetGroup]);
    
    // 초기화
    setSelectedTable('');
    setFilterConditions([]);
    setEstimatedCount(0);
    setPreviewData([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            발송 대상 선정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="filter" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="filter">조건 필터</TabsTrigger>
              <TabsTrigger value="upload">파일 업로드</TabsTrigger>
              <TabsTrigger value="manual">수동 선택</TabsTrigger>
            </TabsList>
            
            <TabsContent value="filter" className="space-y-4">
              {/* 테이블 선택 */}
              <div className="space-y-2">
                <Label>대상 테이블</Label>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger>
                    <SelectValue placeholder="테이블을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => {
                      const Icon = table.icon;
                      return (
                        <SelectItem key={table.value} value={table.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{table.label}</div>
                              <div className="text-xs text-muted-foreground">{table.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* 필터 조건 */}
              {selectedTable && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>필터 조건</Label>
                    <Button onClick={addFilterCondition} variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      조건 추가
                    </Button>
                  </div>

                  {filterConditions.map((condition, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                      <Select 
                        value={condition.field} 
                        onValueChange={(value) => updateFilterCondition(index, { field: value })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="필드 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {filterFields[selectedTable as keyof typeof filterFields]?.map((field) => (
                            <SelectItem key={field.field} value={field.field}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select 
                        value={condition.operator} 
                        onValueChange={(value) => updateFilterCondition(index, { operator: value as any })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">같음</SelectItem>
                          <SelectItem value="contains">포함</SelectItem>
                          <SelectItem value="greater_than">초과</SelectItem>
                          <SelectItem value="less_than">미만</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="값 입력"
                        value={condition.value}
                        onChange={(e) => updateFilterCondition(index, { value: e.target.value })}
                        className="flex-1"
                      />

                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeFilterCondition(index)}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}

                  {filterConditions.length > 0 && (
                    <div className="flex gap-2">
                      <Button onClick={previewTargets} disabled={loading}>
                        <Search className="h-4 w-4 mr-2" />
                        {loading ? '조회 중...' : '미리보기'}
                      </Button>
                      
                      {estimatedCount > 0 && (
                        <Button onClick={saveTargetGroup} variant="default">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          그룹 저장 ({estimatedCount}명)
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 미리보기 결과 */}
              {previewData.length > 0 && (
                <div className="space-y-2">
                  <Label>미리보기 ({estimatedCount}명)</Label>
                  <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                    {previewData.map((record, index) => (
                      <div key={index} className="text-sm py-1 border-b last:border-b-0">
                        {record.name || record.companyName || `ID: ${record.id}`}
                        {record.email && ` (${record.email})`}
                        {record.contact && ` - ${record.contact}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="upload" className="space-y-4">
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  CSV 파일을 업로드하여 대상을 가져오세요
                </p>
                <Button variant="outline">
                  파일 선택
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-4">
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  개별 대상을 수동으로 선택할 수 있습니다
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 저장된 대상 그룹들 */}
      {currentTargets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">선택된 대상 그룹</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentTargets.map((group) => (
                <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{group.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {group.table} 테이블 • {group.estimatedCount}명 • {group.conditions.length}개 조건
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{group.estimatedCount}명</Badge>
                    <Button variant="ghost" size="sm">편집</Button>
                    <Button variant="ghost" size="sm">삭제</Button>
                  </div>
                </div>
              ))}
              
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-medium">총 발송 대상</span>
                  <Badge variant="default" className="text-base px-3 py-1">
                    {currentTargets.reduce((sum, group) => sum + group.estimatedCount, 0)}명
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 