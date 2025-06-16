import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/database/supabase-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: false,
        message: 'Supabase admin client가 초기화되지 않았습니다. 환경변수를 확인해주세요.'
      }, { status: 500 });
    }

    // 스키마 파일 읽기
    const schemaPath = path.join(process.cwd(), 'supabase_hybrid_schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      return NextResponse.json({
        success: false,
        message: 'supabase_hybrid_schema.sql 파일을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // SQL을 세미콜론으로 분리하여 개별 실행
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        const { data, error } = await supabaseAdmin.rpc('exec_sql', {
          sql_query: statement
        });

        if (error) {
          // 이미 존재하는 테이블/인덱스 오류는 무시
          if (error.message.includes('already exists') || 
              error.message.includes('relation') && error.message.includes('already exists')) {
            results.push({
              statement: statement.substring(0, 100) + '...',
              status: 'skipped',
              message: '이미 존재함'
            });
          } else {
            results.push({
              statement: statement.substring(0, 100) + '...',
              status: 'error',
              message: error.message
            });
            errorCount++;
          }
        } else {
          results.push({
            statement: statement.substring(0, 100) + '...',
            status: 'success',
            message: '실행 완료'
          });
          successCount++;
        }
      } catch (err) {
        results.push({
          statement: statement.substring(0, 100) + '...',
          status: 'error',
          message: err instanceof Error ? err.message : '알 수 없는 오류'
        });
        errorCount++;
      }
    }

    // 테이블 존재 확인
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'workflows',
        'workflow_runs', 
        'message_templates',
        'message_logs',
        'system_settings',
        'user_activity_logs'
      ]);

    const createdTables = tables?.map((t: any) => t.table_name) || [];

    return NextResponse.json({
      success: true,
      message: `스키마 초기화 완료. ${successCount}개 성공, ${errorCount}개 오류`,
      details: {
        totalStatements: statements.length,
        successCount,
        errorCount,
        createdTables,
        results: results.slice(0, 20) // 처음 20개 결과만 반환
      }
    });

  } catch (error) {
    console.error('스키마 초기화 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '스키마 초기화에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
}

// GET: 현재 스키마 상태 확인
export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: false,
        message: 'Supabase admin client가 초기화되지 않았습니다.'
      }, { status: 500 });
    }

    // 테이블 목록 조회
    const { data: tables, error: tablesError } = await (supabaseAdmin as SupabaseClient)
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .order('table_name');

    if (tablesError) {
      throw tablesError;
    }

    // 워크플로우 테이블 존재 확인
    const requiredTables = [
      'workflows',
      'workflow_runs',
      'message_templates', 
      'message_logs',
      'system_settings',
      'user_activity_logs'
    ];

    const existingTables = tables?.map((t: any) => t.table_name) || [];
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    // 워크플로우 개수 확인
    let workflowCount = 0;
    if (existingTables.includes('workflows')) {
      const { count } = await (supabaseAdmin as SupabaseClient)
        .from('workflows')
        .select('*', { count: 'exact', head: true });
      workflowCount = count || 0;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalTables: existingTables.length,
        existingTables,
        missingTables,
        isInitialized: missingTables.length === 0,
        workflowCount
      },
      message: missingTables.length === 0 
        ? '스키마가 완전히 초기화되었습니다.'
        : `${missingTables.length}개 테이블이 누락되었습니다.`
    });

  } catch (error) {
    console.error('스키마 상태 확인 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '스키마 상태 확인에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
} 