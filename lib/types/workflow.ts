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
  type: 'static' | 'dynamic'; // 정적 vs 동적 대상 선정
  
  // 정적 대상 선정 (기존 방식)
  table?: string;
  conditions?: FilterCondition[];
  selectedRecords?: any[];
  
  // 동적 대상 선정 (새로운 방식)
  dynamicQuery?: {
    sql: string; // 실행할 SQL 쿼리
    description: string; // 쿼리 설명
    expectedFields: string[]; // 예상 결과 필드 (contact, name 등)
    lastExecuted?: string; // 마지막 실행 시간
    lastCount?: number; // 마지막 실행 시 대상자 수
  };
  
  estimatedCount: number;
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

// 템플릿 변수 매핑 설정
export interface VariableMapping {
  templateVariable: string; // 템플릿에서 사용되는 변수명 (예: #total_reviews)
  sourceField: string; // 데이터베이스 필드명 또는 계산식
  sourceType: 'field' | 'query' | 'function'; // 데이터 소스 타입
  defaultValue?: string; // 기본값
  formatter?: 'number' | 'currency' | 'date' | 'text'; // 포맷터
  selectedColumn?: string; // 쿼리 결과에서 선택된 컬럼명 (query 타입일 때만 사용)
  actualValue?: string; // 실제 쿼리 결과 값 (런타임에 설정됨)
}

// 개인화 설정
export interface PersonalizationSettings {
  enabled: boolean;
  variableMappings: VariableMapping[];
  fallbackBehavior: 'use_default' | 'skip_send' | 'send_without_variables';
}

export interface WorkflowAction {
  id: string;
  type: 'send_alimtalk' | 'send_sms' | 'wait' | 'condition';
  templateId?: string;
  delay?: number; // minutes
  conditions?: WorkflowCondition[];
  variables?: Record<string, string>; // 사용자 정의 변수
  scheduleSettings?: ScheduleSettings; // 스케줄 설정
  personalization?: PersonalizationSettings; // 개인화 설정 추가
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

export interface PersonalizationTarget {
  contact: string;
  data: Record<string, any>;
}

// 변수 매핑 템플릿 시스템
export interface VariableMappingTemplate {
  id: string;
  name: string;
  description: string;
  category: string; // 'performance', 'welcome', 'payment', 'general' 등
  tags: string[];
  variableMappings: VariableMapping[];
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  isPublic: boolean; // 다른 사용자와 공유 가능 여부
  isFavorite?: boolean;
}

// 자동 매핑 제안
export interface MappingSuggestion {
  templateVariable: string;
  suggestedMappings: {
    template: VariableMappingTemplate;
    mapping: VariableMapping;
    confidence: number; // 0-1 사이의 신뢰도
    reason: string; // 제안 이유
  }[];
}

// 매핑 템플릿 검색 필터
export interface MappingTemplateFilter {
  category?: string;
  tags?: string[];
  searchTerm?: string;
  isPublic?: boolean;
  isFavorite?: boolean;
  sortBy?: 'name' | 'usageCount' | 'lastUsedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// 개별 변수 쿼리 템플릿
export interface VariableQueryTemplate {
  id: string;
  variableName: string; // #{total_reviews}, #{monthly_review_count} 등
  name: string; // 템플릿 이름 (예: "총 리뷰 수 조회")
  description: string;
  query: string; // SQL 쿼리
  selectedColumn: string; // 결과에서 사용할 컬럼명
  category: string; // 'performance', 'general', 'custom' 등
  tags: string[];
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  isFavorite?: boolean;
}

// 변수 쿼리 템플릿 검색 필터
export interface VariableQueryTemplateFilter {
  variableName?: string; // 특정 변수명으로 필터링
  category?: string;
  tags?: string[];
  searchTerm?: string;
  isPublic?: boolean;
  isFavorite?: boolean;
  sortBy?: 'name' | 'usageCount' | 'lastUsedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// 매핑 이력 템플릿 (전체 변수 매핑 세트)
export interface MappingHistoryTemplate {
  id: string;
  name: string;
  description: string;
  templateContent: string; // 원본 카카오톡 템플릿 내용
  variableMappings: VariableMapping[]; // 전체 변수 매핑 배열
  category: string;
  tags: string[];
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  isFavorite?: boolean;
}

// 매핑 이력 템플릿 검색 필터
export interface MappingHistoryTemplateFilter {
  category?: string;
  tags?: string[];
  searchTerm?: string;
  isPublic?: boolean;
  isFavorite?: boolean;
  sortBy?: 'name' | 'usageCount' | 'lastUsedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// 대상 그룹과 알림톡 변수 간의 매핑
export interface TargetTemplateMapping {
  id: string;
  targetGroupId: string; // 대상 그룹 ID
  templateId: string; // 알림톡 템플릿 ID
  fieldMappings: FieldMapping[]; // 필드 매핑 배열
  createdAt: string;
  updatedAt: string;
}

// 개별 필드 매핑
export interface FieldMapping {
  templateVariable: string; // 알림톡 템플릿의 변수명 (예: #{고객명})
  targetField: string; // 대상 그룹 쿼리 결과의 필드명 (예: companyName)
  formatter?: 'number' | 'currency' | 'date' | 'text'; // 포맷터
  defaultValue?: string; // 기본값
}

// 매핑 미리보기 결과
export interface MappingPreview {
  templateVariable: string;
  targetField: string;
  sampleValue: string; // 샘플 데이터에서의 실제 값
  formattedValue: string; // 포맷터 적용 후 값
}

// 워크플로우에 매핑 정보 추가
export interface WorkflowWithMapping extends Workflow {
  targetTemplateMappings?: TargetTemplateMapping[]; // 대상-템플릿 매핑 정보
} 