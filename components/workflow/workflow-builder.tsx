'use client';

import { useState } from 'react';
import { Workflow, WorkflowTrigger, WorkflowStep } from '@/lib/types/workflow';
import { KakaoTemplate } from '@/lib/types/template';
import { TemplateBrowser } from '@/components/templates/template-browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Play, 
  Plus, 
  MessageSquare, 
  Clock, 
  Settings, 
  Save,
  Eye,
  Trash2
} from 'lucide-react';

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
      description: '새로운 회원이 가입했을 때'
    }
  );
  const [steps, setSteps] = useState<WorkflowStep[]>(workflow?.steps || []);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);

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
        delay: type === 'wait' ? 60 : undefined
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
      setShowTemplateSelector(false);
      setCurrentStepIndex(null);
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
          <div>
            <label className="text-sm font-medium mb-2 block">언제 실행할까요?</label>
            <Select
              value={trigger.type}
              onValueChange={(value) => {
                const option = triggerOptions.find(opt => opt.value === value);
                if (option) {
                  setTrigger({
                    id: trigger.id,
                    type: value as any,
                    name: option.label,
                    description: option.description
                  });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="트리거 선택" />
              </SelectTrigger>
              <SelectContent>
                {triggerOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCurrentStepIndex(index);
                          setShowTemplateSelector(true);
                        }}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(index)}
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
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>템플릿 선택</DialogTitle>
          </DialogHeader>
          <TemplateBrowser
            onSelect={handleTemplateSelect}
            showSelectButton={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
} 