import { getKoreaTime, koreaTimeToUTCString } from './timezone';

export type ExecutionStep = 
  | 'cron_trigger'      // 1. AWS EventBridge/Vercel Cron 트리거
  | 'scheduler_detect'  // 2. 스케줄러 감지 API
  | 'jobs_query'        // 3. scheduled_jobs 테이블 조회
  | 'workflow_query'    // 4. 워크플로우 정보 조회
  | 'workflow_execute'  // 5. 워크플로우 실행 API 호출
  | 'target_extract'    // 6. 대상자 조회 & 추출
  | 'template_mapping'  // 7. 템플릿 변수 매핑
  | 'message_generate'  // 8. 개인화 메시지 생성
  | 'sms_api_call'      // 9. CoolSMS API 호출
  | 'result_process'    // 10. 발송 결과 처리
  | 'status_update';    // 11. 스케줄 작업 상태 업데이트

export type LogStatus = 'started' | 'success' | 'failed' | 'warning';

export interface ExecutionLogEntry {
  execution_id: string;
  job_id?: string;
  workflow_id?: string;
  workflow_name?: string;
  step: ExecutionStep;
  status: LogStatus;
  message: string;
  details?: any;
  error_message?: string;
  duration_ms?: number;
  timestamp?: string;
}

export class SchedulerLogger {
  private executionId: string;
  private jobId?: string;
  private workflowId?: string;
  private workflowName?: string;
  private stepTimestamps: { [key: string]: number } = {};

  constructor(executionId: string, jobId?: string, workflowId?: string, workflowName?: string) {
    this.executionId = executionId;
    this.jobId = jobId;
    this.workflowId = workflowId;
    this.workflowName = workflowName;
  }

  /**
   * 단계 시작 로그
   */
  async logStepStart(step: ExecutionStep, message: string, details?: any): Promise<void> {
    this.stepTimestamps[step] = Date.now();
    await this.logStep(step, 'started', message, details);
    console.log(`🚀 [${step}] 시작: ${message}`);
  }

  /**
   * 단계 성공 로그
   */
  async logStepSuccess(step: ExecutionStep, message: string, details?: any): Promise<void> {
    const duration = this.stepTimestamps[step] ? Date.now() - this.stepTimestamps[step] : undefined;
    await this.logStep(step, 'success', message, details, undefined, duration);
    console.log(`✅ [${step}] 성공: ${message}${duration ? ` (${duration}ms)` : ''}`);
  }

  /**
   * 단계 실패 로그
   */
  async logStepFailure(step: ExecutionStep, message: string, error?: Error | string, details?: any): Promise<void> {
    const duration = this.stepTimestamps[step] ? Date.now() - this.stepTimestamps[step] : undefined;
    const errorMessage = error instanceof Error ? error.message : String(error || '');
    await this.logStep(step, 'failed', message, details, errorMessage, duration);
    console.error(`❌ [${step}] 실패: ${message}${errorMessage ? ` - ${errorMessage}` : ''}${duration ? ` (${duration}ms)` : ''}`);
  }

  /**
   * 단계 경고 로그
   */
  async logStepWarning(step: ExecutionStep, message: string, details?: any): Promise<void> {
    const duration = this.stepTimestamps[step] ? Date.now() - this.stepTimestamps[step] : undefined;
    await this.logStep(step, 'warning', message, details, undefined, duration);
    console.warn(`⚠️ [${step}] 경고: ${message}${duration ? ` (${duration}ms)` : ''}`);
  }

  /**
   * 기본 로그 메서드
   */
  private async logStep(
    step: ExecutionStep, 
    status: LogStatus, 
    message: string, 
    details?: any, 
    errorMessage?: string, 
    duration?: number
  ): Promise<void> {
    try {
      const logEntry: ExecutionLogEntry = {
        execution_id: this.executionId,
        job_id: this.jobId,
        workflow_id: this.workflowId,
        workflow_name: this.workflowName,
        step,
        status,
        message,
        details,
        error_message: errorMessage,
        duration_ms: duration,
        timestamp: koreaTimeToUTCString(getKoreaTime())
      };

      // 로그 API 호출 (백그라운드에서 실행하여 메인 로직에 영향 없음)
      this.sendLogToAPI(logEntry).catch(logError => {
        console.warn('⚠️ 로그 전송 실패 (무시됨):', logError.message);
      });

    } catch (error) {
      console.warn('⚠️ 로그 기록 중 오류 (무시됨):', error);
    }
  }

  /**
   * API로 로그 전송 (비동기, 실패해도 메인 로직에 영향 없음)
   */
  private async sendLogToAPI(logEntry: ExecutionLogEntry): Promise<void> {
    try {
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.vercel.app')
        : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');

      const response = await fetch(`${baseUrl}/api/scheduler/execution-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-scheduler-internal': 'true'
        },
        body: JSON.stringify({
          action: 'create',
          ...logEntry
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      // 로그 전송 실패는 조용히 처리 (메인 로직에 영향 없음)
      throw error;
    }
  }

  /**
   * 실행 요약 정보 반환
   */
  getExecutionSummary(): { execution_id: string; job_id?: string; workflow_id?: string; workflow_name?: string } {
    return {
      execution_id: this.executionId,
      job_id: this.jobId,
      workflow_id: this.workflowId,
      workflow_name: this.workflowName
    };
  }
}

/**
 * 스케줄러 로거 팩토리 함수
 */
export function createSchedulerLogger(jobId?: string, workflowId?: string, workflowName?: string): SchedulerLogger {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  return new SchedulerLogger(executionId, jobId, workflowId, workflowName);
}

/**
 * 단계별 이름 매핑
 */
export const STEP_NAMES: { [key in ExecutionStep]: string } = {
  cron_trigger: '크론 트리거',
  scheduler_detect: '스케줄러 감지',
  jobs_query: '작업 조회',
  workflow_query: '워크플로우 조회',
  workflow_execute: '워크플로우 실행',
  target_extract: '대상자 추출',
  template_mapping: '템플릿 매핑',
  message_generate: '메시지 생성',
  sms_api_call: 'SMS API 호출',
  result_process: '결과 처리',
  status_update: '상태 업데이트'
};

/**
 * 상태별 이모지 매핑
 */
export const STATUS_EMOJIS: { [key in LogStatus]: string } = {
  started: '🚀',
  success: '✅',
  failed: '❌',
  warning: '⚠️'
};

/**
 * 벌크 로그 전송 유틸리티
 */
export async function sendBulkLogs(logs: ExecutionLogEntry[]): Promise<void> {
  try {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.vercel.app')
      : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');

    const response = await fetch(`${baseUrl}/api/scheduler/execution-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scheduler-internal': 'true'
      },
      body: JSON.stringify({
        action: 'bulk_create',
        logs
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log(`📝 벌크 로그 전송 완료: ${result.created_count}개`);
  } catch (error) {
    console.warn('⚠️ 벌크 로그 전송 실패:', error);
  }
} 