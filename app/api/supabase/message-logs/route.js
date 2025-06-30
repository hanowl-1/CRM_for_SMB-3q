import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/database/supabase-client';

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
    console.log('📊 메시지 로그 테이블 초기화 시작...');
    const supabaseAdmin = getSupabaseAdmin();
    
    // 먼저 테이블 존재 여부 확인
    const { data: tables, error: tableCheckError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'message_logs')
      .eq('table_schema', 'public');
    
    if (tableCheckError) {
      console.log('📋 테이블 확인 실패, 테이블 생성 시도:', tableCheckError.message);
    } else if (tables && tables.length > 0) {
      console.log('✅ message_logs 테이블이 이미 존재합니다.');
      return;
    } else {
      console.log('📋 message_logs 테이블이 존재하지 않음, 생성 시도...');
    }
    
    const { error } = await supabaseAdmin.rpc('exec_sql', { 
      sql: MESSAGE_LOG_SCHEMA 
    });
    
    if (error) {
      console.error('❌ 메시지 로그 테이블 생성 실패:', error);
      // 테이블이 이미 존재하는 경우는 무시
      if (!error.message.includes('already exists')) {
        throw error;
      }
    } else {
      console.log('✅ 메시지 로그 테이블 생성 완료');
    }
  } catch (error) {
    console.error('❌ 테이블 초기화 오류:', error);
    // 테이블 초기화 실패해도 계속 진행 (테이블이 이미 존재할 수 있음)
  }
}

export async function POST(request) {
  try {
    console.log('📨 메시지 로그 POST 요청 시작...');
    const body = await request.json();
    const { action, ...data } = body;
    console.log('📋 요청 액션:', action, '데이터 키:', Object.keys(data));

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
        message_content: data.messageContent,
        variables_used: data.variables || {},
        status: data.status || 'pending',
        provider: data.provider,
        provider_message_id: data.providerMessageId,
        cost: data.costAmount || 0,
        sent_at: data.sentAt ? new Date(data.sentAt).toISOString() : null,
        error_message: data.errorMessage || null
      };

      console.log('📝 단일 로그 생성 시도:', logData.workflow_name);
      const { data: result, error } = await getSupabaseAdmin()
        .from('message_logs')
        .insert(logData)
        .select()
        .single();

      if (error) {
        console.error('❌ 단일 로그 생성 실패:', error);
        throw error;
      }

      console.log('✅ 단일 로그 생성 성공:', result.id);
      return NextResponse.json({
        success: true,
        data: result,
        message: '메시지 로그가 생성되었습니다.'
      });
    }

    if (action === 'bulk_create') {
      // 🔥 대량 메시지 로그 생성 (워크플로우 실행용)
      const { logs } = data;
      
      if (!logs || !Array.isArray(logs) || logs.length === 0) {
        console.warn('⚠️ 저장할 로그 데이터가 없습니다.');
        return NextResponse.json({
          success: true,
          data: [],
          message: '저장할 로그가 없습니다.'
        });
      }

      console.log(`📝 대량 로그 생성 시도: ${logs.length}개`);
      
      // 로그 데이터 변환
      const logDataArray = logs.map(log => ({
        workflow_id: log.workflowId,
        workflow_name: log.workflowName,
        message_type: log.messageType,
        recipient_phone: log.recipientPhone,
        recipient_email: log.recipientEmail,
        recipient_name: log.recipientName,
        template_id: log.templateId,
        message_content: log.messageContent,
        variables_used: log.variables || {},
        status: log.status || 'pending',
        provider: log.provider,
        provider_message_id: log.providerMessageId,
        cost: log.costAmount || 0,
        sent_at: log.sentAt ? new Date(log.sentAt).toISOString() : null,
        error_message: log.errorMessage || null
      }));

      console.log('📋 변환된 로그 데이터 샘플:', {
        count: logDataArray.length,
        first: logDataArray[0] ? {
          workflow_name: logDataArray[0].workflow_name,
          recipient_phone: logDataArray[0].recipient_phone,
          status: logDataArray[0].status,
          provider: logDataArray[0].provider,
          provider_message_id: logDataArray[0].provider_message_id,
          cost_amount: logDataArray[0].cost_amount
        } : 'none'
      });

      const { data: results, error } = await getSupabaseAdmin()
        .from('message_logs')
        .insert(logDataArray)
        .select();

      if (error) {
        console.error('❌ 대량 로그 생성 실패:', error);
        throw error;
      }

      console.log(`✅ 대량 로그 생성 성공: ${results.length}개`);
      return NextResponse.json({
        success: true,
        data: results,
        message: `${results.length}개의 메시지 로그가 생성되었습니다.`
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

      console.log('🔄 로그 업데이트 시도:', id);
      const { data: result, error } = await getSupabaseAdmin()
        .from('message_logs')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ 로그 업데이트 실패:', error);
        throw error;
      }

      console.log('✅ 로그 업데이트 성공:', result.id);
      return NextResponse.json({
        success: true,
        data: result,
        message: '메시지 로그가 업데이트되었습니다.'
      });
    }

    console.log('❌ 잘못된 액션:', action);
    return NextResponse.json({ 
      error: '잘못된 액션입니다.' 
    }, { status: 400 });

  } catch (error) {
    console.error('❌ 메시지 로그 API 오류:', error);
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

    let query = getSupabaseAdmin()
      .from('message_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

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

    // 페이지네이션 적용
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('메시지 로그 쿼리 오류:', error);
      throw error;
    }

    // 통계 정보 조회
    let stats = [];
    try {
      const { data: statsData } = await getSupabaseAdmin()
        .from('message_logs')
        .select('status, message_type')
        .order('created_at', { ascending: false });

      // 통계 수동 계산
      const statusCounts = {};
      const typeCounts = {};
      
      if (statsData) {
        statsData.forEach(row => {
          statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
          typeCounts[row.message_type] = (typeCounts[row.message_type] || 0) + 1;
        });
      }

      stats = [
        ...Object.entries(statusCounts).map(([status, count]) => ({
          status,
          message_type: 'all',
          count
        })),
        ...Object.entries(typeCounts).map(([message_type, count]) => ({
          status: 'all',
          message_type,
          count
        }))
      ];
    } catch (statsError) {
      console.error('통계 조회 오류:', statsError);
      stats = [];
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: count || 0,
      stats,
      pagination: {
        limit,
        offset,
        hasMore: data && data.length === limit,
        total: count || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('메시지 로그 조회 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message,
      data: [],
      stats: [],
      pagination: {
        limit: 50,
        offset: 0,
        hasMore: false,
        total: 0
      }
    }, { status: 500 });
  }
} 