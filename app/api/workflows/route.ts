import { type NextRequest, NextResponse } from "next/server"

// 임시 워크플로우 저장소
const workflows: any[] = []

export async function GET() {
  return NextResponse.json(workflows)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const newWorkflow = {
      id: Date.now(),
      ...body,
      status: "draft",
      createdAt: new Date().toISOString(),
      sent: 0,
      lastRun: null,
    }

    workflows.push(newWorkflow)

    return NextResponse.json(newWorkflow, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create workflow" }, { status: 500 })
  }
}
