import { Workflow } from '@/lib/types/workflow';

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

// 한국시간 기준 유틸리티 함수들
const getKoreaTime = (): Date => {
  // 현재 UTC 시간을 기준으로 한국시간 계산
  const now = new Date();
  
  // 한국시간(KST)은 UTC+9이므로, 로컬 시간대에 관계없이 정확한 한국시간 계산
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const koreaTime = new Date(utcTime + (9 * 60 * 60 * 1000));
  
  return koreaTime;
};

const createKoreaDate = (year: number, month: number, date: number, hours: number = 0, minutes: number = 0): Date => {
  // 한국시간 기준으로 Date 객체 생성
  // month는 0부터 시작하므로 주의
  const koreaTime = new Date();
  koreaTime.setFullYear(year, month - 1, date);
  koreaTime.setHours(hours, minutes, 0, 0);
  
  // 한국시간으로 설정된 시간을 UTC 기준으로 조정
  const utcTime = koreaTime.getTime() - (koreaTime.getTimezoneOffset() * 60000);
  return new Date(utcTime - (9 * 60 * 60 * 1000));
};

const parseKoreaTimeString = (timeString: string): Date => {
  // ISO 문자열을 파싱하여 한국시간으로 처리
  const date = new Date(timeString);
  
  // datetime-local 입력에서 오는 값은 로컬 시간으로 간주되므로
  // 한국시간으로 입력된 것으로 처리
  return date;
};

