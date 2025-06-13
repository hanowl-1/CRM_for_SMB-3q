'use client';

import { useState } from 'react';
import { Workflow, WorkflowTrigger, WorkflowStep, WorkflowTestSettings, WorkflowCondition, TargetGroup, ScheduleSettings } from '@/lib/types/workflow';
import { KakaoTemplate } from '@/lib/types/template';
import { TemplateBrowser } from '@/components/templates/template-browser';
import { VariableSettings } from '@/components/workflow/variable-settings';
import { TriggerSettings } from './trigger-settings';
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
  ArrowRight
} from 'lucide-react';
import { mockTemplates } from '@/lib/data/mock-templates';

interface WorkflowBuilderProps {
  workflow?: Workflow;
  onSave: (workflow: Workflow) => void;
  onTest?: (workflow: Workflow) => void;
}

export function WorkflowBuilder({ workflow, onSave, onTest }: WorkflowBuilderProps) {
  const [activeTab, setActiveTab] = useState('basic');
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

  const triggerOptions = [
    { value: 'signup', label: '회원가입', description: '새로운 회원이 가입했을 때' },
    { value: 'cancel', label: '구독 취소', description: '구독이 취소되었을 때' },
    { value: 'payment_failed', label: '결제 실패', description: '결제가 실패했을 때' },
    { value: 'renewal', label: '구독 갱신', description: '구독이 갱신되었을 때' },
    { value: 'manual', label: '수동 실행', description: '관리자가 수동으로 실행' },
    { value: 'cart_abandon', label: '장바구니 미완료', description: '장바구니에 상품을 담고 일정 시간이 지났을 때' },
    { value: 'birthday', label: '생일', description: '고객의 생일일 때' },
    { value: 'purchase', label: '구매 완료', description: '고객이 구매를 완료했을 때' },
  ];

  // 탭 완료 상태 체크
  const isTabComplete = (tabId: string) => {
    switch (tabId) {
      case 'basic':
        return name.trim() !== '' && description.trim() !== '';
      case 'templates':
        return selectedTemplates.length > 0;
      case 'schedule':
        return true; // 스케줄은 기본값이 있으므로 항상 완료
      case 'targets':
        return targetGroups.length > 0;
      case 'test':
        return testSettings.testPhoneNumber.trim() !== '';
      default:
        return false;
    }
  };

  const handleTemplateSelect = (template: KakaoTemplate) => {
    if (!selectedTemplates.find(t => t.id === template.id)) {
      setSelectedTemplates([...selectedTemplates, template]);
    }
    setShowTemplateSelector(false);
  };

  const removeTemplate = (templateId: string) => {
    setSelectedTemplates(selectedTemplates.filter(t => t.id !== templateId));
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

  const handleSave = () => {
    // 선택된 템플릿들을 워크플로우 단계로 변환
    const templateSteps: WorkflowStep[] = selectedTemplates.map((template, index) => ({
      id: `step_${template.id}_${Date.now()}`,
      name: `${template.templateName} 발송`,
      action: {
        id: `action_${template.id}_${Date.now()}`,
        type: 'send_alimtalk',
        templateId: template.id,
        variables: {},
        scheduleSettings: scheduleSettings
      },
      position: { x: 100, y: index * 150 + 100 }
    }));

    const workflowData: Workflow = {
      id: workflow?.id || `workflow_${Date.now()}`,
      name,
      description,
      status: 'draft',
      trigger,
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
    onSave(workflowData);
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
          variables: {},
          scheduleSettings: scheduleSettings
        },
        position: { x: 100, y: index * 150 + 100 }
      }));

      const workflowData: Workflow = {
        id: workflow?.id || `workflow_${Date.now()}`,
        name,
        description,
        status: 'draft',
        trigger,
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
    const tabs = ['basic', 'templates', 'schedule', 'targets', 'test'];
    const currentIndex = tabs.indexOf(currentTab);
    return currentIndex < tabs.length - 1 ? tabs[currentIndex + 1] : null;
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            스케줄러
            {isTabComplete('schedule') && <CheckCircle className="w-3 h-3 text-green-600" />}
          </TabsTrigger>
          <TabsTrigger value="targets" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            대상 선정
            {isTabComplete('targets') && <CheckCircle className="w-3 h-3 text-green-600" />}
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

              {/* 트리거 설정 */}
              <div>
                <label className="text-sm font-medium mb-2 block">트리거 설정</label>
                <TriggerSettings
                  trigger={trigger}
                  onTriggerChange={(newTrigger: WorkflowTrigger) => {
                    console.log('WorkflowBuilder에서 트리거 변경됨:', newTrigger);
                    setTrigger(newTrigger);
                  }}
                  options={triggerOptions}
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
                <div className="space-y-4">
                  {selectedTemplates.map((template, index) => (
                    <div key={template.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{template.templateName}</h4>
                          <Badge variant="outline">{template.templateCode}</Badge>
                          <Badge variant="secondary">{template.category}</Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-3">
                          {template.templateContent.substring(0, 100)}...
                        </p>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openVariableSettings(template)}
                          >
                            <Zap className="w-4 h-4 mr-1" />
                            변수 설정
                          </Button>
                        </div>
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
              onClick={() => canProceedToNext('templates') && setActiveTab('schedule')}
              disabled={!canProceedToNext('templates')}
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
                        <p className="text-sm text-muted-foreground">트리거 조건이 만족되면 즉시 발송</p>
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
            <Button variant="outline" onClick={() => setActiveTab('templates')}>
              이전: 알림톡 선택
            </Button>
            <Button onClick={() => setActiveTab('targets')}>
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
            <Button variant="outline" onClick={() => setActiveTab('schedule')}>
              이전: 스케줄러 설정
            </Button>
            <Button 
              onClick={() => canProceedToNext('targets') && setActiveTab('test')}
              disabled={!canProceedToNext('targets')}
            >
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
            <Button variant="outline" onClick={() => setActiveTab('targets')}>
              이전: 대상 선정
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