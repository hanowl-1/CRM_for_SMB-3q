'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowRight, 
  Database, 
  MessageSquare, 
  Link2, 
  Eye, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Settings
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
  const [mappings, setMappings] = useState<TargetTemplateMapping[]>(currentMappings);
  const [previewData, setPreviewData] = useState<Record<string, any[]>>({});
  const [isLoadingPreview, setIsLoadingPreview] = useState<Record<string, boolean>>({});
  const [mappingPreviews, setMappingPreviews] = useState<Record<string, MappingPreview[]>>({});

  // 동적 쿼리가 있는 대상 그룹만 필터링
  const dynamicTargetGroups = targetGroups.filter(group => 
    group.type === 'dynamic' && group.dynamicQuery
  );

  // 템플릿 변수 추출
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

  // 대상 그룹 미리보기 데이터 로드
  const loadPreviewData = useCallback(async (targetGroup: TargetGroup) => {
    if (!targetGroup.dynamicQuery) return;

    setIsLoadingPreview(prev => ({ ...prev, [targetGroup.id]: true }));

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
            [targetGroup.id]: result.preview
          }));
        }
      }
    } catch (error) {
      console.error('미리보기 데이터 로드 실패:', error);
    } finally {
      setIsLoadingPreview(prev => ({ ...prev, [targetGroup.id]: false }));
    }
  }, []);

  // 초기 미리보기 데이터 로드
  useEffect(() => {
    dynamicTargetGroups.forEach(group => {
      loadPreviewData(group);
    });
  }, [dynamicTargetGroups, loadPreviewData]);

  // 매핑 생성/업데이트
  const updateMapping = useCallback((targetGroupId: string, templateId: string, fieldMappings: FieldMapping[]) => {
    setMappings(prev => {
      const existingIndex = prev.findIndex(m => 
        m.targetGroupId === targetGroupId && m.templateId === templateId
      );

      const newMapping: TargetTemplateMapping = {
        id: existingIndex >= 0 ? prev[existingIndex].id : `mapping_${Date.now()}`,
        targetGroupId,
        templateId,
        fieldMappings,
        createdAt: existingIndex >= 0 ? prev[existingIndex].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updated = existingIndex >= 0 
        ? prev.map((m, i) => i === existingIndex ? newMapping : m)
        : [...prev, newMapping];

      onMappingChange(updated);
      return updated;
    });
  }, [onMappingChange]);

  // 필드 매핑 업데이트
  const updateFieldMapping = useCallback((
    targetGroupId: string, 
    templateId: string, 
    templateVariable: string, 
    targetField: string,
    formatter?: string,
    defaultValue?: string
  ) => {
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
      formatter: formatter as any,
      defaultValue
    };

    const updatedFieldMappings = existingFieldIndex >= 0
      ? currentFieldMappings.map((fm, i) => i === existingFieldIndex ? newFieldMapping : fm)
      : [...currentFieldMappings, newFieldMapping];

    updateMapping(targetGroupId, templateId, updatedFieldMappings);
  }, [mappings, updateMapping]);

  // 매핑 미리보기 생성
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
      let formattedValue = String(sampleValue);

      // 포맷터 적용
      if (fm.formatter && sampleValue) {
        switch (fm.formatter) {
          case 'number':
            formattedValue = Number(sampleValue).toLocaleString();
            break;
          case 'currency':
            formattedValue = `${Number(sampleValue).toLocaleString()}원`;
            break;
          case 'date':
            formattedValue = new Date(sampleValue).toLocaleDateString();
            break;
          default:
            formattedValue = String(sampleValue);
        }
      }

      return {
        templateVariable: fm.templateVariable,
        targetField: fm.targetField,
        sampleValue: String(sampleValue),
        formattedValue
      };
    });
  }, [mappings, previewData]);

  // 매핑 완성도 체크
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

  if (dynamicTargetGroups.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium mb-2">동적 쿼리 대상 그룹이 없습니다</h3>
          <p className="text-muted-foreground mb-4">
            대상 그룹에서 동적 쿼리를 추가한 후 매핑을 설정할 수 있습니다.
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            대상 그룹 ↔ 알림톡 변수 매핑
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            동적 쿼리 결과의 필드를 알림톡 템플릿 변수와 연결하세요
          </p>
        </CardHeader>
      </Card>

      {/* 매핑 설정 */}
      <div className="space-y-6">
        {dynamicTargetGroups.map(targetGroup => (
          <Card key={targetGroup.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-medium">{targetGroup.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {targetGroup.dynamicQuery?.description}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadPreviewData(targetGroup)}
                  disabled={isLoadingPreview[targetGroup.id]}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingPreview[targetGroup.id] ? 'animate-spin' : ''}`} />
                  미리보기 새로고침
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 쿼리 결과 미리보기 */}
              {previewData[targetGroup.id] && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    쿼리 결과 미리보기
                  </h4>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs font-mono overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            {Object.keys(previewData[targetGroup.id][0] || {}).map(key => (
                              <th key={key} className="px-2 py-1 text-left font-medium">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData[targetGroup.id].slice(0, 2).map((row, index) => (
                            <tr key={index} className="border-b border-gray-100">
                              {Object.values(row).map((value, i) => (
                                <td key={i} className="px-2 py-1">
                                  {String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 템플릿별 매핑 */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">알림톡 템플릿 매핑</h4>
                {selectedTemplates.map(template => {
                  const templateVariables = extractTemplateVariables(template);
                  const completeness = getMappingCompleteness(targetGroup.id, template.id);
                  
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

                          const availableFields = previewData[targetGroup.id] 
                            ? Object.keys(previewData[targetGroup.id][0] || {})
                            : [];

                          return (
                            <div key={variable} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center p-3 bg-gray-50 rounded">
                              <div className="font-medium text-sm">
                                #{variable}
                              </div>
                              
                              <Select
                                value={currentMapping?.targetField || ''}
                                onValueChange={(value) => updateFieldMapping(
                                  targetGroup.id, 
                                  template.id, 
                                  variable, 
                                  value,
                                  currentMapping?.formatter,
                                  currentMapping?.defaultValue
                                )}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="필드 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableFields.map(field => (
                                    <SelectItem key={field} value={field}>
                                      <div className="flex items-center justify-between w-full">
                                        <span>{field}</span>
                                        {previewData[targetGroup.id] && (
                                          <span className="text-xs text-muted-foreground ml-2">
                                            {String(previewData[targetGroup.id][0][field])}
                                          </span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={currentMapping?.formatter || 'text'}
                                onValueChange={(value) => updateFieldMapping(
                                  targetGroup.id, 
                                  template.id, 
                                  variable, 
                                  currentMapping?.targetField || '',
                                  value,
                                  currentMapping?.defaultValue
                                )}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">텍스트</SelectItem>
                                  <SelectItem value="number">숫자</SelectItem>
                                  <SelectItem value="currency">통화</SelectItem>
                                  <SelectItem value="date">날짜</SelectItem>
                                </SelectContent>
                              </Select>

                              <Input
                                placeholder="기본값"
                                value={currentMapping?.defaultValue || ''}
                                onChange={(e) => updateFieldMapping(
                                  targetGroup.id, 
                                  template.id, 
                                  variable, 
                                  currentMapping?.targetField || '',
                                  currentMapping?.formatter,
                                  e.target.value
                                )}
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
        ))}
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
                {dynamicTargetGroups.length}
              </div>
              <div className="text-sm text-blue-700">동적 대상 그룹</div>
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
    </div>
  );
} 