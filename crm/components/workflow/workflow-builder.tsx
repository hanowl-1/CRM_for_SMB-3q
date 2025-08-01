"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Workflow,
  WorkflowTrigger,
  WorkflowStep,
  WorkflowTestSettings,
  WorkflowCondition,
  TargetGroup,
  ScheduleSettings,
  PersonalizationSettings,
  TargetTemplateMapping as TargetTemplateMappingType,
} from "@/lib/types/workflow";
import { KakaoTemplate } from "@/lib/types/template";
import { TemplateBrowser } from "@/components/templates/template-browser";
import { TemplateSelector } from "@/components/templates/template-selector";
import { VariableSettings } from "@/components/workflow/variable-settings";
import { VariableMapping } from "@/components/workflow/variable-mapping";
import { TargetSelection } from "./target-selection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Play,
  Plus,
  MessageSquare,
  Clock,
  Settings,
  Save,
  Eye,
  Trash2,
  Zap,
  Target,
  Calendar,
  Info,
  Users,
  TestTube,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Webhook,
} from "lucide-react";
import { mockTemplates } from "@/lib/data/mock-templates";
import { TargetTemplateMapping } from "./target-template-mapping";

interface WorkflowBuilderProps {
  workflow?: Workflow;
  onSave: (workflow: Workflow) => void;
  onTest?: (workflow: Workflow) => void;
}

// KakaoTemplate을 VariableMapping에서 사용하는 형태로 변환하는 헬퍼 함수
const convertToVariableMappingTemplate = (
  template: KakaoTemplate,
  existingPersonalization?: PersonalizationSettings
) => ({
  id: template.id,
  name: template.templateName,
  content: template.templateContent,
  category: template.category || "기타",
  variables: template.variables || [],
  personalization: existingPersonalization || template.personalization,
});

