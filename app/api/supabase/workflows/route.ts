import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';

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
        createdBy = 'user'
      } = body;

      const { data, error } = await supabase
        .from('workflows')
        .insert({
          name,
          description,
          trigger_type: 'manual',
          trigger_config: scheduleSettings || {},
          target_config: targetGroups || {},
          message_config: selectedTemplates || {},
          variables: templatePersonalizations || {},
          schedule_config: scheduleSettings || {},
          mapping_config: targetTemplateMappings || {},
          created_by: createdBy,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

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
        testSettings
      } = body;

      const { data, error } = await supabase
        .from('workflows')
        .update({
          name,
          description,
          trigger_config: scheduleSettings || {},
          target_config: targetGroups || {},
          message_config: selectedTemplates || {},
          variables: templatePersonalizations || {},
          schedule_config: scheduleSettings || {},
          mapping_config: targetTemplateMappings || {},
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: data
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