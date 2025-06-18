'use client';

import { useState, useCallback, useEffect } from 'react';
import { Workflow, WorkflowTrigger, WorkflowStep, WorkflowTestSettings, WorkflowCondition, TargetGroup, ScheduleSettings, PersonalizationSettings, TargetTemplateMapping as TargetTemplateMappingType } from '@/lib/types/workflow';
import { KakaoTemplate } from '@/lib/types/template';
import { TemplateBrowser } from '@/components/templates/template-browser';
import { VariableSettings } from '@/components/workflow/variable-settings';
import { VariableMapping } from '@/components/workflow/variable-mapping';
import { TargetSelection } from './target-selection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  ArrowLeft
} from 'lucide-react';
import { mockTemplates } from '@/lib/data/mock-templates';
import { TargetTemplateMapping } from './target-template-mapping';

interface WorkflowBuilderProps {
  workflow?: Workflow;
  onSave: (workflow: Workflow) => void;
  onTest?: (workflow: Workflow) => void;
}

// KakaoTemplate을 VariableMapping에서 사용하는 형태로 변환하는 헬퍼 함수
const convertToVariableMappingTemplate = (template: KakaoTemplate, existingPersonalization?: PersonalizationSettings) => ({
  id: template.id,
  name: template.templateName,
  content: template.templateContent,
  category: template.category || '기타',
  variables: template.variables || [],
  personalization: existingPersonalization || template.personalization
});

