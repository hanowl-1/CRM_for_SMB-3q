import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/database/supabase-client';

export interface MappingTemplate {
  id?: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  targetTemplateMappings: any[];
  usageCount?: number;
  lastUsedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  isPublic: boolean;
  isFavorite?: boolean;
}

// 로컬 스토리지 대안 (개발용)
const LOCAL_STORAGE_KEY = 'mapping_templates';

function getLocalTemplates(): MappingTemplate[] {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }
  return [];
}

function saveLocalTemplates(templates: MappingTemplate[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates));
  }
}

// 매핑 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const search = searchParams.get('search') || '';
    const isPublic = searchParams.get('isPublic');
    const isFavorite = searchParams.get('isFavorite');

    console.log('📋 매핑 템플릿 목록 조회:', {
      category,
      search,
      isPublic,
      isFavorite
    });

    const supabase = getSupabaseAdmin();
    
    // 먼저 Supabase 테이블 확인
    const { data, error } = await supabase
      .from('mapping_templates')
      .select('*')
      .limit(1);

    if (error) {
      console.log('⚠️ Supabase 테이블 없음, 샘플 데이터 반환');
      
      // 샘플 데이터 반환
      const sampleTemplates: MappingTemplate[] = [
        {
          id: 'sample_1',
          name: '성과 분석 기본 매핑',
          description: '월간 성과 리포트에 사용되는 기본적인 매핑 템플릿입니다.',
          category: 'performance',
          tags: ['성과', '리포트', '월간'],
          targetTemplateMappings: [{
            id: "sample_mapping_1",
            targetGroupId: "performance_group",
            templateId: "performance_template",
            fieldMappings: [
              {
                templateVariable: "companyName",
                targetField: "company_name",
                formatter: "text",
                defaultValue: "회사명"
              },
              {
                templateVariable: "totalReviews",
                targetField: "total_reviews",
                formatter: "number",
                defaultValue: "0"
              }
            ],
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z"
          }],
          usageCount: 5,
          lastUsedAt: "2024-01-15T10:30:00.000Z",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-15T10:30:00.000Z",
          isPublic: true,
          isFavorite: false
        },
        {
          id: 'sample_2',
          name: '환영 메시지 매핑',
          description: '신규 고객 환영 메시지에 사용되는 매핑 템플릿입니다.',
          category: 'welcome',
          tags: ['환영', '신규고객', '온보딩'],
          targetTemplateMappings: [{
            id: "sample_mapping_2",
            targetGroupId: "new_customer_group",
            templateId: "welcome_template",
            fieldMappings: [
              {
                templateVariable: "customerName",
                targetField: "customer_name",
                formatter: "text",
                defaultValue: "고객님"
              },
              {
                templateVariable: "joinDate",
                targetField: "created_at",
                formatter: "date",
                defaultValue: "오늘"
              }
            ],
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z"
          }],
          usageCount: 12,
          lastUsedAt: "2024-01-20T14:20:00.000Z",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-20T14:20:00.000Z",
          isPublic: true,
          isFavorite: true
        }
      ];

      // 필터링 적용
      let filteredTemplates = sampleTemplates;

      if (category !== 'all') {
        filteredTemplates = filteredTemplates.filter(t => t.category === category);
      }

      if (search) {
        filteredTemplates = filteredTemplates.filter(t => 
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase()) ||
          t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
        );
      }

      if (isPublic === 'true') {
        filteredTemplates = filteredTemplates.filter(t => t.isPublic);
      }

      if (isFavorite === 'true') {
        filteredTemplates = filteredTemplates.filter(t => t.isFavorite);
      }

      return NextResponse.json({
        success: true,
        templates: filteredTemplates,
        note: 'Supabase 테이블이 없어 샘플 데이터를 반환했습니다.'
      });
    }

    // Supabase에서 정상 조회
    let query = supabase
      .from('mapping_templates')
      .select('*');

    // 카테고리 필터
    if (category !== 'all') {
      query = query.eq('category', category);
    }

    // 검색어 필터
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // 공개 여부 필터
    if (isPublic !== null) {
      query = query.eq('is_public', isPublic === 'true');
    }

    // 즐겨찾기 필터
    if (isFavorite === 'true') {
      query = query.eq('is_favorite', true);
    }

    // 정렬 (사용 횟수 순, 최근 생성 순)
    query = query.order('usage_count', { ascending: false })
                 .order('created_at', { ascending: false });

    const { data: queryData, error: queryError } = await query;

    if (queryError) {
      console.error('❌ 매핑 템플릿 조회 실패:', queryError);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    console.log('✅ 매핑 템플릿 조회 성공:', queryData?.length || 0);
    
    return NextResponse.json({
      success: true,
      templates: queryData || []
    });

  } catch (error) {
    console.error('❌ 매핑 템플릿 API 오류:', error);
    return NextResponse.json(
      { error: '매핑 템플릿 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 매핑 템플릿 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      category = 'general',
      tags = [],
      targetTemplateMappings,
      isPublic = false,
      isFavorite = false
    }: MappingTemplate = body;

    console.log('💾 매핑 템플릿 저장 요청:', {
      name,
      category,
      mappingsCount: targetTemplateMappings?.length || 0,
      isPublic
    });

    if (!name || !targetTemplateMappings || targetTemplateMappings.length === 0) {
      return NextResponse.json(
        { error: '템플릿 이름과 매핑 정보는 필수입니다.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const templateData = {
      name,
      description,
      category,
      tags,
      target_template_mappings: targetTemplateMappings,
      usage_count: 0,
      is_public: isPublic,
      is_favorite: isFavorite,
      created_by: null // 현재는 인증 없이 진행
    };

    const { data, error } = await supabase
      .from('mapping_templates')
      .insert([templateData])
      .select()
      .single();

    if (error) {
      console.error('❌ 매핑 템플릿 저장 실패:', error);
      
      // Supabase 실패 시 클라이언트에 알림
      return NextResponse.json({ 
        error: '현재 Supabase 테이블이 설정되지 않아 저장할 수 없습니다. 관리자에게 문의하세요.',
        details: error.message 
      }, { status: 500 });
    }

    console.log('✅ 매핑 템플릿 저장 성공:', data.id);

    return NextResponse.json({
      success: true,
      template: data
    });

  } catch (error) {
    console.error('❌ 매핑 템플릿 저장 API 오류:', error);
    return NextResponse.json(
      { error: '매핑 템플릿 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 매핑 템플릿 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      description,
      category,
      tags,
      targetTemplateMappings,
      isPublic,
      isFavorite
    }: MappingTemplate = body;

    if (!id) {
      return NextResponse.json(
        { error: '템플릿 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('🔄 매핑 템플릿 업데이트:', { id, name });

    const supabase = getSupabaseAdmin();

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category) updateData.category = category;
    if (tags) updateData.tags = tags;
    if (targetTemplateMappings) updateData.target_template_mappings = targetTemplateMappings;
    if (isPublic !== undefined) updateData.is_public = isPublic;
    if (isFavorite !== undefined) updateData.is_favorite = isFavorite;

    const { data, error } = await supabase
      .from('mapping_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ 매핑 템플릿 업데이트 실패:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ 매핑 템플릿 업데이트 성공');

    return NextResponse.json({
      success: true,
      template: data
    });

  } catch (error) {
    console.error('❌ 매핑 템플릿 업데이트 API 오류:', error);
    return NextResponse.json(
      { error: '매핑 템플릿 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 매핑 템플릿 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '템플릿 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('🗑️ 매핑 템플릿 삭제:', id);

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('mapping_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ 매핑 템플릿 삭제 실패:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ 매핑 템플릿 삭제 성공');

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('❌ 매핑 템플릿 삭제 API 오류:', error);
    return NextResponse.json(
      { error: '매핑 템플릿 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 