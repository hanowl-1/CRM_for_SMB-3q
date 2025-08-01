import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 매핑 템플릿 테이블 테스트 시작...');
    
    const supabase = getSupabaseAdmin();

    // 1. 테이블이 있는지 확인
    const { data: existingData, error: checkError } = await supabase
      .from('mapping_templates')
      .select('*')
      .limit(1);

    if (checkError) {
      console.log('⚠️ 테이블이 존재하지 않음:', checkError.message);
      
      // 테이블이 없으면 샘플 데이터로 테이블 구조를 확인할 수 있도록 안내
      return NextResponse.json({
        success: false,
        message: '매핑 템플릿 테이블이 존재하지 않습니다. Supabase 대시보드에서 수동으로 생성해주세요.',
        sql: `
CREATE TABLE mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  target_template_mappings JSONB NOT NULL DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false
);

-- 인덱스 생성
CREATE INDEX idx_mapping_templates_category ON mapping_templates(category);
CREATE INDEX idx_mapping_templates_created_at ON mapping_templates(created_at DESC);
CREATE INDEX idx_mapping_templates_usage_count ON mapping_templates(usage_count DESC);
CREATE INDEX idx_mapping_templates_is_public ON mapping_templates(is_public);
CREATE INDEX idx_mapping_templates_is_favorite ON mapping_templates(is_favorite);

-- RLS 정책 설정
ALTER TABLE mapping_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage all mapping templates" ON mapping_templates FOR ALL USING (true);
        `
      });
    }

    console.log('✅ 테이블 존재 확인');

    // 2. 샘플 데이터가 있는지 확인
    if (existingData && existingData.length > 0) {
      console.log('✅ 기존 데이터 존재:', existingData.length);
      
      return NextResponse.json({
        success: true,
        message: '매핑 템플릿 테이블이 이미 설정되어 있습니다.',
        existingCount: existingData.length
      });
    }

    // 3. 샘플 데이터 삽입
    const sampleData = [
      {
        name: '성과 분석 기본 매핑',
        description: '월간 성과 리포트에 사용되는 기본적인 매핑 템플릿입니다.',
        category: 'performance',
        tags: ['성과', '리포트', '월간'],
        target_template_mappings: [{
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
        is_public: true,
        is_favorite: false
      },
      {
        name: '환영 메시지 매핑',
        description: '신규 고객 환영 메시지에 사용되는 매핑 템플릿입니다.',
        category: 'welcome',
        tags: ['환영', '신규고객', '온보딩'],
        target_template_mappings: [{
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
        is_public: true,
        is_favorite: true
      }
    ];

    const { data: insertData, error: insertError } = await supabase
      .from('mapping_templates')
      .insert(sampleData)
      .select();

    if (insertError) {
      console.error('❌ 샘플 데이터 삽입 실패:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log('✅ 샘플 데이터 삽입 성공:', insertData?.length);

    return NextResponse.json({
      success: true,
      message: '매핑 템플릿 샘플 데이터가 성공적으로 삽입되었습니다.',
      insertedCount: insertData?.length,
      sampleData: insertData
    });

  } catch (error) {
    console.error('❌ 테이블 테스트 오류:', error);
    return NextResponse.json(
      { error: '테이블 테스트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 