import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  koreaTimeToUTCString 
} from '@/lib/utils/timezone';
import { handleWorkflowActivation, handleWorkflowDeactivation } from '@/lib/utils/workflow-scheduler';

// GET: 단일 워크플로우 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Workflow ID is required'
      }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Workflow not found'
        }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('워크플로우 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// PUT: 워크플로우 전체 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Workflow ID is required'
      }, { status: 400 });
    }

    const {
      name,
      description,
      message_config = {},
      target_config = {},
      variables = {},
      schedule_config,
      trigger_config = {},
      trigger_type,
      status
    } = body;

    // 입력 검증
    if (name && !name.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Workflow name cannot be empty'
      }, { status: 400 });
    }

    if (trigger_type && !['manual', 'webhook'].includes(trigger_type)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid trigger type. Only "manual" and "webhook" are supported.'
      }, { status: 400 });
    }

    if (status && !['draft', 'active', 'paused', 'archived'].includes(status)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid status'
      }, { status: 400 });
    }

    console.log('🔥 워크플로우 업데이트 요청:', {
      id,
      name,
      trigger_type,
      targetGroupsCount: target_config?.targetGroups?.length || 0,
      templatesCount: message_config?.selectedTemplates?.length || 0,
      stepsCount: message_config?.steps?.length || 0,
      mappingsCount: target_config?.targetTemplateMappings?.length || 0
    });

    const supabase = getSupabase();

    // 기존 워크플로우 정보 조회 (상태 변경 감지용)
    const { data: existingWorkflow, error: fetchError } = await supabase
      .from('workflows')
      .select('trigger_type, status, schedule_config')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Workflow not found'
        }, { status: 404 });
      }
      throw fetchError;
    }

    const workflowType = trigger_type || existingWorkflow?.trigger_type || 'manual';

    // 기본 업데이트 데이터
    const baseUpdateData: any = {
      updated_at: koreaTimeToUTCString(getKoreaTime())
    };

    // 선택적 필드 업데이트
    if (name !== undefined) baseUpdateData.name = name.trim();
    if (description !== undefined) baseUpdateData.description = description?.trim() || null;
    if (status !== undefined) baseUpdateData.status = status;

    if (message_config !== undefined) {
      baseUpdateData.message_config = {
        steps: message_config?.steps || [],
        selectedTemplates: message_config?.selectedTemplates || []
      };
    }

    if (variables !== undefined) {
      baseUpdateData.variables = {
        templatePersonalizations: variables?.templatePersonalizations || {},
        testSettings: variables?.testSettings || {}
      };
    }

    if (schedule_config !== undefined) {
      baseUpdateData.schedule_config = schedule_config;
    }

    let updateData;

    if (workflowType === 'webhook') {
      // 웹훅 워크플로우: trigger_config만 업데이트, target_config 건드리지 않음
      console.log('📡 웹훅 워크플로우 업데이트 - target_config 제외');
      updateData = {
        ...baseUpdateData,
        ...(trigger_config && { trigger_config })
      };
    } else {
      // Manual 워크플로우: target_config 포함 업데이트
      console.log(`🎯 ${workflowType} 워크플로우 업데이트 - target_config 포함`);
      updateData = {
        ...baseUpdateData,
        ...(target_config !== undefined && {
          target_config: {
            targetGroups: target_config?.targetGroups || [],
            targetTemplateMappings: target_config?.targetTemplateMappings || []
          }
        }),
        ...(target_config?.targetTemplateMappings !== undefined && {
          mapping_config: {
            targetTemplateMappings: target_config.targetTemplateMappings || []
          }
        })
      };
    }

    const { data, error } = await supabase
      .from('workflows')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ 워크플로우 업데이트 완료:', {
      id: data.id,
      name: data.name,
      trigger_type: data.trigger_type
    });

    // 🔥 상태 변경에 따른 자동 스케줄링 처리
    let schedulingResult = null;
    
    const oldStatus = existingWorkflow.status;
    const newStatus = data.status;
    const oldScheduleConfig = existingWorkflow.schedule_config;
    const newScheduleConfig = data.schedule_config;
    
    console.log(`📋 상태 변경 감지: ${oldStatus} → ${newStatus}`);
    
    // 활성화된 경우 (draft/paused/archived → active)
    if (oldStatus !== 'active' && newStatus === 'active') {
      console.log(`🟢 워크플로우 활성화 감지: ${data.name}`);
      schedulingResult = await handleWorkflowActivation(data);
    }
    // 비활성화된 경우 (active → draft/paused/archived)
    else if (oldStatus === 'active' && newStatus !== 'active') {
      console.log(`🔴 워크플로우 비활성화 감지: ${data.name}`);
      schedulingResult = await handleWorkflowDeactivation(data.id);
    }
    // 이미 active 상태에서 스케줄 설정이 변경된 경우
    else if (oldStatus === 'active' && newStatus === 'active' && 
             JSON.stringify(oldScheduleConfig) !== JSON.stringify(newScheduleConfig)) {
      console.log(`🔄 활성 워크플로우 스케줄 설정 변경 감지: ${data.name}`);
      // 기존 스케줄 제거하고 새로 생성
      await handleWorkflowDeactivation(data.id);
      schedulingResult = await handleWorkflowActivation(data);
    }
    
    if (schedulingResult) {
      if (schedulingResult.success) {
        console.log(`✅ 자동 스케줄링 처리 완료: ${data.name}`);
      } else {
        console.error(`❌ 자동 스케줄링 처리 실패: ${data.name}`, schedulingResult.error);
        // 스케줄링 실패는 워크플로우 업데이트 성공에 영향을 주지 않음
      }
    }

    return NextResponse.json({
      success: true,
      data: data,
      scheduling: schedulingResult // 스케줄링 결과 포함
    });

  } catch (error) {
    console.error('워크플로우 업데이트 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// PATCH: 워크플로우 부분 업데이트 (주로 상태 변경)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Workflow ID is required'
      }, { status: 400 });
    }

    const { status, ...otherFields } = body;

    if (!status) {
      return NextResponse.json({
        success: false,
        error: 'Status is required for PATCH operation'
      }, { status: 400 });
    }

    if (!['draft', 'active', 'paused', 'archived'].includes(status)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid status'
      }, { status: 400 });
    }

    console.log('🔄 워크플로우 상태 변경 요청:', { id, status });

    const supabase = getSupabase();

    // 워크플로우 존재 확인
    const { data: existingWorkflow, error: fetchError } = await supabase
      .from('workflows')
      .select('id, name')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Workflow not found'
        }, { status: 404 });
      }
      throw fetchError;
    }

    const updateData = {
      status: status,
      updated_at: koreaTimeToUTCString(getKoreaTime()),
      ...otherFields
    };

    const { data, error } = await supabase
      .from('workflows')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ 워크플로우 상태 변경 완료:', { id, status });

    // 워크플로우를 일시정지/보관할 때 관련 스케줄 작업 취소
    if (status === 'paused' || status === 'archived') {
      console.log(`🗑️ 워크플로우 비활성화로 인한 스케줄 작업 취소 시작: ${id}`);
      
      try {
        const { data: cancelledJobs, error: cancelError } = await supabase
          .from('scheduled_jobs')
          .update({
            status: 'cancelled',
            error_message: `워크플로우가 ${status} 상태로 변경되어 자동 취소됨`,
            updated_at: koreaTimeToUTCString(getKoreaTime())
          })
          .eq('workflow_id', id)
          .in('status', ['pending', 'running'])
          .select();
          
        if (cancelError) {
          console.error(`❌ 스케줄 작업 취소 실패: ${id}`, cancelError);
        } else {
          const cancelledCount = cancelledJobs?.length || 0;
          console.log(`✅ 스케줄 작업 ${cancelledCount}개 취소 완료: ${id}`);
        }
      } catch (cancelException) {
        console.error(`❌ 스케줄 작업 취소 중 예외 발생: ${id}`, cancelException);
      }
    }

    const message = status === 'active' ? '활성화' : 
                   status === 'paused' ? '일시정지' : 
                   status === 'archived' ? '보관' : '업데이트';

    return NextResponse.json({
      success: true,
      data: data,
      message: `워크플로우가 ${message}되었습니다.`
    });

  } catch (error) {
    console.error('워크플로우 상태 변경 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// DELETE: 워크플로우 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Workflow ID is required'
      }, { status: 400 });
    }

    const supabase = getSupabase();

    // 워크플로우 존재 확인
    const { data: existingWorkflow, error: fetchError } = await supabase
      .from('workflows')
      .select('id, name')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Workflow not found'
        }, { status: 404 });
      }
      throw fetchError;
    }

    console.log(`🗑️ 워크플로우 삭제 요청: ${existingWorkflow.name} (${id})`);

    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log(`✅ 워크플로우 삭제 완료: ${existingWorkflow.name} (${id})`);

    return NextResponse.json({
      success: true,
      message: `워크플로우 '${existingWorkflow.name}'가 삭제되었습니다.`
    });

  } catch (error) {
    console.error('워크플로우 삭제 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
} 