'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { VariableMapping, PersonalizationSettings, VariableMappingTemplate } from '@/lib/types/workflow';
import { clientPersonalizationService } from '@/lib/services/personalization-service-client';
import { MappingTemplateService } from '@/lib/services/mapping-template-service';
import MappingTemplateManager from './mapping-template-manager';
import TemplateEditorModal from './template-editor-modal';
import VariableQuerySelector from './variable-query-selector';
import MappingHistorySelector from './mapping-history-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowRight, 
  Database, 
  Code, 
  FunctionSquare,
  AlertCircle,
  CheckCircle,
  Settings,
  Eye,
  Play,
  BookOpen,
  Save,
  Download,
  Upload,
  Sparkles
} from 'lucide-react';

interface KakaoTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  personalization?: PersonalizationSettings;
}

interface VariableMappingProps {
  selectedTemplate: KakaoTemplate | null;
  onMappingChange: (settings: PersonalizationSettings) => void;
  targetSampleData?: Record<string, any>; // 대상자 샘플 데이터
}

export function VariableMapping({ 
  selectedTemplate, 
  onMappingChange,
  targetSampleData = {
    contact: '010-1234-5678',
    companyName: '슈퍼멤버스',
    adId: 123,
    contractCount: 15,
    totalReviews: 1234,
    monthlyReviews: 89
  }
}: VariableMappingProps) {
  const [personalizationEnabled, setPersonalizationEnabled] = useState(false);
  const [variableMappings, setVariableMappings] = useState<VariableMapping[]>([]);
  const [previewContent, setPreviewContent] = useState('');
  const [queryTestResults, setQueryTestResults] = useState<Record<number, { success: boolean; result: any; error: string; columns?: string[]; data?: any[]; selectedColumn?: string }>>({});
  
  // 템플릿 관리 상태
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showTemplateSaveModal, setShowTemplateSaveModal] = useState(false);
  const [currentVariables, setCurrentVariables] = useState<string[]>([]);
  
  // 초기화 상태를 추적하는 ref
  const isInitializedRef = useRef(false);
  const onMappingChangeRef = useRef(onMappingChange);
  
  // onMappingChange ref 업데이트
  useEffect(() => {
    onMappingChangeRef.current = onMappingChange;
  }, [onMappingChange]);

  // targetSampleData를 메모이제이션
  const memoizedTargetSampleData = useMemo(() => targetSampleData, [JSON.stringify(targetSampleData)]);
  
  // 사용 가능한 필드 목록을 메모이제이션
  const availableFields = useMemo(() => Object.keys(memoizedTargetSampleData), [memoizedTargetSampleData]);

  // 설정을 부모에게 알리는 함수 - 의존성 제거
  const notifyParent = useCallback((enabled: boolean, mappings: VariableMapping[]) => {
    if (!isInitializedRef.current) return; // 초기화 중에는 호출하지 않음
    
    const settings: PersonalizationSettings = {
      enabled,
      variableMappings: mappings,
      fallbackBehavior: 'use_default'
    };
    onMappingChangeRef.current(settings);
  }, []); // 의존성 배열 비움

  // 템플릿 변경 시 변수 추출
  useEffect(() => {
    isInitializedRef.current = false; // 초기화 시작
    
    if (!selectedTemplate) {
      setVariableMappings([]);
      setPersonalizationEnabled(false);
      setPreviewContent('');
      setQueryTestResults({});
      setCurrentVariables([]);
      isInitializedRef.current = true;
      return;
    }

    const templateVariables = clientPersonalizationService.extractTemplateVariables(selectedTemplate.content);
    setCurrentVariables(templateVariables);
    
    // 기존 개인화 설정이 있는지 확인 (selectedTemplate.personalization 우선)
    const existingPersonalization = selectedTemplate.personalization;
    const existingMappings = existingPersonalization?.variableMappings || [];
    const isPersonalizationEnabled = existingPersonalization?.enabled || false;
    
    const newMappings = templateVariables.map(variable => {
      const existing = existingMappings.find(m => m.templateVariable === variable);
      return existing || {
        templateVariable: variable,
        sourceField: '',
        sourceType: 'field' as const,
        defaultValue: '',
        formatter: 'text' as const
      };
    });

    setVariableMappings(newMappings);
    setPersonalizationEnabled(isPersonalizationEnabled);
    setPreviewContent(selectedTemplate.content);
    setQueryTestResults({});
    
    // 초기화 완료 후 부모에게 알림 (기존 설정이 있는 경우에만)
    setTimeout(() => {
      isInitializedRef.current = true;
      if (existingPersonalization) {
        notifyParent(isPersonalizationEnabled, newMappings);
      }
    }, 0);
  }, [selectedTemplate?.id, selectedTemplate?.content, selectedTemplate?.personalization, notifyParent]);

  // 미리보기 생성 함수를 useCallback으로 메모이제이션
  const generatePreview = useCallback(async (mappings: VariableMapping[]) => {
    if (!selectedTemplate || !personalizationEnabled) {
      setPreviewContent(selectedTemplate?.content || '');
      return;
    }

    try {
      const settings: PersonalizationSettings = {
        enabled: true,
        variableMappings: mappings,
        fallbackBehavior: 'use_default'
      };

      // PersonalizationTarget 타입에 맞게 데이터 구성
      const targetData = {
        contact: memoizedTargetSampleData.contact || '010-1234-5678',
        data: memoizedTargetSampleData
      };

      const personalizedMessages = await clientPersonalizationService.generatePersonalizedMessages(
        [targetData],
        selectedTemplate.content,
        settings
      );

      setPreviewContent(personalizedMessages[0]?.personalizedContent || selectedTemplate.content);
    } catch (error) {
      console.error('미리보기 생성 실패:', error);
      setPreviewContent(selectedTemplate.content);
    }
  }, [selectedTemplate?.content, personalizationEnabled, memoizedTargetSampleData]);

  // 매핑 변경 시 미리보기 업데이트 - 디바운싱 적용
  useEffect(() => {
    if (variableMappings.length > 0) {
      const timeoutId = setTimeout(() => {
        generatePreview(variableMappings);
      }, 300); // 300ms 디바운싱

      return () => clearTimeout(timeoutId);
    }
  }, [variableMappings, generatePreview]);

  // 개인화 활성화 상태 변경 핸들러
  const handlePersonalizationToggle = useCallback((enabled: boolean) => {
    setPersonalizationEnabled(enabled);
    // setTimeout을 사용하여 상태 업데이트 후 알림
    setTimeout(() => {
      notifyParent(enabled, variableMappings);
    }, 0);
  }, [variableMappings, notifyParent]);

  const updateMapping = useCallback((index: number, updates: Partial<VariableMapping>) => {
    setVariableMappings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      
      // 매핑 변경 시 부모에게 알림 - 디바운싱 적용
      setTimeout(() => {
        if (isInitializedRef.current) {
          notifyParent(personalizationEnabled, updated);
        }
      }, 100);
      
      return updated;
    });
  }, [personalizationEnabled, notifyParent]);

  // 템플릿 적용 핸들러
  const handleApplyTemplate = useCallback((template: VariableMappingTemplate) => {
    const newMappings = [...variableMappings];
    
    // 템플릿의 매핑을 현재 변수들에 적용
    template.variableMappings.forEach(templateMapping => {
      const index = newMappings.findIndex(m => m.templateVariable === templateMapping.templateVariable);
      if (index !== -1) {
        newMappings[index] = { ...templateMapping };
      }
    });
    
    setVariableMappings(newMappings);
    setShowTemplateManager(false);
    
    // 부모에게 알림
    setTimeout(() => {
      notifyParent(personalizationEnabled, newMappings);
    }, 0);
  }, [variableMappings, personalizationEnabled, notifyParent]);

  // 현재 매핑을 템플릿으로 저장
  const handleSaveAsTemplate = useCallback(() => {
    if (variableMappings.length === 0) {
      alert('저장할 변수 매핑이 없습니다.');
      return;
    }
    setShowTemplateSaveModal(true);
  }, [variableMappings]);

  // 템플릿 저장 완료 핸들러
  const handleTemplateSaved = useCallback((template: VariableMappingTemplate) => {
    setShowTemplateSaveModal(false);
    // 성공 메시지 표시 (선택사항)
    console.log('템플릿이 저장되었습니다:', template.name);
  }, []);

  const getSourceTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'field': return <Database className="w-4 h-4" />;
      case 'query': return <Code className="w-4 h-4" />;
      case 'function': return <FunctionSquare className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  }, []);

  const getSourceTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'field': return 'text-blue-600';
      case 'query': return 'text-purple-600';
      case 'function': return 'text-green-600';
      default: return 'text-gray-600';
    }
  }, []);

  const getPreviewValue = useCallback((mapping: VariableMapping, index: number) => {
    if (mapping.sourceType === 'field') {
      return mapping.sourceField ? memoizedTargetSampleData[mapping.sourceField] || mapping.defaultValue || '[값 없음]' : mapping.defaultValue || '[설정 필요]';
    } else if (mapping.sourceType === 'query') {
      // 해당 인덱스의 쿼리 테스트 결과만 가져오기
      const testResult = queryTestResults[index];
      if (testResult && testResult.success && testResult.result !== null) {
        return String(testResult.result);
      }
      return '[쿼리 테스트 필요]';
    } else if (mapping.sourceType === 'function') {
      return mapping.sourceField ? '[함수 결과]' : '[설정 필요]';
    }
    return '[설정 필요]';
  }, [queryTestResults, memoizedTargetSampleData]);

  const testQuery = useCallback(async (query: string, index: number) => {
    try {
      const result = await clientPersonalizationService.testQuery(query, memoizedTargetSampleData);
      const firstColumnValue = result.data?.[0]?.[result.columns?.[0] || ''];
      
      setQueryTestResults(prev => ({
        ...prev,
        [index]: { 
          success: result.success, 
          result: result.result, 
          error: result.error || '', 
          columns: result.columns || [], 
          data: result.data || [],
          selectedColumn: result.columns?.[0] // 기본값: 첫 번째 컬럼
        }
      }));
      
      // 쿼리 테스트 성공 시 변수 매핑에 실제 값 저장
      if (result.success && firstColumnValue !== undefined) {
        setVariableMappings(prev => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = { 
              ...updated[index], 
              actualValue: String(firstColumnValue)
            };
            
            // 부모에게 알림
            setTimeout(() => {
              if (isInitializedRef.current) {
                notifyParent(personalizationEnabled, updated);
              }
            }, 100);
          }
          return updated;
        });
      }
    } catch (error) {
      setQueryTestResults(prev => ({
        ...prev,
        [index]: { 
          success: false, 
          result: null, 
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          columns: [],
          data: [],
          selectedColumn: undefined
        }
      }));
    }
  }, [memoizedTargetSampleData, personalizationEnabled, notifyParent]);

  const updateSelectedColumn = useCallback((index: number, columnName: string) => {
    setQueryTestResults(prev => {
      const current = prev[index];
      if (!current || !current.data || current.data.length === 0) return prev;
      
      const newResult = current.data[0][columnName];
      return {
        ...prev,
        [index]: {
          ...current,
          selectedColumn: columnName,
          result: newResult
        }
      };
    });
    
    // 변수 매핑에도 선택된 컬럼과 실제 값 저장
    setVariableMappings(prev => {
      const updated = [...prev];
      if (updated[index]) {
        const testResult = queryTestResults[index];
        const actualValue = testResult?.data?.[0]?.[columnName];
        
        updated[index] = { 
          ...updated[index], 
          selectedColumn: columnName,
          actualValue: actualValue ? String(actualValue) : undefined
        };
        
        // 부모에게 알림
        setTimeout(() => {
          if (isInitializedRef.current) {
            notifyParent(personalizationEnabled, updated);
          }
        }, 100);
      }
      return updated;
    });
  }, [personalizationEnabled, notifyParent, queryTestResults]);

  if (!selectedTemplate) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-muted-foreground">
            <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">템플릿을 먼저 선택해주세요</p>
            <p className="text-sm">템플릿을 선택하면 변수 매핑을 설정할 수 있습니다</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const templateVariables = clientPersonalizationService.extractTemplateVariables(selectedTemplate.content);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                변수 매핑 설정
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                선택된 템플릿: <strong>{selectedTemplate.name}</strong>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">개인화 메시지</span>
              <Switch
                checked={personalizationEnabled}
                onCheckedChange={handlePersonalizationToggle}
              />
            </div>
          </div>
          
          {/* 템플릿 관리 버튼들 */}
          {templateVariables.length > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4" />
                <span>변수 매핑 관리:</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplateManager(true)}
                className="flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                템플릿 선택
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAsTemplate}
                className="flex items-center gap-2"
                disabled={variableMappings.length === 0 || !variableMappings.some(m => m.sourceField)}
              >
                <Save className="w-4 h-4" />
                템플릿 저장
              </Button>
              
              {/* 매핑 이력 관리 */}
              <MappingHistorySelector
                currentMappings={variableMappings}
                templateContent={selectedTemplate.content}
                onSelect={(mappings) => {
                  setVariableMappings(mappings);
                  // 부모에게 알림
                  setTimeout(() => {
                    notifyParent(personalizationEnabled, mappings);
                  }, 0);
                }}
                onSave={(template) => {
                  console.log('매핑 이력이 저장되었습니다:', template.name);
                }}
              />
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 템플릿 변수 표시 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">템플릿 변수</CardTitle>
          <p className="text-sm text-muted-foreground">
            이 템플릿에서 발견된 변수들입니다
          </p>
        </CardHeader>
        <CardContent>
          {templateVariables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>이 템플릿에는 변수가 없습니다</p>
              <p className="text-xs mt-1">변수는 {`#{변수명}`} 형태로 작성됩니다</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {templateVariables.map(variable => (
                <Badge key={variable} variant="outline" className="text-sm">
                  {variable}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 변수 매핑 설정 */}
      {personalizationEnabled && templateVariables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">변수 매핑</CardTitle>
            <p className="text-sm text-muted-foreground">
              각 템플릿 변수가 어떤 데이터와 연결될지 설정하세요
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {variableMappings.map((mapping, index) => (
              <div key={`${mapping.templateVariable}-${index}`} className="border rounded-lg p-4 space-y-4">
                {/* 변수명 표시 */}
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="text-sm font-mono">
                    {mapping.templateVariable}
                  </Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className={`flex items-center gap-2 ${getSourceTypeColor(mapping.sourceType)}`}>
                    {getSourceTypeIcon(mapping.sourceType)}
                    <span className="text-sm font-medium">
                      {mapping.sourceType === 'field' && '대상자 필드'}
                      {mapping.sourceType === 'query' && '동적 쿼리'}
                      {mapping.sourceType === 'function' && '내장 함수'}
                    </span>
                  </div>
                </div>

                {/* 설정 옵션 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 데이터 소스 타입 */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">데이터 소스</label>
                    <Select
                      value={mapping.sourceType}
                      onValueChange={(value) => updateMapping(index, { sourceType: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="field">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            대상자 필드
                          </div>
                        </SelectItem>
                        <SelectItem value="query">
                          <div className="flex items-center gap-2">
                            <Code className="w-4 h-4" />
                            동적 쿼리
                          </div>
                        </SelectItem>
                        <SelectItem value="function">
                          <div className="flex items-center gap-2">
                            <FunctionSquare className="w-4 h-4" />
                            내장 함수
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 포맷터 */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">포맷</label>
                    <Select
                      value={mapping.formatter}
                      onValueChange={(value) => updateMapping(index, { formatter: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">텍스트</SelectItem>
                        <SelectItem value="number">숫자 (1,234)</SelectItem>
                        <SelectItem value="currency">통화 (1,234원)</SelectItem>
                        <SelectItem value="date">날짜</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 기본값 */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">기본값</label>
                    <Input
                      value={mapping.defaultValue}
                      onChange={(e) => updateMapping(index, { defaultValue: e.target.value })}
                      placeholder="데이터가 없을 때 사용할 값"
                    />
                  </div>
                </div>

                {/* 소스 필드/쿼리/함수 설정 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {mapping.sourceType === 'field' && '필드 선택'}
                    {mapping.sourceType === 'query' && 'SQL 쿼리'}
                    {mapping.sourceType === 'function' && '함수명'}
                  </label>
                  
                  {mapping.sourceType === 'field' ? (
                    <Select
                      value={mapping.sourceField}
                      onValueChange={(value) => updateMapping(index, { sourceField: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="대상자 필드를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields.map(field => (
                          <SelectItem key={field} value={field}>
                            <div className="flex items-center justify-between w-full">
                              <span>{field}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {memoizedTargetSampleData[field]}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : mapping.sourceType === 'query' ? (
                    <div className="space-y-3">
                      {/* 개별 변수 쿼리 선택기 */}
                      <VariableQuerySelector
                        variableName={mapping.templateVariable}
                        currentQuery={mapping.sourceField}
                        currentSelectedColumn={
                          mapping.selectedColumn || 
                          queryTestResults[index]?.selectedColumn || 
                          queryTestResults[index]?.columns?.[0] || 
                          ''
                        }
                        onSelect={(query: string, selectedColumn: string) => {
                          updateMapping(index, { 
                            sourceField: query,
                            selectedColumn: selectedColumn
                          });
                        }}
                        onSave={(template) => {
                          console.log('쿼리 템플릿이 저장되었습니다:', template.name);
                          // 저장 완료 후 추가 작업이 필요하면 여기에 추가
                        }}
                      />
                      
                      <Textarea
                        value={mapping.sourceField}
                        onChange={(e) => updateMapping(index, { sourceField: e.target.value })}
                        placeholder="SELECT COUNT(*) FROM Reviews WHERE companyId = {adId}"
                        rows={4}
                        className="font-mono text-sm"
                      />
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>• 플레이스홀더 사용법: {`{필드명}`} (예: {`{adId}, {companyName}`})</p>
                        <p>• 대상자 데이터의 필드를 쿼리에서 사용할 수 있습니다</p>
                        <p>• 쿼리는 단일 값을 반환해야 합니다</p>
                      </div>
                      {mapping.sourceField && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testQuery(mapping.sourceField || '', index)}
                          className="w-full"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          쿼리 테스트
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Select
                      value={mapping.sourceField}
                      onValueChange={(value) => updateMapping(index, { sourceField: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="함수를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current_date">current_date (오늘 날짜)</SelectItem>
                        <SelectItem value="current_month">current_month (이번 달)</SelectItem>
                        <SelectItem value="company_name_short">company_name_short (회사명 단축)</SelectItem>
                        <SelectItem value="contact_formatted">contact_formatted (연락처 포맷)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* 쿼리 테스트 결과 */}
                {queryTestResults[index] && (
                  <div className={`p-3 rounded-md border ${
                    queryTestResults[index].success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {queryTestResults[index].success ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm font-medium">
                        {queryTestResults[index].success ? '쿼리 테스트 성공' : '쿼리 테스트 실패'}
                      </span>
                    </div>
                    
                    {queryTestResults[index].success ? (
                      <div className="space-y-3">
                        {/* 컬럼 선택 */}
                        {queryTestResults[index].columns && queryTestResults[index].columns!.length > 1 && (
                          <div>
                            <label className="text-sm font-medium mb-2 block">변수값으로 사용할 컬럼 선택</label>
                            <Select
                              value={queryTestResults[index].selectedColumn || queryTestResults[index].columns![0]}
                              onValueChange={(value) => updateSelectedColumn(index, value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {queryTestResults[index].columns!.map(column => (
                                  <SelectItem key={column} value={column}>
                                    <div className="flex items-center justify-between w-full">
                                      <span>{column}</span>
                                      <span className="text-xs text-muted-foreground ml-2">
                                        {queryTestResults[index].data?.[0]?.[column]}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        {/* 선택된 값 표시 */}
                        <div className="text-sm">
                          <span className="text-muted-foreground">선택된 값: </span>
                          <span className="font-mono bg-white px-2 py-1 rounded border">
                            {queryTestResults[index].result !== null ? String(queryTestResults[index].result) : 'null'}
                          </span>
                        </div>
                        
                        {/* 쿼리 결과 테이블 (처음 3개 행만 표시) */}
                        {queryTestResults[index].data && queryTestResults[index].data!.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-2">쿼리 결과 미리보기 (최대 3개 행)</div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs border border-gray-200 rounded">
                                <thead className="bg-gray-50">
                                  <tr>
                                    {queryTestResults[index].columns!.map(column => (
                                      <th key={column} className="px-2 py-1 text-left border-b border-gray-200 font-medium">
                                        {column}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {queryTestResults[index].data!.slice(0, 3).map((row, rowIndex) => (
                                    <tr key={rowIndex} className="hover:bg-gray-50">
                                      {queryTestResults[index].columns!.map(column => (
                                        <td key={column} className={`px-2 py-1 border-b border-gray-100 ${
                                          column === queryTestResults[index].selectedColumn ? 'bg-blue-50 font-medium' : ''
                                        }`}>
                                          {row[column]}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {queryTestResults[index].data!.length > 3 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                ... 총 {queryTestResults[index].data!.length}개 행
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-red-600">
                        {queryTestResults[index].error}
                      </div>
                    )}
                  </div>
                )}

                {/* 현재 값 미리보기 */}
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">현재 값 미리보기</span>
                  </div>
                  <div className="text-sm font-mono bg-white p-2 rounded border">
                    {getPreviewValue(mapping, index)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 미리보기 */}
      {personalizationEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              메시지 미리보기
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              샘플 대상자 데이터로 생성된 개인화 메시지입니다
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 샘플 대상자 정보 */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">샘플 대상자 정보</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  {Object.entries(memoizedTargetSampleData).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* 개인화된 메시지 */}
              <div>
                <h4 className="font-medium mb-2">개인화된 메시지</h4>
                <div className="bg-white border rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                    {previewContent}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* 템플릿 관리자 모달 */}
      {showTemplateManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">변수 매핑 템플릿 선택</h2>
              <p className="text-gray-600 mt-1">기존 템플릿을 선택하여 빠르게 변수를 매핑하세요</p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <MappingTemplateManager
                mode="select"
                currentVariables={currentVariables}
                onApplyTemplate={handleApplyTemplate}
                onSelectTemplate={() => {}} // 미리보기는 나중에 구현
              />
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowTemplateManager(false)}
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 템플릿 저장 모달 */}
      <TemplateEditorModal
        isOpen={showTemplateSaveModal}
        onClose={() => setShowTemplateSaveModal(false)}
        onSave={handleTemplateSaved}
        template={null} // 새 템플릿 생성
        initialMappings={variableMappings} // 현재 매핑 데이터 전달
      />
    </div>
  );
} 