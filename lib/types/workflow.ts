export interface WorkflowTrigger {
  id: string;
  type: 'signup' | 'cancel' | 'payment_failed' | 'renewal' | 'manual' | 'schedule';
  name: string;
  description: string;
  conditions?: WorkflowCondition[];
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string;
}

export interface WorkflowAction {
  id: string;
  type: 'send_alimtalk' | 'send_sms' | 'wait' | 'condition';
  templateId?: string;
  delay?: number; // minutes
  conditions?: WorkflowCondition[];
  variables?: Record<string, string>; // 사용자 정의 변수
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
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  testSettings?: WorkflowTestSettings; // 테스트 설정
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