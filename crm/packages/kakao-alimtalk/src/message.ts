import { KakaoAlimtalkTemplateByNumber } from "./generated/template";
import { COOLSMS_API_KEY, COOLSMS_API_SECRET } from "./const";
import coolsms, { type Message, type Count } from "coolsms-node-sdk";
import { ApiResponse } from "@repo/shared-types/http";

const messageService = new coolsms(COOLSMS_API_KEY, COOLSMS_API_SECRET);
const SENDER_PHONE_NUMBER = "18007710";

type TemplateVariables<T extends keyof typeof KakaoAlimtalkTemplateByNumber> =
  (typeof KakaoAlimtalkTemplateByNumber)[T] extends {
    templateParams: infer P extends readonly any[];
  }
    ? P extends [] // 템플릿 파라미터가 빈 배열인 경우
      ? {} // 빈 객체 타입 반환
      : P[number] extends string
        ? { [K in P[number]]: string }
        : never
    : never;

export async function sendAlimtalkByTemplateNumber<
  T extends keyof typeof KakaoAlimtalkTemplateByNumber,
>(
  templateNumber: T,
  phoneNumber: string,
  variables: TemplateVariables<T>,
): Promise<ApiResponse<{ count: Count }>> {
  const template = KakaoAlimtalkTemplateByNumber[templateNumber];

  const { channelId, templateId, templateParams } = template;
  const to = phoneNumber.replaceAll(/[^0-9]/g, "");

  if (!/^(010)\d{8}$/.test(to))
    return {
      success: false,
      data: null,
      error: {
        status: 400,
        code: "INVALID_PHONE_NUMBER",
        message: "010으로 시작하는 11자리 숫자 문자열이어야 합니다.",
      },
    };

  // CoolSMS API에 맞는 변수 형식으로 변환: #{변수명} 형식
  const coolsmsVariables: Record<string, string> = {};
  if (templateParams.length > 0 && variables) {
    Object.entries(variables as Record<string, string>).forEach(([key, value]) => {
      coolsmsVariables[`#{${key}}`] = value;
    });
  }

  const payload = {
    autoTypeDetect: false,
    type: "ATA",
    to,
    from: SENDER_PHONE_NUMBER,
    kakaoOptions: {
      pfId: channelId,
      templateId: templateId,
      disableSms: false, // 문자 대체발송
      adFlag: false,
      ...(templateParams.length > 0 && { variables: coolsmsVariables }),
    },
  } as Message;

  try {
    const result = await messageService.sendMany([payload]); // NOTE: 형식이 잘못돼도 피드백이 안옴
    const { count } = result;
    return { success: true, data: { count }, error: null };
  } catch (err) {
    console.error("@@ err", err);
    return {
      success: false,
      data: null,
      error: {
        status: 500,
        code: "INTERNAL_SERVER_ERROR",
        message: err.message,
      },
    };
  }
}
