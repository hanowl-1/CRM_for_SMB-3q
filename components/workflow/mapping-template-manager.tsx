'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  Star, 
  StarOff, 
  Edit, 
  Trash2, 
  Copy, 
  Download, 
  Upload,
  Tag,
  Calendar,
  TrendingUp,
  Eye,
  Settings,
  Loader2
} from 'lucide-react';
import type { 
  VariableMappingTemplate, 
  MappingTemplateFilter,
  MappingSuggestion 
} from '@/lib/types/workflow';
import { MappingTemplateService } from '@/lib/services/mapping-template-service';

interface MappingTemplateManagerProps {
  onSelectTemplate?: (template: VariableMappingTemplate) => void;
  onApplyTemplate?: (template: VariableMappingTemplate) => void;
  currentVariables?: string[]; // 현재 템플릿의 변수들 (자동 제안용)
  mode?: 'select' | 'manage'; // 선택 모드 vs 관리 모드
}

export default function MappingTemplateManager({
  onSelectTemplate,
  onApplyTemplate,
  currentVariables = [],
  mode = 'manage'
}: MappingTemplateManagerProps) {
  const [templates, setTemplates] = useState<VariableMappingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MappingTemplateFilter>({
    sortBy: 'lastUsedAt',
    sortOrder: 'desc'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<VariableMappingTemplate | null>(null);
  const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([]);

  // 카테고리 목록
  const categories = [
    { value: '', label: '전체 카테고리' },
    { value: 'performance', label: '성과 리포트' },
    { value: 'welcome', label: '환영 메시지' },
    { value: 'payment', label: '결제 알림' },
    { value: 'general', label: '일반' },
    { value: 'custom', label: '사용자 정의' }
  ];

  // 템플릿 로드
  useEffect(() => {
    loadTemplates();
  }, []);

  // 자동 제안 생성
  useEffect(() => {
    if (currentVariables.length > 0 && mode === 'select') {
      // 자동 제안은 동기적으로 처리 (localStorage 기반)
      const newSuggestions = MappingTemplateService.generateSuggestions(currentVariables, []);
      setSuggestions(newSuggestions);
    }
  }, [currentVariables, mode]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 템플릿 로딩 시작...');
      
      const currentFilter = {
        ...filter,
        searchTerm: searchTerm || undefined,
        category: selectedCategory || undefined,
        isFavorite: showFavoritesOnly || undefined
      };
      
      console.log('📋 필터 조건:', currentFilter);
      
      const loadedTemplates = await MappingTemplateService.getTemplates(currentFilter);
      
      console.log('✅ 템플릿 로딩 완료:', loadedTemplates.length, '개');
      console.log('📄 로딩된 템플릿들:', loadedTemplates);
      
      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('❌ 템플릿 로드 실패:', error);
      setError(error instanceof Error ? error.message : '템플릿을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 필터 변경시 템플릿 재로드
  useEffect(() => {
    loadTemplates();
  }, [filter, searchTerm, selectedCategory, showFavoritesOnly]);

  // 테스트 데이터 생성 함수
  const createTestTemplate = async () => {
    try {
      const testTemplate = {
        name: '성과 리포트 기본 템플릿',
        description: '월간 성과 리포트에 사용되는 기본 변수 매핑 템플릿입니다.',
        category: 'performance',
        tags: ['성과', '리포트', '월간'],
        isPublic: true,
        usageCount: 0,
        variableMappings: [
          {
            templateVariable: '#{companyName}',
            sourceField: 'companyName',
            sourceType: 'field' as const,
            defaultValue: '회사명',
            formatter: 'text' as const
          },
          {
            templateVariable: '#{totalReviews}',
            sourceField: 'totalReviews',
            sourceType: 'field' as const,
            defaultValue: '0',
            formatter: 'number' as const
          },
          {
            templateVariable: '#{monthlyReviews}',
            sourceField: 'monthlyReviews',
            sourceType: 'field' as const,
            defaultValue: '0',
            formatter: 'number' as const
          }
        ]
      };

      console.log('🧪 테스트 템플릿 생성 중...');
      const created = await MappingTemplateService.saveTemplate(testTemplate);
      console.log('✅ 테스트 템플릿 생성 완료:', created);
      
      loadTemplates(); // 목록 새로고침
    } catch (error) {
      console.error('❌ 테스트 템플릿 생성 실패:', error);
    }
  };

  const handleToggleFavorite = async (templateId: string) => {
    try {
      await MappingTemplateService.toggleFavorite(templateId);
      loadTemplates();
    } catch (error) {
      console.error('즐겨찾기 토글 실패:', error);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('정말로 이 템플릿을 삭제하시겠습니까?')) {
      try {
        await MappingTemplateService.deleteTemplate(templateId);
        loadTemplates();
      } catch (error) {
        console.error('템플릿 삭제 실패:', error);
      }
    }
  };

  const handleApplyTemplate = async (template: VariableMappingTemplate) => {
    try {
      await MappingTemplateService.recordUsage(template.id);
      onApplyTemplate?.(template);
      loadTemplates(); // 사용 횟수 업데이트 반영
    } catch (error) {
      console.error('템플릿 적용 실패:', error);
      // 에러가 발생해도 템플릿은 적용
      onApplyTemplate?.(template);
    }
  };

  const handleDuplicateTemplate = async (template: VariableMappingTemplate) => {
    try {
      await MappingTemplateService.duplicateTemplate(template.id, `${template.name} (복사본)`);
      loadTemplates();
    } catch (error) {
      console.error('템플릿 복제 실패:', error);
    }
  };

  // 필터링된 템플릿들
  const filteredTemplates = useMemo(() => {
    return templates;
  }, [templates]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            변수 매핑 템플릿 {mode === 'select' ? '선택' : '관리'}
          </h2>
          <p className="text-gray-600 mt-1">
            {mode === 'select' 
              ? '기존 템플릿을 선택하여 빠르게 변수를 매핑하세요'
              : '변수 매핑 템플릿을 생성하고 관리하세요'
            }
          </p>
        </div>
        
        {mode === 'manage' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              새 템플릿
            </button>
          </div>
        )}
      </div>

      {/* 자동 제안 (선택 모드에서만) */}
      {mode === 'select' && suggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            추천 템플릿
          </h3>
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <div key={index} className="text-sm">
                <span className="font-medium text-blue-800">
                  {suggestion.templateVariable}
                </span>
                <span className="text-blue-600 ml-2">
                  → {suggestion.suggestedMappings[0]?.template.name}
                  ({suggestion.suggestedMappings[0]?.reason})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 검색 및 필터 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="템플릿 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>

        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
            showFavoritesOnly 
              ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
          즐겨찾기
        </button>

        {/* 테스트 데이터 생성 버튼 (개발용) */}
        {mode === 'manage' && (
          <button
            onClick={createTestTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            테스트 데이터
          </button>
        )}
      </div>

      {/* 에러 상태 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <Settings className="w-4 h-4" />
            <span className="font-medium">오류 발생</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
          <button
            onClick={loadTemplates}
            className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 로딩 상태 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">템플릿을 불러오는 중...</p>
          </div>
        </div>
      )}

      {/* 템플릿 목록 */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              mode={mode}
              onToggleFavorite={handleToggleFavorite}
              onEdit={() => setEditingTemplate(template)}
              onDelete={handleDeleteTemplate}
              onDuplicate={handleDuplicateTemplate}
              onSelect={() => onSelectTemplate?.(template)}
              onApply={() => handleApplyTemplate(template)}
            />
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && !error && filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Settings className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            템플릿이 없습니다
          </h3>
          <p className="text-gray-600 mb-4">
            새로운 변수 매핑 템플릿을 생성해보세요.
          </p>
          <div className="flex items-center justify-center gap-3">
            {mode === 'manage' && (
              <>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  첫 번째 템플릿 만들기
                </button>
                <button
                  onClick={createTestTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  테스트 데이터 생성
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 템플릿 카드 컴포넌트
interface TemplateCardProps {
  template: VariableMappingTemplate;
  mode: 'select' | 'manage';
  onToggleFavorite: (id: string) => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (template: VariableMappingTemplate) => void;
  onSelect?: () => void;
  onApply?: () => void;
}

function TemplateCard({
  template,
  mode,
  onToggleFavorite,
  onEdit,
  onDelete,
  onDuplicate,
  onSelect,
  onApply
}: TemplateCardProps) {
  const getCategoryColor = (category: string) => {
    const colors = {
      performance: 'bg-green-100 text-green-800',
      welcome: 'bg-blue-100 text-blue-800',
      payment: 'bg-yellow-100 text-yellow-800',
      general: 'bg-gray-100 text-gray-800',
      custom: 'bg-purple-100 text-purple-800'
    };
    return colors[category as keyof typeof colors] || colors.general;
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
          onClick={() => onToggleFavorite(template.id)}
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

      {/* 변수 개수 */}
      <div className="text-sm text-gray-600 mb-4">
        변수 {template.variableMappings.length}개 포함
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between">
        {mode === 'select' ? (
          <div className="flex gap-2 w-full">
            <button
              onClick={onSelect}
              className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
            >
              <Eye className="w-4 h-4 inline mr-1" />
              미리보기
            </button>
            <button
              onClick={onApply}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              적용
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 w-full">
            <button
              onClick={onEdit}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="편집"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDuplicate(template)}
              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
              title="복사"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(template.id)}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            
            <div className="flex-1" />
            
            <div className="text-xs text-gray-500">
              {template.lastUsedAt ? (
                <span title={new Date(template.lastUsedAt).toLocaleString()}>
                  {new Date(template.lastUsedAt).toLocaleDateString()}
                </span>
              ) : (
                '미사용'
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 