import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.MYSQL_READONLY_HOST || 'supermembers-prod.cluster-cy8cnze5wxti.ap-northeast-2.rds.amazonaws.com',
  port: parseInt(process.env.MYSQL_READONLY_PORT || '3306'),
  user: process.env.MYSQL_READONLY_USER || 'readonly',
  password: process.env.MYSQL_READONLY_PASSWORD || 'phozphoz1!',
  database: process.env.MYSQL_READONLY_DATABASE || 'supermembers',
  charset: 'utf8mb4',
  timezone: '+09:00',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  ssl: {
    rejectUnauthorized: false
  }
};

interface ContactPreview {
  groupName: string;
  contact: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    company?: string;
    position?: string;
    tags?: string[];
    customFields: Record<string, any>;
  };
  messages: {
    templateId: string;
    templateName: string;
    templateCode: string;
    originalContent: string;
    processedContent: string;
    variables: Record<string, string>;
    characterCount: number;
  }[];
}

// 대상-템플릿 매핑 관련 타입 정의
interface FieldMapping {
  templateVariable: string;
  targetField: string;
  formatter?: 'text' | 'number' | 'currency' | 'date';
  defaultValue?: string;
}

interface TargetTemplateMapping {
  id: string;
  targetGroupId: string;
  templateId: string;
  fieldMappings: FieldMapping[];
  createdAt: string;
  updatedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const { targetGroups, templates, templateVariables, targetTemplateMappings, limit = 5 } = await request.json();

    console.log('🔄 워크플로우 미리보기 요청:', {
      targetGroupsCount: targetGroups?.length || 0,
      templatesCount: templates?.length || 0,
      mappingsCount: targetTemplateMappings?.length || 0,
      templateVariablesCount: Object.keys(templateVariables || {}).length
    });

    if (!targetGroups || !Array.isArray(targetGroups) || targetGroups.length === 0) {
      return NextResponse.json({ error: '대상 그룹이 없습니다.' }, { status: 400 });
    }

    const previewData: ContactPreview[] = [];

