import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { koreaTimeToUTCString, getKoreaTime } from '@/lib/utils/timezone';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ success: false, message: 'jobId가 필요합니다.' }, { status: 400 });
    }
    
    console.log(`🔄 스케줄 잡 수동 업데이트 테스트: ${jobId}`);
    
    // 먼저 스케줄 잡 존재 여부 확인
    const { data: existingJob, error: checkError } = await getSupabase()
      .from('scheduled_jobs')
      .select('id, status, workflow_id')
      .eq('id', jobId)
      .single();
      
    if (checkError) {
      console.error(`❌ 스케줄 잡 조회 실패: ${jobId}`, checkError);
      return NextResponse.json({ 
        success: false, 
        message: `스케줄 잡 조회 실패: ${checkError.message}`,
        error: checkError 
      }, { status: 500 });
    }
    
    if (!existingJob) {
      console.warn(`⚠️ 스케줄 잡이 존재하지 않음: ${jobId}`);
      return NextResponse.json({ 
        success: false, 
        message: `스케줄 잡이 존재하지 않음: ${jobId}` 
      }, { status: 404 });
    }
    
    console.log(`📋 스케줄 잡 확인됨: ${jobId}`, existingJob);
    
    // 실제 업데이트 수행
    const endTime = getKoreaTime();
    const { data: updateResult, error: updateError } = await getSupabase()
      .from('scheduled_jobs')
      .update({ 
        status: 'completed',
        completed_at: koreaTimeToUTCString(endTime),
        updated_at: koreaTimeToUTCString(endTime)
      })
      .eq('id', jobId)
      .select();
    
    if (updateError) {
      console.error(`❌ 스케줄 잡 완료 처리 실패: ${jobId}`, updateError);
      return NextResponse.json({ 
        success: false, 
        message: `스케줄 잡 완료 처리 실패: ${updateError.message}`,
        error: updateError 
      }, { status: 500 });
    }
    
    if (updateResult && updateResult.length > 0) {
      console.log(`✅ 스케줄 잡 완료 처리 성공: ${jobId}`, updateResult[0]);
      return NextResponse.json({ 
        success: true, 
        message: `스케줄 잡 완료 처리 성공: ${jobId}`,
        before: existingJob,
        after: updateResult[0]
      });
    } else {
      console.warn(`⚠️ 스케줄 잡 업데이트 결과 없음: ${jobId}`);
      return NextResponse.json({ 
        success: false, 
        message: `스케줄 잡 업데이트 결과 없음: ${jobId}` 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ 스케줄 잡 수동 업데이트 테스트 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '스케줄 잡 수동 업데이트 테스트 실패',
      error: error
    }, { status: 500 });
  }
} 