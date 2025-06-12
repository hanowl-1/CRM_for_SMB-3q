export interface KakaoTemplate {
  id: string;
  templateCode: string;
  templateName: string;
  templateContent: string;
  templateTitle?: string;
  templateSubtitle?: string;
  templateExtra?: string;
  templateAd?: string;
  templateImageName?: string;
  templateImageUrl?: string;
  block: string;
  dormant: boolean;
  securityFlag: boolean;
  status: string;
  inspectionStatus: string;
  senderKey: string;
  buttons?: Array<{
    name: string;
    type: string;
    url_mobile?: string;
    url_pc?: string;
    scheme_android?: string;
    scheme_ios?: string;
  }>;
  categoryCode: string;
  createDate: string;
  updateDate: string;
  channelKey: string;
  variables?: string[];
}

export interface TemplateCategory {
  code: string;
  name: string;
  description?: string;
}

export interface TemplateFilter {
  search?: string;
  category?: string;
  status?: string;
  platform?: string;
  hasButtons?: boolean;
  hasImages?: boolean;
}

export interface TemplateStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  withButtons: number;
  withImages: number;
} 