export interface WorkflowTrigger {
  id: string;
  type: 'signup' | 'cancel' | 'payment_failed' | 'renewal' | 'manual' | 'schedule' | 'cart_abandon' | 'birthday' | 'purchase';
  name: string;
  description: string;
  conditions?: WorkflowCondition[];
  conditionLogic?: 'AND' | 'OR'; // 조건들 간의 논리 연산자
}

export interface WorkflowCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  value: string;
}

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_list';
  value: string;
}

export interface TargetGroup {
  id: string;
  name: string;
  table: string;
  conditions: FilterCondition[];
  estimatedCount: number;
  selectedRecords?: any[];
}

// 스케줄러 설정 인터페이스
export interface ScheduleSettings {
  type: 'immediate' | 'delay' | 'scheduled' | 'recurring';
  delay?: number; // 분 단위
  scheduledTime?: string; // ISO string
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    daysOfWeek?: number[]; // 0=일요일, 1=월요일, ...
    dayOfMonth?: number;
    time: string; // HH:MM 형식
  };
  timezone?: string;
}

export interface WorkflowAction {
  id: string;
  type: 'send_alimtalk' | 'send_sms' | 'wait' | 'condition';
  templateId?: string;
  delay?: number; // minutes
  conditions?: WorkflowCondition[];
  variables?: Record<string, string>; // 사용자 정의 변수
  scheduleSettings?: ScheduleSettings; // 스케줄 설정
}

export interface WorkflowStep {
  id: string;
  name: string;
  action: WorkflowAction;
  nextStepId?: string;
  position: { x: number; y: number };
}

export interface WorkflowTestSettings {
  testPhoneNumber: string;
  testVariables: Record<string, string>;
  enableRealSending: boolean;
  fallbackToSMS: boolean;
  testMode: boolean; // 테스트 모드 활성화 여부
  testNotes: string; // 테스트 관련 메모
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger: WorkflowTrigger;
  targetGroups?: TargetGroup[]; // 발송 대상 그룹들
  steps: WorkflowStep[];
  testSettings?: WorkflowTestSettings; // 테스트 설정
  scheduleSettings?: ScheduleSettings; // 워크플로우 전체 스케줄 설정
  createdAt: string;
  updatedAt: string;
  stats: {
    totalRuns: number;
    successRate: number;
    lastRun?: string;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  customerId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStepId?: string;
  startedAt: string;
  completedAt?: string;
  logs: WorkflowLog[];
}

export interface WorkflowLog {
  id: string;
  stepId: string;
  action: string;
  status: 'success' | 'failed' | 'skipped';
  message: string;
  timestamp: string;
  data?: any;
} 