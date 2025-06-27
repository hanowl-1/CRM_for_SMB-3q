'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ArrowRight, 
  Database, 
  MessageSquare, 
  Link2, 
  Eye, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Settings,
  Save,
  FolderOpen,
  Code,
  FunctionSquare,
  Play,
  Users,
  XCircle,
  Phone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator as UISeparator } from '@/components/ui/separator';
import type { 
  TargetGroup, 
  TargetTemplateMapping, 
  FieldMapping, 
  MappingPreview 
} from '@/lib/types/workflow';
import type { KakaoTemplate } from '@/lib/types/template';
import { MappingTemplateManager } from './mapping-template-manager';
import { Label } from '@/components/ui/label';
import type { PersonalizationSettings } from '@/lib/types/workflow';

interface TargetTemplateMappingProps {
  targetGroups: TargetGroup[];
  selectedTemplates: KakaoTemplate[];
  currentMappings?: TargetTemplateMapping[];
  onMappingChange: (mappings: TargetTemplateMapping[]) => void;
  templatePersonalizations?: Record<string, PersonalizationSettings>;
}

export function TargetTemplateMapping({
  targetGroups,
  selectedTemplates,
  currentMappings = [],
  onMappingChange,
  templatePersonalizations = {}
}: TargetTemplateMappingProps) {
  const [mappings, setMappings] = useState<TargetTemplateMapping[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveDialogData, setSaveDialogData] = useState<any>(null);
  const [previewData, setPreviewData] = useState<Record<string, any[]>>({});
  const [isLoadingPreview, setIsLoadingPreview] = useState<Record<string, boolean>>({});
  const [queryTestResults, setQueryTestResults] = useState<Record<string, any>>({});
  const [isLoadingTest, setIsLoadingTest] = useState<Record<string, boolean>>({});

  // 🔥 새로운 상태: 저장된 변수 매핑 정보
  const [savedVariableMappings, setSavedVariableMappings] = useState<Record<string, any>>({});

  // 안정적인 참조를 위한 ref들
  const onMappingChangeRef = useRef(onMappingChange);
  const mappingsRef = useRef<TargetTemplateMapping[]>([]);
  const isInitializedRef = useRef(false);

  // 현재 설정 저장 상태
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 저장된 매핑 목록 로드
  useEffect(() => {
    // 로컬 스토리지 로드는 제거
  }, []);

  // onMappingChange 함수 참조 업데이트
  useEffect(() => {
    onMappingChangeRef.current = onMappingChange;
  }, [onMappingChange]);

  // currentMappings 초기화 (한 번만)
  useEffect(() => {
    if (!isInitializedRef.current && currentMappings.length > 0) {
      console.log('🔄 매핑 초기화 (1회만):', currentMappings.length);
      setMappings(currentMappings);
      mappingsRef.current = currentMappings;
      isInitializedRef.current = true;
    } else if (!isInitializedRef.current) {
      isInitializedRef.current = true;
    }
  }, [currentMappings]);

  // 모든 대상 그룹 처리 (동적 + 정적)
  const allTargetGroups = useMemo(() => {
    console.log('🎯 전체 대상 그룹:', targetGroups.length);
    return targetGroups;
  }, [targetGroups]);

  // 동적 쿼리가 있는 대상 그룹만 필터링 (기존 호환성 유지)
  const dynamicTargetGroups = useMemo(() => {
    const filtered = targetGroups.filter(group => 
      group.type === 'dynamic' && group.dynamicQuery
    );
    console.log('🎯 동적 대상 그룹 필터링:', filtered.length);
    return filtered;
  }, [targetGroups]);

  // 템플릿 변수 추출 (안정적인 메모이제이션)
  const extractTemplateVariables = useCallback((template: KakaoTemplate): string[] => {
    const variableRegex = /#{([^}]+)}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = variableRegex.exec(template.templateContent)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    return variables;
  }, []);

  // 정적 대상 그룹의 테이블 스키마 로드
  const loadStaticGroupSchema = useCallback(async (targetGroup: TargetGroup) => {
    if (targetGroup.type !== 'static' || !targetGroup.table) return;

    const groupId = targetGroup.id;
    setIsLoadingPreview(prev => ({ ...prev, [groupId]: true }));

    try {
      const response = await fetch('/api/mysql/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: targetGroup.table
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.columns) {
          // 스키마 정보를 미리보기 데이터 형태로 변환
          const sampleData = {};
          result.columns.forEach((col: any) => {
            sampleData[col.Field] = `[${col.Type}]`;
          });
          
          setPreviewData(prev => ({
            ...prev,
            [groupId]: [sampleData]
          }));
        }
      }
    } catch (error) {
      console.error('정적 그룹 스키마 로드 실패:', error);
    } finally {
      setIsLoadingPreview(prev => ({ ...prev, [groupId]: false }));
    }
  }, []);

  // 대상 그룹 미리보기 데이터 로드 (안정적인 콜백)
  const loadPreviewData = useCallback(async (targetGroup: TargetGroup) => {
    if (targetGroup.type === 'static') {
      return loadStaticGroupSchema(targetGroup);
    }
    
    if (!targetGroup.dynamicQuery) return;

    const groupId = targetGroup.id;
    setIsLoadingPreview(prev => ({ ...prev, [groupId]: true }));

    try {
      const response = await fetch('/api/mysql/targets/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'custom_query',
          query: targetGroup.dynamicQuery.sql,
          limit: 3
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.preview) {
          setPreviewData(prev => ({
            ...prev,
            [groupId]: result.preview
          }));
        }
      }
    } catch (error) {
      console.error('미리보기 데이터 로드 실패:', error);
    } finally {
      setIsLoadingPreview(prev => ({ ...prev, [groupId]: false }));
    }
  }, [loadStaticGroupSchema]);

  // 초기 미리보기 데이터 로드 (모든 대상 그룹)
  useEffect(() => {
    if (allTargetGroups.length > 0) {
      console.log('📊 초기 미리보기 데이터 로드 시작 (전체 그룹)');
      allTargetGroups.forEach(group => {
        loadPreviewData(group);
      });
    }
  }, [allTargetGroups, loadPreviewData]);

  // 매핑 업데이트 (안정적인 콜백)
  const updateMapping = useCallback((targetGroupId: string, templateId: string, fieldMappings: FieldMapping[]) => {
    console.log('🔧 매핑 업데이트:', { targetGroupId, templateId, fieldMappingsCount: fieldMappings.length });

    setMappings(prev => {
      const existingIndex = prev.findIndex(m => 
        m.targetGroupId === targetGroupId && m.templateId === templateId
      );

      const newMapping: TargetTemplateMapping = {
        id: existingIndex >= 0 ? prev[existingIndex].id : `mapping_${targetGroupId}_${templateId}_${Date.now()}`,
        targetGroupId,
        templateId,
        fieldMappings,
        createdAt: existingIndex >= 0 ? prev[existingIndex].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updated = existingIndex >= 0 
        ? prev.map((m, i) => i === existingIndex ? newMapping : m)
        : [...prev, newMapping];

      // ref 업데이트
      mappingsRef.current = updated;
      
      console.log('💾 매핑 상태 업데이트:', { 이전: prev.length, 새로운: updated.length });
      return updated;
    });
  }, []);

  // 매핑 변경 알림 (디바운스된 효과)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (mappingsRef.current !== mappings && isInitializedRef.current) {
        console.log('📤 부모에게 매핑 변경 알림:', mappings.length);
        onMappingChangeRef.current(mappings);
        mappingsRef.current = mappings;
      }
    }, 100); // 100ms 디바운스

    return () => clearTimeout(timeoutId);
  }, [mappings]);

  // 필드 매핑 업데이트 (안정적인 콜백)
  const updateFieldMapping = useCallback((
    targetGroupId: string, 
    templateId: string, 
    templateVariable: string, 
    updates: Partial<FieldMapping>
  ) => {
    console.log('🔄 필드 매핑 업데이트:', { targetGroupId, templateId, templateVariable, updates });

    const currentMapping = mappings.find(m => 
      m.targetGroupId === targetGroupId && m.templateId === templateId
    );

    const currentFieldMappings = currentMapping?.fieldMappings || [];
    const existingFieldIndex = currentFieldMappings.findIndex(fm => 
      fm.templateVariable === templateVariable
    );

    const newFieldMapping: FieldMapping = {
      ...(currentMapping?.fieldMappings.find(fm => fm.templateVariable === templateVariable) || {
        templateVariable,
        targetField: '', // 기본값 설정
      }),
      ...updates,
    };

    const updatedFieldMappings = existingFieldIndex >= 0
      ? currentFieldMappings.map((fm, i) => i === existingFieldIndex ? newFieldMapping : fm)
      : [...currentFieldMappings, newFieldMapping];

    updateMapping(targetGroupId, templateId, updatedFieldMappings);
  }, [mappings, updateMapping]);

  // 매핑 미리보기 생성 (안정적인 메모이제이션)
  const generateMappingPreview = useCallback((
    targetGroupId: string, 
    templateId: string
  ): MappingPreview[] => {
    const mapping = mappings.find(m => 
      m.targetGroupId === targetGroupId && m.templateId === templateId
    );
    const preview = previewData[targetGroupId];

    if (!mapping || !preview || preview.length === 0) return [];

    const sampleRow = preview[0];
    
    return mapping.fieldMappings.map(fm => {
      const sampleValue = sampleRow[fm.targetField] || fm.defaultValue || '';
      // 모든 값을 문자열로 처리 (포맷터 제거)
      const formattedValue = String(sampleValue);

      return {
        templateVariable: fm.templateVariable,
        targetField: fm.targetField,
        sampleValue: String(sampleValue),
        formattedValue
      };
    });
  }, [mappings, previewData]);

  // 매핑 완성도 체크 (안정적인 메모이제이션)
  const getMappingCompleteness = useCallback((targetGroupId: string, templateId: string) => {
    const template = selectedTemplates.find(t => t.id === templateId);
    if (!template) return { completed: 0, total: 0, percentage: 0 };

    const templateVariables = extractTemplateVariables(template);
    const mapping = mappings.find(m => 
      m.targetGroupId === targetGroupId && m.templateId === templateId
    );

    const mappedVariables = mapping?.fieldMappings.filter(fm => fm.targetField).length || 0;
    const total = templateVariables.length;
    const percentage = total > 0 ? Math.round((mappedVariables / total) * 100) : 0;

    return { completed: mappedVariables, total, percentage };
  }, [selectedTemplates, mappings, extractTemplateVariables]);

  // 현재 설정을 Supabase에 저장
  const handleSaveCurrentSettings = useCallback(async () => {
    if (!saveName.trim()) {
      alert('저장할 이름을 입력해주세요.');
      return;
    }

    if (mappings.length === 0) {
      alert('저장할 매핑이 없습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/mapping-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: saveName.trim(),
          description: saveDescription.trim() || `매핑 설정 - ${new Date().toLocaleString()}`,
          category: 'workflow_mapping',
          tags: ['워크플로우', '매핑설정'],
          target_template_mappings: mappings,
          is_public: false,
          is_favorite: false
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert('✅ 현재 설정이 성공적으로 저장되었습니다!\n\n다른 워크플로우에서도 이 설정을 불러와 사용할 수 있습니다.');
          setShowSaveDialog(false);
          setSaveName('');
          setSaveDescription('');
        } else {
          throw new Error(result.error || '저장 실패');
        }
      } else {
        throw new Error('서버 오류');
      }
    } catch (error) {
      console.error('현재 설정 저장 실패:', error);
      alert('❌ 저장에 실패했습니다.\n\n' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    } finally {
      setIsSaving(false);
    }
  }, [saveName, saveDescription, mappings]);

  // 🔥 NEW: 변수 쿼리 테스트 함수
  const testVariableQuery = useCallback(async (
    targetGroupId: string, 
    templateId: string, 
    variable: string, 
    sql: string,
    params?: Record<string, any>
  ) => {
    const key = `${targetGroupId}-${templateId}-${variable}`;
    setIsLoadingTest(prev => ({ ...prev, [key]: true }));
    try {
      const response = await fetch('/api/mysql/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql, params: params || {} })
      });
      const result = await response.json();
      setQueryTestResults(prev => ({ ...prev, [key]: result }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      setQueryTestResults(prev => ({ ...prev, [key]: { success: false, error: errorMessage } }));
    } finally {
      setIsLoadingTest(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  // 그룹 미리보기 로드
  const loadGroupPreview = async () => {
    // 동적 그룹들의 미리보기 데이터 새로고침
    const dynamicGroups = allTargetGroups.filter(g => g.type === 'dynamic');
    for (const group of dynamicGroups) {
      await loadPreviewData(group);
    }
    // 저장된 변수 매핑 정보도 새로고침
    await loadSavedVariableMappings();
  };

  // 🔥 저장된 변수 매핑 정보 로드
  const loadSavedVariableMappings = useCallback(async () => {
    try {
      const response = await fetch('/api/supabase/individual-variables?action=list');
      const result = await response.json();
      
      if (result.success && result.data) {
        const mappingsByVariable: Record<string, any> = {};
        result.data.forEach((mapping: any) => {
          // 변수명에서 #{} 제거
          const cleanVariableName = mapping.variableName?.replace(/^#{|}$/g, '') || mapping.displayName?.replace(/^#{|}$/g, '');
          if (cleanVariableName) {
            mappingsByVariable[cleanVariableName] = mapping;
          }
        });
        setSavedVariableMappings(mappingsByVariable);
        console.log('📋 저장된 변수 매핑 로드 완료:', mappingsByVariable);
      }
    } catch (error) {
      console.error('❌ 저장된 변수 매핑 로드 실패:', error);
    }
  }, []);

  // 컴포넌트 마운트 시 저장된 변수 매핑 로드
  useEffect(() => {
    loadSavedVariableMappings();
  }, [loadSavedVariableMappings]);

  // 컴포넌트 조건부 렌더링
  if (allTargetGroups.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium mb-2">대상 그룹이 없습니다</h3>
          <p className="text-muted-foreground mb-4">
            대상 그룹을 추가한 후 매핑을 설정할 수 있습니다.
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            대상 그룹 설정으로 돌아가기
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (selectedTemplates.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium mb-2">선택된 알림톡 템플릿이 없습니다</h3>
          <p className="text-muted-foreground mb-4">
            알림톡 템플릿을 선택한 후 매핑을 설정할 수 있습니다.
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            알림톡 선택으로 돌아가기
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                매핑 설정 확인
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                변수 매핑과 대상 매핑 설정을 확인하고 검토하세요
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center gap-2"
                disabled={mappings.length === 0}
              >
                <Save className="w-4 h-4" />
                현재 설정 저장
              </Button>
              
              <Button
                onClick={loadGroupPreview}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                새로고침
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 매핑 설정 */}
      <div className="space-y-8">
        {/* 대상 매핑 정보 */}
        <div>
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            대상 매핑 설정
          </h3>
          
          {allTargetGroups.map(targetGroup => (
            <Card key={targetGroup.id} className="mb-4">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    T
                  </div>
                  <div>
                    <h4 className="font-medium">{targetGroup.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {targetGroup.type === 'dynamic' ? '동적 그룹' : '정적 그룹'} • 예상 대상: {targetGroup.estimatedCount}명
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 연락처 열 */}
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-800">연락처 열</span>
                    </div>
                    <div className="text-sm">
                      {targetGroup.type === 'dynamic' && targetGroup.dynamicQuery?.contactColumn ? (
                        <span className="font-mono bg-white px-2 py-1 rounded border">
                          {targetGroup.dynamicQuery.contactColumn}
                        </span>
                      ) : (
                        <span className="text-amber-600">설정되지 않음</span>
                      )}
                    </div>
                  </div>

                  {/* 매핑 열 */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-blue-800">매핑 열</span>
                    </div>
                    <div className="text-sm">
                      {targetGroup.type === 'dynamic' && targetGroup.dynamicQuery?.mappingColumns?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {targetGroup.dynamicQuery.mappingColumns.map(col => (
                            <span key={col} className="font-mono bg-white px-2 py-1 rounded border text-xs">
                              {col}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-amber-600">설정되지 않음</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 변수 매핑 정보 */}
        <div>
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-600" />
            변수 매핑 설정
          </h3>
          
          {selectedTemplates.map(template => (
            <Card key={template.id} className="mb-4">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-medium">
                    M
                  </div>
                  <div>
                    <h4 className="font-medium">{template.templateName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {extractTemplateVariables(template).length}개 변수
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {extractTemplateVariables(template).map(variable => {
                    const templateId = template.id;
                    const personalization = templatePersonalizations[templateId];
                    const variableMapping = personalization?.variableMappings?.find(
                      vm => vm.templateVariable === variable
                    );
                    
                    // 🔥 저장된 변수 매핑 정보도 확인
                    const savedMapping = savedVariableMappings[variable];
                    const hasMapping = variableMapping || savedMapping;

                    return (
                      <div key={variable} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="font-mono text-sm bg-purple-100 px-2 py-1 rounded">
                            #{variable}
                          </span>
                          {hasMapping ? (
                            <Badge variant="secondary" className="text-xs">
                              {savedMapping ? '저장된 설정' : variableMapping?.sourceType === 'query' ? '쿼리 설정됨' : '필드 매핑됨'}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              설정 필요
                            </Badge>
                          )}
                        </div>

                        {hasMapping ? (
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="bg-orange-50 p-2 rounded border">
                              <span className="text-orange-600 font-medium">출력 열:</span>
                              <div className="mt-1">
                                {savedMapping ? (
                                  <span className="text-gray-900">{savedMapping.selectedColumn || savedMapping.displayName}</span>
                                ) : variableMapping ? (
                                  <span className="text-gray-900">{variableMapping.selectedColumn || variableMapping.sourceField}</span>
                                ) : (
                                  <span className="text-gray-400">설정 필요</span>
                                )}
                              </div>
                            </div>
                            <div className="bg-blue-50 p-2 rounded border">
                              <span className="text-blue-600 font-medium">매핑 열:</span>
                              <div className="mt-1">
                                {savedMapping ? (
                                  <span className="text-gray-900">{savedMapping.keyColumn || '--'}</span>
                                ) : variableMapping ? (
                                  <span className="text-gray-900">{variableMapping.mappingKeyField || '--'}</span>
                                ) : (
                                  <span className="text-gray-400">--</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                            <div className="flex items-center gap-2 text-gray-800">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-sm font-medium">기본값 사용</span>
                            </div>
                            <p className="text-xs text-gray-700 mt-1">
                              이 변수는 기본값 <code className="bg-white px-1 rounded border">--</code>로 처리됩니다.
                              필요시 알림톡 선택 탭에서 매핑을 설정할 수 있습니다.
                            </p>
                          </div>
                        )}

                        {/* 🔥 기본값 표시 추가 */}
                        {(savedMapping?.defaultValue || variableMapping?.defaultValue) && (
                          <div className="mt-2 p-2 bg-gray-50 rounded border">
                            <span className="text-gray-600 font-medium text-sm">기본값:</span>
                            <span className="ml-2 text-gray-900 text-sm">
                              {savedMapping?.defaultValue || variableMapping?.defaultValue}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 매핑 상태 요약 */}
        <Card className="bg-gray-50">
          <CardContent className="pt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              매핑 설정 요약
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium text-gray-700 mb-2">대상 그룹</h5>
                <ul className="space-y-1">
                  {allTargetGroups.map(group => (
                    <li key={group.id} className="flex items-center gap-2">
                      {group.type === 'dynamic' && group.dynamicQuery?.contactColumn && group.dynamicQuery?.mappingColumns?.length ? (
                        <CheckCircle className="w-3 h-3 text-green-600" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-600" />
                      )}
                      <span className="text-xs">{group.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h5 className="font-medium text-gray-700 mb-2">템플릿 변수</h5>
                {selectedTemplates.map(template => {
                  const variables = extractTemplateVariables(template);
                  const personalization = templatePersonalizations[template.id];
                  const mappedCount = variables.filter(variable => {
                    const hasPersonalizationMapping = personalization?.variableMappings?.some(vm => vm.templateVariable === variable);
                    const hasSavedMapping = savedVariableMappings[variable];
                    // 🔥 설정이 안 되어 있어도 기본값 '--'로 처리하므로 항상 true로 간주
                    return hasPersonalizationMapping || hasSavedMapping || true;
                  }).length;
                  
                  return (
                    <div key={template.id} className="flex items-center gap-2 mb-1">
                      {/* 🔥 모든 변수가 설정된 것으로 간주 (기본값 사용) */}
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      <span className="text-xs">
                        {variables.length}/{variables.length} 변수 준비됨 (기본값 포함)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 매핑 요약 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">매핑 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {allTargetGroups.length}
              </div>
              <div className="text-sm text-blue-700">대상 그룹</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {selectedTemplates.length}
              </div>
              <div className="text-sm text-green-700">알림톡 템플릿</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {mappings.length}
              </div>
              <div className="text-sm text-purple-700">생성된 매핑</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 현재 설정 저장 모달 */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">현재 매핑 설정 저장</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">설정 이름 *</label>
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="예: 고객 성과 매핑 설정"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">설명 (선택사항)</label>
                <Input
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="이 매핑 설정에 대한 설명을 입력하세요"
                />
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  💾 현재 {mappings.length}개의 매핑이 Supabase에 저장됩니다.
                  <span className="block mt-1">
                    다른 워크플로우에서도 이 설정을 불러와 재사용할 수 있습니다.
                  </span>
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveDialog(false);
                    setSaveName('');
                    setSaveDescription('');
                  }}
                  disabled={isSaving}
                >
                  취소
                </Button>
                <Button 
                  onClick={handleSaveCurrentSettings}
                  disabled={isSaving || !saveName.trim()}
                >
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 