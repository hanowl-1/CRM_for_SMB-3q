import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/database/supabase-client';

// 매핑 템플릿 사용량 증가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: '템플릿 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('📈 매핑 템플릿 사용량 증가:', id);

    const supabase = getSupabaseAdmin();

    // 현재 사용량 조회
    const { data: template, error: fetchError } = await supabase
      .from('mapping_templates')
      .select('usage_count')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('❌ 템플릿 조회 실패:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // 사용량 증가
    const { data, error } = await supabase
      .from('mapping_templates')
      .update({
        usage_count: (template.usage_count || 0) + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ 사용량 업데이트 실패:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ 사용량 업데이트 성공:', data.usage_count);

    return NextResponse.json({
      success: true,
      usageCount: data.usage_count
    });

  } catch (error) {
    console.error('❌ 사용량 증가 API 오류:', error);
    return NextResponse.json(
      { error: '사용량 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 