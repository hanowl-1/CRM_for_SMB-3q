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
        testSettings,
        steps,
        createdBy = 'user'
      } = body;

      console.log('🔥 워크플로우 생성 요청:', {
        name,
        targetGroupsCount: targetGroups?.length || 0,
        templatesCount: selectedTemplates?.length || 0,
        stepsCount: steps?.length || 0,
        mappingsCount: targetTemplateMappings?.length || 0
      });

      const { data, error } = await supabase
        .from('workflows')
        .insert({
          name,
          description,
          trigger_type: 'manual',
          trigger_config: scheduleSettings || {},
          target_config: {
            targetGroups: targetGroups || [],
            targetTemplateMappings: targetTemplateMappings || []
          },
          message_config: {
            steps: steps || [],
            selectedTemplates: selectedTemplates || []
          },
          variables: {
            templatePersonalizations: templatePersonalizations || {},
            testSettings: testSettings || {}
          },
          schedule_config: scheduleSettings || {},
          mapping_config: {
            targetTemplateMappings: targetTemplateMappings || []
          },
          created_by: createdBy,
          status: 'draft'
        })
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
        steps
      } = body;

      console.log('🔥 워크플로우 업데이트 요청:', {
        id,
        name,
        targetGroupsCount: targetGroups?.length || 0,
        templatesCount: selectedTemplates?.length || 0,
        stepsCount: steps?.length || 0,
        mappingsCount: targetTemplateMappings?.length || 0
      });

      const { data, error } = await supabase
        .from('workflows')
        .update({
          name,
          description,
          trigger_config: scheduleSettings || {},
          target_config: {
            targetGroups: targetGroups || [],
            targetTemplateMappings: targetTemplateMappings || []
          },
          message_config: {
            steps: steps || [],
            selectedTemplates: selectedTemplates || []
          },
          variables: {
            templatePersonalizations: templatePersonalizations || {},
            testSettings: testSettings || {}
          },
          schedule_config: scheduleSettings || {},
          mapping_config: {
            targetTemplateMappings: targetTemplateMappings || []
          },
          updated_at: koreaTimeToUTCString(getKoreaTime())
        })
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