import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Bearer Token 인증 확인
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    if (!authHeader || !expectedToken) {
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    if (token !== expectedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('🔄 External cron job started:', new Date().toISOString());

    // 현재 시간 (한국 시간)
    const now = new Date();
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const currentTimeString = koreaTime.toTimeString().slice(0, 8); // HH:MM:SS

    console.log('현재 한국 시간:', koreaTime.toISOString());
    console.log('현재 시간 문자열:', currentTimeString);

    // 실행 가능한 스케줄 작업 조회
    const { data: jobs, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .in('status', ['pending', 'running'])
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('스케줄 작업 조회 오류:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log(`총 ${jobs?.length || 0}개의 스케줄 작업 발견`);

    const executableJobs = [];
    
    for (const job of jobs || []) {
      const scheduledTime = new Date(job.scheduled_time);
      const scheduledTimeString = scheduledTime.toTimeString().slice(0, 8);
      
      // 시간 차이 계산 (초)
      const timeDiff = (koreaTime.getTime() - scheduledTime.getTime()) / 1000;
      const isExecutable = timeDiff >= 0 && timeDiff <= 300; // 5분 이내

      console.log(`작업 ${job.id}: 예정시간=${scheduledTimeString}, 현재시간=${currentTimeString}, 차이=${Math.round(timeDiff)}초, 실행가능=${isExecutable}, 상태=${job.status}`);

      if (isExecutable && job.status === 'pending') {
        executableJobs.push(job);
      }
    }

    console.log(`실행할 작업 수: ${executableJobs.length}`);

    const results = [];

    for (const job of executableJobs) {
      try {
        console.log(`🚀 작업 실행 시작: ${job.id} (${job.workflow_name})`);

        // 작업 상태를 running으로 변경
        await supabase
          .from('scheduled_jobs')
          .update({ 
            status: 'running',
            started_at: new Date().toISOString()
          })
          .eq('id', job.id);

        // 워크플로우 실행 API 호출
        const workflowResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/workflow/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workflowId: job.workflow_id,
            scheduledJobId: job.id
          })
        });

        if (workflowResponse.ok) {
          const workflowResult = await workflowResponse.json();
          console.log(`✅ 작업 ${job.id} 실행 성공:`, workflowResult);
          
          // 작업 상태를 completed로 변경
          await supabase
            .from('scheduled_jobs')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);

          results.push({
            jobId: job.id,
            status: 'completed',
            result: workflowResult
          });
        } else {
          const errorText = await workflowResponse.text();
          console.error(`❌ 작업 ${job.id} 실행 실패:`, errorText);
          
          // 작업 상태를 failed로 변경
          await supabase
            .from('scheduled_jobs')
            .update({ 
              status: 'failed',
              error_message: errorText,
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);

          results.push({
            jobId: job.id,
            status: 'failed',
            error: errorText
          });
        }
      } catch (error) {
        console.error(`❌ 작업 ${job.id} 처리 중 오류:`, error);
        
        // 작업 상태를 failed로 변경
        await supabase
          .from('scheduled_jobs')
          .update({ 
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        results.push({
          jobId: job.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('🔄 External cron job completed:', new Date().toISOString());

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalJobs: jobs?.length || 0,
      executableJobs: executableJobs.length,
      results
    });

  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // POST 요청도 같은 로직으로 처리
  return GET(request);
} 