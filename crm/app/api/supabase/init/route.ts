import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/database/supabase-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!supabaseAdmin) {
      return NextResponse.json({
        success: false,
        message: 'Supabase admin client가 초기화되지 않았습니다. 환경변수를 확인해주세요.'
      }, { status: 500 });
    }

    // mapping_templates 테이블 생성 액션
    if (action === 'create_mapping_templates_table') {
      const createTableSQL = `
        -- 매핑 템플릿 테이블 생성
        CREATE TABLE IF NOT EXISTS mapping_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(100) DEFAULT 'general',
          tags TEXT[] DEFAULT '{}',
          
          -- 매핑 정보
          target_template_mappings JSONB NOT NULL DEFAULT '[]',
          
          -- 메타데이터
          usage_count INTEGER DEFAULT 0,
          last_used_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by UUID,
          
          -- 공유 설정
          is_public BOOLEAN DEFAULT false,
          is_favorite BOOLEAN DEFAULT false,
          
          -- 인덱스
          CONSTRAINT mapping_templates_name_check CHECK (LENGTH(name) >= 1)
        );

        -- 인덱스 생성
        CREATE INDEX IF NOT EXISTS idx_mapping_templates_category ON mapping_templates(category);
        CREATE INDEX IF NOT EXISTS idx_mapping_templates_created_at ON mapping_templates(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_mapping_templates_usage_count ON mapping_templates(usage_count DESC);
        CREATE INDEX IF NOT EXISTS idx_mapping_templates_is_public ON mapping_templates(is_public);
        CREATE INDEX IF NOT EXISTS idx_mapping_templates_is_favorite ON mapping_templates(is_favorite);

        -- 업데이트 트리거 함수
        CREATE OR REPLACE FUNCTION update_mapping_templates_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- 트리거 생성
        DROP TRIGGER IF EXISTS trigger_mapping_templates_updated_at ON mapping_templates;
        CREATE TRIGGER trigger_mapping_templates_updated_at
          BEFORE UPDATE ON mapping_templates
          FOR EACH ROW
          EXECUTE FUNCTION update_mapping_templates_updated_at();
      `;

      try {
        // 직접 SQL 실행
        const { data, error } = await supabaseAdmin.rpc('exec_sql', {
          sql_query: createTableSQL
        });

        if (error) {
          console.error('❌ mapping_templates 테이블 생성 실패:', error);
          return NextResponse.json({
            success: false,
            message: `테이블 생성 실패: ${error.message}`
          }, { status: 500 });
        }

        console.log('✅ mapping_templates 테이블 생성 성공');
        
        return NextResponse.json({
          success: true,
          message: 'mapping_templates 테이블이 성공적으로 생성되었습니다.'
        });

      } catch (sqlError) {
        console.error('❌ SQL 실행 오류:', sqlError);
        return NextResponse.json({
          success: false,
          message: `SQL 실행 오류: ${sqlError instanceof Error ? sqlError.message : '알 수 없는 오류'}`
        }, { status: 500 });
      }
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