export function WorkflowBuilder({ workflow, onSave, onTest }: WorkflowBuilderProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>(workflow?.targetGroups || []);
  const [selectedTemplates, setSelectedTemplates] = useState<KakaoTemplate[]>([]);
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>({
    type: 'immediate',
    timezone: 'Asia/Seoul'
  });
  const [steps, setSteps] = useState<WorkflowStep[]>(workflow?.steps || []);
  const [testSettings, setTestSettings] = useState<WorkflowTestSettings>(
    workflow?.testSettings || {
      testPhoneNumber: '010-1234-5678',
      testVariables: {},
      enableRealSending: false,
      fallbackToSMS: true,
      testMode: false,
      testNotes: ''
    }
  );
  
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showVariableSettings, setShowVariableSettings] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<KakaoTemplate | null>(null);

  // 새로운 상태: 템플릿별 개인화 설정
  const [templatePersonalizations, setTemplatePersonalizations] = useState<Record<string, PersonalizationSettings>>({});
  
  // 새로운 상태: 템플릿별 변수 저장
  const [templateVariables, setTemplateVariables] = useState<Record<string, Record<string, string>>>({});

  // 새로운 상태: 대상-템플릿 매핑
  const [targetTemplateMappings, setTargetTemplateMappings] = useState<TargetTemplateMappingType[]>([]);

  // 기존 워크플로우 로드 시 변수와 개인화 설정 초기화
  useEffect(() => {
    if (workflow && workflow.steps) {
      console.log('🔄 워크플로우 로드 시작:', {
        workflowId: workflow.id,
        workflowName: workflow.name,
        stepsCount: workflow.steps.length
      });
      
      const variables: Record<string, Record<string, string>> = {};
      const personalizations: Record<string, PersonalizationSettings> = {};
      const templates: KakaoTemplate[] = [];
      
      workflow.steps.forEach((step, index) => {
        console.log(`🔍 Step ${index + 1} 분석:`, {
          stepId: step.id,
          actionType: step.action.type,
          templateId: step.action.templateId
        });
        
        if (step.action.templateId && step.action.type === 'send_alimtalk') {
          // 변수 저장
          if (step.action.variables) {
            variables[step.action.templateId] = step.action.variables;
            console.log(`📝 변수 복원 (${step.action.templateId}):`, step.action.variables);
          }
          
          // 개인화 설정 저장
          if (step.action.personalization) {
            personalizations[step.action.templateId] = step.action.personalization;
            console.log(`⚙️ 개인화 설정 복원 (${step.action.templateId}):`, step.action.personalization);
          }
          
          // 템플릿 정보 복원 (mockTemplates에서 찾기)
          let templateInfo = mockTemplates.find(t => t.id === step.action.templateId);
          
          // 템플릿을 찾지 못한 경우, templateCode로도 시도
          if (!templateInfo && step.action.templateCode) {
            templateInfo = mockTemplates.find(t => t.templateCode === step.action.templateCode);
            console.log(`🔍 templateCode로 재검색 (${step.action.templateCode}):`, templateInfo ? '성공' : '실패');
          }
          
          // 여전히 찾지 못한 경우, 템플릿 번호로 시도
          if (!templateInfo && step.action.templateId.includes('_')) {
            const parts = step.action.templateId.split('_');
            const templateNumber = parseInt(parts[parts.length - 1]);
            if (!isNaN(templateNumber)) {
              templateInfo = mockTemplates.find(t => t.templateNumber === templateNumber);
              console.log(`🔍 templateNumber로 재검색 (${templateNumber}):`, templateInfo ? '성공' : '실패');
            }
          }
          
          if (templateInfo && !templates.find(t => t.id === templateInfo.id)) {
            const templateWithPersonalization = {
              ...templateInfo,
              personalization: step.action.personalization
            };
            templates.push(templateWithPersonalization);
            console.log(`✅ 템플릿 복원 성공:`, {
              templateId: templateInfo.id,
              templateName: templateInfo.templateName,
              templateCode: templateInfo.templateCode
            });
          } else if (!templateInfo) {
            console.error(`❌ 템플릿을 찾을 수 없음:`, {
              templateId: step.action.templateId,
              templateCode: step.action.templateCode,
              templateName: step.action.templateName,
              availableTemplates: mockTemplates.length
            });
            
            // 사용 가능한 템플릿 ID들을 로그로 출력 (디버깅용)
            console.log('📋 사용 가능한 템플릿 ID 목록 (처음 5개):', 
              mockTemplates.slice(0, 5).map(t => ({ id: t.id, code: t.templateCode, name: t.templateName }))
            );
          }
        }
      });
      
      setTemplateVariables(variables);
      setTemplatePersonalizations(personalizations);
      setSelectedTemplates(templates);
      
      console.log('🔄 워크플로우 로드 완료:', {
        templates: templates.length,
        variables: Object.keys(variables).length,
        personalizations: Object.keys(personalizations).length,
        loadedTemplates: templates.map(t => ({ id: t.id, name: t.templateName }))
      });
      
      // 대상 그룹도 복원
      if (workflow.targetGroups) {
        setTargetGroups(workflow.targetGroups);
        console.log('👥 대상 그룹 복원:', workflow.targetGroups.length);
      }
      
      // 스케줄 설정도 복원
      if (workflow.scheduleSettings) {
        setScheduleSettings(workflow.scheduleSettings);
        console.log('⏰ 스케줄 설정 복원:', workflow.scheduleSettings);
      }
      
      // 테스트 설정도 복원
      if (workflow.testSettings) {
        setTestSettings(workflow.testSettings);
        console.log('🧪 테스트 설정 복원:', workflow.testSettings);
      }
    }
  }, [workflow]);

  // 탭 완료 상태 체크
  const isTabComplete = (tabId: string) => {
    switch (tabId) {
      case 'basic':
        return name.trim() !== '' && description.trim() !== '';
      case 'templates':
        return selectedTemplates.length > 0;
      case 'targets':
        return targetGroups.length > 0;
      case 'mapping':
        // 동적 쿼리가 있는 대상 그룹이 있는 경우에만 매핑 필요
        const hasDynamicTargets = targetGroups.some(group => 
          group.type === 'dynamic' && group.dynamicQuery
        );
        if (!hasDynamicTargets) return true; // 동적 대상이 없으면 매핑 불필요
        
        // 모든 동적 대상 그룹과 템플릿 조합에 대해 매핑이 있는지 확인
        const dynamicTargets = targetGroups.filter(group => 
          group.type === 'dynamic' && group.dynamicQuery
        );
        
        for (const target of dynamicTargets) {
          for (const template of selectedTemplates) {
            const mapping = targetTemplateMappings.find(m => 
              m.targetGroupId === target.id && m.templateId === template.id
            );
            if (!mapping || mapping.fieldMappings.length === 0) {
              return false; // 매핑이 없으면 미완료
            }
          }
        }
        return true;
      case 'schedule':
        return true; // 스케줄은 기본값이 있으므로 항상 완료
      case 'test':
        return testSettings.testPhoneNumber.trim() !== '';
      default:
        return false;
    }
  };

  const handleTemplateSelect = (template: KakaoTemplate) => {
    if (!selectedTemplates.find(t => t.id === template.id)) {
      // 기존 개인화 설정이 있는지 확인
      const existingPersonalization = templatePersonalizations[template.id];
      
      const templateWithPersonalization = {
        ...template,
        personalization: existingPersonalization
      };
      
      setSelectedTemplates([...selectedTemplates, templateWithPersonalization]);
      
      console.log(`📋 템플릿 ${template.id} 선택됨, 기존 개인화 설정:`, existingPersonalization ? '있음' : '없음');
    }
    setShowTemplateSelector(false);
  };

  const removeTemplate = (templateId: string) => {
    setSelectedTemplates(selectedTemplates.filter(t => t.id !== templateId));
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
  const handlePersonalizationChange = useCallback((templateId: string, settings: PersonalizationSettings) => {
    console.log(`🔧 템플릿 ${templateId} 개인화 설정 변경:`, {
      enabled: settings.enabled,
      mappingsCount: settings.variableMappings.length,
      mappings: settings.variableMappings
    });
    
    setTemplatePersonalizations(prev => {
      const updated = {
        ...prev,
        [templateId]: settings
      };
      console.log(`💾 개인화 설정 저장 완료:`, updated);
      return updated;
    });
    
    // 개인화 설정에서 변수 추출하여 저장 (모든 값 타입 고려)
    const variables: Record<string, string> = {};
    settings.variableMappings.forEach(mapping => {
      const variableName = mapping.templateVariable.replace(/^#{|}$/g, '');
      
      // 우선순위: actualValue > defaultValue > sourceField > 빈 문자열
      if (mapping.actualValue) {
        variables[variableName] = mapping.actualValue;
      } else if (mapping.defaultValue) {
        variables[variableName] = mapping.defaultValue;
      } else if (mapping.sourceField) {
        variables[variableName] = mapping.sourceField;
      } else {
        variables[variableName] = '';
      }
    });
    
    setTemplateVariables(prev => {
      const updated = {
        ...prev,
        [templateId]: variables
      };
      console.log(`🔧 템플릿 ${templateId} 변수 저장:`, variables);
      return updated;
    });
    
    // 선택된 템플릿 목록에서 해당 템플릿의 개인화 설정도 업데이트
    setSelectedTemplates(prev => {
      const updated = prev.map(template => 
        template.id === templateId 
          ? { ...template, personalization: settings }
          : template
      );
      console.log(`📋 선택된 템플릿 목록 업데이트 완료`);
      return updated;
    });
  }, []);

  const handleSave = async () => {
    // 선택된 템플릿들을 워크플로우 단계로 변환 (개인화 설정 포함)
    const templateSteps: WorkflowStep[] = selectedTemplates.map((template, index) => ({
      id: `step_${template.id}_${Date.now()}`,
      name: `${template.templateName} 발송`,
      action: {
        id: `action_${template.id}_${Date.now()}`,
        type: 'send_alimtalk',
        templateId: template.id,
        templateCode: template.templateCode,
        templateName: template.templateName,
        variables: templateVariables[template.id] || {},
        scheduleSettings: scheduleSettings,
        personalization: templatePersonalizations[template.id]
      },
      position: { x: 100, y: index * 150 + 100 }
    }));

    // 기본 트리거 설정 (수동 실행)
    const defaultTrigger: WorkflowTrigger = {
      id: 'trigger_manual',
      type: 'manual',
      name: '수동 실행',
      description: '관리자가 수동으로 실행하는 워크플로우',
      conditions: [],
      conditionLogic: 'AND'
    };

    const workflowData: Workflow = {
      id: workflow?.id || `workflow_${Date.now()}`,
      name,
      description,
      status: 'draft',
      trigger: defaultTrigger,
      targetGroups,
      steps: templateSteps,
      testSettings,
      scheduleSettings,
      createdAt: workflow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: {
        totalRuns: 0,
        successRate: 0
      }
    };

    // 워크플로우 저장
    onSave(workflowData);

    // 스케줄 설정이 있고 즉시 실행이 아닌 경우 스케줄러에 등록
    if (scheduleSettings.type !== 'immediate' && workflowData.status === 'active') {
      try {
        const response = await fetch('/api/scheduler', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'schedule',
            workflow: workflowData
          })
        });

        const result = await response.json();
        
        if (result.success) {
          console.log('✅ 워크플로우가 스케줄러에 등록되었습니다:', result.data.jobId);
          // 성공 알림 표시 (선택사항)
        } else {
          console.error('❌ 스케줄러 등록 실패:', result.message);
        }
      } catch (error) {
        console.error('❌ 스케줄러 등록 중 오류:', error);
      }
    }
  };

  const handleTest = () => {
    if (onTest) {
      const templateSteps: WorkflowStep[] = selectedTemplates.map((template, index) => ({
        id: `step_${template.id}_${Date.now()}`,
        name: `${template.templateName} 발송`,
        action: {
          id: `action_${template.id}_${Date.now()}`,
          type: 'send_alimtalk',
          templateId: template.id,
          templateCode: template.templateCode,
          templateName: template.templateName,
          variables: templateVariables[template.id] || {},
          scheduleSettings: scheduleSettings,
          personalization: templatePersonalizations[template.id]
        },
        position: { x: 100, y: index * 150 + 100 }
      }));

      const defaultTrigger: WorkflowTrigger = {
        id: 'trigger_manual',
        type: 'manual',
        name: '수동 실행',
        description: '관리자가 수동으로 실행하는 워크플로우',
        conditions: [],
        conditionLogic: 'AND'
      };

      const workflowData: Workflow = {
        id: workflow?.id || `workflow_${Date.now()}`,
        name,
        description,
        status: 'draft',
        trigger: defaultTrigger,
        targetGroups,
        steps: templateSteps,
        testSettings,
        scheduleSettings,
        createdAt: workflow?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: {
          totalRuns: 0,
          successRate: 0
        }
      };
      onTest(workflowData);
    }
  };

  const canProceedToNext = (currentTab: string) => {
    return isTabComplete(currentTab);
  };

  const getNextTab = (currentTab: string) => {
    const tabs = ['basic', 'templates', 'targets', 'mapping', 'schedule', 'test'];
    const currentIndex = tabs.indexOf(currentTab);
    return currentIndex < tabs.length - 1 ? tabs[currentIndex + 1] : null;
  };

  // 매핑 변경 핸들러
  const handleMappingChange = useCallback((mappings: TargetTemplateMappingType[]) => {
    setTargetTemplateMappings(mappings);
  }, []);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            기본정보
            {isTabComplete('basic') && <CheckCircle className="w-3 h-3 text-green-600" />}
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            알림톡 선택
            {isTabComplete('templates') && <CheckCircle className="w-3 h-3 text-green-600" />}
          </TabsTrigger>
          <TabsTrigger value="targets" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            대상 선정
            {isTabComplete('targets') && <CheckCircle className="w-3 h-3 text-green-600" />}
          </TabsTrigger>
          <TabsTrigger value="mapping" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            대상-템플릿 매핑
            {isTabComplete('mapping') && <CheckCircle className="w-3 h-3 text-green-600" />}
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            스케줄러
            {isTabComplete('schedule') && <CheckCircle className="w-3 h-3 text-green-600" />}
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            테스트 설정
            {isTabComplete('test') && <CheckCircle className="w-3 h-3 text-green-600" />}
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
                <label className="text-sm font-medium mb-2 block">워크플로우 이름 *</label>
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
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={() => canProceedToNext('basic') && setActiveTab('templates')}
              disabled={!canProceedToNext('basic')}
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
                <Button onClick={() => setShowTemplateSelector(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  템플릿 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">선택된 템플릿이 없습니다</p>
                  <p className="text-sm mb-4">워크플로우에서 사용할 알림톡 템플릿을 선택해주세요</p>
                  <Button onClick={() => setShowTemplateSelector(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    첫 번째 템플릿 선택
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {selectedTemplates.map((template, index) => (
                    <div key={template.id} className="border rounded-lg p-6 space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-lg">{template.templateName}</h4>
                            <Badge variant="outline">{template.templateCode}</Badge>
                            <Badge variant="secondary">{template.category}</Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-3">
                            {template.templateContent.substring(0, 100)}...
                          </p>
                          
                          {/* 템플릿 변수 표시 */}
                          {template.variables && template.variables.length > 0 && (
                            <div className="mb-3">
                              <p className="text-sm font-medium text-muted-foreground mb-2">템플릿 변수:</p>
                              <div className="flex flex-wrap gap-1">
                                {template.variables.map(variable => (
                                  <Badge key={variable} variant="outline" className="text-xs font-mono">
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
                                개인화 활성화 ({templatePersonalizations[template.id].variableMappings.length}개 변수 매핑됨)
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
                          selectedTemplate={convertToVariableMappingTemplate(template, templatePersonalizations[template.id])}
                          onMappingChange={(settings) => handlePersonalizationChange(template.id, settings)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setActiveTab('basic')}>
              이전: 기본정보
            </Button>
            <Button 
              onClick={() => canProceedToNext('templates') && setActiveTab('targets')}
              disabled={!canProceedToNext('templates')}
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
          />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setActiveTab('templates')}>
              이전: 알림톡 선택
            </Button>
            <Button 
              onClick={() => canProceedToNext('targets') && setActiveTab('mapping')}
              disabled={!canProceedToNext('targets')}
            >
              다음: 대상-템플릿 매핑
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
          />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setActiveTab('targets')}>
              이전: 대상 선정
            </Button>
            <Button 
              onClick={() => canProceedToNext('mapping') && setActiveTab('schedule')}
              disabled={!canProceedToNext('mapping')}
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
              <CardTitle>스케줄러 설정</CardTitle>
              <p className="text-sm text-muted-foreground">
                언제 알림톡을 발송할지 설정하세요
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-3 block">발송 시점</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      scheduleSettings.type === 'immediate' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setScheduleSettings({...scheduleSettings, type: 'immediate'})}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        scheduleSettings.type === 'immediate' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`} />
                      <div>
                        <h4 className="font-medium">즉시 발송</h4>
                        <p className="text-sm text-muted-foreground">워크플로우 실행 시 즉시 발송</p>
                      </div>
                    </div>
                  </div>

                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      scheduleSettings.type === 'delay' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setScheduleSettings({...scheduleSettings, type: 'delay'})}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        scheduleSettings.type === 'delay' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`} />
                      <div>
                        <h4 className="font-medium">지연 발송</h4>
                        <p className="text-sm text-muted-foreground">일정 시간 후 발송</p>
                      </div>
                    </div>
                  </div>

                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      scheduleSettings.type === 'scheduled' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setScheduleSettings({...scheduleSettings, type: 'scheduled'})}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        scheduleSettings.type === 'scheduled' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`} />
                      <div>
                        <h4 className="font-medium">예약 발송</h4>
                        <p className="text-sm text-muted-foreground">특정 날짜와 시간에 발송</p>
                      </div>
                    </div>
                  </div>

                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      scheduleSettings.type === 'recurring' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setScheduleSettings({...scheduleSettings, type: 'recurring'})}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        scheduleSettings.type === 'recurring' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`} />
                      <div>
                        <h4 className="font-medium">반복 발송</h4>
                        <p className="text-sm text-muted-foreground">정기적으로 반복 발송</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 지연 발송 설정 */}
              {scheduleSettings.type === 'delay' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">지연 시간</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={scheduleSettings.delay || 60}
                      onChange={(e) => setScheduleSettings({
                        ...scheduleSettings, 
                        delay: parseInt(e.target.value) || 60
                      })}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">분 후 발송</span>
                  </div>
                </div>
              )}

              {/* 예약 발송 설정 */}
              {scheduleSettings.type === 'scheduled' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">예약 일시</label>
                  <Input
                    type="datetime-local"
                    value={scheduleSettings.scheduledTime || ''}
                    onChange={(e) => setScheduleSettings({
                      ...scheduleSettings, 
                      scheduledTime: e.target.value
                    })}
                  />
                </div>
              )}

              {/* 반복 발송 설정 */}
              {scheduleSettings.type === 'recurring' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">반복 주기</label>
                    <Select
                      value={scheduleSettings.recurringPattern?.frequency || 'daily'}
                      onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                        setScheduleSettings({
                          ...scheduleSettings,
                          recurringPattern: {
                            ...scheduleSettings.recurringPattern,
                            frequency: value,
                            interval: 1,
                            time: '09:00'
                          }
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
                    <label className="text-sm font-medium mb-2 block">발송 시간</label>
                    <Input
                      type="time"
                      value={scheduleSettings.recurringPattern?.time || '09:00'}
                      onChange={(e) => setScheduleSettings({
                        ...scheduleSettings,
                        recurringPattern: {
                          ...scheduleSettings.recurringPattern!,
                          time: e.target.value
                        }
                      })}
                    />
                  </div>

                  {scheduleSettings.recurringPattern?.frequency === 'weekly' && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">요일 선택</label>
                      <div className="flex gap-2">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                          <Button
                            key={index}
                            variant={
                              scheduleSettings.recurringPattern?.daysOfWeek?.includes(index) 
                                ? 'default' 
                                : 'outline'
                            }
                            size="sm"
                            onClick={() => {
                              const currentDays = scheduleSettings.recurringPattern?.daysOfWeek || [];
                              const newDays = currentDays.includes(index)
                                ? currentDays.filter(d => d !== index)
                                : [...currentDays, index];
                              
                              setScheduleSettings({
                                ...scheduleSettings,
                                recurringPattern: {
                                  ...scheduleSettings.recurringPattern!,
                                  daysOfWeek: newDays
                                }
                              });
                            }}
                          >
                            {day}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {scheduleSettings.recurringPattern?.frequency === 'monthly' && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">매월 몇 일</label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={scheduleSettings.recurringPattern?.dayOfMonth || 1}
                        onChange={(e) => setScheduleSettings({
                          ...scheduleSettings,
                          recurringPattern: {
                            ...scheduleSettings.recurringPattern!,
                            dayOfMonth: parseInt(e.target.value) || 1
                          }
                        })}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setActiveTab('mapping')}>
              이전: 대상-템플릿 매핑
            </Button>
            <Button onClick={() => setActiveTab('test')}>
              다음: 테스트 설정
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </TabsContent>

        {/* 테스트 설정 탭 */}
        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>테스트 설정</CardTitle>
              <p className="text-sm text-muted-foreground">
                워크플로우를 테스트하기 위한 설정을 구성하세요
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">테스트 수신 번호 *</label>
                <Input
                  value={testSettings.testPhoneNumber}
                  onChange={(e) => setTestSettings({
                    ...testSettings,
                    testPhoneNumber: e.target.value
                  })}
                  placeholder="010-1234-5678"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="real-sending"
                  checked={testSettings.enableRealSending}
                  onCheckedChange={(checked) => setTestSettings({
                    ...testSettings,
                    enableRealSending: checked
                  })}
                />
                <Label htmlFor="real-sending">실제 메시지 발송 (체크 해제 시 시뮬레이션만)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="fallback-sms"
                  checked={testSettings.fallbackToSMS}
                  onCheckedChange={(checked) => setTestSettings({
                    ...testSettings,
                    fallbackToSMS: checked
                  })}
                />
                <Label htmlFor="fallback-sms">알림톡 실패 시 SMS로 대체 발송</Label>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">테스트 메모</label>
                <Textarea
                  value={testSettings.testNotes || ''}
                  onChange={(e) => setTestSettings({
                    ...testSettings,
                    testNotes: e.target.value
                  })}
                  placeholder="테스트에 대한 메모를 작성하세요"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setActiveTab('schedule')}>
              이전: 스케줄러 설정
            </Button>
            <div className="flex gap-3">
              {onTest && (
                <Button onClick={handleTest} variant="outline">
                  <Play className="w-4 h-4 mr-2" />
                  테스트 실행
                </Button>
              )}
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                워크플로우 저장
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 템플릿 선택 다이얼로그 */}
      <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
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

      {/* 변수 설정 다이얼로그 */}
      <Dialog open={showVariableSettings} onOpenChange={setShowVariableSettings}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>변수 설정 - {currentTemplate?.templateName}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <VariableSettings
              templateContent={currentTemplate?.templateContent || ''}
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