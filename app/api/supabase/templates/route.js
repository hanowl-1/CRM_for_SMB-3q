import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/database/supabase-client';

// 템플릿 테이블 스키마
const TEMPLATE_SCHEMA = `
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'welcome', 'reminder', 'promotion', 'notification'
  message_type VARCHAR(50) NOT NULL, -- 'sms', 'kakao', 'email'
  template_code VARCHAR(100), -- 카카오톡 템플릿 코드
  subject VARCHAR(255), -- 이메일 제목
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- 사용된 변수 목록
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'archived'
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_message_type ON message_templates(message_type);
CREATE INDEX IF NOT EXISTS idx_templates_status ON message_templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON message_templates(created_at DESC);
`;

// 템플릿 사용 기록 테이블
const TEMPLATE_USAGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS template_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES message_templates(id) ON DELETE CASCADE,
  workflow_id UUID,
  workflow_name VARCHAR(255),
  recipient_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_usage_template_id ON template_usage_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_workflow_id ON template_usage_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_used_at ON template_usage_logs(used_at DESC);
`;

// 테이블 초기화
async function ensureTemplateTables() {
  try {
    // 템플릿 테이블 생성
    const { error: templateError } = await supabaseAdmin.rpc('exec_sql', { 
      sql: TEMPLATE_SCHEMA 
    });
    
    if (templateError && !templateError.message.includes('already exists')) {
      console.error('템플릿 테이블 생성 실패:', templateError);
    }

    // 템플릿 사용 기록 테이블 생성
    const { error: usageError } = await supabaseAdmin.rpc('exec_sql', { 
      sql: TEMPLATE_USAGE_SCHEMA 
    });
    
    if (usageError && !usageError.message.includes('already exists')) {
      console.error('템플릿 사용 기록 테이블 생성 실패:', usageError);
    }
  } catch (error) {
    console.error('템플릿 테이블 초기화 오류:', error);
  }
}

// 기본 템플릿 데이터
const DEFAULT_TEMPLATES = [
  {
    name: '신규 회원 환영 메시지',
    description: '새로 가입한 회원에게 보내는 환영 메시지',
    category: 'welcome',
    message_type: 'sms',
    content: '안녕하세요 {{회사명}}입니다! {{담당자}}님, 회원가입을 환영합니다. 궁금한 점이 있으시면 {{연락처}}로 연락주세요.',
    variables: ['회사명', '담당자', '연락처'],
    status: 'active'
  },
  {
    name: '구독 만료 알림',
    description: '구독 서비스 만료 전 알림 메시지',
    category: 'reminder',
    message_type: 'kakao',
    content: '[구독 만료 알림]\n{{회사명}}님의 구독이 {{마감일수}}일 후 만료됩니다.\n연장을 원하시면 {{구매링크}}에서 갱신해주세요.',
    variables: ['회사명', '마감일수', '구매링크'],
    status: 'active'
  },
  {
    name: '프로모션 안내',
    description: '특별 혜택 및 프로모션 안내 메시지',
    category: 'promotion',
    message_type: 'sms',
    content: '🎉 {{회사명}} 특별 혜택!\n{{광고명}} 체험 기회를 놓치지 마세요.\n신청: {{신청링크}}\n문의: {{고객센터번호}}',
    variables: ['회사명', '광고명', '신청링크', '고객센터번호'],
    status: 'active'
  }
];

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    // 테이블 존재 확인
    await ensureTemplateTables();

    if (action === 'create') {
      // 새 템플릿 생성
      const templateData = {
        name: data.name,
        description: data.description,
        category: data.category,
        message_type: data.messageType,
        template_code: data.templateCode,
        subject: data.subject,
        content: data.content,
        variables: data.variables || [],
        status: data.status || 'draft',
        created_by: data.createdBy
      };

      const { data: result, error } = await supabaseAdmin
        .from('message_templates')
        .insert(templateData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: '템플릿이 생성되었습니다.'
      });
    }

    if (action === 'update') {
      // 템플릿 업데이트
      const { id, ...updateData } = data;
      
      const templateData = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const { data: result, error } = await supabaseAdmin
        .from('message_templates')
        .update(templateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: '템플릿이 업데이트되었습니다.'
      });
    }

    if (action === 'delete') {
      // 템플릿 삭제
      const { id } = data;

      const { error } = await supabaseAdmin
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: '템플릿이 삭제되었습니다.'
      });
    }

    if (action === 'duplicate') {
      // 템플릿 복제
      const { id } = data;

      const { data: original, error: fetchError } = await supabaseAdmin
        .from('message_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const duplicateData = {
        ...original,
        id: undefined,
        name: `${original.name} (복사본)`,
        status: 'draft',
        usage_count: 0,
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: result, error } = await supabaseAdmin
        .from('message_templates')
        .insert(duplicateData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: '템플릿이 복제되었습니다.'
      });
    }

    if (action === 'log_usage') {
      // 템플릿 사용 기록
      const usageData = {
        template_id: data.templateId,
        workflow_id: data.workflowId,
        workflow_name: data.workflowName,
        recipient_count: data.recipientCount || 0,
        success_count: data.successCount || 0,
        failed_count: data.failedCount || 0
      };

      const { data: result, error } = await supabaseAdmin
        .from('template_usage_logs')
        .insert(usageData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // 템플릿 사용 횟수 업데이트
      await supabaseAdmin
        .from('message_templates')
        .update({ 
          usage_count: supabaseAdmin.raw('usage_count + 1'),
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', data.templateId);

      return NextResponse.json({
        success: true,
        data: result,
        message: '템플릿 사용이 기록되었습니다.'
      });
    }

    if (action === 'seed_defaults') {
      // 기본 템플릿 생성
      const { data: result, error } = await supabaseAdmin
        .from('message_templates')
        .insert(DEFAULT_TEMPLATES)
        .select();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: result,
        count: result.length,
        message: `${result.length}개의 기본 템플릿이 생성되었습니다.`
      });
    }

    return NextResponse.json({ 
      error: '잘못된 액션입니다.' 
    }, { status: 400 });

  } catch (error) {
    console.error('템플릿 API 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const category = searchParams.get('category');
    const messageType = searchParams.get('message_type');
    const status = searchParams.get('status');
    const includeUsage = searchParams.get('include_usage') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 테이블 존재 확인
    await ensureTemplateTables();

    if (id) {
      // 특정 템플릿 조회
      const { data: template, error } = await supabaseAdmin
        .from('message_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      let usage = [];
      if (includeUsage) {
        const { data: usageData } = await supabaseAdmin
          .from('template_usage_logs')
          .select('*')
          .eq('template_id', id)
          .order('used_at', { ascending: false })
          .limit(10);
        
        usage = usageData || [];
      }

      return NextResponse.json({
        success: true,
        data: { ...template, usage },
        timestamp: new Date().toISOString()
      });
    }

    // 템플릿 목록 조회
    let query = supabaseAdmin
      .from('message_templates')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 필터 적용
    if (category) {
      query = query.eq('category', category);
    }
    if (messageType) {
      query = query.eq('message_type', messageType);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // 통계 정보 조회
    const { data: stats } = await supabaseAdmin
      .from('message_templates')
      .select('category, message_type, status, count(*)')
      .group('category, message_type, status');

    return NextResponse.json({
      success: true,
      data,
      count,
      stats,
      pagination: {
        limit,
        offset,
        hasMore: data.length === limit
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('템플릿 조회 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
} 