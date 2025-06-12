import path from "path";
import fs from "fs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.tz.setDefault("Asia/Seoul");
import { fetchTemplates } from "../src/utils";
import {
  KakaoAlimtalkTemplateRawData,
  KakaoChannel,
  KakaoChannelIds,
  ServicePlatform,
} from "../src/types";

async function generateTemplateFile() {
  const templates = await fetchTemplates();

  let fileContent = `// 이 파일은 코드 생성 스크립트에 의해 자동 생성됩니다. 직접 수정하지 마세요.\n// 생성일: ${dayjs().format("YYYY-MM-DD HH:mm:ss")}\n\n`;

  const findTemplateVariablesRegex = /#\{([^}]+)\}/g;
  const findTemplateNumberRegex = /^(\d+)\.\s*(.+)$/;
  const findServicePlatformRegex = /\[(슈퍼멤버스|슈퍼차트)\]/;

  const templateById: Record<string, any> = {};
  const templateByNumber: Record<string, any> = {};
  const templateByPlatform: Record<
    ServicePlatform,
    Record<KakaoChannel, { [key: string]: string }>
  > = {
    CHART: { BLOGGER: {}, CEO: {} },
    MEMBERS: { BLOGGER: {}, CEO: {} },
  };

  templates.templateList.forEach((template: KakaoAlimtalkTemplateRawData) => {
    const { templateId, name, content, channelId, buttons, variables } =
      template;
    const substitutions: string[] = [];

    if (buttons.length > 0) {
      for (const button of buttons) {
        const { linkMo, linkPc, linkAnd, linkIos } = button;
        if (linkMo) {
          const matches = linkMo.match(findTemplateVariablesRegex);
          if (matches) substitutions.push(...matches);
        }
        if (linkPc) {
          const matches = linkPc.match(findTemplateVariablesRegex);
          if (matches) substitutions.push(...matches);
        }
        if (linkAnd) {
          const matches = linkAnd.match(findTemplateVariablesRegex);
          if (matches) substitutions.push(...matches);
        }
        if (linkIos) {
          const matches = linkIos.match(findTemplateVariablesRegex);
          if (matches) substitutions.push(...matches);
        }
      }
    }
    if (variables.length > 0) {
      for (const variable of variables) {
        substitutions.push(variable["name"]);
      }
    }
    const uniqueSubstitutions = [...new Set(substitutions)];

    let matches = name.match(findTemplateNumberRegex);
    if (!matches) {
      console.error(
        `Template name ${name} does not match the expected format. (number)`,
      );
      return;
    }
    const templateName = name;
    const templateNumber = Number(matches[1]);
    const templateTitle = matches[2].replace(/\[[^\]]*\]/g, "").trim();
    const matches2 = templateName.match(findServicePlatformRegex);

    const servicePlatform: ServicePlatform = !!matches2
      ? matches2[1] === "슈퍼멤버스"
        ? "MEMBERS"
        : "CHART"
      : null;

    const channel = KakaoChannelIds[channelId];

    const templateMetadata = {
      templateName,
      templateNumber,
      templateTitle,
    };

    const templateData = {
      servicePlatform,
      channel,
      channelId,
      templateId,
      content,
      ...templateMetadata,
      templateParams: uniqueSubstitutions,
    };

    templateById[templateId] = templateData;
    templateByNumber[templateNumber] = templateData;
    if (!!servicePlatform)
      templateByPlatform[servicePlatform][channel][templateNumber] =
        templateTitle;
  });

  // 1. templateId를 키로 하는 객체
  fileContent += `export const KakaoAlimtalkTemplateById = ${JSON.stringify(templateById, null, 4)} as const;\n\n`;
  fileContent += `export type KakaoAlimtalkTemplateId = keyof typeof KakaoAlimtalkTemplateById;\n\n`;

  // 2. templateNumber를 키로 하는 객체
  fileContent += `export const KakaoAlimtalkTemplateByNumber = ${JSON.stringify(templateByNumber, null, 4)} as const;\n\n`;
  fileContent += `export type KakaoAlimtalkTemplateNumber = keyof typeof KakaoAlimtalkTemplateByNumber;\n\n`;

  // 3. 채널별 템플릿 메타데이터 그룹핑 객체
  fileContent += `export const KakaoAlimtalkTemplateByPlatform = ${JSON.stringify(templateByPlatform, null, 4)} as const;\n\n`;

  // 출력 경로 설정 및 폴더 확인/생성
  const outputPath = path.join(process.cwd(), "./src/generated/template.ts");
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  fs.writeFileSync(outputPath, fileContent, "utf-8");
  console.log(`Generated ${outputPath} successfully!`);
}

generateTemplateFile();
