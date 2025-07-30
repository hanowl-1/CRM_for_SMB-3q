import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  koreaTimeToUTCString 
} from '@/lib/utils/timezone';

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
      selectedTemplates,
      targetGroups,
      templatePersonalizations,
      targetTemplateMappings,
      scheduleSettings,
      schedule_config,
      testSettings,
      steps,
      trigger_type,
      trigger_config,
      status
    } = body;

    // 입력 검증
    if (name && !name.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Workflow name cannot be empty'
      }, { status: 400 });
    }

    if (trigger_type && !['manual', 'schedule', 'webhook'].includes(trigger_type)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid trigger type'
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
      targetGroupsCount: targetGroups?.length || 0,
      templatesCount: selectedTemplates?.length || 0,
      stepsCount: steps?.length || 0,
      mappingsCount: targetTemplateMappings?.length || 0
    });

    const supabase = getSupabase();

    // 기존 워크플로우 정보 조회 (타입 확인용)
    const { data: existingWorkflow, error: fetchError } = await supabase
      .from('workflows')
      .select('trigger_type')
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

    if (steps !== undefined || selectedTemplates !== undefined) {
      baseUpdateData.message_config = {
        steps: steps || [],
        selectedTemplates: selectedTemplates || []
      };
    }

    if (templatePersonalizations !== undefined || testSettings !== undefined) {
      baseUpdateData.variables = {
        templatePersonalizations: templatePersonalizations || {},
        testSettings: testSettings || {}
      };
    }

    if (scheduleSettings !== undefined || schedule_config !== undefined) {
      baseUpdateData.schedule_config = schedule_config || scheduleSettings || {};
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
      // Manual/Schedule 워크플로우: target_config 포함 업데이트
      console.log(`🎯 ${workflowType} 워크플로우 업데이트 - target_config 포함`);
      updateData = {
        ...baseUpdateData,
        ...(targetGroups !== undefined && {
          target_config: {
            targetGroups: targetGroups || [],
            targetTemplateMappings: targetTemplateMappings || []
          }
        }),
        ...(targetTemplateMappings !== undefined && {
          mapping_config: {
            targetTemplateMappings: targetTemplateMappings || []
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

    return NextResponse.json({
      success: true,
      data: data
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