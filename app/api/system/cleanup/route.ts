import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  formatKoreaTime 
} from '@/lib/utils/timezone';

/**
 * 시스템 정리 및 레거시 코드 체크 API
 * - 사용하지 않는 스케줄 잡 정리
 * - 오래된 로그 데이터 정리
 * - 중복된 워크플로우 체크
 * - 레거시 설정 식별
 */
export async function GET(request: NextRequest) {
  try {
    const client = getSupabase();
    const now = getKoreaTime();
    const cleanupReport = [];
    
    console.log(`🧹 시스템 정리 체크 시작: ${formatKoreaTime(now)}`);
    
    // 1. 오래된 완료/실패 스케줄 잡 정리 (30일 이상)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const { data: oldJobs, error: oldJobsError } = await client
      .from('scheduled_jobs')
      .select('id, status, created_at, workflow_data')
      .in('status', ['completed', 'failed'])
      .lt('created_at', thirtyDaysAgo.toISOString());
    
    if (!oldJobsError && oldJobs && oldJobs.length > 0) {
      cleanupReport.push({
        category: 'old_jobs',
        count: oldJobs.length,
        action: 'delete_recommended',
        description: `30일 이상 된 완료/실패 스케줄 잡 ${oldJobs.length}개 발견`,
        items: oldJobs.slice(0, 5).map(job => ({
          id: job.id,
          status: job.status,
          created_at: job.created_at,
          workflow_name: job.workflow_data?.name || 'Unknown'
        }))
      });
    }
    
    // 2. 중복된 pending 스케줄 잡 체크
    const { data: pendingJobs } = await client
      .from('scheduled_jobs')
      .select('workflow_id, scheduled_time, id, workflow_data')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    const duplicateGroups = {};
    pendingJobs?.forEach(job => {
      const key = `${job.workflow_id}_${job.scheduled_time}`;
      if (!duplicateGroups[key]) {
        duplicateGroups[key] = [];
      }
      duplicateGroups[key].push(job);
    });
    
    const duplicates = Object.values(duplicateGroups).filter((group: any) => group.length > 1);
    if (duplicates.length > 0) {
      cleanupReport.push({
        category: 'duplicate_jobs',
        count: duplicates.length,
        action: 'cleanup_required',
        description: `중복된 스케줄 잡 그룹 ${duplicates.length}개 발견`,
        items: duplicates.slice(0, 3).map((group: any) => ({
          workflow_id: group[0].workflow_id,
          workflow_name: group[0].workflow_data?.name || 'Unknown',
          scheduled_time: group[0].scheduled_time,
          duplicate_count: group.length,
          job_ids: group.map((j: any) => j.id)
        }))
      });
    }
    
    // 3. 비활성 워크플로우의 스케줄 잡 체크
    const { data: workflows } = await client
      .from('workflows')
      .select('id, name, status');
    
    const activeWorkflowIds = workflows?.filter(w => w.status === 'active').map(w => w.id) || [];
    const inactiveWorkflowIds = workflows?.filter(w => w.status !== 'active').map(w => w.id) || [];
    
    const { data: orphanJobs } = await client
      .from('scheduled_jobs')
      .select('id, workflow_id, workflow_data, status, scheduled_time')
      .eq('status', 'pending')
      .in('workflow_id', inactiveWorkflowIds);
    
    if (orphanJobs && orphanJobs.length > 0) {
      cleanupReport.push({
        category: 'orphan_jobs',
        count: orphanJobs.length,
        action: 'cleanup_required',
        description: `비활성 워크플로우의 스케줄 잡 ${orphanJobs.length}개 발견`,
        items: orphanJobs.slice(0, 5).map(job => ({
          id: job.id,
          workflow_id: job.workflow_id,
          workflow_name: job.workflow_data?.name || 'Unknown',
          scheduled_time: job.scheduled_time
        }))
      });
    }
    
    // 4. 레거시 설정 체크 (schedule_settings vs schedule_config)
    const { data: legacyWorkflows } = await client
      .from('workflows')
      .select('id, name, schedule_settings, schedule_config')
      .not('schedule_settings', 'is', null);
    
    const needsMigration = legacyWorkflows?.filter(w => 
      w.schedule_settings && !w.schedule_config
    ) || [];
    
    if (needsMigration.length > 0) {
      cleanupReport.push({
        category: 'legacy_config',
        count: needsMigration.length,
        action: 'migration_required',
        description: `레거시 schedule_settings를 사용하는 워크플로우 ${needsMigration.length}개 발견`,
        items: needsMigration.slice(0, 5).map(w => ({
          id: w.id,
          name: w.name,
          has_schedule_settings: !!w.schedule_settings,
          has_schedule_config: !!w.schedule_config
        }))
      });
    }
    
    // 5. 시스템 통계
    const systemStats = {
      total_workflows: workflows?.length || 0,
      active_workflows: activeWorkflowIds.length,
      total_scheduled_jobs: pendingJobs?.length || 0,
      cleanup_candidates: cleanupReport.reduce((sum, item) => sum + item.count, 0)
    };
    
    // 6. 권장 정리 작업
    const recommendations = [];
    
    if (cleanupReport.some(item => item.category === 'old_jobs')) {
      recommendations.push({
        priority: 'medium',
        action: 'DELETE FROM scheduled_jobs WHERE status IN (\'completed\', \'failed\') AND created_at < NOW() - INTERVAL \'30 days\'',
        description: '30일 이상 된 완료/실패 스케줄 잡 삭제'
      });
    }
    
    if (cleanupReport.some(item => item.category === 'duplicate_jobs')) {
      recommendations.push({
        priority: 'high',
        action: 'manual_review_required',
        description: '중복된 스케줄 잡 수동 검토 및 정리 필요'
      });
    }
    
    if (cleanupReport.some(item => item.category === 'orphan_jobs')) {
      recommendations.push({
        priority: 'high',
        action: 'DELETE FROM scheduled_jobs WHERE workflow_id IN (SELECT id FROM workflows WHERE status != \'active\')',
        description: '비활성 워크플로우의 스케줄 잡 정리'
      });
    }
    
    if (cleanupReport.some(item => item.category === 'legacy_config')) {
      recommendations.push({
        priority: 'low',
        action: 'migrate_schedule_settings_to_schedule_config',
        description: 'schedule_settings를 schedule_config로 마이그레이션'
      });
    }
    
    console.log(`✅ 시스템 정리 체크 완료: ${cleanupReport.length}개 카테고리, ${systemStats.cleanup_candidates}개 정리 대상`);
    
    return NextResponse.json({
      success: true,
      data: {
        check_time: formatKoreaTime(now),
        system_stats: systemStats,
        cleanup_report: cleanupReport,
        recommendations,
        summary: {
          total_issues: cleanupReport.length,
          total_items: systemStats.cleanup_candidates,
          critical_issues: cleanupReport.filter(item => 
            ['duplicate_jobs', 'orphan_jobs'].includes(item.category)
          ).length
        }
      },
      message: cleanupReport.length > 0 
        ? `${cleanupReport.length}개 카테고리에서 정리가 필요한 항목을 발견했습니다.`
        : '시스템이 깔끔한 상태입니다.'
    });
    
  } catch (error) {
    console.error('❌ 시스템 정리 체크 실패:', error);
    return NextResponse.json({
      success: false,
      message: '시스템 정리 체크 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}

/**
 * 실제 정리 작업 실행 (POST)
 */
export async function POST(request: NextRequest) {
  try {
    const { action, confirm } = await request.json();
    
    if (!confirm) {
      return NextResponse.json({
        success: false,
        message: '정리 작업을 실행하려면 confirm: true를 전달해야 합니다.'
      }, { status: 400 });
    }
    
    const client = getSupabase();
    const now = getKoreaTime();
    const results = [];
    
    switch (action) {
      case 'cleanup_old_jobs':
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const { error: deleteError } = await client
          .from('scheduled_jobs')
          .delete()
          .in('status', ['completed', 'failed'])
          .lt('created_at', thirtyDaysAgo.toISOString());
        
        if (!deleteError) {
          results.push({ action: 'cleanup_old_jobs', status: 'success', message: '오래된 스케줄 잡 정리 완료' });
        } else {
          results.push({ action: 'cleanup_old_jobs', status: 'failed', error: deleteError.message });
        }
        break;
        
      case 'cleanup_orphan_jobs':
        // 비활성 워크플로우의 스케줄 잡 정리
        const { data: inactiveWorkflows } = await client
          .from('workflows')
          .select('id')
          .neq('status', 'active');
        
        if (inactiveWorkflows && inactiveWorkflows.length > 0) {
          const inactiveIds = inactiveWorkflows.map(w => w.id);
          const { error: orphanError } = await client
            .from('scheduled_jobs')
            .delete()
            .in('workflow_id', inactiveIds)
            .eq('status', 'pending');
          
          if (!orphanError) {
            results.push({ action: 'cleanup_orphan_jobs', status: 'success', message: '비활성 워크플로우 스케줄 잡 정리 완료' });
          } else {
            results.push({ action: 'cleanup_orphan_jobs', status: 'failed', error: orphanError.message });
          }
        }
        break;
        
      default:
        return NextResponse.json({
          success: false,
          message: '지원하지 않는 정리 작업입니다.'
        }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        cleanup_time: formatKoreaTime(now),
        results
      },
      message: '정리 작업이 완료되었습니다.'
    });
    
  } catch (error) {
    console.error('❌ 시스템 정리 실행 실패:', error);
    return NextResponse.json({
      success: false,
      message: '시스템 정리 실행 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
} 