    for (const group of targetGroups) {
      try {
        // 동적 쿼리만 처리 (정적 그룹은 제외)
        if (group.type !== 'dynamic' || !group.dynamicQuery?.sql) {
          console.log(`그룹 "${group.name}"은 동적 쿼리가 아니므로 건너뜀`);
          continue;
        }

        // MySQL 연결
        const connection = await mysql.createConnection(dbConfig);
        
        try {
          // 동적 쿼리 실행하여 실제 수신자 데이터 가져오기
          const limitedQuery = `${group.dynamicQuery.sql} LIMIT ${limit}`;
          const [rows] = await connection.execute(limitedQuery);
          const contacts = rows as any[];

          if (!contacts || contacts.length === 0) {
            console.log(`그룹 "${group.name}"에서 조회된 연락처가 없음`);
            continue;
          }

          console.log(`그룹 "${group.name}"에서 ${contacts.length}개 연락처 조회됨`);

          // 각 연락처에 대해 개인화된 메시지 생성
          for (const contact of contacts) {
            const contactPreview: ContactPreview = {
              groupName: group.name,
              contact: {
                id: String(contact.id || contact.adId || contact.userId || 'unknown'),
                name: String(contact.name || contact.companyName || contact.title || '이름 없음'),
                phone: String(contact.phone || contact.phoneNumber || contact.mobile || '번호 없음'),
                email: contact.email,
                company: contact.company || contact.companyName,
                position: contact.position || contact.role,
                tags: [],
                customFields: contact
              },
              messages: []
            };

            // 선택된 템플릿들에 대해 개인화된 메시지 생성
            if (templates && Array.isArray(templates)) {
              for (const template of templates) {
                console.log(`🔧 템플릿 "${template.templateName}" 처리 중...`);
                
                // 해당 그룹과 템플릿에 대한 매핑 정보 찾기
                const targetMapping = targetTemplateMappings?.find((mapping: TargetTemplateMapping) => 
                  mapping.targetGroupId === group.id && mapping.templateId === template.id
                );

                console.log(`🔍 매핑 정보:`, {
                  groupId: group.id,
                  templateId: template.id,
                  mappingFound: !!targetMapping,
                  fieldMappingsCount: targetMapping?.fieldMappings?.length || 0
                });

                const personalizedVariables: Record<string, string> = {};

                if (targetMapping && targetMapping.fieldMappings) {
                  // 대상-템플릿 매핑이 있는 경우: 매핑 정보를 사용하여 변수 생성
                  console.log(`✅ 매핑 정보 사용하여 변수 생성`);
                  
                  targetMapping.fieldMappings.forEach((fieldMapping: FieldMapping) => {
                    const { templateVariable, targetField, formatter, defaultValue } = fieldMapping;
                    
                    // 연락처 데이터에서 해당 필드 값 가져오기
                    let rawValue = contact[targetField];
                    
                    // 값이 없으면 기본값 사용
                    if (rawValue === null || rawValue === undefined || rawValue === '') {
                      rawValue = defaultValue || '';
                    }

                    // 포맷터 적용
                    let formattedValue = String(rawValue);
                    if (formatter && rawValue) {
                      switch (formatter) {
                        case 'number':
                          formattedValue = Number(rawValue).toLocaleString();
                          break;
                        case 'currency':
                          formattedValue = `${Number(rawValue).toLocaleString()}원`;
                          break;
                        case 'date':
                          formattedValue = new Date(rawValue).toLocaleDateString();
                          break;
                        default:
                          formattedValue = String(rawValue);
                      }
                    }

                    // 템플릿 변수명에서 #{} 제거
                    const variableName = templateVariable.replace(/^#{|}$/g, '');
                    personalizedVariables[variableName] = formattedValue;

                    console.log(`🔧 변수 매핑:`, {
                      templateVariable: variableName,
                      targetField,
                      rawValue,
                      formattedValue,
                      formatter
                    });
                  });
                } else {
                  // 매핑 정보가 없는 경우: 기존 방식 사용 (하위 호환성)
                  console.log(`⚠️ 매핑 정보 없음, 기존 방식 사용`);
                  
                  const variables = templateVariables?.[template.id] || {};
                  
                  // 기본 연락처 정보 매핑
                  personalizedVariables['고객명'] = contactPreview.contact.name;
                  personalizedVariables['회사명'] = contactPreview.contact.company || '회사명 없음';
                  personalizedVariables['직책'] = contactPreview.contact.position || '직책 없음';
                  personalizedVariables['이메일'] = contactPreview.contact.email || '이메일 없음';
                  personalizedVariables['전화번호'] = contactPreview.contact.phone;

                  // MySQL 쿼리 결과의 모든 필드를 변수로 매핑
                  Object.entries(contact).forEach(([key, value]) => {
                    if (value !== null && value !== undefined) {
                      personalizedVariables[key] = String(value);
                    }
                  });

                  // 설정된 변수 값으로 덮어쓰기
                  Object.entries(variables).forEach(([key, value]) => {
                    personalizedVariables[key] = String(value || '');
                  });
                }

                // 템플릿 내용에 변수 치환
                let processedContent = template.templateContent;
                Object.entries(personalizedVariables).forEach(([key, value]) => {
                  processedContent = processedContent.replace(new RegExp(`#{${key}}`, 'g'), value);
                });

                console.log(`📝 최종 메시지 생성:`, {
                  originalLength: template.templateContent.length,
                  processedLength: processedContent.length,
                  variablesCount: Object.keys(personalizedVariables).length
                });

                contactPreview.messages.push({
                  templateId: template.id,
                  templateName: template.templateName,
                  templateCode: template.templateCode,
                  originalContent: template.templateContent,
                  processedContent,
                  variables: personalizedVariables,
                  characterCount: processedContent.length
                });
              }
            }

            previewData.push(contactPreview);
          }

        } finally {
          await connection.end();
        }

      } catch (groupError) {
        console.error(`그룹 "${group.name}" 처리 중 오류:`, groupError);
        continue;
      }
    }

    // 전체 예상 수신자 수 계산
    let totalEstimatedCount = 0;
    for (const group of targetGroups) {
      try {
        if (group.type !== 'dynamic' || !group.dynamicQuery?.sql) {
          continue;
        }

        const connection = await mysql.createConnection(dbConfig);
        
        try {
          const countQuery = `SELECT COUNT(*) as total FROM (${group.dynamicQuery.sql}) as subquery`;
          const [countRows] = await connection.execute(countQuery);
          const countResult = countRows as any[];
          
          if (countResult && countResult[0] && countResult[0].total) {
            totalEstimatedCount += countResult[0].total;
          }
        } finally {
          await connection.end();
        }
      } catch (countError) {
        console.error(`그룹 "${group.name}" 수 계산 중 오류:`, countError);
      }
    }

    console.log('✅ 미리보기 생성 완료:', {
      previewDataCount: previewData.length,
      totalEstimatedCount,
      messagesGenerated: previewData.reduce((total, contact) => total + contact.messages.length, 0)
    });

    return NextResponse.json({
      success: true,
      data: previewData,
      totalEstimatedCount,
      previewCount: previewData.length
    });

  } catch (error) {
    console.error('❌ 워크플로우 미리보기 오류:', error);
    return NextResponse.json(
      { error: '미리보기를 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 