"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Save,
  FolderOpen,
  Star,
  Copy,
  Trash2,
  Plus,
  Search,
  Filter,
  Eye,
  Clock,
  Users,
  Tag,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TargetTemplateMapping } from "@/lib/types/workflow";
import type { VariableMappingTemplate } from "@/lib/types/workflow";

interface MappingTemplate {
  id: string; // Make id required
  name: string;
  description?: string;
  category: string;
  tags: string[];
  variableMappings: {
    templateVariable: string;
    sourceField: string;
    sourceType: "field" | "query" | "function";
    defaultValue?: string;
    formatter?: "text" | "number" | "currency" | "date";
  }[];
  isPublic: boolean;
  isFavorite: boolean;
  usageCount?: number;
  lastUsedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MappingTemplateManagerProps {
  mode: "select" | "manage";
  currentMappings: string[]; // 변수 이름 목록
  onApplyTemplate: (template: VariableMappingTemplate) => void;
  onSelectTemplate?: (template: VariableMappingTemplate) => void;
}

export function MappingTemplateManager({
  mode = "manage",
  currentMappings,
  onApplyTemplate,
  onSelectTemplate,
}: MappingTemplateManagerProps) {
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<MappingTemplate[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [showPublic, setShowPublic] = useState(false);

  // 저장 모달 상태
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({
    name: "",
    description: "",
    category: "general",
    tags: [] as string[],
    isPublic: false,
    isFavorite: false,
  });

  // 미리보기 모달 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] =
    useState<MappingTemplate | null>(null);

  // 태그 입력 상태
  const [tagInput, setTagInput] = useState("");

  // 카테고리 옵션
  const categories = [
    { value: "all", label: "전체" },
    { value: "general", label: "일반" },
    { value: "performance", label: "성과" },
    { value: "welcome", label: "환영" },
    { value: "payment", label: "결제" },
    { value: "notification", label: "알림" },
    { value: "marketing", label: "마케팅" },
  ];

  // 템플릿 목록 로드
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all")
        params.append("category", selectedCategory);
      if (searchTerm) params.append("search", searchTerm);
      if (showPublic) params.append("isPublic", "true");
      if (showFavorites) params.append("isFavorite", "true");

      const response = await fetch(`/api/mapping-templates?${params}`);
      const result = await response.json();

      if (result.success) {
        setTemplates(result.templates);
        console.log("✅ 매핑 템플릿 로드 성공:", result.templates.length);
      } else {
        console.error("❌ 템플릿 로드 실패:", result.error);
      }
    } catch (error) {
      console.error("❌ 템플릿 로드 오류:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchTerm, showPublic, showFavorites]);

  // 필터링된 템플릿 업데이트
  useEffect(() => {
    let filtered = templates;

    if (searchTerm) {
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          template.description
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          template.tags.some((tag) =>
            tag.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }

    if (showFavorites) {
      filtered = filtered.filter((template) => template.isFavorite);
    }

    if (showPublic) {
      filtered = filtered.filter((template) => template.isPublic);
    }

    setFilteredTemplates(filtered);
  }, [templates, searchTerm, showFavorites, showPublic]);

  // 초기 로드
  useEffect(() => {
    if (mode === "manage") {
      loadTemplates();
    }
  }, [mode, loadTemplates]);

  // 템플릿 저장
  const handleSaveTemplate = async () => {
    if (!saveForm.name || currentMappings.length === 0) {
      alert("템플릿 이름과 매핑 정보가 필요합니다.");
      return;
    }

    try {
      const templateData: MappingTemplate = {
        id: `template_${Date.now()}`, // 임시 ID 생성
        name: saveForm.name,
        description: saveForm.description,
        category: saveForm.category,
        tags: saveForm.tags,
        variableMappings: currentMappings.map((name) => ({
          templateVariable: name,
          sourceField: name,
          sourceType: "field",
          formatter: "text",
          defaultValue: "",
        })),
        isPublic: saveForm.isPublic,
        isFavorite: saveForm.isFavorite,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch("/api/mapping-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateData),
      });

      const result = await response.json();

      if (result.success) {
        console.log("✅ 템플릿 저장 성공");
        setShowSaveModal(false);
        setSaveForm({
          name: "",
          description: "",
          category: "general",
          tags: [],
          isPublic: false,
          isFavorite: false,
        });
        loadTemplates(); // 목록 새로고침
      } else {
        alert(`저장 실패: ${result.error}`);
      }
    } catch (error) {
      console.error("❌ 템플릿 저장 오류:", error);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  // 템플릿 적용
  const handleApplyTemplate = async (template: MappingTemplate) => {
    try {
      // 사용량 증가
      await fetch(`/api/mapping-templates/${template.id}/use`, {
        method: "POST",
      });

      // 매핑 적용 - 타입 변환
      const variableMappingTemplate: VariableMappingTemplate = {
        id: template.id,
        name: template.name,
        description: template.description || "",
        category: template.category,
        variableMappings: template.variableMappings,
        isPublic: template.isPublic,
        isFavorite: template.isFavorite,
        createdAt: template.createdAt || new Date().toISOString(),
        updatedAt: template.updatedAt || new Date().toISOString(),
        tags: template.tags,
        usageCount: template.usageCount || 0,
        lastUsedAt: template.lastUsedAt || null,
      };

      onApplyTemplate(variableMappingTemplate);

      console.log("✅ 템플릿 적용 성공:", template.name);
    } catch (error) {
      console.error("❌ 템플릿 적용 오류:", error);
    }
  };

  // 템플릿 삭제
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("정말로 이 템플릿을 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(`/api/mapping-templates?id=${templateId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        console.log("✅ 템플릿 삭제 성공");
        loadTemplates(); // 목록 새로고침
      } else {
        alert(`삭제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error("❌ 템플릿 삭제 오류:", error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  // 태그 추가
  const handleAddTag = () => {
    if (tagInput.trim() && !saveForm.tags.includes(tagInput.trim())) {
      setSaveForm((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput("");
    }
  };

  // 태그 제거
  const handleRemoveTag = (tagToRemove: string) => {
    setSaveForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  // 미리보기 표시
  const handlePreviewTemplate = (template: MappingTemplate) => {
    setPreviewTemplate(template);
    setShowPreviewModal(true);
  };

  return (
    <>
      <Dialog open={mode === "manage"} onOpenChange={() => {}}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              매핑 템플릿 관리
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="browse" className="h-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="browse">템플릿 찾아보기</TabsTrigger>
                <TabsTrigger value="save">현재 매핑 저장</TabsTrigger>
              </TabsList>

              <TabsContent value="browse" className="space-y-4 mt-4">
                {/* 검색 및 필터 */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="템플릿 이름, 설명, 태그로 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={showFavorites}
                      onCheckedChange={setShowFavorites}
                    />
                    <Star className="w-4 h-4" />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={showPublic}
                      onCheckedChange={setShowPublic}
                    />
                    <Users className="w-4 h-4" />
                  </div>
                </div>

                {/* 템플릿 목록 */}
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-500">
                        템플릿을 불러오는 중...
                      </p>
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-8">
                      <FolderOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">저장된 템플릿이 없습니다.</p>
                    </div>
                  ) : (
                    filteredTemplates.map((template) => (
                      <Card
                        key={template.id}
                        className="border-l-4 border-l-blue-500"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">{template.name}</h4>
                                {template.isFavorite && (
                                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                )}
                                {template.isPublic && (
                                  <Users className="w-4 h-4 text-green-500" />
                                )}
                                <Badge variant="outline">
                                  {template.category}
                                </Badge>
                              </div>

                              {template.description && (
                                <p className="text-sm text-gray-600 mb-2">
                                  {template.description}
                                </p>
                              )}

                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Copy className="w-3 h-3" />
                                  {template.variableMappings?.length || 0}개
                                  매핑
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  사용 {template.usageCount || 0}회
                                </span>
                                {template.lastUsedAt && (
                                  <span>
                                    최근 사용:{" "}
                                    {new Date(
                                      template.lastUsedAt
                                    ).toLocaleDateString()}
                                  </span>
                                )}
                              </div>

                              {template.tags && template.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {template.tags.map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      <Tag className="w-3 h-3 mr-1" />
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePreviewTemplate(template)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApplyTemplate(template)}
                              >
                                적용
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  handleDeleteTemplate(template.id)
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="save" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="templateName">템플릿 이름 *</Label>
                    <Input
                      id="templateName"
                      placeholder="예: 성과 분석 매핑"
                      value={saveForm.name}
                      onChange={(e) =>
                        setSaveForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="templateDescription">설명</Label>
                    <Textarea
                      id="templateDescription"
                      placeholder="이 템플릿에 대한 설명을 입력하세요..."
                      value={saveForm.description}
                      onChange={(e) =>
                        setSaveForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="templateCategory">카테고리</Label>
                    <Select
                      value={saveForm.category}
                      onValueChange={(value) =>
                        setSaveForm((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter((c) => c.value !== "all")
                          .map((category) => (
                            <SelectItem
                              key={category.value}
                              value={category.value}
                            >
                              {category.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>태그</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="태그 입력 후 Enter"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                      />
                      <Button type="button" onClick={handleAddTag}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {saveForm.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {tag}
                          <X
                            className="w-3 h-3 cursor-pointer"
                            onClick={() => handleRemoveTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isPublic"
                        checked={saveForm.isPublic}
                        onCheckedChange={(checked) =>
                          setSaveForm((prev) => ({
                            ...prev,
                            isPublic: checked,
                          }))
                        }
                      />
                      <Label htmlFor="isPublic">공개 템플릿</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isFavorite"
                        checked={saveForm.isFavorite}
                        onCheckedChange={(checked) =>
                          setSaveForm((prev) => ({
                            ...prev,
                            isFavorite: checked,
                          }))
                        }
                      />
                      <Label htmlFor="isFavorite">즐겨찾기</Label>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">저장될 매핑 정보</h4>
                    <p className="text-sm text-gray-600">
                      현재 설정된 {currentMappings.length}개의 매핑이 템플릿으로
                      저장됩니다.
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveTemplate}
                    disabled={!saveForm.name || currentMappings.length === 0}
                    className="w-full"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    템플릿 저장
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {}}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mode === "select" && (
        <div className="space-y-4">
          {/* 검색 및 필터 */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="템플릿 이름, 설명, 태그로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                checked={showFavorites}
                onCheckedChange={setShowFavorites}
              />
              <Star className="w-4 h-4" />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={showPublic} onCheckedChange={setShowPublic} />
              <Users className="w-4 h-4" />
            </div>
          </div>

          {/* 템플릿 목록 */}
          <div className="max-h-96 overflow-y-auto space-y-3">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">
                  템플릿을 불러오는 중...
                </p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">저장된 템플릿이 없습니다.</p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="border-l-4 border-l-blue-500"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{template.name}</h4>
                          {template.isFavorite && (
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          )}
                          {template.isPublic && (
                            <Users className="w-4 h-4 text-green-500" />
                          )}
                          <Badge variant="outline">{template.category}</Badge>
                        </div>

                        {template.description && (
                          <p className="text-sm text-gray-600 mb-2">
                            {template.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Copy className="w-3 h-3" />
                            {template.variableMappings?.length || 0}개 매핑
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            사용 {template.usageCount || 0}회
                          </span>
                          {template.lastUsedAt && (
                            <span>
                              최근 사용:{" "}
                              {new Date(
                                template.lastUsedAt
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {template.tags && template.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs"
                              >
                                <Tag className="w-3 h-3 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePreviewTemplate(template)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApplyTemplate(template)}
                        >
                          적용
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>템플릿 미리보기: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">기본 정보</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">카테고리:</span>{" "}
                    {previewTemplate.category}
                  </div>
                  <div>
                    <span className="font-medium">사용 횟수:</span>{" "}
                    {previewTemplate.usageCount || 0}회
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">설명:</span>{" "}
                    {previewTemplate.description || "설명 없음"}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">매핑 정보</h4>
                <div className="space-y-2">
                  {previewTemplate.variableMappings.map((mapping, index) => (
                    <Card key={index} className="p-3">
                      <div className="text-sm">
                        <div className="font-medium mb-1">
                          매핑 {index + 1}: {mapping.templateVariable}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline">
                              #{mapping.templateVariable}
                            </Badge>
                            <span>→</span>
                            <span>{mapping.sourceField}</span>
                            <Badge variant="secondary">
                              {mapping.sourceType}
                            </Badge>
                            {mapping.formatter && (
                              <Badge variant="outline">
                                {mapping.formatter}
                              </Badge>
                            )}
                            {mapping.defaultValue && (
                              <span className="text-gray-500">
                                (기본값: {mapping.defaultValue})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreviewModal(false)}
            >
              닫기
            </Button>
            {previewTemplate && (
              <Button
                onClick={() => {
                  handleApplyTemplate(previewTemplate);
                  setShowPreviewModal(false);
                }}
              >
                이 템플릿 적용
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
