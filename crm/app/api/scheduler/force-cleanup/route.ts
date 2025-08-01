import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { formatKoreaTime, getKoreaTime } from '@/lib/utils/timezone';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    const now = getKoreaTime();
    const supabase = getSupabase();
    
    console.log(`\n🔧 === 강제 작업 정리 ===`);
    console.log(`📋 대상 작업 ID: ${jobId || 'ALL'}`);
    console.log(`📋 현재 시간: ${formatKoreaTime(now)}`);
    
    let query = supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('status', 'running');
    
    if (jobId) {
      query = query.eq('id', jobId);
    }
    
    const { data: jobs, error } = await query;
    
    if (error) {
      throw error;
    }
    
    console.log(`📋 대상 작업 수: ${jobs?.length || 0}개`);
    
    const cleanupResults = [];
    
    if (jobs && jobs.length > 0) {
      for (const job of jobs) {
        console.log(`\n--- 작업 정리: ${job.id} ---`);
        console.log(`📋 워크플로우: ${job.workflow_data?.name || 'Unknown'}`);
        console.log(`📋 상태: ${job.status}`);
        console.log(`📋 executed_at: ${job.executed_at}`);
        
        const { error: updateError } = await supabase
          .from('scheduled_jobs')
          .update({
            status: 'failed',
            error_message: '관리자 강제 정리',
            updated_at: formatKoreaTime(now, 'yyyy-MM-dd HH:mm:ss')
          })
          .eq('id', job.id);
        
        if (updateError) {
          console.error(`❌ 정리 실패: ${job.id}`, updateError);
          cleanupResults.push({
            id: job.id,
            workflow_name: job.workflow_data?.name,
            status: 'failed',
            error: updateError.message
          });
        } else {
          console.log(`✅ 정리 완료: ${job.id}`);
          cleanupResults.push({
            id: job.id,
            workflow_name: job.workflow_data?.name,
            status: 'success'
          });
        }
      }
    }
    
    console.log(`🎯 정리 완료: ${cleanupResults.length}개 작업`);
    
    return NextResponse.json({
      success: true,
      data: {
        cleaned_jobs: cleanupResults.length,
        results: cleanupResults,
        timestamp: formatKoreaTime(now)
      },
      message: `${cleanupResults.length}개 작업 정리 완료`
    });
    
  } catch (error) {
    console.error('❌ 강제 정리 실패:', error);
    return NextResponse.json({
      success: false,
      message: '강제 정리 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
} 