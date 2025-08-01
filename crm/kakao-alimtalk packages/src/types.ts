export type TemplateStatus = "PENDING" | "INSPECTING" | "APPROVED" | "REJECTED";
export type ButtonType = "DS" | "WL" | "AL" | "BK" | "MD" | "BC" | "BT" | "AC";

export interface KakaoAlimtalkTemplateRawData {
  channelId: KakaoChannelId;
  templateId: string;
  name: string;
  status: TemplateStatus;
  categoryCode: string;
  content: string;
  buttons: {
    buttonType: ButtonType;
    buttonName: string;
    linkMo: string;
    linkPc: string;
    linkAnd: string;
    linkIos: string;
  }[];
  variables: { name: string }[];
}

export const KakaoChannels = {
  BLOGGER: "KA01PF240827043524198kVF1UDK9zbb",
  CEO: "KA01PF201224090944283HjX3BnWfSna",
} as const;

export const KakaoChannelIds = {
  KA01PF240827043524198kVF1UDK9zbb: "BLOGGER",
  KA01PF201224090944283HjX3BnWfSna: "CEO",
} as const;

export type KakaoChannel = keyof typeof KakaoChannels;
export type KakaoChannelId = keyof typeof KakaoChannelIds;

export type ServicePlatform = "MEMBERS" | "CHART";

export type AlimtalkMessageStatus =
  | "PENDING" // 대기중
  | "SENDING" // 이미 발송 요청된 그룹
  | "DELETED" // 삭제 처리된 그룹
  | "FAILED" // 실패 처리된 그룹
  | "COMPLETE" // 발송 완료된 그룹
  | "SCHEDULED"; // 발송 예약된 그룹;
