import { NextRequest, NextResponse } from 'next/server';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';

// GET: 템플릿 사용 현황 조회
export async function GET(request: NextRequest) {
  try {
    console.log('📊 템플릿 사용 현황 조회 시작...');
    
    // 모든 워크플로우 조회
    const workflowsResult = await supabaseWorkflowService.getWorkflows(1000, 0);
    
    if (!workflowsResult.success) {
      return NextResponse.json({
        success: false,
        message: workflowsResult.error || '워크플로우 조회에 실패했습니다.'
      }, { status: 500 });
    }

    const workflows = workflowsResult.data || [];
    console.log(`📋 총 ${workflows.length}개 워크플로우 조회됨`);

    // 템플릿 사용 현황 분석
    const templateUsage = new Map<string, {
      templateCode: string;
      templateName: string;
      servicePlatform: string;
      usageCount: number;
      workflows: Array<{
        id: string;
        name: string;
        status: string;
        lastRun?: string;
      }>;
      status: 'active' | 'pending' | 'deprecated'; // 사용 상태
    }>();

    // 각 워크플로우에서 사용 중인 템플릿 추출
    workflows.forEach((workflow: any) => {
      const messageConfig = workflow.message_config;
      const steps = messageConfig?.steps || [];
      
      steps.forEach((step: any) => {
        const action = step.action;
        // 실제 데이터 구조에 맞게 수정: 'send_alimtalk'로 변경
        if (action?.type === 'send_alimtalk' && action.templateCode) {
          const templateCode = action.templateCode;
          const templateName = action.templateName || step.name || '알 수 없는 템플릿';
          
          // 서비스 플랫폼 추출 (예: MEMBERS_113 -> MEMBERS)
          const servicePlatform = templateCode.split('_')[0] || 'UNKNOWN';
          
          if (!templateUsage.has(templateCode)) {
            templateUsage.set(templateCode, {
              templateCode,
              templateName: templateName.replace(' 발송', ''), // " 발송" 제거
              servicePlatform,
              usageCount: 0,
              workflows: [],
              status: 'pending' // 기본값
            });
          }
          
          const usage = templateUsage.get(templateCode)!;
          usage.usageCount++;
          
          // 워크플로우 정보 추가 (중복 제거)
          const existingWorkflow = usage.workflows.find(w => w.id === workflow.id);
          if (!existingWorkflow) {
            usage.workflows.push({
              id: workflow.id,
              name: workflow.name,
              status: workflow.status,
              lastRun: workflow.last_run_at
            });
          }
          
          // 사용 상태 결정
          if (workflow.status === 'active') {
            usage.status = 'active'; // 하나라도 활성 워크플로우에서 사용 중이면 active
          } else if (usage.status !== 'active' && workflow.status === 'paused') {
            usage.status = 'pending'; // 일시정지된 워크플로우에서만 사용 중
          }
        }
      });
    });

    // 결과 정렬 (사용 빈도순)
    const sortedUsage = Array.from(templateUsage.values())
      .sort((a, b) => b.usageCount - a.usageCount);

    console.log(`✅ 템플릿 사용 현황 분석 완료: ${sortedUsage.length}개 템플릿`);
    console.log('📊 사용 현황 상세:', sortedUsage.map(u => ({
      templateCode: u.templateCode,
      templateName: u.templateName,
      status: u.status,
      usageCount: u.usageCount,
      workflowsCount: u.workflows.length
    })));

    return NextResponse.json({
      success: true,
      data: {
        totalTemplates: sortedUsage.length,
        activeTemplates: sortedUsage.filter(t => t.status === 'active').length,
        pendingTemplates: sortedUsage.filter(t => t.status === 'pending').length,
        deprecatedTemplates: sortedUsage.filter(t => t.status === 'deprecated').length,
        usage: sortedUsage
      },
      message: '템플릿 사용 현황을 성공적으로 조회했습니다.'
    });

  } catch (error) {
    console.error('❌ 템플릿 사용 현황 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '템플릿 사용 현황 조회에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
} 