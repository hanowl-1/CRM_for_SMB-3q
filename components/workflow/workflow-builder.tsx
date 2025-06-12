'use client';

import { useState } from 'react';
import { Workflow, WorkflowTrigger, WorkflowStep, WorkflowTestSettings, WorkflowCondition } from '@/lib/types/workflow';
import { KakaoTemplate } from '@/lib/types/template';
import { TemplateBrowser } from '@/components/templates/template-browser';
import { VariableSettings } from '@/components/workflow/variable-settings';
import { TriggerSettings } from './trigger-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Plus, 
  MessageSquare, 
  Clock, 
  Settings, 
  Save,
  Eye,
  Trash2,
  Zap
} from 'lucide-react';
import { mockTemplates } from '@/lib/data/mock-templates';

interface WorkflowBuilderProps {
  workflow?: Workflow;
  onSave: (workflow: Workflow) => void;
  onTest?: (workflow: Workflow) => void;
}

export function WorkflowBuilder({ workflow, onSave, onTest }: WorkflowBuilderProps) {
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [trigger, setTrigger] = useState<WorkflowTrigger>(
    workflow?.trigger || {
      id: '1',
      type: 'signup',
      name: '회원가입',
      description: '새로운 회원이 가입했을 때',
      conditions: [],
      conditionLogic: 'AND'
    }
  );
  const [steps, setSteps] = useState<WorkflowStep[]>(workflow?.steps || []);
  const [testSettings, setTestSettings] = useState<WorkflowTestSettings>(
    workflow?.testSettings || {
      testPhoneNumber: '010-1234-5678',
      testVariables: {},
      enableRealSending: false,
      fallbackToSMS: true
    }
  );
  
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showVariableSettings, setShowVariableSettings] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<KakaoTemplate | null>(null);

  const triggerOptions = [
    { value: 'signup', label: '회원가입', description: '새로운 회원이 가입했을 때' },
    { value: 'cancel', label: '구독 취소', description: '구독이 취소되었을 때' },
    { value: 'payment_failed', label: '결제 실패', description: '결제가 실패했을 때' },
    { value: 'renewal', label: '구독 갱신', description: '구독이 갱신되었을 때' },
    { value: 'manual', label: '수동 실행', description: '관리자가 수동으로 실행' },
  ];

  const addStep = (type: 'send_alimtalk' | 'send_sms' | 'wait') => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      name: type === 'send_alimtalk' ? '알림톡 발송' : type === 'send_sms' ? 'SMS 발송' : '대기',
      action: {
        id: `action_${Date.now()}`,
        type,
        delay: type === 'wait' ? 60 : undefined,
        variables: {}
      },
      position: { x: 100, y: steps.length * 150 + 100 }
    };

    if (type === 'send_alimtalk' || type === 'send_sms') {
      setCurrentStepIndex(steps.length);
      setShowTemplateSelector(true);
      setSteps([...steps, newStep]);
    } else {
      setSteps([...steps, newStep]);
    }
  };

  const handleTemplateSelect = (template: KakaoTemplate) => {
    if (currentStepIndex !== null) {
      const updatedSteps = [...steps];
      updatedSteps[currentStepIndex].action.templateId = template.id;
      updatedSteps[currentStepIndex].name = `${template.templateName} 발송`;
      setSteps(updatedSteps);
      setCurrentTemplate(template);
      setShowTemplateSelector(false);
      setShowVariableSettings(true);
    }
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

  const openVariableSettings = (stepIndex: number) => {
    const step = steps[stepIndex];
    if (step.action.templateId) {
      const template = mockTemplates.find(t => t.id === step.action.templateId);
      if (template) {
        setCurrentStepIndex(stepIndex);
        setCurrentTemplate(template);
        setShowVariableSettings(true);
      }
    }
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const workflowData: Workflow = {
      id: workflow?.id || `workflow_${Date.now()}`,
      name,
      description,
      status: 'draft',
      trigger,
      steps,
      testSettings,
      createdAt: workflow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: {
        totalRuns: 0,
        successRate: 0
      }
    };
    onSave(workflowData);
  };

  const handleTest = () => {
    if (onTest) {
      const workflowData: Workflow = {
        id: workflow?.id || `workflow_${Date.now()}`,
        name,
        description,
        status: 'draft',
        trigger,
        steps,
        testSettings,
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

  return (
    <div className="space-y-6">
      {/* 워크플로우 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>워크플로우 기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">워크플로우 이름</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 신규 회원 환영 메시지"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">설명</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 워크플로우가 무엇을 하는지 설명해주세요"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* 트리거 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>트리거 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <TriggerSettings
            trigger={trigger}
            onTriggerChange={(newTrigger: WorkflowTrigger) => setTrigger(newTrigger)}
            options={triggerOptions}
          />
        </CardContent>
      </Card>

      {/* 워크플로우 단계 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>워크플로우 단계</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => addStep('send_alimtalk')}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                알림톡
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addStep('send_sms')}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                SMS
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addStep('wait')}
              >
                <Clock className="w-4 h-4 mr-1" />
                대기
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>아직 단계가 없습니다.</p>
              <p className="text-sm">위의 버튼을 클릭하여 단계를 추가해보세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{step.name}</h4>
                      <Badge variant="outline">
                        {step.action.type === 'send_alimtalk' ? '알림톡' : 
                         step.action.type === 'send_sms' ? 'SMS' : '대기'}
                      </Badge>
                      {step.action.variables && Object.keys(step.action.variables).length > 0 && (
                        <Badge variant="secondary">
                          <Zap className="w-3 h-3 mr-1" />
                          변수 {Object.keys(step.action.variables).length}개
                        </Badge>
                      )}
                    </div>
                    
                    {step.action.type === 'wait' && (
                      <p className="text-sm text-muted-foreground">
                        {step.action.delay}분 대기
                      </p>
                    )}
                    
                    {step.action.templateId && (
                      <p className="text-sm text-muted-foreground">
                        템플릿 ID: {step.action.templateId}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {(step.action.type === 'send_alimtalk' || step.action.type === 'send_sms') && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCurrentStepIndex(index);
                            setShowTemplateSelector(true);
                          }}
                          title="템플릿 변경"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        
                        {step.action.templateId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openVariableSettings(index)}
                            title="변수 설정"
                          >
                            <Zap className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(index)}
                      title="단계 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 액션 버튼 */}
      <div className="flex gap-3">
        <Button onClick={handleSave} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          저장
        </Button>
        
        {steps.length > 0 && (
          <Button onClick={handleTest} variant="outline">
            <Play className="w-4 h-4 mr-2" />
            테스트 실행
          </Button>
        )}
      </div>

      {/* 템플릿 선택 다이얼로그 */}
      <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>템플릿 선택</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <TemplateBrowser
              onSelect={handleTemplateSelect}
              showSelectButton={true}
              isDialogMode={true}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 변수 설정 다이얼로그 */}
      <Dialog open={showVariableSettings} onOpenChange={setShowVariableSettings}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {currentTemplate?.templateName} - 변수 및 테스트 설정
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="variables" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="variables">변수 설정</TabsTrigger>
              <TabsTrigger value="test">테스트 설정</TabsTrigger>
            </TabsList>
            
            <TabsContent value="variables" className="mt-6">
              {currentTemplate && currentStepIndex !== null && (
                <VariableSettings
                  templateContent={currentTemplate.templateContent}
                  variables={steps[currentStepIndex]?.action.variables || {}}
                  testSettings={testSettings}
                  onVariablesChange={handleVariablesChange}
                  onTestSettingsChange={setTestSettings}
                />
              )}
            </TabsContent>
            
            <TabsContent value="test" className="mt-6">
              <VariableSettings
                templateContent=""
                variables={{}}
                testSettings={testSettings}
                onVariablesChange={() => {}}
                onTestSettingsChange={setTestSettings}
              />
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={handleVariableSettingsClose}>
              취소
            </Button>
            <Button onClick={handleVariableSettingsClose}>
              적용
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 