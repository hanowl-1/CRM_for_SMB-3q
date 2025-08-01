'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MappingTemplateManager } from '@/components/workflow/mapping-template-manager';
import TemplateEditorModal from '@/components/workflow/template-editor-modal';
import type { VariableMappingTemplate } from '@/lib/types/workflow';
import { Settings, BookOpen, Plus } from 'lucide-react';

export default function TemplatesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<VariableMappingTemplate | null>(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  const handleTemplateSelect = (template: VariableMappingTemplate) => {
    setEditingTemplate(template);
  };

  const handleTemplateSaved = (template: VariableMappingTemplate) => {
    setShowCreateModal(false);
    setEditingTemplate(null);
    // 템플릿 목록이 자동으로 새로고침됩니다
  };

  const handleApplyTemplate = (mappings: any[]) => {
    console.log('템플릿 적용:', mappings);
    // 여기서 적용된 매핑을 처리할 수 있습니다
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BookOpen className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">변수 매핑 템플릿</h1>
            <p className="text-gray-600 mt-1">
              자주 사용하는 변수 매핑 설정을 템플릿으로 저장하고 관리하세요
            </p>
          </div>
        </div>

        {/* 통계 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Settings className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">전체 템플릿</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">공개 템플릿</p>
                  <p className="text-2xl font-bold">8</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Plus className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">내 템플릿</p>
                  <p className="text-2xl font-bold">4</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Settings className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">이번 달 사용</p>
                  <p className="text-2xl font-bold">47</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 템플릿 관리 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplateManager(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            템플릿 관리
          </button>
        </div>
      </div>

      {/* 템플릿 목록 표시 영역 */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">템플릿 관리</h3>
            <p className="text-gray-600 mb-4">
              위의 "템플릿 관리" 버튼을 클릭하여 템플릿을 관리하세요.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 템플릿 매니저 모달 */}
      <MappingTemplateManager
        currentMappings={[]}
        onApplyTemplate={handleApplyTemplate}
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
      />

      {/* 템플릿 생성/편집 모달 */}
      <TemplateEditorModal
        isOpen={showCreateModal || editingTemplate !== null}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTemplate(null);
        }}
        template={editingTemplate}
        onSave={handleTemplateSaved}
      />
    </div>
  );
} 