class SchedulerService {
  private jobs: Map<string, ScheduledJob> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor() {
    console.log('📅 스케줄러 서비스 초기화 중... (한국시간 기준)');
    console.log('🌏 현재 한국시간:', getKoreaTime().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
    
    // 자동으로 스케줄러 시작
    this.startScheduler();
  }

  // 스케줄러 시작
  startScheduler() {
    if (this.isRunning) {
      console.log('⚠️ 스케줄러가 이미 실행 중입니다.');
      return;
    }

    this.isRunning = true;
    console.log('🚀 스케줄러 시작됨 (한국시간 기준)');
    
    // 즉시 한 번 실행
    this.checkAndExecuteJobs();
    
    // 30초마다 작업 확인 (더 자주 확인)
    const interval = setInterval(() => {
      this.checkAndExecuteJobs();
    }, 30000);
    
    this.intervals.set('main', interval);
    console.log('⏰ 스케줄러 간격: 30초마다 작업 확인');
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
    const now = getKoreaTime();
    
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
            scheduledTime = parseKoreaTimeString(workflow.scheduleSettings.scheduledTime);
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
    
    console.log(`📅 워크플로우 예약됨: ${workflow.name} (한국시간: ${scheduledTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })})`);
    
    return jobId;
  }

  // 다음 반복 실행 시간 계산 (한국시간 기준)
  private calculateNextRecurringTime(pattern: any): Date {
    const now = getKoreaTime();
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

  // 예약된 작업 확인 및 실행 (한국시간 기준)
  private async checkAndExecuteJobs() {
    const now = getKoreaTime();
    const allJobs = Array.from(this.jobs.values());
    const pendingJobs = allJobs.filter(
      job => job.status === 'pending' && job.scheduledTime <= now
    );

    // 현재 상태 로그
    console.log(`🔍 작업 확인 중 (한국시간: ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })})`);
    console.log(`📊 전체 작업: ${allJobs.length}개, 대기 중: ${allJobs.filter(j => j.status === 'pending').length}개, 실행 예정: ${pendingJobs.length}개`);
    
    // 대기 중인 작업들 상세 정보
    if (allJobs.filter(j => j.status === 'pending').length > 0) {
      console.log('⏳ 대기 중인 작업들:');
      allJobs.filter(j => j.status === 'pending').forEach(job => {
        const timeUntil = job.scheduledTime.getTime() - now.getTime();
        const minutesUntil = Math.round(timeUntil / (1000 * 60));
        console.log(`  - ${job.workflow.name}: ${job.scheduledTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (${minutesUntil}분 ${minutesUntil > 0 ? '후' : '전'})`);
      });
    }

    if (pendingJobs.length > 0) {
      console.log(`⏰ 실행할 작업 ${pendingJobs.length}개 발견!`);
      for (const job of pendingJobs) {
        console.log(`🎯 실행 대상: ${job.workflow.name} (예정: ${job.scheduledTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })})`);
      }
    }

    for (const job of pendingJobs) {
      await this.executeJob(job);
    }
  }

  // 작업 실행
  private async executeJob(job: ScheduledJob) {
    try {
      console.log(`🚀 워크플로우 실행 시작: ${job.workflow.name}`);
      console.log(`⏰ 예정 시간: ${job.scheduledTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      console.log(`🕐 현재 시간: ${getKoreaTime().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      
      job.status = 'running';
      job.executedAt = getKoreaTime();

      // 🔧 Supabase에서 최신 워크플로우 데이터 조회
      console.log('📊 Supabase에서 최신 워크플로우 데이터 조회 중...');
      
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXT_PUBLIC_BASE_URL)
        : 'http://localhost:3000';
      
      const workflowResponse = await fetch(`${baseUrl}/api/supabase/workflows/${job.workflowId}`);
      
      if (!workflowResponse.ok) {
        throw new Error(`워크플로우 조회 실패: ${workflowResponse.status}`);
      }
      
      const workflowResult = await workflowResponse.json();
      
      if (!workflowResult.success || !workflowResult.data) {
        throw new Error(`워크플로우 데이터 조회 실패: ${workflowResult.message}`);
      }
      
      const supabaseWorkflow = workflowResult.data;
      console.log('📋 Supabase 워크플로우 데이터:', {
        id: supabaseWorkflow.id,
        name: supabaseWorkflow.name,
        hasTargetConfig: !!supabaseWorkflow.target_config,
        targetGroupsCount: supabaseWorkflow.target_config?.targetGroups?.length || 0,
        hasMessageConfig: !!supabaseWorkflow.message_config,
        stepsCount: supabaseWorkflow.message_config?.steps?.length || 0
      });

      // Supabase 데이터를 스케줄러가 이해할 수 있는 형태로 변환
      const testWorkflow = {
        id: supabaseWorkflow.id,
        name: supabaseWorkflow.name,
        description: supabaseWorkflow.description || '',
        status: 'active',
        // 🎯 타겟 그룹 정보 올바르게 매핑
        targetGroups: supabaseWorkflow.target_config?.targetGroups || [],
        // 📝 메시지 단계 정보 올바르게 매핑  
        steps: supabaseWorkflow.message_config?.steps || [],
        // ⚙️ 테스트 설정 (스케줄러 실행용)
        testSettings: {
          enableRealSending: true, // 스케줄된 실행은 실제 발송
          testMode: false, // 실제 타겟 그룹 사용
          testPhoneNumber: supabaseWorkflow.variables?.testSettings?.testPhoneNumber || ''
        },
        // 📅 스케줄 설정
        scheduleSettings: {
          type: 'immediate' as const,
          timezone: 'Asia/Seoul'
        },
        // 🏷️ 기타 정보
        createdAt: supabaseWorkflow.created_at,
        updatedAt: supabaseWorkflow.updated_at
      };

      console.log('📤 워크플로우 API 호출 중...', {
        workflowId: testWorkflow.id,
        workflowName: testWorkflow.name,
        enableRealSending: testWorkflow.testSettings?.enableRealSending,
        testMode: testWorkflow.testSettings?.testMode,
        stepsCount: testWorkflow.steps?.length || 0,
        targetGroupsCount: testWorkflow.targetGroups?.length || 0,
        targetGroupsDetail: testWorkflow.targetGroups?.map((g: any) => ({
          id: g.id,
          name: g.name,
          type: g.type,
          hasDynamicQuery: !!g.dynamicQuery
        }))
      });

      console.log('🌐 API 호출 URL:', `${baseUrl}/api/workflow/test`);

      const response = await fetch(`${baseUrl}/api/workflow/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow: testWorkflow
        })
      });

      console.log('📡 API 응답 상태:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        job.status = 'completed';
        console.log(`✅ 워크플로우 실행 완료: ${job.workflow.name}`, {
          success: result.success,
          message: result.message,
          sentCount: result.results?.length || 0
        });
        
        // 반복 작업인 경우 다음 실행 예약
        if (job.workflow.scheduleSettings?.type === 'recurring') {
          console.log('🔄 반복 작업이므로 다음 실행 예약 중...');
          this.scheduleWorkflow(job.workflow);
        }
      } else {
        const errorText = await response.text();
        console.error('❌ API 응답 오류:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : '알 수 없는 오류';
      console.error(`❌ 워크플로우 실행 실패: ${job.workflow.name}`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
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