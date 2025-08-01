import { type NextRequest, NextResponse } from "next/server"

// Coolsms API 연동 함수 (실제 구현 시 사용)
async function sendViaCoolsms(messageData: any) {
  // 실제 Coolsms API 호출 로직
  // const response = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.COOLSMS_API_KEY}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify(messageData)
  // })

  // 임시 응답
  return {
    success: true,
    messageId: `msg_${Date.now()}`,
    status: "sent",
  }
}

export async function POST(request: NextRequest) {
  try {
    const { campaignId, recipients, messageContent, messageType } = await request.json()

    const results = []

    for (const recipient of recipients) {
      // 변수 치환
      let personalizedMessage = messageContent
      Object.keys(recipient.variables || {}).forEach((key) => {
        personalizedMessage = personalizedMessage.replace(new RegExp(`{{${key}}}`, "g"), recipient.variables[key])
      })

      // 메시지 발송
      const result = await sendViaCoolsms({
        to: recipient.phone,
        text: personalizedMessage,
        type: messageType,
      })

      results.push({
        recipient: recipient.phone,
        ...result,
      })
    }

    return NextResponse.json({
      success: true,
      results,
      totalSent: results.filter((r) => r.success).length,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to send messages" }, { status: 500 })
  }
}
