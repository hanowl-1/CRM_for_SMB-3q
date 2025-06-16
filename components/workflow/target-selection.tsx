'use client';

import { useState, useEffect } from 'react';
import { TargetGroup, FilterCondition } from '@/lib/types/workflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Plus, 
  Trash2, 
  Users, 
  Database, 
  Code, 
  Play, 
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';

interface TargetSelectionProps {
  onTargetsChange: (targets: TargetGroup[]) => void;
  currentTargets: TargetGroup[];
}

export function TargetSelection({ onTargetsChange, currentTargets }: TargetSelectionProps) {
  const [targets, setTargets] = useState<TargetGroup[]>(currentTargets);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'static' | 'dynamic'>('static');
  
  // 정적 대상 선정 상태
  const [staticName, setStaticName] = useState('');
  const [staticTable, setStaticTable] = useState('');
  const [staticConditions, setStaticConditions] = useState<FilterCondition[]>([]);
  
  // 동적 대상 선정 상태
  const [dynamicName, setDynamicName] = useState('');
  const [dynamicDescription, setDynamicDescription] = useState('');
  const [dynamicSql, setDynamicSql] = useState('');
  const [dynamicFields, setDynamicFields] = useState('contact, name, id');
  const [queryTestResult, setQueryTestResult] = useState<any>(null);
  const [isTestingQuery, setIsTestingQuery] = useState(false);

  const [availableTables, setAvailableTables] = useState<string[]>([]);

  useEffect(() => {
    // 사용 가능한 테이블 목록 로드
    fetchAvailableTables();
  }, []);

  useEffect(() => {
    onTargetsChange(targets);
  }, [targets, onTargetsChange]);

  const fetchAvailableTables = async () => {
    try {
      const response = await fetch('/api/mysql/table-mappings');
      if (response.ok) {
        const data = await response.json();
        // mappings는 객체이므로 Object.values()를 사용하여 배열로 변환
        if (data.mappings && typeof data.mappings === 'object') {
          const tableNames = Object.values(data.mappings).map((mapping: any) => mapping.tableName);
          setAvailableTables(tableNames);
        } else {
          console.warn('테이블 매핑 데이터가 객체가 아닙니다:', data);
          setAvailableTables([]);
        }
      }
    } catch (error) {
      console.error('테이블 목록 로드 실패:', error);
      setAvailableTables([]);
    }
  };

  const testDynamicQuery = async () => {
    if (!dynamicSql.trim()) return;
    
    setIsTestingQuery(true);
    setQueryTestResult(null); // 이전 결과 초기화
    
    try {
      console.log('동적 쿼리 테스트 시작:', dynamicSql);
      
      const response = await fetch('/api/mysql/targets/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'custom_query',
          query: dynamicSql,
          limit: 5
        })
      });
      
      console.log('응답 상태:', response.status, response.statusText);
      
      if (response.ok) {
        const result = await response.json();
        console.log('쿼리 테스트 결과:', result);
        setQueryTestResult(result);
      } else {
        const errorText = await response.text();
        console.error('API 오류 응답:', errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          setQueryTestResult({ 
            success: false, 
            error: errorJson.error || errorJson.message || '쿼리 실행 실패' 
          });
        } catch (parseError) {
          setQueryTestResult({ 
            success: false, 
            error: `HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}` 
          });
        }
      }
    } catch (error) {
      console.error('네트워크 오류:', error);
      setQueryTestResult({ 
        success: false, 
        error: `네트워크 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` 
      });
    } finally {
      setIsTestingQuery(false);
    }
  };

  const addStaticTarget = () => {
    if (!staticName.trim() || !staticTable) return;

    const newTarget: TargetGroup = {
      id: `target_${Date.now()}`,
      name: staticName,
      type: 'static',
      table: staticTable,
      conditions: staticConditions,
      estimatedCount: 0
    };

    setTargets([...targets, newTarget]);
    resetStaticForm();
    setShowAddDialog(false);
  };

  const addDynamicTarget = () => {
    if (!dynamicName.trim() || !dynamicSql.trim()) return;

    const newTarget: TargetGroup = {
      id: `target_${Date.now()}`,
      name: dynamicName,
      type: 'dynamic',
      dynamicQuery: {
        sql: dynamicSql,
        description: dynamicDescription,
        expectedFields: dynamicFields.split(',').map(f => f.trim()),
        lastExecuted: undefined,
        lastCount: queryTestResult?.totalCount || 0
      },
      estimatedCount: queryTestResult?.totalCount || 0
    };

    setTargets([...targets, newTarget]);
    resetDynamicForm();
    setShowAddDialog(false);
  };

  const resetStaticForm = () => {
    setStaticName('');
    setStaticTable('');
    setStaticConditions([]);
  };

  const resetDynamicForm = () => {
    setDynamicName('');
    setDynamicDescription('');
    setDynamicSql('');
    setDynamicFields('contact, name, id');
    setQueryTestResult(null);
  };

  const removeTarget = (targetId: string) => {
    setTargets(targets.filter(t => t.id !== targetId));
  };

  const addStaticCondition = () => {
    const newCondition: FilterCondition = {
      field: '',
      operator: 'equals',
      value: ''
    };
    setStaticConditions([...staticConditions, newCondition]);
  };

  const updateStaticCondition = (index: number, updates: Partial<FilterCondition>) => {
    const updatedConditions = staticConditions.map((condition, i) =>
      i === index ? { ...condition, ...updates } : condition
    );
    setStaticConditions(updatedConditions);
  };

  const removeStaticCondition = (index: number) => {
    setStaticConditions(staticConditions.filter((_, i) => i !== index));
  };

  // 예시 쿼리 템플릿
  const queryTemplates = [
    {
      name: "월간 리포트 대상자",
      description: "광고 시작일이 오늘인 고객",
      sql: `SELECT 
  ad.id as adId,
  cp.contacts as contact,
  cp.name as companyName,
  COUNT(ct.id) as contractCount
FROM Ads ad
JOIN Companies cp ON cp.id = ad.companyId 
  AND cp.contacts IS NOT NULL
JOIN Ads_Payment ap ON ap.adId = ad.id
JOIN Contracts ct ON ad.id = ct.company 
  AND ct.currentState >= 1
WHERE ap.adsStart = DATE(NOW())
GROUP BY ad.id, cp.contacts, cp.name`
    },
    {
      name: "VIP 고객",
      description: "계약 수 10개 이상인 고객",
      sql: `SELECT 
  cp.contacts as contact,
  cp.name as companyName,
  COUNT(ct.id) as contractCount
FROM Companies cp
JOIN Ads ad ON ad.companyId = cp.id
JOIN Contracts ct ON ct.company = ad.id
WHERE cp.contacts IS NOT NULL
  AND ct.currentState >= 1
GROUP BY cp.id, cp.contacts, cp.name
HAVING COUNT(ct.id) >= 10`
    },
    {
      name: "신규 가입 고객",
      description: "최근 7일 내 가입한 고객",
      sql: `SELECT 
  contacts as contact,
  name as companyName,
  createdAt
FROM Companies 
WHERE contacts IS NOT NULL
  AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                발송 대상 선정
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                알림톡을 받을 대상자를 설정하세요
              </p>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              대상 그룹 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {targets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">설정된 대상 그룹이 없습니다</p>
              <p className="text-sm mb-4">알림톡을 받을 대상자 그룹을 추가해주세요</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                첫 번째 대상 그룹 추가
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {targets.map((target) => (
                <div key={target.id} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      target.type === 'dynamic' 
                        ? 'bg-purple-100 text-purple-600' 
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {target.type === 'dynamic' ? <Code className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{target.name}</h4>
                      <Badge variant={target.type === 'dynamic' ? 'default' : 'secondary'}>
                        {target.type === 'dynamic' ? '동적 쿼리' : '정적 조건'}
                      </Badge>
                      <Badge variant="outline">
                        약 {target.estimatedCount.toLocaleString()}명
                      </Badge>
                    </div>
                    
                    {target.type === 'static' ? (
                      <div className="text-sm text-muted-foreground">
                        <p>테이블: {target.table}</p>
                        <p>조건: {target.conditions?.length || 0}개</p>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <p>{target.dynamicQuery?.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {target.dynamicQuery?.lastExecuted 
                              ? `마지막 실행: ${new Date(target.dynamicQuery.lastExecuted).toLocaleString()}`
                              : '아직 실행되지 않음'
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTarget(target.id)}
                    title="대상 그룹 제거"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 대상 그룹 추가 다이얼로그 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>대상 그룹 추가</DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'static' | 'dynamic')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="static" className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                정적 조건
              </TabsTrigger>
              <TabsTrigger value="dynamic" className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                동적 쿼리
              </TabsTrigger>
            </TabsList>

            {/* 정적 조건 탭 */}
            <TabsContent value="static" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">그룹 이름 *</label>
                <Input
                  value={staticName}
                  onChange={(e) => setStaticName(e.target.value)}
                  placeholder="예: VIP 고객"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">테이블 선택 *</label>
                <Select value={staticTable} onValueChange={setStaticTable}>
                  <SelectTrigger>
                    <SelectValue placeholder="테이블을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTables.map(table => (
                      <SelectItem key={table} value={table}>{table}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">필터 조건</label>
                  <Button variant="outline" size="sm" onClick={addStaticCondition}>
                    <Plus className="w-4 h-4 mr-1" />
                    조건 추가
                  </Button>
                </div>
                
                {staticConditions.map((condition, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border rounded-lg mb-2">
                    <Input
                      placeholder="필드명"
                      value={condition.field}
                      onChange={(e) => updateStaticCondition(index, { field: e.target.value })}
                      className="flex-1"
                    />
                    <Select
                      value={condition.operator}
                      onValueChange={(value) => updateStaticCondition(index, { operator: value as any })}
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
                      placeholder="값"
                      value={condition.value}
                      onChange={(e) => updateStaticCondition(index, { value: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStaticCondition(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  취소
                </Button>
                <Button onClick={addStaticTarget} disabled={!staticName.trim() || !staticTable}>
                  추가
                </Button>
              </div>
            </TabsContent>

            {/* 동적 쿼리 탭 */}
            <TabsContent value="dynamic" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">그룹 이름 *</label>
                <Input
                  value={dynamicName}
                  onChange={(e) => setDynamicName(e.target.value)}
                  placeholder="예: 월간 리포트 대상자"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">설명</label>
                <Input
                  value={dynamicDescription}
                  onChange={(e) => setDynamicDescription(e.target.value)}
                  placeholder="이 쿼리가 어떤 대상자를 선택하는지 설명"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">SQL 쿼리 *</label>
                  <div className="flex gap-2">
                    <Select onValueChange={(value) => {
                      const template = queryTemplates.find(t => t.name === value);
                      if (template) {
                        setDynamicSql(template.sql);
                        setDynamicDescription(template.description);
                      }
                    }}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="템플릿 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {queryTemplates.map(template => (
                          <SelectItem key={template.name} value={template.name}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      onClick={testDynamicQuery}
                      disabled={!dynamicSql.trim() || isTestingQuery}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      {isTestingQuery ? '테스트 중...' : '쿼리 테스트'}
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={dynamicSql}
                  onChange={(e) => setDynamicSql(e.target.value)}
                  placeholder="SELECT contact, name FROM Companies WHERE ..."
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">예상 결과 필드</label>
                <Input
                  value={dynamicFields}
                  onChange={(e) => setDynamicFields(e.target.value)}
                  placeholder="contact, name, id"
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  쿼리 결과에 포함될 필드명을 쉼표로 구분하여 입력 (contact 필드는 필수)
                </p>
              </div>

              {/* 쿼리 테스트 결과 */}
              {queryTestResult && (
                <div className={`p-4 rounded-lg border ${
                  queryTestResult.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {queryTestResult.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="font-medium">
                      {queryTestResult.success ? '쿼리 테스트 성공' : '쿼리 테스트 실패'}
                    </span>
                  </div>
                  
                  {queryTestResult.success ? (
                    <div>
                      <p className="text-sm mb-2">
                        총 <strong>{queryTestResult.totalCount?.toLocaleString()}</strong>명의 대상자가 검색되었습니다.
                      </p>
                      {queryTestResult.preview && queryTestResult.preview.length > 0 && (
                        <div className="text-xs">
                          <p className="font-medium mb-1">미리보기 (최대 5개):</p>
                          <pre className="bg-white p-2 rounded border text-xs overflow-x-auto">
                            {JSON.stringify(queryTestResult.preview, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-red-600">{queryTestResult.error}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  취소
                </Button>
                <Button 
                  onClick={addDynamicTarget} 
                  disabled={!dynamicName.trim() || !dynamicSql.trim()}
                >
                  추가
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
} 