import { Workflow } from '../types/workflow';

interface ScheduledJob {
  id: string;
  workflowId: string;
  scheduledTime: Date;
  workflow: Workflow;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  executedAt?: Date;
  error?: string;
}

class SchedulerService {
  private jobs: Map<string, ScheduledJob> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor() {
    this.startScheduler();
  }

  // 스케줄러 시작
  startScheduler() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 스케줄러 서비스 시작됨');
    
    // 매분마다 실행할 작업 확인
    const checkInterval = setInterval(() => {
      this.checkAndExecuteJobs();
    }, 60000); // 1분마다 체크
    
    this.intervals.set('main', checkInterval);
  }

  // 스케줄러 중지
  stopScheduler() {
    this.isRunning = false;
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    console.log('⏹️ 스케줄러 서비스 중지됨');
  }

  // 워크플로우 예약
  scheduleWorkflow(workflow: Workflow): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let scheduledTime: Date;
    const now = new Date();
    
    if (!workflow.scheduleSettings) {
      // 기본값: 즉시 실행
      scheduledTime = now;
    } else {
      switch (workflow.scheduleSettings.type) {
        case 'immediate':
          scheduledTime = now;
          break;
        case 'delay':
          const delayMinutes = workflow.scheduleSettings.delay || 0;
          scheduledTime = new Date(now.getTime() + delayMinutes * 60000);
          break;
        case 'scheduled':
          if (workflow.scheduleSettings.scheduledTime) {
            scheduledTime = new Date(workflow.scheduleSettings.scheduledTime);
          } else {
            scheduledTime = now;
          }
          break;
        case 'recurring':
          // 반복 작업의 경우 다음 실행 시간 계산
          scheduledTime = this.calculateNextRecurringTime(workflow.scheduleSettings.recurringPattern);
          break;
        default:
          scheduledTime = now;
      }
    }

    const job: ScheduledJob = {
      id: jobId,
      workflowId: workflow.id,
      scheduledTime,
      workflow,
      status: 'pending',
      createdAt: now
    };

    this.jobs.set(jobId, job);
    
    console.log(`📅 워크플로우 예약됨: ${workflow.name} (${scheduledTime.toLocaleString('ko-KR')})`);
    
    return jobId;
  }

  // 다음 반복 실행 시간 계산
  private calculateNextRecurringTime(pattern: any): Date {
    const now = new Date();
    const [hours, minutes] = (pattern?.time || '09:00').split(':').map(Number);
    
    switch (pattern?.frequency) {
      case 'daily':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + (pattern.interval || 1));
        tomorrow.setHours(hours, minutes, 0, 0);
        return tomorrow;
        
      case 'weekly':
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7 * (pattern.interval || 1));
        nextWeek.setHours(hours, minutes, 0, 0);
        return nextWeek;
        
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + (pattern.interval || 1));
        nextMonth.setDate(pattern.dayOfMonth || 1);
        nextMonth.setHours(hours, minutes, 0, 0);
        return nextMonth;
        
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 기본 24시간 후
    }
  }

  // 예약된 작업 확인 및 실행
  private async checkAndExecuteJobs() {
    const now = new Date();
    const pendingJobs = Array.from(this.jobs.values()).filter(
      job => job.status === 'pending' && job.scheduledTime <= now
    );

    if (pendingJobs.length > 0) {
      console.log(`⏰ 실행할 작업 ${pendingJobs.length}개 발견`);
    }

    for (const job of pendingJobs) {
      await this.executeJob(job);
    }
  }

  // 작업 실행
  private async executeJob(job: ScheduledJob) {
    try {
      console.log(`🚀 워크플로우 실행 시작: ${job.workflow.name}`);
      
      job.status = 'running';
      job.executedAt = new Date();

      // 워크플로우 실행 API 호출
      const response = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow: job.workflow,
          scheduledExecution: true,
          jobId: job.id
        })
      });

      if (response.ok) {
        const result = await response.json();
        job.status = 'completed';
        console.log(`✅ 워크플로우 실행 완료: ${job.workflow.name}`, result);
        
        // 반복 작업인 경우 다음 실행 예약
        if (job.workflow.scheduleSettings?.type === 'recurring') {
          this.scheduleWorkflow(job.workflow);
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : '알 수 없는 오류';
      console.error(`❌ 워크플로우 실행 실패: ${job.workflow.name}`, error);
    }
  }

  // 예약된 작업 목록 조회
  getScheduledJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => 
      a.scheduledTime.getTime() - b.scheduledTime.getTime()
    );
  }

  // 작업 취소
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'pending') {
      this.jobs.delete(jobId);
      console.log(`🗑️ 작업 취소됨: ${jobId}`);
      return true;
    }
    return false;
  }

  // 워크플로우의 모든 예약 작업 취소
  cancelWorkflowJobs(workflowId: string): number {
    let cancelled = 0;
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.workflowId === workflowId && job.status === 'pending') {
        this.jobs.delete(jobId);
        cancelled++;
      }
    }
    console.log(`🗑️ 워크플로우 ${workflowId}의 ${cancelled}개 작업 취소됨`);
    return cancelled;
  }

  // 스케줄러 상태 조회
  getStatus() {
    const jobs = Array.from(this.jobs.values());
    return {
      isRunning: this.isRunning,
      totalJobs: jobs.length,
      pendingJobs: jobs.filter(j => j.status === 'pending').length,
      runningJobs: jobs.filter(j => j.status === 'running').length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      nextJob: jobs
        .filter(j => j.status === 'pending')
        .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())[0]
    };
  }
}

// 싱글톤 인스턴스
const schedulerService = new SchedulerService();

export default schedulerService;
export type { ScheduledJob }; 