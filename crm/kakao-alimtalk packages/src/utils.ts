import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { COOLSMS_API_KEY, COOLSMS_API_SECRET } from "./const";
import { KakaoAlimtalkTemplateRawData } from "./types";

export function getAuthorization() {
  const date = new Date();
  const salt = uuidv4();
  const hmacValue = crypto
    .createHmac("sha256", COOLSMS_API_SECRET)
    .update(date.toISOString() + salt)
    .digest("hex");
  const authorization = `HMAC-SHA256 apiKey=${COOLSMS_API_KEY}, date=${date.toISOString()}, salt=${salt}, signature=${hmacValue}`;
  return authorization;
}

export async function fetchTemplates(): Promise<{
  templateList: KakaoAlimtalkTemplateRawData[];
  limit: number;
  startKey: string;
  nextKey: string;
}> {
  const authorization = getAuthorization();
  try {
    const response = await axios.get<{
      templateList: KakaoAlimtalkTemplateRawData[];
      limit: number;
      startKey: string;
      nextKey: string;
    }>("https://api.coolsms.co.kr/kakao/v2/templates?limit=1000", {
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
    });
    if (response.status !== 200 || !response.data.templateList) {
      throw new Error("API 응답이 올바르지 않습니다.");
    }
    return response.data;
  } catch (error) {
    console.error("템플릿 데이터를 가져오는데 실패했습니다:", error);
    process.exit(1);
  }
}
