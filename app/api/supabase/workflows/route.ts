import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  koreaTimeToUTCString 
} from '@/lib/utils/timezone';

// GET: 워크플로우 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    const supabase = getSupabase();

    if (action === 'list') {
      // 모든 워크플로우 조회
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: data || []
      });
    }

    if (action === 'get' && id) {
      // 특정 워크플로우 조회
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: data
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action or missing parameters'
    }, { status: 400 });

  } catch (error) {
    console.error('워크플로우 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// POST: 워크플로우 생성/업데이트/삭제 등 액션 처리
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const supabase = getSupabase();

    if (action === 'create') {
      // 새 워크플로우 생성
      const {
        name,
        description,
        selectedTemplates,
        targetGroups,
        templatePersonalizations,
        targetTemplateMappings,
        scheduleSettings,
        schedule_config,  // 🔥 추가: DB 필드명과 일치
        testSettings,
        steps,
        createdBy = 'user',
        trigger_type = 'manual',
        trigger_config = {},
        status = 'draft'
      } = body;

      console.log('🔥 워크플로우 생성 요청:', {
        name,
        trigger_type,
        targetGroupsCount: targetGroups?.length || 0,
        templatesCount: selectedTemplates?.length || 0,
        stepsCount: steps?.length || 0,
        mappingsCount: targetTemplateMappings?.length || 0
      });

      // 🎯 워크플로우 타입별 필드 최적화
      const baseWorkflowData = {
        name,
        description,
        trigger_type,
        status,
        created_by: createdBy,
        message_config: {
          steps: steps || [],
          selectedTemplates: selectedTemplates || []
        }
      };

      let workflowData;
      
      if (trigger_type === 'webhook') {
        // 🔥 웹훅 워크플로우: trigger_config만 저장, target_config 제외
        console.log('📡 웹훅 워크플로우 생성 - target_config 제외');
        workflowData = {
          ...baseWorkflowData,
          trigger_config,
          schedule_config: schedule_config || scheduleSettings || {},
          variables: {
            templatePersonalizations: templatePersonalizations || {},
            testSettings: testSettings || {}
          }
        };
      } else {
        // 🎯 Manual/Schedule 워크플로우: target_config 포함, trigger_config는 기본값
        console.log(`🎯 ${trigger_type} 워크플로우 생성 - target_config 포함`);
        workflowData = {
          ...baseWorkflowData,
          trigger_config: trigger_config || {},
          target_config: {
            targetGroups: targetGroups || [],
            targetTemplateMappings: targetTemplateMappings || []
          },
          variables: {
            templatePersonalizations: templatePersonalizations || {},
            testSettings: testSettings || {}
          },
          schedule_config: schedule_config || scheduleSettings || {},
          mapping_config: {
            targetTemplateMappings: targetTemplateMappings || []
          }
        };
      }

      const { data, error } = await supabase
        .from('workflows')
        .insert(workflowData)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 워크플로우 생성 완료:', {
        id: data.id,
        target_config: data.target_config,
        message_config: data.message_config
      });

      return NextResponse.json({
        success: true,
        data: data
      });
    }

    if (action === 'update') {
      // 워크플로우 업데이트
      const {
        id,
        name,
        description,
        selectedTemplates,
        targetGroups,
        templatePersonalizations,
        targetTemplateMappings,
        scheduleSettings,
        testSettings,
        steps,
        trigger_type,
        trigger_config
      } = body;

      console.log('🔥 워크플로우 업데이트 요청:', {
        id,
        name,
        trigger_type,
        targetGroupsCount: targetGroups?.length || 0,
        templatesCount: selectedTemplates?.length || 0,
        stepsCount: steps?.length || 0,
        mappingsCount: targetTemplateMappings?.length || 0
      });

      // 🎯 기존 워크플로우 정보 조회 (타입 확인용)
      const { data: existingWorkflow } = await supabase
        .from('workflows')
        .select('trigger_type')
        .eq('id', id)
        .single();

      const workflowType = trigger_type || existingWorkflow?.trigger_type || 'manual';

      // 🎯 워크플로우 타입별 업데이트 필드 최적화
      const baseUpdateData = {
        name,
        description,
        message_config: {
          steps: steps || [],
          selectedTemplates: selectedTemplates || []
        },
        variables: {
          templatePersonalizations: templatePersonalizations || {},
          testSettings: testSettings || {}
        },
        schedule_config: scheduleSettings || {},
        updated_at: koreaTimeToUTCString(getKoreaTime())
      };

      let updateData;

      if (workflowType === 'webhook') {
        // 🔥 웹훅 워크플로우: trigger_config만 업데이트, target_config 건드리지 않음
        console.log('📡 웹훅 워크플로우 업데이트 - target_config 제외');
        updateData = {
          ...baseUpdateData,
          ...(trigger_config && { trigger_config })
        };
      } else {
        // 🎯 Manual/Schedule 워크플로우: target_config 포함 업데이트
        console.log(`🎯 ${workflowType} 워크플로우 업데이트 - target_config 포함`);
        updateData = {
          ...baseUpdateData,
          target_config: {
            targetGroups: targetGroups || [],
            targetTemplateMappings: targetTemplateMappings || []
          },
          mapping_config: {
            targetTemplateMappings: targetTemplateMappings || []
          }
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
        target_config: data.target_config,
        message_config: data.message_config
      });

      return NextResponse.json({
        success: true,
        data: data
      });
    }

    if (action === 'toggle_status') {
      // 워크플로우 상태 변경
      const { id, status } = body;

      if (!id || !status) {
        return NextResponse.json({
          success: false,
          error: 'ID and status are required'
        }, { status: 400 });
      }

      console.log('🔄 워크플로우 상태 변경 요청:', { id, status });

      const { data, error } = await supabase
        .from('workflows')
        .update({
          status: status,
          updated_at: koreaTimeToUTCString(getKoreaTime())
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 워크플로우 상태 변경 완료:', { id, status });

      // 🔥 워크플로우를 일시정지/보관할 때 관련 스케줄 작업 취소
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

      return NextResponse.json({
        success: true,
        data: data,
        message: `워크플로우가 ${status === 'active' ? '활성화' : '일시정지'}되었습니다.`
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('워크플로우 저장 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// DELETE: 특정 워크플로우 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID is required'
      }, { status: 400 });
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Workflow deleted successfully'
    });

  } catch (error) {
    console.error('워크플로우 삭제 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
} 