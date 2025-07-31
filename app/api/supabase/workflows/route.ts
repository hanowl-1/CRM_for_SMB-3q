import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/database/supabase-client";
import { handleWorkflowActivation } from "@/lib/utils/workflow-scheduler";

// GET: 워크플로우 목록 조회 (페이지네이션 + 필터링 지원)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100); // 최대 100개
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const trigger_type = searchParams.get("trigger_type");

    const supabase = getSupabase();

    // 기본 쿼리 빌더
    let query = supabase.from("workflows").select("*", { count: "exact" });

    // 필터링 적용
    if (status) {
      query = query.eq("status", status);
    }

    if (trigger_type) {
      query = query.eq("trigger_type", trigger_type);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // 페이지네이션 적용
    const offset = (page - 1) * limit;
    query = query
      .range(offset, offset + limit - 1)
      .order("updated_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("워크플로우 목록 조회 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}

// POST: 새 워크플로우 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      message_config = {},
      target_config = {},
      variables = {},
      schedule_config,
      trigger_config = {},
      created_by = "user",
      trigger_type = "manual",
      status = "draft",
    } = body;

    // 입력 검증
    if (!name || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow name is required",
        },
        { status: 400 }
      );
    }

    if (!["manual", "webhook"].includes(trigger_type)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid trigger type. Only "manual" and "webhook" are supported.',
        },
        { status: 400 }
      );
    }

    if (!["draft", "active", "paused", "archived"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid status",
        },
        { status: 400 }
      );
    }

    console.log("🔥 워크플로우 생성 요청:", {
      name,
      trigger_type,
      targetGroupsCount: target_config?.targetGroups?.length || 0,
      templatesCount: message_config?.selectedTemplates?.length || 0,
      stepsCount: message_config?.steps?.length || 0,
      mappingsCount: target_config?.targetTemplateMappings?.length || 0,
    });

    const supabase = getSupabase();

    // 기본 워크플로우 데이터
    const baseWorkflowData = {
      name: name.trim(),
      description: description?.trim() || null,
      trigger_type,
      status,
      created_by: created_by,
      message_config: {
        steps: message_config?.steps || [],
        selectedTemplates: message_config?.selectedTemplates || [],
      },
    };

    let workflowData;

    // Webhook 타입의 경우 schedule_config 검증
    if (trigger_type === "webhook" && schedule_config) {
      if (!["immediate", "delay"].includes(schedule_config.type)) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Webhook workflows only support "immediate" and "delay" schedule types.',
          },
          { status: 400 }
        );
      }
    }

    if (trigger_type === "webhook") {
      // 웹훅 워크플로우: trigger_config만 저장, target_config 제외
      console.log("📡 웹훅 워크플로우 생성 - target_config 제외");
      workflowData = {
        ...baseWorkflowData,
        trigger_config,
        schedule_config: schedule_config || {},
        variables: {
          templatePersonalizations: variables?.templatePersonalizations || {},
          testSettings: variables?.testSettings || {},
        },
      };
    } else {
      // Manual 워크플로우: target_config 포함
      console.log(`🎯 ${trigger_type} 워크플로우 생성 - target_config 포함`);
      workflowData = {
        ...baseWorkflowData,
        trigger_config: trigger_config || {},
        target_config: {
          targetGroups: target_config?.targetGroups || [],
          targetTemplateMappings: target_config?.targetTemplateMappings || [],
        },
        variables: {
          templatePersonalizations: variables?.templatePersonalizations || {},
          testSettings: variables?.testSettings || {},
        },
        schedule_config: schedule_config || {},
        mapping_config: {
          targetTemplateMappings: target_config?.targetTemplateMappings || [],
        },
      };
    }

    const { data, error } = await supabase
      .from("workflows")
      .insert(workflowData)
      .select()
      .single();

    if (error) throw error;

    console.log("✅ 워크플로우 생성 완료:", {
      id: data.id,
      name: data.name,
      trigger_type: data.trigger_type,
    });

    // 🔥 자동 스케줄링 처리 (active + recurring인 경우)
    let schedulingResult = null;
    if (data.status === 'active' && data.trigger_type === 'manual' && data.schedule_config?.type === 'recurring') {
      console.log(`📅 자동 스케줄링 시작: ${data.name}`);
      schedulingResult = await handleWorkflowActivation(data);
      
      if (schedulingResult.success) {
        console.log(`✅ 자동 스케줄링 완료: ${data.name}`);
      } else {
        console.error(`❌ 자동 스케줄링 실패: ${data.name}`, schedulingResult.error);
        // 스케줄링 실패는 워크플로우 생성 성공에 영향을 주지 않음
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: data,
        scheduling: schedulingResult // 스케줄링 결과 포함
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("워크플로우 생성 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}
