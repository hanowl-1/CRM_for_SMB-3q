import { type NextRequest, NextResponse } from "next/server"

// 임시 데이터 저장소 (실제로는 데이터베이스 사용)
const campaigns: any[] = []

export async function GET() {
  return NextResponse.json(campaigns)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const newCampaign = {
      id: Date.now(),
      ...body,
      status: "draft",
      createdAt: new Date().toISOString(),
      sent: 0,
    }

    campaigns.push(newCampaign)

    return NextResponse.json(newCampaign, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }
}
