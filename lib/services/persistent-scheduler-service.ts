import { getSupabase } from '@/lib/database/supabase-client';
import { Workflow } from '@/lib/types/workflow';

interface PersistentScheduledJob {
  id: string;
  workflow_id: string;
  scheduled_time: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  workflow_data: any;
  created_at: string;
  updated_at: string;
  executed_at?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
}

class PersistentSchedulerService {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('📅 영구 스케줄러 서비스 초기화 중...');
    this.ensureScheduleTable();
    this.startScheduler();
  }

  // 스케줄 테이블 생성
  private async ensureScheduleTable() {
    try {
      const client = getSupabase();
      
      // 스케줄 테이블 생성 - 직접 SQL 실행 방식으로 변경
      console.log('📅 scheduled_jobs 테이블 생성 시도...');
      
      // 1. 먼저 테이블이 존재하는지 확인
      const { data: existingTable, error: checkError } = await client
        .from('scheduled_jobs')
        .select('id')
        .limit(1);

      if (checkError && checkError.code === '42P01') {
        // 테이블이 없으면 Supabase 대시보드에서 생성하도록 안내
        console.log('⚠️ scheduled_jobs 테이블이 없습니다.');
        console.log('📝 Supabase 대시보드에서 다음 SQL을 실행해주세요:');
        console.log(`
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  workflow_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_time ON scheduled_jobs(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_workflow_id ON scheduled_jobs(workflow_id);

-- 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER trigger_update_scheduled_jobs_updated_at
  BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_jobs_updated_at();
        `);
        
        // 테이블이 없으면 일단 패스하고 계속 진행
        console.log('⏭️ 테이블 생성을 건너뛰고 계속 진행합니다.');
        return;
      }

      console.log('✅ scheduled_jobs 테이블이 이미 존재합니다.');
    } catch (error) {
      console.error('❌ 스케줄 테이블 확인 실패:', error);
      console.log('⏭️ 테이블 확인을 건너뛰고 계속 진행합니다.');
    }
  }

  // 워크플로우 예약 (DB에 저장)
  async scheduleWorkflow(workflow: Workflow): Promise<string> {
    try {
      const client = getSupabase();
      const now = new Date();
      
      let scheduledTime: Date;
      
      if (!workflow.scheduleSettings) {
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
            scheduledTime = this.calculateNextRecurringTime(workflow.scheduleSettings.recurringPattern);
            break;
          default:
            scheduledTime = now;
        }
      }

      const { data, error } = await client
        .from('scheduled_jobs')
        .insert([{
          workflow_id: workflow.id,
          scheduled_time: scheduledTime.toISOString(),
          workflow_data: workflow,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ 워크플로우 예약 실패:', error);
        throw error;
      }

      console.log(`📅 워크플로우 예약됨 (DB 저장): ${workflow.name} (${scheduledTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })})`);
      return data.id;
    } catch (error) {
      console.error('❌ 워크플로우 예약 실패:', error);
      throw error;
    }
  }

  // 다음 반복 실행 시간 계산
  private calculateNextRecurringTime(pattern: any): Date {
    if (!pattern || !pattern.time) {
      return new Date(Date.now() + 60 * 60 * 1000); // 1시간 후
    }
    
    const [hours, minutes] = pattern.time.split(':').map(Number);
    console.log(`⏰ 설정된 시간: ${hours}:${minutes.toString().padStart(2, '0')}`);
    
    // 현재 한국시간 (데이터베이스가 한국시간으로 설정됨)
    const now = new Date();
    console.log(`🇰🇷 현재 시간: ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`🌍 현재 시간 (ISO): ${now.toISOString()}`);
    
    let nextTime: Date;
    
    switch (pattern.frequency) {
      case 'daily':
        // 오늘 목표 시간 설정
        nextTime = new Date();
        nextTime.setHours(hours, minutes, 0, 0);
        
        console.log(`📅 오늘 목표 시간: ${nextTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
        
        // 만약 오늘의 해당 시간이 이미 지났다면 내일로 설정
        if (nextTime <= now) {
          nextTime.setDate(nextTime.getDate() + (pattern.interval || 1));
          console.log(`➡️ 내일로 설정됨: ${nextTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
        }
        break;
        
      case 'weekly':
        // 주간 반복
        nextTime = new Date();
        nextTime.setHours(hours, minutes, 0, 0);
        
        if (nextTime <= now) {
          nextTime.setDate(nextTime.getDate() + 7 * (pattern.interval || 1));
        }
        break;
        
      case 'monthly':
        // 월간 반복
        nextTime = new Date();
        nextTime.setDate(pattern.dayOfMonth || 1);
        nextTime.setHours(hours, minutes, 0, 0);
        
        if (nextTime <= now) {
          nextTime.setMonth(nextTime.getMonth() + (pattern.interval || 1));
        }
        break;
        
      default:
        return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    
    console.log(`🌍 최종 다음 실행 시간: ${nextTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`🌍 최종 다음 실행 시간 (ISO): ${nextTime.toISOString()}`);
    
    // 검증: 설정된 시간과 일치하는지 확인
    console.log(`✅ 검증 - 시간 일치: ${nextTime.getHours() === hours && nextTime.getMinutes() === minutes}`);
    
    return nextTime;
  }

  // 스케줄러 시작
  startScheduler() {
    if (this.isRunning) {
      console.log('⚠️ 영구 스케줄러가 이미 실행 중입니다.');
      return;
    }

    this.isRunning = true;
    console.log('🚀 영구 스케줄러 시작됨');
    
    // 즉시 한 번 실행
    this.checkAndExecuteJobs();
    
    // 30초마다 작업 확인
    this.checkInterval = setInterval(() => {
      this.checkAndExecuteJobs();
    }, 30000);
  }

  // 스케줄러 중지
  stopScheduler() {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('⏹️ 영구 스케줄러 서비스 중지됨');
  }

  // 예약된 작업 확인 및 실행
  private async checkAndExecuteJobs() {
    try {
      const client = getSupabase();
      const now = new Date();
      
      // 실행할 작업들 조회
      const { data: jobs, error } = await client
        .from('scheduled_jobs')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_time', now.toISOString())
        .order('scheduled_time', { ascending: true });

      if (error) {
        console.error('❌ 예약된 작업 조회 실패:', error);
        return;
      }

      if (!jobs || jobs.length === 0) {
        return;
      }

      console.log(`⏰ 실행할 작업 ${jobs.length}개 발견!`);

      for (const job of jobs) {
        await this.executeJob(job);
      }
    } catch (error) {
      console.error('❌ 작업 확인 및 실행 실패:', error);
    }
  }

  // 작업 실행
  private async executeJob(job: PersistentScheduledJob) {
    try {
      const client = getSupabase();
      
      // 상태를 실행 중으로 변경
      await client
        .from('scheduled_jobs')
        .update({ 
          status: 'running',
          executed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      console.log(`🚀 워크플로우 실행 시작: ${job.workflow_data.name}`);

      // 워크플로우 API 호출
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXT_PUBLIC_BASE_URL)
        : 'http://localhost:3001'; // 포트를 3001로 수정

      const response = await fetch(`${baseUrl}/api/workflow/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow: {
            ...job.workflow_data,
            testSettings: {
              enableRealSending: true,
              testMode: false
            }
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // 성공 상태로 업데이트
        await client
          .from('scheduled_jobs')
          .update({ status: 'completed' })
          .eq('id', job.id);

        console.log(`✅ 워크플로우 실행 완료: ${job.workflow_data.name}`);
        
        // 반복 작업인 경우 다음 실행 예약
        if (job.workflow_data.scheduleSettings?.type === 'recurring') {
          console.log('🔄 반복 작업이므로 다음 실행 예약 중...');
          await this.scheduleWorkflow(job.workflow_data);
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

    } catch (error) {
      const client = getSupabase();
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      
      // 실패 상태로 업데이트
      await client
        .from('scheduled_jobs')
        .update({ 
          status: 'failed',
          error_message: errorMessage,
          retry_count: job.retry_count + 1
        })
        .eq('id', job.id);

      console.error(`❌ 워크플로우 실행 실패: ${job.workflow_data.name}`, errorMessage);
      
      // 재시도 로직
      if (job.retry_count < job.max_retries) {
        console.log(`🔄 재시도 예약: ${job.workflow_data.name} (${job.retry_count + 1}/${job.max_retries})`);
        
        // 5분 후 재시도
        const retryTime = new Date(Date.now() + 5 * 60 * 1000);
        await client
          .from('scheduled_jobs')
          .update({
            status: 'pending',
            scheduled_time: retryTime.toISOString()
          })
          .eq('id', job.id);
      }
    }
  }

  // 스케줄러 상태 조회
  async getStatus() {
    try {
      const client = getSupabase();
      
      const { data: jobs, error } = await client
        .from('scheduled_jobs')
        .select('status, scheduled_time, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ 스케줄러 상태 조회 실패:', error);
        return {
          isRunning: this.isRunning,
          totalJobs: 0,
          pendingJobs: 0,
          runningJobs: 0,
          completedJobs: 0,
          failedJobs: 0
        };
      }

      const now = new Date();
      const nextJob = jobs
        ?.filter(j => j.status === 'pending' && new Date(j.scheduled_time) > now)
        .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())[0];

      return {
        isRunning: this.isRunning,
        totalJobs: jobs?.length || 0,
        pendingJobs: jobs?.filter(j => j.status === 'pending').length || 0,
        runningJobs: jobs?.filter(j => j.status === 'running').length || 0,
        completedJobs: jobs?.filter(j => j.status === 'completed').length || 0,
        failedJobs: jobs?.filter(j => j.status === 'failed').length || 0,
        nextJob: nextJob ? {
          scheduledTime: nextJob.scheduled_time,
          workflow: { name: 'Next Scheduled Job' }
        } : null
      };
    } catch (error) {
      console.error('❌ 스케줄러 상태 조회 실패:', error);
      return {
        isRunning: this.isRunning,
        totalJobs: 0,
        pendingJobs: 0,
        runningJobs: 0,
        completedJobs: 0,
        failedJobs: 0
      };
    }
  }

  // 작업 취소
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const client = getSupabase();
      
      const { error } = await client
        .from('scheduled_jobs')
        .update({ status: 'cancelled' })
        .eq('id', jobId)
        .eq('status', 'pending');

      if (error) {
        console.error('❌ 작업 취소 실패:', error);
        return false;
      }

      console.log(`🗑️ 작업 취소됨: ${jobId}`);
      return true;
    } catch (error) {
      console.error('❌ 작업 취소 실패:', error);
      return false;
    }
  }

  // 워크플로우의 모든 예약 작업 취소
  async cancelWorkflowJobs(workflowId: string): Promise<number> {
    try {
      const client = getSupabase();
      
      const { data, error } = await client
        .from('scheduled_jobs')
        .update({ status: 'cancelled' })
        .eq('workflow_id', workflowId)
        .eq('status', 'pending')
        .select();

      if (error) {
        console.error('❌ 워크플로우 작업 취소 실패:', error);
        return 0;
      }

      const cancelledCount = data?.length || 0;
      console.log(`🗑️ 워크플로우 ${workflowId}의 ${cancelledCount}개 작업 취소됨`);
      return cancelledCount;
    } catch (error) {
      console.error('❌ 워크플로우 작업 취소 실패:', error);
      return 0;
    }
  }

  // 오늘 하루 동안의 모든 스케줄 미리 생성 (Vercel Hobby 제한 대응)
  async scheduleTodaysJobs(): Promise<{ scheduledCount: number; nextJobs: any[] }> {
    try {
      const client = getSupabase();
      
      // 활성화된 반복 워크플로우 조회
      const { data: workflows, error: workflowError } = await client
        .from('workflows')
        .select('*')
        .eq('status', 'active')
        .not('schedule_settings', 'is', null);

      if (workflowError) {
        console.error('❌ 워크플로우 조회 실패:', workflowError);
        return { scheduledCount: 0, nextJobs: [] };
      }

      if (!workflows || workflows.length === 0) {
        console.log('📅 활성화된 반복 워크플로우가 없습니다.');
        return { scheduledCount: 0, nextJobs: [] };
      }

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      
      console.log(`📅 오늘 범위: ${todayStart.toLocaleString('ko-KR')} ~ ${todayEnd.toLocaleString('ko-KR')}`);

      let scheduledCount = 0;
      const nextJobs = [];

      for (const workflow of workflows) {
        try {
          const scheduleSettings = workflow.schedule_settings;
          
          if (!scheduleSettings || scheduleSettings.type !== 'recurring') {
            continue;
          }

          const pattern = scheduleSettings.recurringPattern;
          if (!pattern || !pattern.time) {
            continue;
          }

          // 오늘 실행해야 할 시간들 계산
          const todaysExecutionTimes = this.calculateTodaysExecutionTimes(pattern, todayStart);
          
          for (const executionTime of todaysExecutionTimes) {
            // 이미 같은 시간에 예약된 작업이 있는지 확인
            const { data: existingJobs, error: checkError } = await client
              .from('scheduled_jobs')
              .select('id')
              .eq('workflow_id', workflow.id)
              .eq('scheduled_time', executionTime.toISOString())
              .eq('status', 'pending');

            if (checkError) {
              console.error('❌ 기존 작업 확인 실패:', checkError);
              continue;
            }

            if (existingJobs && existingJobs.length > 0) {
              console.log(`⏭️ 이미 예약된 작업 건너뜀: ${workflow.name} (${executionTime.toLocaleString('ko-KR')})`);
              continue;
            }

            // 새 작업 예약
            const { data, error } = await client
              .from('scheduled_jobs')
              .insert([{
                workflow_id: workflow.id,
                scheduled_time: executionTime.toISOString(),
                workflow_data: {
                  id: workflow.id,
                  name: workflow.name,
                  steps: workflow.steps,
                  scheduleSettings: scheduleSettings
                },
                status: 'pending'
              }])
              .select()
              .single();

            if (error) {
              console.error('❌ 작업 예약 실패:', error);
              continue;
            }

            console.log(`📅 작업 예약됨: ${workflow.name} (${executionTime.toLocaleString('ko-KR')})`);
            scheduledCount++;
            
            nextJobs.push({
              id: data.id,
              workflowName: workflow.name,
              scheduledTime: executionTime.toISOString()
            });
          }
        } catch (error) {
          console.error(`❌ 워크플로우 ${workflow.name} 스케줄링 실패:`, error);
        }
      }

      console.log(`✅ 총 ${scheduledCount}개의 작업이 오늘 스케줄에 추가되었습니다.`);
      return { scheduledCount, nextJobs };
      
    } catch (error) {
      console.error('❌ 오늘 스케줄 생성 실패:', error);
      return { scheduledCount: 0, nextJobs: [] };
    }
  }

  // 오늘 하루 동안의 실행 시간들 계산
  private calculateTodaysExecutionTimes(pattern: any, todayStart: Date): Date[] {
    const executionTimes: Date[] = [];
    
    if (!pattern.time) {
      return executionTimes;
    }

    const [hours, minutes] = pattern.time.split(':').map(Number);
    
    switch (pattern.frequency) {
      case 'daily':
        // 매일 반복 - 오늘 한 번
        const dailyTime = new Date(todayStart);
        dailyTime.setHours(hours, minutes, 0, 0);
        
        // 현재 시간보다 미래인 경우만 추가
        if (dailyTime.getTime() > Date.now()) {
          executionTimes.push(dailyTime);
        }
        break;
        
      case 'hourly':
        // 시간별 반복 - 오늘 하루 동안 여러 번
        const interval = pattern.interval || 1;
        const startHour = Math.max(hours, new Date().getHours());
        
        for (let hour = startHour; hour < 24; hour += interval) {
          const hourlyTime = new Date(todayStart);
          hourlyTime.setHours(hour, minutes, 0, 0);
          
          if (hourlyTime.getTime() > Date.now()) {
            executionTimes.push(hourlyTime);
          }
        }
        break;
        
      case 'weekly':
        // 주간 반복 - 해당 요일인 경우만
        const targetDayOfWeek = pattern.dayOfWeek || todayStart.getDay();
        if (todayStart.getDay() === targetDayOfWeek) {
          const weeklyTime = new Date(todayStart);
          weeklyTime.setHours(hours, minutes, 0, 0);
          
          if (weeklyTime.getTime() > Date.now()) {
            executionTimes.push(weeklyTime);
          }
        }
        break;
    }
    
    return executionTimes;
  }

  // 현재 실행해야 할 작업들을 즉시 확인하고 실행 (Vercel 서버리스 환경 대응)
  async checkAndExecutePendingJobs(): Promise<number> {
    try {
      const client = getSupabase();
      const now = new Date();
      
      // 배치 크기 설정 (환경변수로 조정 가능, 기본값: 50)
      const batchSize = parseInt(process.env.SCHEDULER_BATCH_SIZE || '50');
      
      // 현재 시간 이전에 예약된 대기 중인 작업들 조회
      const { data: pendingJobs, error } = await client
        .from('scheduled_jobs')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_time', now.toISOString())
        .order('scheduled_time', { ascending: true })
        .limit(batchSize); // 환경변수로 조정 가능한 배치 크기

      if (error) {
        console.error('❌ 대기 작업 조회 실패:', error);
        return 0;
      }

      if (!pendingJobs || pendingJobs.length === 0) {
        return 0;
      }

      console.log(`⚡ ${pendingJobs.length}개의 즉시 실행할 작업 발견 (배치 크기: ${batchSize})`);
      
      let executedCount = 0;
      
      // 각 작업을 순차적으로 실행
      for (const job of pendingJobs) {
        try {
          await this.executeJob(job);
          executedCount++;
        } catch (error) {
          console.error(`❌ 작업 실행 실패: ${job.id}`, error);
        }
      }

      console.log(`✅ ${executedCount}개의 작업 즉시 실행 완료`);
      return executedCount;
      
    } catch (error) {
      console.error('❌ 즉시 실행 체크 실패:', error);
      return 0;
    }
  }
}

// 싱글톤 인스턴스
const persistentSchedulerService = new PersistentSchedulerService();

export default persistentSchedulerService;
export type { PersistentScheduledJob }; 