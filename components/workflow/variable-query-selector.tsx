'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Save,
  BookOpen,
  Plus,
  Star,
  StarOff,
  Trash2,
  Database,
  TrendingUp,
  Check,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { VariableQueryTemplate } from '@/lib/types/workflow';
import { VariableQueryTemplateService } from '@/lib/services/variable-query-template-service';

interface VariableQuerySelectorProps {
  variableName: string; // #{total_reviews} 등
  currentQuery?: string;
  currentSelectedColumn?: string;
  onSelect: (query: string, selectedColumn: string) => void;
  onSave?: (template: VariableQueryTemplate) => void;
}

export default function VariableQuerySelector({
  variableName,
  currentQuery = '',
  currentSelectedColumn = '',
  onSelect,
  onSave
}: VariableQuerySelectorProps) {
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templates, setTemplates] = useState<VariableQueryTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 저장 폼 데이터
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    category: 'custom' as string,
    tags: [] as string[],
    isPublic: false
  });

  // 템플릿 로드
  const loadTemplates = async () => {
    try {
      // 실제 Supabase API에서 개별 변수 매핑 데이터 가져오기
      const response = await fetch('/api/supabase/individual-variables?action=list');
      const result = await response.json();
      
      if (result.success) {
        // 현재 변수명과 일치하는 매핑들만 필터링
        const matchingMappings = result.data.filter((mapping: any) => 
          mapping.variableName === variableName
        );
        
        // VariableQueryTemplate 형식으로 변환
        const convertedTemplates = matchingMappings.map((mapping: any) => ({
          id: mapping.id,
          variableName: mapping.variableName,
          name: mapping.displayName,
          description: `${mapping.category} - ${mapping.sourceType}`,
          query: mapping.sourceField || '',
          selectedColumn: mapping.selectedColumn || '',
          category: mapping.category,
          tags: mapping.tags || [],
          usageCount: mapping.usageCount || 0,
          lastUsedAt: mapping.lastUsedAt,
          createdAt: mapping.createdAt,
          updatedAt: mapping.updatedAt,
          isPublic: mapping.isPublic,
          isFavorite: mapping.isFavorite
        }));
        
        // 검색어로 필터링
        const filtered = searchTerm 
          ? convertedTemplates.filter((t: any) => 
              t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
              t.query.toLowerCase().includes(searchTerm.toLowerCase())
            )
          : convertedTemplates;
        
        // 사용 횟수 순으로 정렬
        filtered.sort((a: any, b: any) => b.usageCount - a.usageCount);
        setTemplates(filtered);
      } else {
        console.error('개별 변수 매핑 로드 실패:', result.error);
        setTemplates([]);
      }
    } catch (error) {
      console.error('개별 변수 매핑 로드 오류:', error);
      setTemplates([]);
    }
  };

  useEffect(() => {
    if (showLibrary) {
      loadTemplates();
    }
  }, [showLibrary, variableName, searchTerm]);

  // 템플릿 선택
  const handleSelectTemplate = async (template: VariableQueryTemplate) => {
    console.log('템플릿 선택:', template);
    
    try {
      // Supabase API를 사용하여 사용 횟수 증가
      await fetch('/api/supabase/individual-variables?action=record-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variableName: template.variableName }),
      });
    } catch (error) {
      console.error('사용 기록 저장 실패:', error);
    }
    
    // 선택된 템플릿의 쿼리와 컬럼 정보를 부모에게 전달
    onSelect?.(template.query, template.selectedColumn || '');
    
    // 라이브러리 닫기
    setShowLibrary(false);
    
    // 템플릿 목록 새로고침 (사용 횟수 업데이트 반영)
    loadTemplates();
  };

  // 즐겨찾기 토글
  const handleToggleFavorite = async (templateId: string) => {
    try {
      // 현재 즐겨찾기 상태 찾기
      const template = templates.find(t => t.id === templateId);
      if (!template) return;

      const response = await fetch(`/api/supabase/individual-variables?action=update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: templateId,
          isFavorite: !template.isFavorite
        }),
      });

      const result = await response.json();
      if (result.success) {
        loadTemplates();
      } else {
        console.error('즐겨찾기 토글 실패:', result.error);
      }
    } catch (error) {
      console.error('즐겨찾기 토글 오류:', error);
    }
  };

  // 템플릿 삭제
  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('정말로 이 쿼리 템플릿을 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`/api/supabase/individual-variables?action=delete&id=${templateId}`, {
          method: 'DELETE',
        });

        const result = await response.json();
        if (result.success) {
          loadTemplates();
        } else {
          console.error('템플릿 삭제 실패:', result.error);
          alert('삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('템플릿 삭제 오류:', error);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  // 저장 폼 열기
  const handleOpenSaveForm = () => {
    if (!currentQuery.trim()) {
      alert('저장할 쿼리가 없습니다.');
      return;
    }
    
    // 폼 초기화
    setSaveForm({
      name: '',
      description: '',
      category: 'custom',
      tags: [],
      isPublic: false
    });
    
    setShowSaveForm(true);
  };

  // 쿼리 저장
  const handleSaveQuery = async () => {
    if (!saveForm.name.trim()) {
      alert('템플릿 이름을 입력해주세요.');
      return;
    }
    
    if (!saveForm.description.trim()) {
      alert('템플릿 설명을 입력해주세요.');
      return;
    }

    // 선택된 컬럼이 없을 때 경고
    if (!currentSelectedColumn) {
      const proceed = confirm(
        '변수값으로 사용할 컬럼이 선택되지 않았습니다.\n' +
        '쿼리를 테스트하고 컬럼을 선택하는 것을 권장합니다.\n\n' +
        '그래도 저장하시겠습니까?'
      );
      if (!proceed) {
        return;
      }
    }

    try {
      // Supabase API를 사용하여 개별 변수 매핑 저장
      const response = await fetch('/api/supabase/individual-variables?action=create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variableName,
          displayName: saveForm.name,
          sourceType: 'query',
          sourceField: currentQuery,
          selectedColumn: currentSelectedColumn || '',
          formatter: 'text',
          category: saveForm.category,
          tags: saveForm.tags,
          isPublic: saveForm.isPublic,
          createdBy: 'user'
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`쿼리 템플릿이 저장되었습니다!\n${currentSelectedColumn ? `선택된 컬럼: ${currentSelectedColumn}` : '컬럼: 미선택'}`);
        onSave?.(result.data);
        setShowSaveForm(false);
        
        // 라이브러리가 열려있다면 새로고침
        if (showLibrary) {
          loadTemplates();
        }
      } else {
        throw new Error(result.error || '저장 실패');
      }
    } catch (error) {
      console.error('저장 실패:', error);
      alert(`저장에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  // 태그 추가
  const addTag = (tag: string) => {
    if (tag.trim() && !saveForm.tags.includes(tag.trim())) {
      setSaveForm({
        ...saveForm,
        tags: [...saveForm.tags, tag.trim()]
      });
    }
  };

  // 태그 제거
  const removeTag = (tagToRemove: string) => {
    setSaveForm({
      ...saveForm,
      tags: saveForm.tags.filter(tag => tag !== tagToRemove)
    });
  };

  return (
    <div className="space-y-4">
      {/* 메인 버튼들 */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowLibrary(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
        >
          <BookOpen className="w-4 h-4" />
          쿼리 라이브러리
        </button>
        
        {currentQuery && (
          <button
            onClick={handleOpenSaveForm}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
          >
            <Save className="w-4 h-4" />
            쿼리 저장
          </button>
        )}
      </div>

      {/* 쿼리 라이브러리 */}
      {showLibrary && (
        <div className="border border-gray-200 rounded-lg bg-white shadow-lg">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{variableName} 쿼리 라이브러리</h3>
              <button
                onClick={() => setShowLibrary(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="쿼리 템플릿 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="p-4 max-h-96 overflow-y-auto">
            {templates.length === 0 ? (
              <div className="text-center py-8">
                <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">
                  {searchTerm ? '검색 결과가 없습니다' : '저장된 쿼리 템플릿이 없습니다'}
                </p>
                {currentQuery && (
                  <button
                    onClick={handleOpenSaveForm}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    첫 번째 템플릿 만들기
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900">{template.name}</h4>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {template.category}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                사용 {template.usageCount}회
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600">{template.description}</p>
                          
                          {/* 선택된 컬럼 정보 표시 */}
                          {template.selectedColumn && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-blue-600 font-medium">컬럼:</span>
                              <code className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                {template.selectedColumn}
                              </code>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleToggleFavorite(template.id)}
                          className="text-gray-400 hover:text-yellow-500"
                        >
                          {template.isFavorite ? (
                            <Star className="w-4 h-4 fill-current text-yellow-500" />
                          ) : (
                            <StarOff className="w-4 h-4" />
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-700 max-h-20 overflow-y-auto">
                      {template.query}
                    </div>
                    {template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => handleSelectTemplate(template)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      <Check className="w-4 h-4" />
                      이 쿼리 사용하기
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 쿼리 저장 폼 */}
      {showSaveForm && (
        <div className="border border-gray-200 rounded-lg bg-white shadow-lg">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">쿼리 템플릿 저장</h3>
              <button
                onClick={() => setShowSaveForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  템플릿 이름 *
                </label>
                <input
                  type="text"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 총 리뷰 수 조회"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리
                </label>
                <select
                  value={saveForm.category}
                  onChange={(e) => setSaveForm({ ...saveForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="performance">성과 리포트</option>
                  <option value="general">일반</option>
                  <option value="custom">사용자 정의</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설명 *
              </label>
              <textarea
                value={saveForm.description}
                onChange={(e) => setSaveForm({ ...saveForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="이 쿼리 템플릿의 용도를 설명해주세요."
              />
            </div>

            {/* 저장될 쿼리 미리보기 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                저장될 쿼리
              </label>
              <div className="bg-gray-50 p-3 rounded-lg">
                <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {currentQuery}
                </pre>
              </div>
              <div className="mt-2 p-2 bg-blue-50 rounded border">
                <p className="text-xs text-blue-700 font-medium mb-1">
                  변수값으로 사용할 컬럼:
                </p>
                <p className="text-sm font-mono text-blue-800">
                  {currentSelectedColumn || '없음 (쿼리 테스트 후 컬럼을 선택해주세요)'}
                </p>
              </div>
              {!currentSelectedColumn && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <span>⚠️</span>
                  컬럼이 선택되지 않았습니다. 쿼리를 테스트하고 컬럼을 선택해주세요.
                </p>
              )}
            </div>

            {/* 저장 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveForm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveQuery}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 