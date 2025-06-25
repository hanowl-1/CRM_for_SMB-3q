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
  Code
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { 
  TargetGroup, 
  TargetTemplateMapping, 
  FieldMapping, 
  MappingPreview 
} from '@/lib/types/workflow';
import type { KakaoTemplate } from '@/lib/types/template';
import { MappingTemplateManager } from './mapping-template-manager';

interface TargetTemplateMappingProps {
  targetGroups: TargetGroup[];
  selectedTemplates: KakaoTemplate[];
  currentMappings?: TargetTemplateMapping[];
  onMappingChange: (mappings: TargetTemplateMapping[]) => void;
}

export function TargetTemplateMapping({
  targetGroups,
  selectedTemplates,
  currentMappings = [],
  onMappingChange
}: TargetTemplateMappingProps) {
  const [mappings, setMappings] = useState<TargetTemplateMapping[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, any[]>>({});
  const [isLoadingPreview, setIsLoadingPreview] = useState<Record<string, boolean>>({});
  const [mappingPreviews, setMappingPreviews] = useState<Record<string, MappingPreview[]>>({});
  
  // 안정적인 참조를 위한 ref들
  const onMappingChangeRef = useRef(onMappingChange);
  const mappingsRef = useRef<TargetTemplateMapping[]>([]);
  const isInitializedRef = useRef(false);

  // 현재 설정 저장 상태
  const [showSaveDialog, setShowSaveDialog] = useState(false);
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
    targetField: string,
    defaultValue?: string
  ) => {
    console.log('🔄 필드 매핑 업데이트:', { targetGroupId, templateId, templateVariable, targetField });

    const currentMapping = mappings.find(m => 
      m.targetGroupId === targetGroupId && m.templateId === templateId
    );

    const currentFieldMappings = currentMapping?.fieldMappings || [];
    const existingFieldIndex = currentFieldMappings.findIndex(fm => 
      fm.templateVariable === templateVariable
    );

    const newFieldMapping: FieldMapping = {
      templateVariable,
      targetField,
      formatter: 'text', // 항상 텍스트로 처리
      defaultValue
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
              <CardTitle className="text-xl">대상-템플릿 매핑</CardTitle>
              <p className="text-muted-foreground mt-1">
                대상 그룹의 데이터 필드를 알림톡 템플릿 변수에 매핑하세요
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
                variant="outline"
                onClick={() => {
                  dynamicTargetGroups.forEach(group => {
                    loadPreviewData(group);
                  });
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                미리보기 새로고침
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 매핑 설정 */}
      <div className="space-y-6">
        {allTargetGroups.map(targetGroup => {
          const groupPreviewData = previewData[targetGroup.id];
          const isLoading = isLoadingPreview[targetGroup.id];
          
          return (
            <Card key={targetGroup.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium ${
                      targetGroup.type === 'dynamic' ? 'bg-purple-500' : 'bg-blue-500'
                    }`}>
                      {targetGroup.type === 'dynamic' ? <Code className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="font-medium">{targetGroup.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {targetGroup.type === 'dynamic' ? '동적 쿼리' : '정적 조건'} • 
                        약 {(targetGroup.estimatedCount || 0).toLocaleString()}명
                      </p>
                    </div>
                  </div>
                  
                  {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>로딩 중...</span>
                    </div>
                  )}
                  
                  {!isLoading && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadPreviewData(targetGroup)}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      새로고침
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {/* 대상 그룹 미리보기 */}
                {groupPreviewData && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium mb-3">대상자 미리보기</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            {Object.keys(groupPreviewData[0] || {}).map(key => (
                              <th key={key} className="text-left py-2 px-3 font-medium">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {groupPreviewData.slice(0, 2).map((row, index) => (
                            <tr key={index} className="border-b">
                              {Object.values(row).map((value, i) => (
                                <td key={i} className="py-2 px-3 text-muted-foreground">
                                  {String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 템플릿별 매핑 */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">알림톡 템플릿 매핑</h4>
                  {selectedTemplates.map(template => {
                    const templateVariables = extractTemplateVariables(template);
                    const completeness = getMappingCompleteness(targetGroup.id, template.id);
                    const availableFields = groupPreviewData ? Object.keys(groupPreviewData[0] || {}) : [];
                    
                    console.log('🔍 매핑 디버깅:', {
                      targetGroupId: targetGroup.id,
                      targetGroupType: targetGroup.type,
                      hasPreviewData: !!groupPreviewData,
                      availableFieldsCount: availableFields.length,
                      availableFields,
                      isLoading: isLoadingPreview[targetGroup.id]
                    });
                    
                    return (
                      <div key={template.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                              <MessageSquare className="w-3 h-3" />
                            </div>
                            <div>
                              <h5 className="font-medium">{template.templateName}</h5>
                              <p className="text-xs text-muted-foreground">
                                {templateVariables.length}개 변수
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={completeness.percentage === 100 ? 'default' : 'secondary'}>
                              {completeness.completed}/{completeness.total} 매핑됨
                            </Badge>
                            {completeness.percentage === 100 ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                            )}
                          </div>
                        </div>

                        {/* 변수별 매핑 설정 */}
                        <div className="space-y-3">
                          {templateVariables.map(variable => {
                            const currentMapping = mappings
                              .find(m => m.targetGroupId === targetGroup.id && m.templateId === template.id)
                              ?.fieldMappings.find(fm => fm.templateVariable === variable);

                            return (
                              <div key={variable} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center p-3 bg-gray-50 rounded">
                                <div className="font-medium text-sm">
                                  #{variable}
                                </div>
                                
                                <Select
                                  value={currentMapping?.targetField || ''}
                                  onValueChange={(value) => {
                                    console.log('🔄 필드 선택 변경:', { variable, value });
                                    updateFieldMapping(
                                      targetGroup.id, 
                                      template.id, 
                                      variable, 
                                      value,
                                      currentMapping?.defaultValue
                                    );
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="필드 선택" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableFields.length > 0 ? (
                                      availableFields.map(field => (
                                        <SelectItem key={field} value={field}>
                                          <div className="flex items-center justify-between w-full">
                                            <span>{field}</span>
                                            {groupPreviewData && (
                                              <span className="text-xs text-muted-foreground ml-2">
                                                {String(groupPreviewData[0][field])}
                                              </span>
                                            )}
                                          </div>
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <div className="p-2 text-sm text-muted-foreground">
                                        {isLoading ? '로딩 중...' : '사용 가능한 필드가 없습니다'}
                                        {!groupPreviewData && !isLoading && (
                                          <div className="text-xs mt-1">
                                            새로고침 버튼을 눌러 데이터를 다시 로드해보세요
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </SelectContent>
                                </Select>

                                <Input
                                  placeholder="기본값 (선택사항)"
                                  value={currentMapping?.defaultValue || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    console.log('🔄 기본값 변경:', { variable, value });
                                    updateFieldMapping(
                                      targetGroup.id, 
                                      template.id, 
                                      variable, 
                                      currentMapping?.targetField || '',
                                      value
                                    );
                                  }}
                                  className="text-sm"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* 매핑 미리보기 */}
                        {completeness.completed > 0 && (
                          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                            <h6 className="text-sm font-medium mb-2">매핑 미리보기</h6>
                            <div className="space-y-1 text-sm">
                              {generateMappingPreview(targetGroup.id, template.id).map(preview => (
                                <div key={preview.templateVariable} className="flex items-center gap-2">
                                  <span className="font-mono text-xs bg-white px-2 py-1 rounded">
                                    #{preview.templateVariable}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-gray-400" />
                                  <span className="text-blue-700 font-medium">
                                    {preview.formattedValue}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    ({preview.targetField})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
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