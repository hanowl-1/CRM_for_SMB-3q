import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/database/supabase-client';

// 메시지 발송 기록 테이블 스키마
const MESSAGE_LOG_SCHEMA = `
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id VARCHAR(255),
  workflow_name VARCHAR(255),
  message_type VARCHAR(50) NOT NULL, -- 'sms', 'kakao', 'email'
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  template_id VARCHAR(255),
  template_name VARCHAR(255),
  message_content TEXT NOT NULL,
  variables JSONB,
  status VARCHAR(50) NOT NULL, -- 'pending', 'sent', 'failed', 'delivered'
  provider VARCHAR(50), -- 'coolsms', 'kakao', etc.
  provider_message_id VARCHAR(255),
  error_message TEXT,
  cost_amount DECIMAL(10,2),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_workflow_id ON message_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_recipient_phone ON message_logs(recipient_phone);
`;

// 테이블 초기화
async function ensureMessageLogsTable() {
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', { 
      sql: MESSAGE_LOG_SCHEMA 
    });
    
    if (error) {
      console.error('메시지 로그 테이블 생성 실패:', error);
      // 테이블이 이미 존재하는 경우는 무시
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  } catch (error) {
    console.error('테이블 초기화 오류:', error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    // 테이블 존재 확인
    await ensureMessageLogsTable();

    if (action === 'create') {
      // 새 메시지 로그 생성
      const logData = {
        workflow_id: data.workflowId,
        workflow_name: data.workflowName,
        message_type: data.messageType,
        recipient_phone: data.recipientPhone,
        recipient_email: data.recipientEmail,
        recipient_name: data.recipientName,
        template_id: data.templateId,
        template_name: data.templateName,
        message_content: data.messageContent,
        variables: data.variables || {},
        status: data.status || 'pending',
        provider: data.provider,
        provider_message_id: data.providerMessageId,
        cost_amount: data.costAmount,
        sent_at: data.sentAt ? new Date(data.sentAt).toISOString() : null
      };

      const { data: result, error } = await supabaseAdmin
        .from('message_logs')
        .insert(logData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: '메시지 로그가 생성되었습니다.'
      });
    }

    if (action === 'update') {
      // 메시지 로그 상태 업데이트
      const { id, status, errorMessage, deliveredAt, providerMessageId } = data;

      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (errorMessage) updateData.error_message = errorMessage;
      if (deliveredAt) updateData.delivered_at = new Date(deliveredAt).toISOString();
      if (providerMessageId) updateData.provider_message_id = providerMessageId;

      const { data: result, error } = await supabaseAdmin
        .from('message_logs')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: '메시지 로그가 업데이트되었습니다.'
      });
    }

    if (action === 'bulk_create') {
      // 대량 메시지 로그 생성
      const { logs } = data;
      
      const logData = logs.map(log => ({
        workflow_id: log.workflowId,
        workflow_name: log.workflowName,
        message_type: log.messageType,
        recipient_phone: log.recipientPhone,
        recipient_email: log.recipientEmail,
        recipient_name: log.recipientName,
        template_id: log.templateId,
        template_name: log.templateName,
        message_content: log.messageContent,
        variables: log.variables || {},
        status: log.status || 'pending',
        provider: log.provider,
        cost_amount: log.costAmount
      }));

      const { data: result, error } = await supabaseAdmin
        .from('message_logs')
        .insert(logData)
        .select();

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: result,
        count: result.length,
        message: `${result.length}개의 메시지 로그가 생성되었습니다.`
      });
    }

    return NextResponse.json({ 
      error: '잘못된 액션입니다.' 
    }, { status: 400 });

  } catch (error) {
    console.error('메시지 로그 API 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflow_id');
    const status = searchParams.get('status');
    const messageType = searchParams.get('message_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 테이블 존재 확인
    await ensureMessageLogsTable();

    let query = supabaseAdmin
      .from('message_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 필터 적용
    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (messageType) {
      query = query.eq('message_type', messageType);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // 통계 정보 조회
    const { data: stats } = await supabaseAdmin
      .from('message_logs')
      .select('status, message_type, count(*)')
      .group('status, message_type');

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
    console.error('메시지 로그 조회 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
} 