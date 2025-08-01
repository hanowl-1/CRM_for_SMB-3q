'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Star, 
  StarOff, 
  Trash2, 
  Database,
  TrendingUp,
  Check,
  X,
  Save,
  History,
  FileText,
  Calendar
} from 'lucide-react';
import type { MappingHistoryTemplate, VariableMapping } from '@/lib/types/workflow';
import { MappingHistoryService } from '@/lib/services/mapping-history-service';

interface MappingHistorySelectorProps {
  onSelect: (mappings: VariableMapping[]) => void;
  onSave?: (template: MappingHistoryTemplate) => void;
  currentMappings: VariableMapping[];
  templateContent: string;
}

export default function MappingHistorySelector({
  onSelect,
  onSave,
  currentMappings,
  templateContent
}: MappingHistorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<MappingHistoryTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // 템플릿 로드
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = () => {
    const allTemplates = MappingHistoryService.getTemplates({
      sortBy: 'lastUsedAt',
      sortOrder: 'desc'
    });
    const filtered = searchTerm 
      ? allTemplates.filter(t => 
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.templateContent.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : allTemplates;
    
    setTemplates(filtered);
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [searchTerm]);

  const handleSelectTemplate = (template: MappingHistoryTemplate) => {
    const mappings = MappingHistoryService.applyMappingHistory(template.id);
    if (mappings) {
      onSelect(mappings);
      setIsOpen(false);
    }
  };

  const handleToggleFavorite = (templateId: string) => {
    MappingHistoryService.toggleFavorite(templateId);
    loadTemplates();
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm('정말로 이 매핑 이력을 삭제하시겠습니까?')) {
      MappingHistoryService.deleteTemplate(templateId);
      loadTemplates();
    }
  };

  const handleSaveCurrentMapping = () => {
    if (currentMappings.length === 0) {
      alert('저장할 매핑이 없습니다.');
      return;
    }
    setShowSaveModal(true);
  };

  if (!isOpen) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100"
        >
          <History className="w-4 h-4" />
          매핑 이력 불러오기
        </button>
        {currentMappings.length > 0 && (
          <button
            onClick={handleSaveCurrentMapping}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
          >
            <Save className="w-4 h-4" />
            매핑 이력 저장
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* 템플릿 선택 모달 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                매핑 이력 선택
              </h2>
              <p className="text-gray-600 mt-1">
                저장된 변수 매핑 이력을 선택하거나 현재 매핑을 저장하세요
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* 검색 */}
          <div className="p-6 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="매핑 이력 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 템플릿 목록 */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {templates.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? '검색 결과가 없습니다' : '저장된 매핑 이력이 없습니다'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm 
                    ? '다른 검색어를 시도해보세요'
                    : '현재 매핑 설정을 이력으로 저장해보세요'
                  }
                </p>
                {currentMappings.length > 0 && (
                  <button
                    onClick={handleSaveCurrentMapping}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4" />
                    현재 매핑 저장
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {templates.map((template) => (
                  <HistoryTemplateCard
                    key={template.id}
                    template={template}
                    onSelect={() => handleSelectTemplate(template)}
                    onToggleFavorite={() => handleToggleFavorite(template.id)}
                    onDelete={() => handleDeleteTemplate(template.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <div className="flex gap-2">
              {currentMappings.length > 0 && (
                <button
                  onClick={handleSaveCurrentMapping}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Save className="w-4 h-4" />
                  현재 매핑 저장
                </button>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* 매핑 저장 모달 */}
      {showSaveModal && (
        <MappingSaveModal
          templateContent={templateContent}
          mappings={currentMappings}
          onSave={(template) => {
            setShowSaveModal(false);
            onSave?.(template);
            loadTemplates();
          }}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </>
  );
}

// 이력 템플릿 카드 컴포넌트
interface HistoryTemplateCardProps {
  template: MappingHistoryTemplate;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

function HistoryTemplateCard({ template, onSelect, onToggleFavorite, onDelete }: HistoryTemplateCardProps) {
  const getCategoryColor = (category: string) => {
    const colors = {
      performance: 'bg-green-100 text-green-800',
      welcome: 'bg-blue-100 text-blue-800',
      payment: 'bg-yellow-100 text-yellow-800',
      general: 'bg-gray-100 text-gray-800',
      custom: 'bg-purple-100 text-purple-800'
    };
    return colors[category as keyof typeof colors] || colors.custom;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
          <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
        </div>
        
        <button
          onClick={onToggleFavorite}
          className="text-gray-400 hover:text-yellow-500 ml-2"
        >
          {template.isFavorite ? (
            <Star className="w-4 h-4 fill-current text-yellow-500" />
          ) : (
            <StarOff className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* 메타 정보 */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(template.category)}`}>
          {template.category}
        </span>
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {template.usageCount}회 사용
        </span>
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {template.variableMappings.length}개 변수
        </span>
      </div>

      {/* 태그 */}
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {template.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className="text-xs text-gray-500">+{template.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* 템플릿 내용 미리보기 */}
      <div className="bg-gray-50 p-3 rounded-md mb-3">
        <div className="text-xs text-gray-600 mb-1">템플릿 내용:</div>
        <div className="text-xs text-gray-800 line-clamp-2">
          {template.templateContent}
        </div>
      </div>

      {/* 변수 매핑 미리보기 */}
      <div className="bg-blue-50 p-3 rounded-md mb-4">
        <div className="text-xs text-blue-600 mb-1">변수 매핑:</div>
        <div className="space-y-1">
          {template.variableMappings.slice(0, 3).map((mapping, index) => (
            <div key={index} className="text-xs text-blue-800 flex items-center gap-2">
              <span className="font-mono">{mapping.templateVariable}</span>
              <span>→</span>
              <span className="truncate">{mapping.sourceField || '미설정'}</span>
            </div>
          ))}
          {template.variableMappings.length > 3 && (
            <div className="text-xs text-blue-600">
              ... 외 {template.variableMappings.length - 3}개
            </div>
          )}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={onSelect}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            <Check className="w-4 h-4" />
            적용
          </button>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={onDelete}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {template.lastUsedAt ? (
              <span title={new Date(template.lastUsedAt).toLocaleString()}>
                {new Date(template.lastUsedAt).toLocaleDateString()}
              </span>
            ) : (
              '미사용'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 매핑 저장 모달 컴포넌트
interface MappingSaveModalProps {
  templateContent: string;
  mappings: VariableMapping[];
  onSave: (template: MappingHistoryTemplate) => void;
  onClose: () => void;
}

function MappingSaveModal({ templateContent, mappings, onSave, onClose }: MappingSaveModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'custom',
    tags: [] as string[],
    isPublic: false
  });
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = [
    { value: 'performance', label: '성과 리포트' },
    { value: 'welcome', label: '환영 메시지' },
    { value: 'payment', label: '결제 알림' },
    { value: 'general', label: '일반' },
    { value: 'custom', label: '사용자 정의' }
  ];

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
      newErrors.name = '이력 이름을 입력해주세요.';
    }

    if (!formData.description.trim()) {
      newErrors.description = '이력 설명을 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const template = MappingHistoryService.saveCurrentMapping(
      templateContent,
      mappings,
      formData.name,
      formData.description,
      formData.category,
      formData.tags,
      formData.isPublic
    );

    onSave(template);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            매핑 이력 저장
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
          <div className="space-y-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이력 이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="예: 성과 리포트 매핑 설정"
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
                placeholder="이 매핑 이력의 용도를 설명해주세요."
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
                다른 사용자와 공유 (공개 이력)
              </label>
            </div>

            {/* 저장될 내용 미리보기 */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  저장될 템플릿 내용
                </label>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-800 line-clamp-3">
                    {templateContent}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  저장될 변수 매핑 ({mappings.length}개)
                </label>
                <div className="bg-blue-50 p-3 rounded-lg max-h-32 overflow-y-auto">
                  {mappings.map((mapping, index) => (
                    <div key={index} className="text-sm text-blue-800 flex items-center gap-2 mb-1">
                      <span className="font-mono">{mapping.templateVariable}</span>
                      <span>→</span>
                      <span className="truncate">{mapping.sourceField || '미설정'}</span>
                    </div>
                  ))}
                </div>
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
            저장
          </button>
        </div>
      </div>
    </div>
  );
} 