export function WorkflowBuilder({
  workflow,
  onSave,
  onTest,
}: WorkflowBuilderProps) {
  // 기본정보 탭
  const [activeTab, setActiveTab] = useState("basic");
  const [name, setName] = useState(workflow?.name || "");
  const [description, setDescription] = useState(workflow?.description || "");
  const [workflowStatus, setWorkflowStatus] = useState(
    workflow?.status || "draft"
  );
  const [triggerType, setTriggerType] = useState(
    workflow?.trigger_type || "manual"
  );

  // 템플릿 선택 탭
  const [selectedTemplates, setSelectedTemplates] = useState<KakaoTemplate[]>(
    workflow?.message_config?.selectedTemplates || []
  );
  const [steps, setSteps] = useState<WorkflowStep[]>(
    workflow?.message_config?.steps || []
  );

  // 대상 선정 탭
  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>(() => {
    // 기존 대상 그룹이 있으면 사용
    if (workflow?.target_config?.targetGroups?.length > 0) {
      return workflow.target_config.targetGroups;
    }

    // 웹훅 워크플로우인 경우 trigger_config에서 자동화 대상 그룹 생성
    if (workflow?.trigger_config?.eventType) {
      const eventType = workflow.trigger_config.eventType;
      const eventNames = {
        lead_created: "도입문의 완료",
        signup: "회원가입 완료",
      };

      return [
        {
          id: `automation_${eventType}`,
          name: `${eventNames[eventType] || eventType} 자동화`,
          type: "automation" as const,
          automationQuery: {
            event: eventType as "lead_created" | "signup",
            eventName: eventNames[eventType] || eventType,
          },
          estimatedCount: 0,
        },
      ];
    }

    return [];
  });

  // 대상-템플릿 매핑
  const [targetTemplateMappings, setTargetTemplateMappings] = useState<
    TargetTemplateMappingType[]
  >(workflow?.target_config?.targetTemplateMappings || []);

  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>(
    workflow?.schedule_config || {
      type: "immediate",
      timezone: "Asia/Seoul",
    }
  );

  //  템플릿별 개인화 설정
  const [templatePersonalizations, setTemplatePersonalizations] = useState<
    Record<string, PersonalizationSettings>
  >(workflow?.variables?.templatePersonalizations || {});

  // 테스트 설정
  const [testSettings, setTestSettings] = useState<WorkflowTestSettings>(() => {
    const defaultSettings = {
      testPhoneNumber: "010-1234-5678",
      testVariables: {},
      enableRealSending: false,
      fallbackToSMS: true,
      testMode: false,
      testNotes: "",
    };

    if (workflow?.variables?.testSettings) {
      return {
        ...defaultSettings,
        ...workflow.variables.testSettings,
        // 중요한 필드들은 반드시 문자열이어야 함
        testPhoneNumber:
          workflow.variables.testSettings.testPhoneNumber ||
          defaultSettings.testPhoneNumber,
        testNotes:
          workflow.variables.testSettings.testNotes ||
          defaultSettings.testNotes,
      };
    }

    return defaultSettings;
  });

  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showCoolSMSSelector, setShowCoolSMSSelector] = useState(false);
  const [showVariableSettings, setShowVariableSettings] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<KakaoTemplate | null>(
    null
  );

  // 템플릿별 변수 저장
  const [templateVariables, setTemplateVariables] = useState<
    Record<string, Record<string, string>>
  >({});

  // 미리보기 데이터
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [totalEstimatedCount, setTotalEstimatedCount] = useState(0);

  // console.log("🔥 workflow", workflow);

  // 기존 워크플로우 로드 시 변수와 개인화 설정 초기화
  useEffect(() => {
    if (workflow && workflow.message_config?.steps) {
      console.log("🔄 워크플로우 로드 시작:", {
        workflowId: workflow.id,
        workflowName: workflow.name,
        stepsCount: workflow.message_config?.steps.length,
      });

      const variables: Record<string, Record<string, string>> = {};
      const personalizations: Record<string, PersonalizationSettings> = {};
      const templates: KakaoTemplate[] = [];
      const mappings: TargetTemplateMappingType[] = [];

      workflow.message_config?.steps.forEach((step, index) => {
        console.log(`🔍 Step ${index + 1} 분석:`, {
          stepId: step.id,
          actionType: step.action.type,
          templateId: step.action.templateId,
        });

        if (step.action.templateId && step.action.type === "send_alimtalk") {
          // 변수 저장
          if (step.action.variables) {
            variables[step.action.templateId] = step.action.variables;
            console.log(
              `📝 변수 복원 (${step.action.templateId}):`,
              step.action.variables
            );
          }

          // 개인화 설정 저장
          if (step.action.personalization) {
            personalizations[step.action.templateId] =
              step.action.personalization;
            console.log(
              `⚙️ 개인화 설정 복원 (${step.action.templateId}):`,
              step.action.personalization
            );
          } else if (
            workflow.variables?.templatePersonalizations?.[
              step.action.templateId
            ]
          ) {
            // 워크플로우 레벨 개인화 설정 복원
            personalizations[step.action.templateId] =
              workflow.variables.templatePersonalizations[
                step.action.templateId
              ];
            console.log(
              `⚙️ 워크플로우 레벨 개인화 설정 복원 (${step.action.templateId}):`,
              workflow.variables.templatePersonalizations[
                step.action.templateId
              ]
            );
          }

          // 대상-템플릿 매핑 정보 복원
          const actionWithMappings = step.action as any;
          if (
            actionWithMappings.targetTemplateMappings &&
            Array.isArray(actionWithMappings.targetTemplateMappings)
          ) {
            actionWithMappings.targetTemplateMappings.forEach(
              (mapping: any) => {
                if (!mappings.find((m) => m.id === mapping.id)) {
                  mappings.push(mapping);
                }
              }
            );
            console.log(
              `🔗 매핑 정보 복원 (${step.action.templateId}):`,
              actionWithMappings.targetTemplateMappings.length
            );
          }

          // 템플릿 정보 복원 (mockTemplates에서 찾기)
          let templateInfo = mockTemplates.find(
            (t) => t.id === step.action.templateId
          );

          // 템플릿을 찾지 못한 경우, templateCode로도 시도
          if (!templateInfo && step.action.templateCode) {
            templateInfo = mockTemplates.find(
              (t) => t.templateCode === step.action.templateCode
            );
            console.log(
              `🔍 templateCode로 재검색 (${step.action.templateCode}):`,
              templateInfo ? "성공" : "실패"
            );
          }

          // 여전히 찾지 못한 경우, 템플릿 번호로 시도
          if (!templateInfo && step.action.templateId.includes("_")) {
            const parts = step.action.templateId.split("_");
            const templateNumber = parseInt(parts[parts.length - 1]);
            if (!isNaN(templateNumber)) {
              templateInfo = mockTemplates.find(
                (t) => t.templateNumber === templateNumber
              );
              console.log(
                `🔍 templateNumber로 재검색 (${templateNumber}):`,
                templateInfo ? "성공" : "실패"
              );
            }
          }

          if (
            templateInfo &&
            !templates.find((t) => t.id === templateInfo.id)
          ) {
            const templateWithPersonalization = {
              ...templateInfo,
              personalization: step.action.personalization,
            };
            templates.push(templateWithPersonalization);
            console.log(`✅ 템플릿 복원 성공:`, {
              templateId: templateInfo.id,
              templateName: templateInfo.templateName,
              templateCode: templateInfo.templateCode,
            });
          } else if (!templateInfo) {
            console.error(`❌ 템플릿을 찾을 수 없음:`, {
              templateId: step.action.templateId,
              templateCode: step.action.templateCode,
              templateName: step.action.templateName,
              availableTemplates: mockTemplates.length,
            });

            // 사용 가능한 템플릿 ID들을 로그로 출력 (디버깅용)
            console.log(
              "📋 사용 가능한 템플릿 ID 목록 (처음 5개):",
              mockTemplates.slice(0, 5).map((t) => ({
                id: t.id,
                code: t.templateCode,
                name: t.templateName,
              }))
            );
          }
        }
      });

      // 기존 워크플로우에서 매핑 정보 복원
      if (workflow.mapping_config?.targetTemplateMappings) {
        mappings.push(...workflow.mapping_config.targetTemplateMappings);
        console.log(
          "🔗 워크플로우 레벨 대상-템플릿 매핑 복원:",
          workflow.mapping_config.targetTemplateMappings.length
        );
      }

      setTemplateVariables(variables);
      setTemplatePersonalizations(personalizations);
      setSelectedTemplates(templates);
      setTargetTemplateMappings(mappings);

      console.log("🔄 워크플로우 로드 완료:", {
        templates: templates.length,
        variables: Object.keys(variables).length,
        personalizations: Object.keys(personalizations).length,
        mappings: mappings.length,
        loadedTemplates: templates.map((t) => ({
          id: t.id,
          name: t.templateName,
        })),
      });

      // 대상 그룹 복원
      if (workflow.target_config?.targetGroups?.length > 0) {
        setTargetGroups(workflow.target_config.targetGroups);
        console.log(
          "👥 대상 그룹 복원:",
          workflow.target_config.targetGroups.length
        );
      } else if (workflow.trigger_config?.eventType) {
        // 웹훅 워크플로우인 경우 trigger_config에서 자동화 대상 그룹 생성
        const eventType = workflow.trigger_config.eventType;
        const eventNames = {
          lead_created: "도입문의 완료",
          signup: "회원가입 완료",
        };

        const automationTarget = {
          id: `automation_${eventType}`,
          name: `${eventNames[eventType] || eventType} 자동화`,
          type: "automation" as const,
          automationQuery: {
            event: eventType as "lead_created" | "signup",
            eventName: eventNames[eventType] || eventType,
          },
          estimatedCount: 0,
        };

        setTargetGroups([automationTarget]);
        console.log("🤖 자동화 대상 그룹 생성:", automationTarget);
      }

      // 스케줄 설정 복원
      if (workflow.schedule_config) {
        console.log("⏰ 스케줄 설정 복원:", {
          타입: workflow.schedule_config.type,
          예약시간: workflow.schedule_config.scheduledTime,
          반복패턴: workflow.schedule_config.recurringPattern,
        });
        setScheduleSettings(workflow.schedule_config);
      } else {
        console.log("⏰ 워크플로우에 스케줄 설정이 없음, 기본값 사용");
      }

      // 테스트 설정 복원
      if (workflow.variables?.testSettings) {
        setTestSettings(workflow.variables.testSettings);
        console.log("🧪 테스트 설정 복원:", workflow.variables.testSettings);
      }
    }
  }, [workflow]);

  // 탭 완료 상태 체크
  const isTabComplete = (tabId: string) => {
    const isEditMode = !!workflow?.id; // 수정 모드 vs 생성 모드 구분

    // 필수 전단계 탭들의 완료 상태 체크
    const isBasicComplete =
      (name || "").trim() !== "" && (description || "").trim() !== "";
    const isTemplatesComplete = selectedTemplates.length > 0;

    // 🔥 대상 설정 완료 체크: 모드별로 다르게 처리
    let isTargetsComplete = false;
    if (isEditMode) {
      // 수정 모드: webhook은 무조건 완료, manual은 데이터 기반
      isTargetsComplete =
        triggerType === "webhook" ? true : targetGroups.length > 0;
    } else {
      // 생성 모드: manual, webhook 상관없이 실제 대상 선택 필요
      isTargetsComplete = targetGroups.length > 0;
    }

    // 핵심 3단계(기본정보, 템플릿선택, 대상설정)가 모두 완료되었는지
    const coreStepsComplete =
      isBasicComplete && isTemplatesComplete && isTargetsComplete;

    switch (tabId) {
      case "basic":
        return isBasicComplete;
      case "templates":
        return isTemplatesComplete;
      case "targets":
        return isTargetsComplete;
      case "mapping":
        // 🔥 매핑 설정 완료 체크: 모드별로 다르게 처리
        if (isEditMode) {
          // 수정 모드: webhook은 무조건 완료, manual은 데이터 기반
          if (triggerType === "webhook") {
            return true; // webhook은 무조건 완료
          } else {
            // manual 수정 모드: 데이터 기반으로 판단
            return coreStepsComplete;
          }
        } else {
          // 생성 모드: manual, webhook 상관없이 이전 단계 완료 필요
          return coreStepsComplete;
        }

      case "schedule":
        // 🔥 핵심 3단계가 완료되어야 체크표시 나타남
        return coreStepsComplete;
      case "review":
        // 🔥 핵심 3단계가 완료되고 테스트 전화번호도 입력되어야 체크표시
        return (
          coreStepsComplete &&
          (testSettings?.testPhoneNumber || "").trim() !== ""
        );
      default:
        return false;
    }
  };

  const handleTemplateSelect = (template: KakaoTemplate) => {
    if (!selectedTemplates.find((t) => t.id === template.id)) {
      // 기존 개인화 설정이 있는지 확인
      const existingPersonalization = templatePersonalizations[template.id];

      const templateWithPersonalization = {
        ...template,
        personalization: existingPersonalization,
      };

      setSelectedTemplates([...selectedTemplates, templateWithPersonalization]);

      console.log(
        `📋 템플릿 ${template.id} 선택됨, 기존 개인화 설정:`,
        existingPersonalization ? "있음" : "없음"
      );
    }
    setShowTemplateSelector(false);
  };

  const removeTemplate = (templateId: string) => {
    setSelectedTemplates(selectedTemplates.filter((t) => t.id !== templateId));
    // 해당 템플릿의 개인화 설정도 제거
    const newPersonalizations = { ...templatePersonalizations };
    delete newPersonalizations[templateId];
    setTemplatePersonalizations(newPersonalizations);
  };

  const handleVariablesChange = (variables: Record<string, string>) => {
    if (currentStepIndex !== null) {
      const updatedSteps = [...steps];
      updatedSteps[currentStepIndex].action.variables = variables;
      setSteps(updatedSteps);
    }
  };

  const handleVariableSettingsClose = () => {
    setShowVariableSettings(false);
    setCurrentStepIndex(null);
    setCurrentTemplate(null);
  };

  const openVariableSettings = (template: KakaoTemplate) => {
    setCurrentTemplate(template);
    setShowVariableSettings(true);
  };

  // 새로운 함수: 개인화 설정 변경 핸들러를 useCallback으로 메모이제이션
  const handlePersonalizationChange = useCallback(
    (templateId: string, settings: PersonalizationSettings) => {
      console.log(`🔧 템플릿 ${templateId} 개인화 설정 변경:`, {
        enabled: settings.enabled,
        mappingsCount: settings.variableMappings.length,
        mappings: settings.variableMappings,
      });

      setTemplatePersonalizations((prev) => {
        const updated = {
          ...prev,
          [templateId]: settings,
        };
        console.log(`💾 개인화 설정 저장 완료:`, updated);
        return updated;
      });

      // 개인화 설정에서 변수 추출하여 저장 (모든 값 타입 고려)
      const variables: Record<string, string> = {};
      settings.variableMappings.forEach((mapping) => {
        const variableName = mapping.templateVariable.replace(/^#{|}$/g, "");

        // 우선순위: actualValue > defaultValue > sourceField > 빈 문자열
        if (mapping.actualValue) {
          variables[variableName] = mapping.actualValue;
        } else if (mapping.defaultValue) {
          variables[variableName] = mapping.defaultValue;
        } else if (mapping.sourceField) {
          variables[variableName] = mapping.sourceField;
        } else {
          variables[variableName] = "";
        }
      });

      setTemplateVariables((prev) => {
        const updated = {
          ...prev,
          [templateId]: variables,
        };
        console.log(`🔧 템플릿 ${templateId} 변수 저장:`, variables);
        return updated;
      });

      // 선택된 템플릿 목록에서 해당 템플릿의 개인화 설정도 업데이트
      setSelectedTemplates((prev) => {
        const updated = prev.map((template) =>
          template.id === templateId
            ? { ...template, personalization: settings }
            : template
        );
        console.log(`📋 선택된 템플릿 목록 업데이트 완료`);
        return updated;
      });
    },
    []
  );

  // 워크플로우 저장 관련 상태
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(
    workflow?.id || null
  );
  // 변경사항 추적 상태
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 워크플로우 저장 함수
  const saveWorkflow = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      // 🔥 선택된 템플릿들로부터 steps 생성
      const templateSteps: WorkflowStep[] = selectedTemplates.map(
        (template, index) => ({
          id: `step_${template.id}_${Date.now()}`,
          name: `${template.templateName} 발송`,
          action: {
            id: `action_${template.id}_${Date.now()}`,
            type: "send_alimtalk",
            templateId: template.id,
            templateCode: template.templateCode,
            templateName: template.templateName,
            variables: templateVariables[template.id] || {},
            scheduleSettings: scheduleSettings,
            personalization: templatePersonalizations[template.id],
          },
          position: { x: 100, y: index * 150 + 100 },
        })
      );

      const workflowData = {
        name: name || "임시 워크플로우",
        description: description || "",
        selectedTemplates,
        targetGroups,
        templatePersonalizations,
        targetTemplateMappings,
        scheduleSettings,
        testSettings,
        steps: templateSteps, // 🔥 steps 추가
      };

      console.log("💾 워크플로우 저장 데이터:", {
        name: workflowData.name,
        targetGroupsCount: workflowData.targetGroups.length,
        templatesCount: workflowData.selectedTemplates.length,
        stepsCount: workflowData.steps.length,
        mappingsCount: workflowData.targetTemplateMappings.length,
      });

      // REST API 원칙에 따라 새 생성과 수정을 분리
      const isUpdate = workflowId ? true : false;

      const response = await fetch(
        isUpdate
          ? `/api/supabase/workflows/${workflowId}` // PUT for update
          : "/api/supabase/workflows", // POST for create
        {
          method: isUpdate ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(workflowData), // action, id 파라미터 제거
        }
      );

      const result = await response.json();

      if (result.success) {
        if (!workflowId) {
          setWorkflowId(result.data.id);
        }
        setLastSaved(new Date().toLocaleTimeString());
        setHasUnsavedChanges(false); // 저장 완료 시 변경사항 리셋
        console.log("✅ 워크플로우 저장 완료");
        return true;
      } else {
        console.error("❌ 워크플로우 저장 실패:", result.error);
        return false;
      }
    } catch (error) {
      console.error("❌ 워크플로우 저장 오류:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    name,
    description,
    selectedTemplates,
    targetGroups,
    templatePersonalizations,
    targetTemplateMappings,
    scheduleSettings,
    testSettings,
    workflowId,
  ]);

  // 탭 변경 시 저장하지 않음 (수동 저장으로 변경)
  const handleTabChange = useCallback(
    (newTab: string) => {
      // 🔥 동적 탭 순서 사용
      const tabs = getTabOrder();
      const currentIndex = tabs.indexOf(activeTab);
      const newIndex = tabs.indexOf(newTab);

      //  뒤로 가는 경우는 항상 허용
      if (newIndex <= currentIndex) {
        setActiveTab(newTab);
        return;
      }

      // 🔥 앞으로 가는 경우, 이전 탭들이 모두 완료되어야 함
      for (let i = 0; i < newIndex; i++) {
        if (!isTabComplete(tabs[i])) {
          console.log(
            `❌ ${tabs[i]} 탭이 완료되지 않아 ${newTab} 탭으로 이동할 수 없습니다`
          );
          // 🔥 완료되지 않은 첫 번째 탭으로 이동
          setActiveTab(tabs[i]);
          return;
        }
      }

      // 탭 이동 (자동저장 제거됨)
      setActiveTab(newTab);
    },
    [activeTab, isTabComplete]
  );

  // 탭이 클릭 가능한지 체크하는 함수
  const isTabClickable = (tabId: string) => {
    const isEditMode = !!workflow?.id; // 수정 모드 vs 생성 모드 구분

    // 수정 모드에서는 모든 탭 클릭 가능 (데이터 기반으로 표시)
    if (isEditMode) {
      return true;
    }

    // 생성 모드에서는 순차적 진행만 허용
    // 🔥 동적 탭 순서 사용
    const tabs = getTabOrder();
    const targetIndex = tabs.indexOf(tabId);
    const currentIndex = tabs.indexOf(activeTab);

    // 현재 탭이거나 뒤로 가는 경우는 항상 클릭 가능
    if (targetIndex <= currentIndex) return true;

    // 앞으로 가는 경우, 이전 탭들이 모두 완료되어야 함
    for (let i = 0; i < targetIndex; i++) {
      if (!isTabComplete(tabs[i])) return false;
    }

    return true;
  };

  // 테스트용 워크플로우 객체 생성 함수
  const buildWorkflowForTest = (): Workflow => {
    const templateSteps: WorkflowStep[] = selectedTemplates.map(
      (template, index) => ({
        id: `step_${template.id}_${Date.now()}`,
        name: `${template.templateName} 발송`,
        action: {
          id: `action_${template.id}_${Date.now()}`,
          type: "send_alimtalk",
          templateId: template.id,
          templateCode: template.templateCode,
          templateName: template.templateName,
          variables: templateVariables[template.id] || {},
          // 스케줄 테스트 모드가 활성화된 경우 스케줄 설정 사용, 아니면 즉시 발송
          scheduleSettings:
            testSettings.testMode && scheduleSettings.type !== "immediate"
              ? scheduleSettings
              : { type: "immediate", timezone: "Asia/Seoul" },
          personalization: templatePersonalizations[template.id],
        },
        position: { x: 100, y: index * 150 + 100 },
      })
    );

    const getTriggerInfoForTest = () => {
      const effectiveScheduleSettings =
        testSettings.testMode && scheduleSettings.type !== "immediate"
          ? scheduleSettings
          : { type: "immediate" as const, timezone: "Asia/Seoul" };

      if (effectiveScheduleSettings.type === "immediate") {
        return {
          type: "manual" as const,
          name: "수동 실행 (테스트)",
          description: "테스트용 수동 실행",
        };
      } else {
        const delay =
          "delay" in effectiveScheduleSettings
            ? effectiveScheduleSettings.delay
            : 0;
        return {
          type: "schedule" as const,
          name:
            effectiveScheduleSettings.type === "delay"
              ? `지연 테스트 (${delay}분 후)`
              : effectiveScheduleSettings.type === "scheduled"
              ? "예약 테스트"
              : effectiveScheduleSettings.type === "recurring"
              ? "반복 테스트"
              : "스케줄 테스트",
          description:
            effectiveScheduleSettings.type === "delay"
              ? `${delay}분 후 테스트 실행`
              : effectiveScheduleSettings.type === "scheduled"
              ? "예약된 시간에 테스트 실행"
              : effectiveScheduleSettings.type === "recurring"
              ? "반복 일정에 따라 테스트 실행"
              : "스케줄에 따라 테스트 실행",
        };
      }
    };

    const testTriggerInfo = getTriggerInfoForTest();
    const defaultTrigger: WorkflowTrigger = {
      id: "trigger_test",
      type: testTriggerInfo.type,
      name: testTriggerInfo.name,
      description: testTriggerInfo.description,
      conditions: [],
      conditionLogic: "AND",
    };

    return {
      // id: workflow?.id || `workflow_test_${Date.now()}`,
      name: `${name} (테스트)`,
      description: `${description} - 테스트 실행`,
      status: "draft",
      trigger: defaultTrigger,
      targetGroups,
      steps: templateSteps,
      testSettings,
      // 스케줄 테스트 모드에 따라 스케줄 설정 적용
      scheduleSettings:
        testSettings.testMode && scheduleSettings.type !== "immediate"
          ? scheduleSettings
          : { type: "immediate", timezone: "Asia/Seoul" },
      createdAt: workflow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // stats: {
      //   totalRuns: 0,
      //   successRate: 0,
      // },
    };
  };

  const handleTest = () => {
    if (onTest) {
      // 스케줄 테스트 모드가 활성화되어 있고, 즉시 발송이 아닌 경우
      if (testSettings.testMode && scheduleSettings.type !== "immediate") {
        // 스케줄 테스트 확인 메시지
        const confirmMessage =
          `스케줄 설정대로 테스트를 진행하시겠습니까?\n\n` +
          `${
            scheduleSettings.type === "delay"
              ? `${scheduleSettings.delay}분 후에`
              : scheduleSettings.type === "scheduled"
              ? `${scheduleSettings.scheduledTime}에`
              : "다음 반복 시간에"
          } 테스트 메시지가 발송됩니다.\n\n` +
          `즉시 테스트를 원하시면 "스케줄 설정대로 테스트" 옵션을 해제해주세요.`;

        if (!confirm(confirmMessage)) {
          return;
        }
      }

      const workflowData = buildWorkflowForTest();
      onTest(workflowData);
    }
  };

  const canProceedToNext = (currentTab: string) => {
    return isTabComplete(currentTab);
  };

  // const hasAutomationTargets = () => {
  //   return targetGroups.some((group) => group.type === "automation");
  // };

  // 🔥 모든 타입에서 6개 탭 사용
  const getTabOrder = () => {
    return ["basic", "templates", "targets", "mapping", "schedule", "review"];
  };

  const getNextTab = (currentTab: string) => {
    const tabs = getTabOrder(); // 🔥 동적 탭 순서 사용
    const currentIndex = tabs.indexOf(currentTab);
    return currentIndex < tabs.length - 1 ? tabs[currentIndex + 1] : null;
  };

  // 매핑 변경 핸들러
  const handleMappingChange = useCallback(
    (mappings: TargetTemplateMappingType[]) => {
      console.log("🔗 매핑 변경 핸들러 호출:", {
        mappingsLength: mappings.length,
        mappings: mappings.map((m) => ({
          id: m.id,
          targetGroupId: m.targetGroupId,
          templateId: m.templateId,
          fieldMappingsCount: m.fieldMappings.length,
        })),
      });
      setTargetTemplateMappings(mappings);
    },
    []
  );

  // 미리보기 데이터 로드 함수
  const loadPreviewData = async () => {
    if (targetGroups.length === 0 || selectedTemplates.length === 0) {
      setPreviewData([]);
      setTotalEstimatedCount(0);
      return;
    }

    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      console.log("🔄 미리보기 데이터 로드 시작:", {
        targetGroupsCount: targetGroups.length,
        templatesCount: selectedTemplates.length,
        mappingsCount: targetTemplateMappings.length,
        templateVariablesCount: Object.keys(templateVariables).length,
        targetGroups: targetGroups.map((g) => ({
          id: g.id,
          name: g.name,
          type: g.type,
        })),
        templates: selectedTemplates.map((t) => ({
          id: t.id,
          name: t.templateName,
        })),
        mappings: targetTemplateMappings.map((m) => ({
          id: m.id,
          targetGroupId: m.targetGroupId,
          templateId: m.templateId,
          fieldMappingsCount: m.fieldMappings.length,
        })),
      });

      const response = await fetch("/api/workflow/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetGroups,
          templates: selectedTemplates,
          templatePersonalizations, // 🔥 템플릿 개인화 설정 (API 명세서 준수)
          targetTemplateMappings,
          limit: 5,
        }),
      });

      console.log(
        "🌐 미리보기 API 응답 상태:",
        response.status,
        response.statusText
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ 미리보기 API 응답 오류:", response.status, errorText);
        throw new Error(
          `미리보기 데이터를 불러오는데 실패했습니다. (${response.status})`
        );
      }

      const result = await response.json();

      console.log("📦 미리보기 API 전체 응답:", result);
      console.log("📊 미리보기 API 상세 분석:", {
        success: result.success,
        dataExists: !!result.data,
        dataLength: result.data?.length || 0,
        totalEstimatedCount: result.totalEstimatedCount,
        errorMessage: result.error,
        rawData: result.data,
      });

      if (result.success) {
        console.log("✅ 미리보기 데이터 로드 성공:", {
          previewCount: result.data?.length || 0,
          totalEstimatedCount: result.totalEstimatedCount || 0,
          hasData: result.data && result.data.length > 0,
          sampleData: result.data?.[0] || null,
        });

        setPreviewData(result.data.data);
        setTotalEstimatedCount(result.data.totalEstimatedCount || 0);
      } else {
        console.error("❌ 미리보기 API 응답 실패:", result);
        throw new Error(result.error || "미리보기 데이터 로드 실패");
      }
    } catch (error) {
      console.error("❌ 미리보기 로드 오류:", error);
      setPreviewError(
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다."
      );
      setPreviewData([]);
      setTotalEstimatedCount(0);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const getTriggerConfig = () => {
    if (triggerType === "webhook") {
      const automationTarget = targetGroups.find(
        (group) => group.type === "automation"
      );
      const eventType = automationTarget?.automationQuery?.event;
      console.log("🔥 자동화 이벤트 타입:", eventType);
      return {
        eventType: eventType,
      };
    } else {
      // Manual/Schedule일 때는 빈 객체
      return {};
    }
  };

  const getTargetConfig = () => {
    if (triggerType === "webhook") {
      // 🔥 webhook일 때: target_config 비워둠
      return {};
    } else {
      // 🔥 manual, schedule일 때: targetGroups 설정
      return {
        targetGroups,
        targetTemplateMappings,
      };
    }
  };

  const isScheduleTypeEnabled = (scheduleType: string) => {
    if (triggerType === "webhook") {
      // webhook 타입일 때는 immediate와 delay만 허용
      return scheduleType === "immediate";
    }
    // manual 타입일 때는 모든 스케줄 타입 허용
    return true;
  };

  // 대상 그룹이나 템플릿, 매핑 정보가 변경될 때 미리보기 데이터 다시 로드
  useEffect(() => {
    if (activeTab === "review") {
      console.log("📊 리뷰 탭에서 미리보기 자동 로드 트리거:", {
        targetGroupsCount: targetGroups.length,
        templatesCount: selectedTemplates.length,
        mappingsCount: targetTemplateMappings.length,
      });
      loadPreviewData();
    }
  }, [
    activeTab,
    targetGroups.length,
    selectedTemplates.length,
    targetTemplateMappings.length,
    // 배열의 내용이 변경되었는지 확인하기 위한 안정적인 키
    targetGroups.map((g) => g.id).join(","),
    selectedTemplates.map((t) => t.id).join(","),
    targetTemplateMappings
      .map(
        (m) => `${m.targetGroupId}-${m.templateId}-${m.fieldMappings.length}`
      )
      .join(","),
  ]);

  // 변경사항 추적 - 주요 상태가 변경될 때 unsaved 플래그 설정 -> UI를 위한 코드 (굳이 없어도 되는 코드)
  useEffect(() => {
    // 초기 로드 시에는 변경사항으로 처리하지 않음
    if (workflow && !hasUnsavedChanges) return;

    // 기본 정보나 설정이 변경되면 unsaved 표시
    if (
      name ||
      description ||
      selectedTemplates.length > 0 ||
      targetGroups.length > 0
    ) {
      setHasUnsavedChanges(true);
    }
  }, [
    name,
    description,
    selectedTemplates.length,
    targetGroups.length,
    templatePersonalizations,
    targetTemplateMappings.length,
    scheduleSettings,
    testSettings,
  ]);

  // 페이지 나가기 전 경고 (저장되지 않은 변경사항이 있을 때)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "저장되지 않은 변경사항이 있습니다. 정말 나가시겠습니까?";
        return "저장되지 않은 변경사항이 있습니다. 정말 나가시겠습니까?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  return (
    <div className="space-y-6">
      {/* 워크플로우 빌더 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">워크플로우 빌더</h1>
          <p className="text-muted-foreground mt-1">
            개인화된 알림톡 발송 워크플로우를 설정하세요
          </p>
          {/* 저장 상태 표시 */}
          <div className="flex items-center gap-4 mt-2 text-sm">
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <span className="text-orange-600">저장되지 않은 변경사항</span>
              </div>
            )}
            {lastSaved && !hasUnsavedChanges && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="text-green-600">마지막 저장: {lastSaved}</span>
              </div>
            )}
            {workflowId && (
              <span className="text-xs text-muted-foreground">
                ID: {workflowId.slice(0, 8)}...
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            기본정보
            {isTabComplete("basic") && (
              <CheckCircle className="w-3 h-3 text-green-600" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            disabled={!isTabClickable("templates")}
            className={
              !isTabClickable("templates")
                ? "flex items-center gap-2 opacity-50 cursor-not-allowed"
                : "flex items-center gap-2"
            }
          >
            <MessageSquare className="w-4 h-4" />
            알림톡 선택
            {isTabComplete("templates") && (
              <CheckCircle className="w-3 h-3 text-green-600" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="targets"
            disabled={!isTabClickable("targets")}
            className={
              !isTabClickable("targets")
                ? "flex items-center gap-2 opacity-50 cursor-not-allowed"
                : "flex items-center gap-2"
            }
          >
            <Users className="w-4 h-4" />
            대상 선정
            {isTabComplete("targets") && (
              <CheckCircle className="w-3 h-3 text-green-600" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="mapping"
            className="flex items-center gap-2"
            disabled={!isTabClickable("mapping")}
          >
            매핑 설정 확인
            {isTabComplete("mapping") && (
              <CheckCircle className="w-3 h-3 text-green-600" />
            )}
          </TabsTrigger>

          <TabsTrigger
            value="schedule"
            className="flex items-center gap-2"
            disabled={!isTabClickable("schedule")}
          >
            <Calendar className="w-4 h-4" />
            스케줄러
            {isTabComplete("schedule") && (
              <CheckCircle className="w-3 h-3 text-green-600" />
            )}
          </TabsTrigger>

          <TabsTrigger
            value="review"
            className="flex items-center gap-2"
            disabled={!isTabClickable("review")}
          >
            <CheckCircle className="w-4 h-4" />
            최종 확인
            {isTabComplete("review") && (
              <CheckCircle className="w-3 h-3 text-green-600" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* 기본 정보 탭 */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>워크플로우 기본 정보</CardTitle>
              <p className="text-sm text-muted-foreground">
                워크플로우의 이름과 목적을 설정하세요
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  워크플로우 이름 *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 신규 회원 환영 메시지"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">설명 *</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="이 워크플로우가 무엇을 하는지 설명해주세요"
                  rows={3}
                />
              </div>

              {/* 🔥 워크플로우 상태 선택 추가 */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  워크플로우 상태 *
                </label>
                <Select
                  value={workflowStatus}
                  onValueChange={(
                    value: "draft" | "active" | "paused" | "archived"
                  ) => setWorkflowStatus(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="상태를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                        <span>초안 (Draft)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>활성 (Active)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="paused">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <span>일시정지 (Paused)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="archived">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span>보관됨 (Archived)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {workflowStatus === "draft" &&
                    "초안 상태입니다. 스케줄러에 등록되지 않습니다."}
                  {workflowStatus === "active" &&
                    "활성 상태입니다. 스케줄 설정에 따라 자동 실행됩니다."}
                  {workflowStatus === "paused" &&
                    "일시정지 상태입니다. 스케줄 실행이 중단됩니다."}
                  {workflowStatus === "archived" &&
                    "보관된 상태입니다. 실행되지 않습니다."}
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>실행 방식 *</Label>
                    <Select
                      value={triggerType}
                      onValueChange={(value: "manual" | "webhook") =>
                        setTriggerType(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="실행 방식을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="manual"
                          className="flex items-center gap-2"
                        >
                          <Zap className="w-4 h-4" />
                          조건 만족시 검색 및 발송
                        </SelectItem>
                        <SelectItem
                          value="webhook"
                          className="flex items-center gap-2"
                        >
                          <Webhook className="w-4 h-4" />
                          이벤트 발생 시 자동 발송
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-sm text-muted-foreground">
                      {triggerType === "manual"
                        ? "워크플로우가 활성화되면 설정된 조건의 대상자를 검색하여 메시지를 발송합니다."
                        : "특정 이벤트(회원가입, 도입문의 등)가 발생하면 자동으로 메시지를 발송합니다."}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() =>
                canProceedToNext("basic") && setActiveTab("templates")
              }
              disabled={!canProceedToNext("basic")}
            >
              다음: 알림톡 선택
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </TabsContent>

        {/* 알림톡 선택 탭 */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>알림톡 템플릿 선택</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    이 워크플로우에서 발송할 알림톡 템플릿을 선택하세요
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setShowTemplateSelector(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    템플릿 추가
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCoolSMSSelector(true)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    CoolSMS 템플릿
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    선택된 템플릿이 없습니다
                  </p>
                  <p className="text-sm mb-4">
                    워크플로우에서 사용할 알림톡 템플릿을 선택해주세요
                  </p>
                  <Button onClick={() => setShowTemplateSelector(true)}>
                    <Plus className="w-4 h-4 mr-2" />첫 번째 템플릿 선택
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {selectedTemplates.map((template, index) => (
                    <div
                      key={template.id}
                      className="border rounded-lg p-6 space-y-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-lg">
                              {template.templateName}
                            </h4>
                            <Badge variant="outline">
                              {template.templateCode}
                            </Badge>
                            <Badge variant="secondary">
                              {template.category}
                            </Badge>
                          </div>

                          <p className="text-sm text-muted-foreground mb-3">
                            {template.templateContent.substring(0, 100)}...
                          </p>

                          {/* 템플릿 변수 표시 */}
                          {template.variables &&
                            template.variables.length > 0 && (
                              <div className="mb-3">
                                <p className="text-sm font-medium text-muted-foreground mb-2">
                                  템플릿 변수:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {template.variables.map((variable) => (
                                    <Badge
                                      key={variable}
                                      variant="outline"
                                      className="text-xs font-mono"
                                    >
                                      {variable}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                          {/* 개인화 설정 상태 표시 */}
                          {templatePersonalizations[template.id]?.enabled && (
                            <div className="mb-3">
                              <Badge variant="secondary" className="text-xs">
                                개인화 활성화 (
                                {
                                  templatePersonalizations[template.id]
                                    .variableMappings.length
                                }
                                개 변수 매핑됨)
                              </Badge>
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTemplate(template.id)}
                          title="템플릿 제거"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* 변수 매핑 컴포넌트 */}
                      <div className="border-t pt-4">
                        <VariableMapping
                          selectedTemplate={convertToVariableMappingTemplate(
                            template,
                            templatePersonalizations[template.id]
                          )}
                          onMappingChange={(settings) =>
                            handlePersonalizationChange(template.id, settings)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setActiveTab("basic")}>
              이전: 기본정보
            </Button>
            <Button
              onClick={() =>
                canProceedToNext("templates") && setActiveTab("targets")
              }
              disabled={!canProceedToNext("templates")}
            >
              다음: 대상 선정
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </TabsContent>

        {/* 대상 선정 탭 */}
        <TabsContent value="targets" className="space-y-6">
          <TargetSelection
            onTargetsChange={setTargetGroups}
            currentTargets={targetGroups}
            triggerType={triggerType}
          />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setActiveTab("templates")}>
              이전: 알림톡 선택
            </Button>
            <Button
              onClick={() =>
                canProceedToNext("targets") && setActiveTab("mapping")
              }
              disabled={!canProceedToNext("targets")}
            >
              다음: 매핑 설정 확인
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </TabsContent>

        {/* 매핑 탭 */}
        <TabsContent value="mapping" className="space-y-6">
          <TargetTemplateMapping
            targetGroups={targetGroups}
            selectedTemplates={selectedTemplates}
            currentMappings={targetTemplateMappings}
            onMappingChange={handleMappingChange}
            templatePersonalizations={templatePersonalizations}
          />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setActiveTab("targets")}>
              이전: 대상 선정
            </Button>
            <Button
              onClick={() =>
                canProceedToNext("mapping") && setActiveTab("schedule")
              }
              disabled={!canProceedToNext("mapping")}
            >
              다음: 스케줄러 설정
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </TabsContent>

        {/* 스케줄러 설정 탭 */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>워크플로우 스케줄 설정</CardTitle>
              <p className="text-sm text-muted-foreground">
                워크플로우가 언제 실행될지 설정하세요
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 현재 트리거 상태 표시 */}
              <div
                className={`${
                  triggerType === "webhook"
                    ? "bg-orange-50 border-orange-200"
                    : "bg-blue-50 border-blue-200"
                } border rounded-lg p-4`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {triggerType === "webhook" ? (
                    <Webhook className="w-4 h-4 text-orange-600" />
                  ) : (
                    <Zap className="w-4 h-4 text-blue-600" />
                  )}
                  <span
                    className={`font-medium ${
                      triggerType === "webhook"
                        ? "text-orange-900"
                        : "text-blue-900"
                    }`}
                  >
                    현재 트리거 설정
                  </span>
                </div>
                <div
                  className={`text-sm ${
                    triggerType === "webhook"
                      ? "text-orange-800"
                      : "text-blue-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">트리거 타입:</span>
                    <Badge
                      variant="outline"
                      className={`${
                        triggerType === "webhook" ? "bg-orange-50" : "bg-white"
                      }`}
                    >
                      {triggerType === "webhook"
                        ? "웹훅 트리거"
                        : scheduleSettings.type === "immediate"
                        ? "수동 실행"
                        : scheduleSettings.type === "delay"
                        ? `지연 실행 (${scheduleSettings.delay}분 후)`
                        : scheduleSettings.type === "scheduled"
                        ? "예약 실행"
                        : scheduleSettings.type === "recurring"
                        ? "반복 실행"
                        : "스케줄 실행"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs">
                    {triggerType === "webhook"
                      ? "외부 이벤트 발생 시 자동으로 실행되는 워크플로우입니다."
                      : scheduleSettings.type === "immediate"
                      ? "워크플로우가 활성화되면 조건에 맞는 대상에게 즉시 메시지가 발송됩니다."
                      : scheduleSettings.type === "delay"
                      ? `저장 후 ${scheduleSettings.delay}분 후에 자동으로 실행됩니다.`
                      : scheduleSettings.type === "scheduled"
                      ? "지정된 날짜와 시간에 자동으로 실행됩니다."
                      : scheduleSettings.type === "recurring"
                      ? "설정된 반복 일정에 따라 자동으로 실행됩니다."
                      : "스케줄에 따라 자동으로 실행됩니다."}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-4">실행 방식 선택</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      scheduleSettings.type === "immediate"
                        ? "border-blue-500 bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      console.log("🔄 스케줄 타입 변경: immediate");
                      setScheduleSettings({
                        type: "immediate",
                        timezone: "Asia/Seoul",
                      });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 ${
                          scheduleSettings.type === "immediate"
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300"
                        }`}
                      />
                      <div>
                        <h4 className="font-medium">즉시 발송</h4>
                        <p className="text-sm text-muted-foreground">
                          조건 만족시 발송
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-4 border rounded-lg transition-colors ${
                      scheduleSettings.type === "delay"
                        ? "border-blue-500 bg-blue-50"
                        : isScheduleTypeEnabled("delay")
                        ? "hover:bg-gray-50 cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() => {
                      if (isScheduleTypeEnabled("delay")) {
                        console.log("🔄 스케줄 타입 변경: delay");
                        setScheduleSettings({
                          type: "delay",
                          scheduledTime: scheduleSettings.scheduledTime || "",
                          timezone: "Asia/Seoul",
                        });
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 ${
                          scheduleSettings.type === "delay"
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300"
                        }`}
                      />
                      <div>
                        <h4 className="font-medium">지연 발송</h4>
                        <p className="text-sm text-muted-foreground">
                          일정 시간 후 발송
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-4 border rounded-lg transition-colors ${
                      scheduleSettings.type === "scheduled"
                        ? "border-blue-500 bg-blue-50"
                        : isScheduleTypeEnabled("scheduled")
                        ? "hover:bg-gray-50 cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() => {
                      if (isScheduleTypeEnabled("scheduled")) {
                        console.log("🔄 스케줄 타입 변경: scheduled");
                        setScheduleSettings({
                          type: "scheduled",
                          scheduledTime: scheduleSettings.scheduledTime || "",
                          timezone: "Asia/Seoul",
                        });
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 ${
                          scheduleSettings.type === "scheduled"
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300"
                        }`}
                      />
                      <div>
                        <h4 className="font-medium">예약 발송</h4>
                        <p className="text-sm text-muted-foreground">
                          특정 날짜와 시간에 발송
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-4 border rounded-lg transition-colors ${
                      scheduleSettings.type === "recurring"
                        ? "border-blue-500 bg-blue-50"
                        : isScheduleTypeEnabled("recurring")
                        ? "hover:bg-gray-50 cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() => {
                      if (isScheduleTypeEnabled("recurring")) {
                        console.log("🔄 스케줄 타입 변경: recurring");
                        setScheduleSettings({
                          type: "recurring",
                          recurringPattern:
                            scheduleSettings.recurringPattern || {
                              frequency: "daily",
                              interval: 1,
                              time: "09:00",
                            },
                          timezone: "Asia/Seoul",
                        });
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 ${
                          scheduleSettings.type === "recurring"
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300"
                        }`}
                      />
                      <div>
                        <h4 className="font-medium">반복 발송</h4>
                        <p className="text-sm text-muted-foreground">
                          정기적으로 반복 발송
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 지연 발송 설정 */}
              {scheduleSettings.type === "delay" && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    지연 시간
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={scheduleSettings.delay || 60}
                      onChange={(e) =>
                        setScheduleSettings({
                          ...scheduleSettings,
                          delay: parseInt(e.target.value) || 60,
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      분 후 발송
                    </span>
                  </div>
                </div>
              )}

              {/* 예약 발송 설정 */}
              {scheduleSettings.type === "scheduled" && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    예약 일시 (한국시간 KST)
                  </label>
                  <Input
                    type="datetime-local"
                    value={
                      // 🔥 datetime-local input은 "YYYY-MM-DDTHH:mm" 형태만 인식하므로 시간대 정보 제거
                      scheduleSettings.scheduledTime
                        ? scheduleSettings.scheduledTime.replace(
                            /\+\d{2}:\d{2}$/,
                            ""
                          )
                        : ""
                    }
                    onChange={(e) => {
                      // 🔥 한국시간대를 명시하여 저장
                      const localTimeValue = e.target.value; // "2025-06-30T17:30"
                      const kstTimeValue = localTimeValue
                        ? `${localTimeValue}+09:00`
                        : ""; // "2025-06-30T17:30+09:00"
                      console.log("⏰ 스케줄 시간 입력:", {
                        원본입력: localTimeValue,
                        한국시간대명시: kstTimeValue,
                      });
                      setScheduleSettings({
                        ...scheduleSettings,
                        scheduledTime: kstTimeValue,
                      });
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    설정된 시간은 한국시간(KST) 기준으로 실행됩니다
                  </p>
                </div>
              )}

              {/* 반복 발송 설정 */}
              {scheduleSettings.type === "recurring" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      반복 주기
                    </label>
                    <Select
                      value={
                        scheduleSettings.recurringPattern?.frequency || "daily"
                      }
                      onValueChange={(value: "daily" | "weekly" | "monthly") =>
                        setScheduleSettings({
                          ...scheduleSettings,
                          recurringPattern: {
                            ...scheduleSettings.recurringPattern,
                            frequency: value,
                            interval: 1,
                            time: "09:00",
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">매일</SelectItem>
                        <SelectItem value="weekly">매주</SelectItem>
                        <SelectItem value="monthly">매월</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      발송 시간 (한국시간 KST)
                    </label>
                    <Input
                      type="time"
                      value={scheduleSettings.recurringPattern?.time || "09:00"}
                      onChange={(e) =>
                        setScheduleSettings({
                          ...scheduleSettings,
                          recurringPattern: {
                            ...scheduleSettings.recurringPattern!,
                            time: e.target.value,
                          },
                        })
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      설정된 시간은 한국시간(KST) 기준으로 실행됩니다
                    </p>
                  </div>

                  {scheduleSettings.recurringPattern?.frequency ===
                    "weekly" && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        요일 선택
                      </label>
                      <div className="flex gap-2">
                        {["일", "월", "화", "수", "목", "금", "토"].map(
                          (day, index) => (
                            <Button
                              key={index}
                              variant={
                                scheduleSettings.recurringPattern?.daysOfWeek?.includes(
                                  index
                                )
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => {
                                const currentDays =
                                  scheduleSettings.recurringPattern
                                    ?.daysOfWeek || [];
                                const newDays = currentDays.includes(index)
                                  ? currentDays.filter((d) => d !== index)
                                  : [...currentDays, index];

                                setScheduleSettings({
                                  ...scheduleSettings,
                                  recurringPattern: {
                                    ...scheduleSettings.recurringPattern!,
                                    daysOfWeek: newDays,
                                  },
                                });
                              }}
                            >
                              {day}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {scheduleSettings.recurringPattern?.frequency ===
                    "monthly" && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        매월 몇 일
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={
                          scheduleSettings.recurringPattern?.dayOfMonth || 1
                        }
                        onChange={(e) =>
                          setScheduleSettings({
                            ...scheduleSettings,
                            recurringPattern: {
                              ...scheduleSettings.recurringPattern!,
                              dayOfMonth: parseInt(e.target.value) || 1,
                            },
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setActiveTab("mapping")}>
              이전: 매핑 설정 확인
            </Button>
            <Button onClick={() => setActiveTab("review")}>
              다음: 최종 확인
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </TabsContent>

        {/* 최종 확인 탭 */}
        <TabsContent value="review" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>워크플로우 전체 설정 요약</CardTitle>
              <p className="text-sm text-muted-foreground">
                설정한 워크플로우의 모든 정보를 확인하고 테스트를 진행하세요
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 기본 정보 */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-lg mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  기본 정보
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      워크플로우 이름
                    </label>
                    <p className="text-sm mt-1">{name || "미설정"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      상태
                    </label>
                    <div className="text-sm mt-1">
                      <Badge
                        variant={
                          workflowStatus === "active" ? "default" : "outline"
                        }
                        className={`
                        ${
                          workflowStatus === "active"
                            ? "bg-green-100 text-green-800 border-green-300"
                            : ""
                        }
                        ${
                          workflowStatus === "paused"
                            ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                            : ""
                        }
                        ${
                          workflowStatus === "archived"
                            ? "bg-red-100 text-red-800 border-red-300"
                            : ""
                        }
                        ${
                          workflowStatus === "draft"
                            ? "bg-gray-100 text-gray-800 border-gray-300"
                            : ""
                        }
                      `}
                      >
                        <div className="flex items-center gap-1">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              workflowStatus === "active"
                                ? "bg-green-500"
                                : workflowStatus === "paused"
                                ? "bg-yellow-500"
                                : workflowStatus === "archived"
                                ? "bg-red-500"
                                : "bg-gray-400"
                            }`}
                          ></div>
                          {workflowStatus === "draft" && "초안"}
                          {workflowStatus === "active" && "활성"}
                          {workflowStatus === "paused" && "일시정지"}
                          {workflowStatus === "archived" && "보관됨"}
                        </div>
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    설명
                  </label>
                  <p className="text-sm mt-1">{description || "미설정"}</p>
                </div>
              </div>

              {/* 대상 그룹 */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-lg mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  대상 그룹 ({targetGroups.length}개)
                </h4>
                {targetGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    선택된 대상 그룹이 없습니다
                  </p>
                ) : (
                  <div className="space-y-2">
                    {targetGroups.map((group, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {group.type === "static" ? "정적" : "동적"}
                        </Badge>
                        <span className="text-sm">{group.name}</span>
                        {group.estimatedCount && (
                          <span className="text-xs text-muted-foreground">
                            ({group.estimatedCount}명)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 알림톡 템플릿 */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-lg mb-3 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  알림톡 템플릿 ({selectedTemplates.length}개)
                </h4>
                {selectedTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    선택된 템플릿이 없습니다
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedTemplates.map((template, index) => (
                      <div
                        key={template.id}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {template.templateName}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {template.templateCode}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {template.templateContent.substring(0, 80)}...
                          </p>
                          {template.variables &&
                            template.variables.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {template.variables
                                  .slice(0, 3)
                                  .map((variable) => (
                                    <Badge
                                      key={variable}
                                      variant="outline"
                                      className="text-xs font-mono"
                                    >
                                      {variable}
                                    </Badge>
                                  ))}
                                {template.variables.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{template.variables.length - 3}개 더
                                  </Badge>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 스케줄러 설정 */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-lg mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  스케줄러 설정
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      발송 타입
                    </label>
                    <p className="text-sm mt-1">
                      {scheduleSettings.type === "immediate" && "즉시 발송"}
                      {scheduleSettings.type === "delay" &&
                        `지연 발송 (${scheduleSettings.delay}분 후)`}
                      {scheduleSettings.type === "scheduled" &&
                        `예약 발송 (${scheduleSettings.scheduledTime})`}
                      {scheduleSettings.type === "recurring" && "반복 발송"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      타임존
                    </label>
                    <p className="text-sm mt-1">{scheduleSettings.timezone}</p>
                  </div>
                </div>
                {scheduleSettings.type === "recurring" &&
                  scheduleSettings.recurringPattern && (
                    <div className="mt-3">
                      <label className="text-sm font-medium text-muted-foreground">
                        반복 패턴
                      </label>
                      <p className="text-sm mt-1">
                        {scheduleSettings.recurringPattern.frequency ===
                          "daily" && "매일"}
                        {scheduleSettings.recurringPattern.frequency ===
                          "weekly" && "매주"}
                        {scheduleSettings.recurringPattern.frequency ===
                          "monthly" && "매월"}{" "}
                        {scheduleSettings.recurringPattern.time}에 발송
                      </p>
                    </div>
                  )}
              </div>

              {/* 테스트 설정 */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-lg mb-3 flex items-center gap-2">
                  <TestTube className="w-5 h-5" />
                  테스트 설정
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      테스트 수신 번호 *
                    </label>
                    <Input
                      value={testSettings.testPhoneNumber}
                      onChange={(e) =>
                        setTestSettings({
                          ...testSettings,
                          testPhoneNumber: e.target.value,
                        })
                      }
                      placeholder="010-1234-5678"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="real-sending"
                      checked={testSettings.enableRealSending}
                      onCheckedChange={(checked) =>
                        setTestSettings({
                          ...testSettings,
                          enableRealSending: checked,
                        })
                      }
                    />
                    <Label htmlFor="real-sending">
                      실제 메시지 발송 (체크 해제 시 시뮬레이션만)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="fallback-sms"
                      checked={testSettings.fallbackToSMS}
                      onCheckedChange={(checked) =>
                        setTestSettings({
                          ...testSettings,
                          fallbackToSMS: checked,
                        })
                      }
                    />
                    <Label htmlFor="fallback-sms">
                      알림톡 실패 시 SMS로 대체 발송
                    </Label>
                  </div>

                  {/* 스케줄 테스트 옵션 추가 */}
                  {scheduleSettings.type !== "immediate" && (
                    <div className="border-t pt-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Switch
                          id="test-schedule"
                          checked={testSettings.testMode}
                          onCheckedChange={(checked) =>
                            setTestSettings({
                              ...testSettings,
                              testMode: checked,
                            })
                          }
                        />
                        <Label htmlFor="test-schedule">
                          스케줄 설정대로 테스트 (체크 해제 시 즉시 테스트)
                        </Label>
                      </div>
                      {testSettings.testMode && (
                        <div className="ml-6 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {scheduleSettings.type === "delay" &&
                                `${scheduleSettings.delay}분 후에 테스트 메시지가 발송됩니다`}
                              {scheduleSettings.type === "scheduled" &&
                                `${scheduleSettings.scheduledTime}에 테스트 메시지가 발송됩니다`}
                              {scheduleSettings.type === "recurring" &&
                                "다음 반복 시간에 테스트 메시지가 발송됩니다"}
                            </span>
                          </div>
                          <p className="text-xs text-orange-600">
                            ⚠️ 스케줄 테스트는 실제 스케줄러에 등록되어 설정된
                            시간에 발송됩니다.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      테스트 메모
                    </label>
                    <Textarea
                      value={testSettings.testNotes || ""}
                      onChange={(e) =>
                        setTestSettings({
                          ...testSettings,
                          testNotes: e.target.value,
                        })
                      }
                      placeholder="테스트에 대한 메모를 작성하세요"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* 발송 미리보기 */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-lg flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    발송 미리보기
                    {isLoadingPreview && (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadPreviewData}
                    disabled={
                      isLoadingPreview ||
                      selectedTemplates.length === 0 ||
                      targetGroups.length === 0
                    }
                    className="flex items-center gap-2"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${
                        isLoadingPreview ? "animate-spin" : ""
                      }`}
                    />
                    미리보기 새로고침
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  실제 수신자 데이터를 기반으로 개인화된 메시지를 미리
                  확인하세요
                </p>

                {previewError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">미리보기 로드 실패</span>
                    </div>
                    <p className="text-sm text-red-600 mt-1">{previewError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={loadPreviewData}
                    >
                      다시 시도
                    </Button>
                  </div>
                )}

                {/* 현재 설정 상태 표시 */}
                <div className="bg-gray-50 border rounded-lg p-3 mb-4">
                  <h5 className="text-sm font-medium mb-2">현재 설정 상태</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          targetGroups.length > 0
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      />
                      <span>대상 그룹: {targetGroups.length}개</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          selectedTemplates.length > 0
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      />
                      <span>템플릿: {selectedTemplates.length}개</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          targetTemplateMappings.length > 0
                            ? "bg-green-500"
                            : "bg-yellow-500"
                        }`}
                      />
                      <span>매핑: {targetTemplateMappings.length}개</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          Object.keys(templateVariables).length > 0
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      />
                      <span>
                        변수: {Object.keys(templateVariables).length}개
                      </span>
                    </div>
                  </div>
                  {targetTemplateMappings.length === 0 &&
                    targetGroups.some((g) => g.type === "dynamic") && (
                      <p className="text-xs text-yellow-600 mt-2">
                        💡 동적 대상 그룹이 있지만 매핑이 설정되지 않았습니다.
                        "변수-대상 매핑" 탭에서 설정해주세요.
                      </p>
                    )}
                </div>

                {selectedTemplates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>선택된 템플릿이 없습니다</p>
                  </div>
                ) : targetGroups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>선택된 대상 그룹이 없습니다</p>
                  </div>
                ) : isLoadingPreview ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p>실제 수신자 데이터를 불러오는 중...</p>
                  </div>
                ) : previewData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">
                      미리보기 데이터가 없습니다
                    </h3>

                    {targetGroups.some((g) => g.type === "dynamic") ? (
                      <div className="space-y-3">
                        <p className="text-sm">
                          동적 대상 그룹이 설정되어 있지만 조회된 데이터가
                          없습니다.
                        </p>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left max-w-md mx-auto">
                          <h4 className="font-medium text-yellow-800 mb-2">
                            확인해보세요:
                          </h4>
                          <ul className="text-sm text-yellow-700 space-y-1">
                            <li>• 대상 그룹의 SQL 쿼리가 올바른지 확인</li>
                            <li>• 쿼리 결과에 실제 데이터가 있는지 확인</li>
                            <li>• MySQL 연결이 정상적인지 확인</li>
                            {targetTemplateMappings.length === 0 && (
                              <li>
                                • "대상-템플릿 매핑" 탭에서 매핑 설정 완료
                              </li>
                            )}
                          </ul>
                        </div>

                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveTab("targets")}
                          >
                            대상 그룹 확인
                          </Button>
                          {targetTemplateMappings.length === 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveTab("mapping")}
                            >
                              매핑 설정
                            </Button>
                          )}
                          <Button size="sm" onClick={loadPreviewData}>
                            다시 시도
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm">
                          정적 대상 그룹만 설정되어 있습니다.
                        </p>
                        <p className="text-xs">
                          동적 쿼리 기반 대상 그룹을 추가하면 미리보기를 확인할
                          수 있습니다.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveTab("targets")}
                        >
                          대상 그룹 설정
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* 전체 요약 정보 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-medium text-blue-900">
                            발송 예정 요약
                          </h5>
                          <p className="text-sm text-blue-700">
                            총 {totalEstimatedCount}명의 수신자에게{" "}
                            {selectedTemplates.length}개의 템플릿으로 발송 예정
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-900">
                            {totalEstimatedCount}
                          </div>
                          <div className="text-xs text-blue-600">
                            예상 수신자
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 개인화된 메시지 미리보기 */}
                    <div className="space-y-4">
                      <h5 className="font-medium flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        개인화된 메시지 미리보기 (최대 5명)
                      </h5>

                      {previewData.map((contactPreview, contactIndex) => (
                        <div
                          key={contactIndex}
                          className="border rounded-lg p-4 bg-gray-50"
                        >
                          {/* 수신자 정보 */}
                          <div className="flex items-center justify-between mb-3 pb-3 border-b">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                                {contactIndex + 1}
                              </div>
                              <div>
                                <div className="font-medium">
                                  {contactPreview.contact.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {contactPreview.contact.phone}
                                  {contactPreview.contact.company &&
                                    ` • ${contactPreview.contact.company}`}
                                </div>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {contactPreview.groupName}
                            </Badge>
                          </div>

                          {/* 개인화된 메시지들 */}
                          <div className="space-y-3">
                            {contactPreview.messages.map(
                              (message: any, messageIndex: number) => (
                                <div
                                  key={message.templateId}
                                  className="bg-white border rounded-lg p-3"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-medium">
                                      {messageIndex + 1}
                                    </div>
                                    <span className="font-medium text-sm">
                                      {message.templateName}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {message.templateCode}
                                    </Badge>
                                  </div>

                                  <div className="bg-white border-2 border-blue-200 rounded-lg p-4 mb-3">
                                    <div className="text-sm font-medium text-gray-600 mb-2">
                                      📱 개인화된 메시지
                                    </div>
                                    <div className="text-sm whitespace-pre-wrap leading-relaxed bg-gray-50 p-3 rounded border">
                                      {message.processedContent}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                      글자 수: {message.characterCount}자
                                    </span>
                                    <span>
                                      변수{" "}
                                      {
                                        Object.keys(message.variables || {})
                                          .length
                                      }
                                      개 적용
                                    </span>
                                  </div>

                                  {/* 적용된 변수 표시 */}
                                  {Object.keys(message.variables || {}).length >
                                    0 && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                                        적용된 변수 보기
                                      </summary>
                                      <div className="mt-2 pt-2 border-t">
                                        <div className="flex flex-wrap gap-1">
                                          {Object.entries(
                                            message.variables || {}
                                          ).map(
                                            ([key, value]: [string, any]) => (
                                              <div
                                                key={key}
                                                className="bg-blue-50 border rounded px-2 py-1 text-xs"
                                              >
                                                <span className="font-mono text-blue-600">
                                                  #{key}
                                                </span>
                                                <span className="text-muted-foreground mx-1">
                                                  →
                                                </span>
                                                <span className="font-medium">
                                                  {String(value)}
                                                </span>
                                              </div>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    </details>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      ))}

                      {previewData.length > 0 &&
                        totalEstimatedCount > previewData.length && (
                          <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg bg-gray-50">
                            <Info className="w-4 h-4 mx-auto mb-1" />
                            <p>
                              위 미리보기는 {previewData.length}명의 샘플입니다.
                            </p>
                            <p>
                              실제로는 총 {totalEstimatedCount}명에게
                              발송됩니다.
                            </p>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setActiveTab("schedule")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              이전: 스케줄러 설정
            </Button>
            <div className="flex gap-3">
              {onTest && (
                <>
                  <Button
                    onClick={() => {
                      const testWorkflow = {
                        id: workflow?.id || "",
                        name: `${name} (테스트)`,
                        description: `${description} - 테스트 실행`,
                        status: workflowStatus,
                        trigger_type: triggerType,
                        targetGroups,
                        steps,
                        testSettings,
                        scheduleSettings,
                      };

                      onTest(testWorkflow);
                    }}
                    variant="outline"
                    className="bg-blue-50 border-blue-200 hover:bg-blue-100"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    테스트 번호로 발송
                  </Button>
                </>
              )}
              {/* 워크플로우 저장 버튼 */}
              <Button
                onClick={() => {
                  try {
                    const workflowData: Workflow = {
                      id: workflow?.id || "",
                      name,
                      description,
                      status: workflowStatus,
                      trigger_type: triggerType,
                      trigger_config: getTriggerConfig(),
                      target_config: getTargetConfig(),
                      schedule_config: scheduleSettings,
                      variables: {
                        templatePersonalizations,
                        testSettings,
                      },
                      createdBy: "user",
                      message_config: {
                        steps: selectedTemplates.map((template, index) => ({
                          id: `step_${template.id}_${Date.now()}`,
                          name: `${template.templateName} 발송`,
                          action: {
                            id: `action_${template.id}_${Date.now()}`,
                            type: "send_alimtalk",
                            templateId: template.id,
                            templateCode: template.templateCode,
                            templateName: template.templateName,
                            variables: templateVariables[template.id] || {},
                            scheduleSettings: scheduleSettings,
                            personalization:
                              templatePersonalizations[template.id],
                          } as any,
                          position: { x: 100, y: index * 150 + 100 },
                        })),
                        selectedTemplates,
                      },
                    };

                    // console.log("🚀 워크플로우 저장 데이터:", {
                    //   name: workflowData.name,
                    //   templatePersonalizations:
                    //     workflowData.templatePersonalizations,
                    //   stepsWithPersonalization: workflowData.steps.map(
                    //     (step) => ({
                    //       templateId: step.action.templateId,
                    //       hasPersonalization: !!step.action.personalization,
                    //       personalization: step.action.personalization,
                    //     })
                    //   ),
                    // });

                    onSave(workflowData);
                    console.log("✅ 워크플로우 저장 완료");
                  } catch (error) {
                    console.error("🔥 저장 버튼 클릭 중 오류:", error);
                    alert(
                      `저장 중 오류 발생: ${
                        error instanceof Error ? error.message : String(error)
                      }`
                    );
                  }
                }}
              >
                <Save className="w-4 h-4 mr-2" />
                {workflow?.id ? "워크플로우 수정" : "워크플로우 저장"}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 템플릿 선택 다이얼로그 */}
      <Dialog
        open={showTemplateSelector}
        onOpenChange={setShowTemplateSelector}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>알림톡 템플릿 선택</DialogTitle>
          </DialogHeader>
          <TemplateBrowser
            onSelect={handleTemplateSelect}
            showSelectButton={true}
            isDialogMode={true}
          />
        </DialogContent>
      </Dialog>

      {/* CoolSMS 템플릿 선택 다이얼로그 */}
      <Dialog open={showCoolSMSSelector} onOpenChange={setShowCoolSMSSelector}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CoolSMS 알림톡 템플릿 선택</DialogTitle>
          </DialogHeader>
          <TemplateSelector
            onSelect={(template) => {
              // CoolSMS 템플릿을 KakaoTemplate 형식으로 변환
              const kakaoTemplate: KakaoTemplate = {
                id: template.template_id,
                // templateId: template.template_id,
                templateCode: template.template_id,
                templateName: template.template_name,
                templateContent: template.content,
                templateParams: template.variables,
                channel: template.channel as "CEO" | "BLOGGER",
                channelId: "",
                servicePlatform: "MEMBERS" as const,
                templateNumber: 0,
                templateTitle: template.template_name,
              };
              handleTemplateSelect(kakaoTemplate);
              setShowCoolSMSSelector(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* 변수 설정 다이얼로그 */}
      <Dialog
        open={showVariableSettings}
        onOpenChange={setShowVariableSettings}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              변수 설정 - {currentTemplate?.templateName}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <VariableSettings
              templateContent={currentTemplate?.templateContent || ""}
              variables={currentTemplate ? {} : {}}
              testSettings={testSettings}
              onVariablesChange={handleVariablesChange}
              onTestSettingsChange={setTestSettings}
            />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={handleVariableSettingsClose}>
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
