'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, AlertCircle, Database, Hash, Settings } from 'lucide-react';
import type { VariableMappingTemplate, VariableMapping } from '@/lib/types/workflow';
import { MappingTemplateService } from '@/lib/services/mapping-template-service';

interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: VariableMappingTemplate | null;
  onSave: (template: VariableMappingTemplate) => void;
  initialMappings?: VariableMapping[];
}

export default function TemplateEditorModal({
  isOpen,
  onClose,
  template,
  onSave,
  initialMappings = []
}: TemplateEditorModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    tags: [] as string[],
    isPublic: false
  });
  const [mappings, setMappings] = useState<VariableMapping[]>(initialMappings);
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 카테고리 옵션
  const categories = [
    { value: 'performance', label: '성과 리포트' },
    { value: 'welcome', label: '환영 메시지' },
    { value: 'payment', label: '결제 알림' },
    { value: 'general', label: '일반' },
    { value: 'custom', label: '사용자 정의' }
  ];

  // 템플릿 데이터 로드
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description,
        category: template.category,
        tags: [...template.tags],
        isPublic: template.isPublic
      });
      setMappings([...template.variableMappings]);
    } else {
      // 새 템플릿
      setFormData({
        name: '',
        description: '',
        category: 'general',
        tags: [],
        isPublic: false
      });
      setMappings(initialMappings);
    }
    setErrors({});
  }, [template, isOpen, initialMappings]);

  const handleAddMapping = () => {
    const newMapping: VariableMapping = {
      templateVariable: '',
      sourceField: '',
      sourceType: 'field',
      defaultValue: '',
      formatter: 'text'
    };
    setMappings([...mappings, newMapping]);
  };

  const handleUpdateMapping = (index: number, updates: Partial<VariableMapping>) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], ...updates };
    setMappings(updated);
  };

  const handleRemoveMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '템플릿 이름을 입력해주세요.';
    }

    if (!formData.description.trim()) {
      newErrors.description = '템플릿 설명을 입력해주세요.';
    }

    if (mappings.length === 0) {
      newErrors.mappings = '최소 하나의 변수 매핑을 추가해주세요.';
    }

    // 변수 매핑 검증
    mappings.forEach((mapping, index) => {
      if (!mapping.templateVariable.trim()) {
        newErrors[`mapping_${index}_variable`] = '변수명을 입력해주세요.';
      }
      if (!mapping.sourceField.trim()) {
        newErrors[`mapping_${index}_source`] = '데이터 소스를 입력해주세요.';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const templateData = {
        ...formData,
        variableMappings: mappings,
        usageCount: 0 // 새 템플릿의 경우 사용 횟수는 0으로 시작
      };

      if (template) {
        // 기존 템플릿 업데이트
        const updated = await MappingTemplateService.updateTemplate(template.id, templateData);
        if (updated) {
          onSave(updated);
        }
      } else {
        // 새 템플릿 생성
        const created = await MappingTemplateService.saveTemplate(templateData);
        onSave(created);
      }

      onClose();
    } catch (error) {
      console.error('템플릿 저장 실패:', error);
      // 에러 처리 - 사용자에게 알림
      alert('템플릿 저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {template ? '템플릿 편집' : '새 템플릿 생성'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  템플릿 이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="예: 성과 리포트 기본 변수"
                />
                {errors.name && (
                  <p className="text-red-600 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설명 *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="이 템플릿의 용도와 포함된 변수들에 대해 설명해주세요."
              />
              {errors.description && (
                <p className="text-red-600 text-sm mt-1">{errors.description}</p>
              )}
            </div>

            {/* 태그 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                태그
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="태그 입력 후 Enter"
                />
                <button
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  추가
                </button>
              </div>
            </div>

            {/* 공개 설정 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isPublic" className="text-sm text-gray-700">
                다른 사용자와 공유 (공개 템플릿)
              </label>
            </div>

            {/* 변수 매핑 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">변수 매핑</h3>
                <button
                  onClick={handleAddMapping}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  변수 추가
                </button>
              </div>

              {errors.mappings && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="w-4 h-4" />
                    {errors.mappings}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {mappings.map((mapping, index) => (
                  <MappingEditor
                    key={index}
                    mapping={mapping}
                    index={index}
                    onUpdate={(updates) => handleUpdateMapping(index, updates)}
                    onRemove={() => handleRemoveMapping(index)}
                    errors={errors}
                  />
                ))}

                {mappings.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Hash className="w-8 h-8 mx-auto mb-2" />
                    <p>변수 매핑을 추가해주세요.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Save className="w-4 h-4" />
            {template ? '업데이트' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 개별 매핑 편집 컴포넌트
interface MappingEditorProps {
  mapping: VariableMapping;
  index: number;
  onUpdate: (updates: Partial<VariableMapping>) => void;
  onRemove: () => void;
  errors: Record<string, string>;
}

function MappingEditor({ mapping, index, onUpdate, onRemove, errors }: MappingEditorProps) {
  const sourceTypes = [
    { value: 'field', label: '필드 매핑', icon: Hash },
    { value: 'query', label: 'SQL 쿼리', icon: Database },
    { value: 'function', label: '내장 함수', icon: Settings }
  ];

  const formatters = [
    { value: 'text', label: '텍스트' },
    { value: 'number', label: '숫자' },
    { value: 'currency', label: '통화' },
    { value: 'date', label: '날짜' }
  ];

  const builtInFunctions = [
    'current_date',
    'company_name_short',
    'contact_formatted'
  ];

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">변수 #{index + 1}</h4>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 템플릿 변수명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            템플릿 변수명 *
          </label>
          <input
            type="text"
            value={mapping.templateVariable}
            onChange={(e) => onUpdate({ templateVariable: e.target.value })}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors[`mapping_${index}_variable`] ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="#{변수명}"
          />
          {errors[`mapping_${index}_variable`] && (
            <p className="text-red-600 text-sm mt-1">{errors[`mapping_${index}_variable`]}</p>
          )}
        </div>

        {/* 데이터 소스 타입 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            데이터 소스 타입
          </label>
          <select
            value={mapping.sourceType}
            onChange={(e) => onUpdate({ sourceType: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {sourceTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        {/* 데이터 소스 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            데이터 소스 *
          </label>
          {mapping.sourceType === 'function' ? (
            <select
              value={mapping.sourceField}
              onChange={(e) => onUpdate({ sourceField: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors[`mapping_${index}_source`] ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">내장 함수 선택</option>
              {builtInFunctions.map(func => (
                <option key={func} value={func}>{func}</option>
              ))}
            </select>
          ) : (
            <textarea
              value={mapping.sourceField}
              onChange={(e) => onUpdate({ sourceField: e.target.value })}
              rows={mapping.sourceType === 'query' ? 3 : 1}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors[`mapping_${index}_source`] ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder={
                mapping.sourceType === 'query' 
                  ? 'SELECT COUNT(*) FROM Reviews WHERE companyId = {adId}'
                  : 'companyName'
              }
            />
          )}
          {errors[`mapping_${index}_source`] && (
            <p className="text-red-600 text-sm mt-1">{errors[`mapping_${index}_source`]}</p>
          )}
        </div>

        {/* 기본값 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            기본값
          </label>
          <input
            type="text"
            value={mapping.defaultValue}
            onChange={(e) => onUpdate({ defaultValue: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="값이 없을 때 사용할 기본값"
          />
        </div>

        {/* 포맷터 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            포맷
          </label>
          <select
            value={mapping.formatter}
            onChange={(e) => onUpdate({ formatter: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {formatters.map(format => (
              <option key={format.value} value={format.value}>{format.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
} 