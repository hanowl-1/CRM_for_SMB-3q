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
  console.log('🚀 =================================');
  console.log('🚀 워크플로우 미리보기 API 호출 시작');
  console.log('🚀 =================================');
  
  try {
    const { targetGroups, templates, templateVariables, targetTemplateMappings, limit = 5 } = await request.json();

    console.log('🔄 워크플로우 미리보기 요청:', {
      timestamp: new Date().toISOString(),
      targetGroupsCount: targetGroups?.length || 0,
      templatesCount: templates?.length || 0,
      mappingsCount: targetTemplateMappings?.length || 0,
      templateVariablesCount: Object.keys(templateVariables || {}).length,
      limit
    });

    console.log('📊 요청 데이터 상세:', {
      targetGroupsDetail: targetGroups?.map((g: any) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        hasDynamicQuery: !!g.dynamicQuery,
        sqlQuery: g.dynamicQuery?.sql ? g.dynamicQuery.sql.substring(0, 100) + '...' : 'N/A'
      })),
      templatesDetail: templates?.map((t: any) => ({
        id: t.id,
        name: t.templateName,
        code: t.templateCode
      })),
      mappingsDetail: targetTemplateMappings?.map((m: any) => ({
        id: m.id,
        targetGroupId: m.targetGroupId,
        templateId: m.templateId,
        fieldMappingsCount: m.fieldMappings?.length || 0
      }))
    });

    if (!targetGroups || !Array.isArray(targetGroups) || targetGroups.length === 0) {
      console.log('❌ 대상 그룹이 없음');
      return NextResponse.json({ error: '대상 그룹이 없습니다.' }, { status: 400 });
    }

    if (!templates || !Array.isArray(templates) || templates.length === 0) {
      console.log('❌ 템플릿이 없음');
      return NextResponse.json({ error: '템플릿이 없습니다.' }, { status: 400 });
    }

    const previewData: ContactPreview[] = [];

    for (const group of targetGroups) {
      try {
        console.log(`🔍 그룹 "${group.name}" 처리 시작:`, {
          id: group.id,
          type: group.type,
          hasDynamicQuery: !!group.dynamicQuery,
          sql: group.dynamicQuery?.sql
        });

        // 동적 쿼리만 처리 (정적 그룹은 제외)
        if (group.type !== 'dynamic' || !group.dynamicQuery?.sql) {
          console.log(`⏭️ 그룹 "${group.name}"은 동적 쿼리가 아니므로 건너뜀 (type: ${group.type})`);
          continue;
        }

        console.log(`🔄 MySQL 연결 시작 - 그룹 "${group.name}"`);
        // MySQL 연결
        const connection = await mysql.createConnection(dbConfig);
        
        try {
          // 동적 쿼리 실행하여 실제 수신자 데이터 가져오기
          // 세미콜론 제거 후 LIMIT 추가
          let cleanQuery = group.dynamicQuery.sql.trim();
          if (cleanQuery.endsWith(';')) {
            cleanQuery = cleanQuery.slice(0, -1);
          }
          const limitedQuery = `${cleanQuery} LIMIT ${limit}`;
          
          console.log(`📊 쿼리 실행:`, { 
            originalQuery: group.dynamicQuery.sql,
            cleanedQuery: cleanQuery,
            finalQuery: limitedQuery,
            limit 
          });
          
          const [rows] = await connection.execute(limitedQuery);
          const contacts = rows as any[];

          console.log(`📋 쿼리 결과:`, {
            groupName: group.name,
            rowsCount: contacts?.length || 0,
            sampleRow: contacts?.[0] || null,
            allFields: contacts?.[0] ? Object.keys(contacts[0]) : []
          });

          if (!contacts || contacts.length === 0) {
            console.log(`❌ 그룹 "${group.name}"에서 조회된 연락처가 없음`);
            continue;
          }

          console.log(`✅ 그룹 "${group.name}"에서 ${contacts.length}개 연락처 조회됨`);

          // 각 연락처에 대해 개인화된 메시지 생성
          for (const contact of contacts) {
            const contactPreview: ContactPreview = {
              groupName: group.name,
              contact: {
                id: String(contact.id || contact.adId || contact.userId || contact.idx || 'unknown'),
                name: String(contact.name || contact.companyName || contact.title || contact.company || contact.advertiser || '이름 없음'),
                phone: String(contact.phone || contact.phoneNumber || contact.mobile || contact.tel || contact.contact || '번호 없음'),
                email: contact.email || contact.emailAddress || contact.mail,
                company: contact.company || contact.companyName || contact.advertiser || contact.business,
                position: contact.position || contact.role || contact.job || contact.title,
                tags: [],
                customFields: contact
              },
              messages: []
            };

            console.log(`👤 연락처 정보 매핑:`, {
              원본데이터: Object.keys(contact),
              매핑결과: {
                id: contactPreview.contact.id,
                name: contactPreview.contact.name,
                phone: contactPreview.contact.phone,
                company: contactPreview.contact.company
              }
            });

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
                  
                  // 먼저 기본 변수 값들을 설정 (templateVariables에서)
                  const baseVariables = templateVariables?.[template.id] || {};
                  Object.entries(baseVariables).forEach(([key, value]) => {
                    personalizedVariables[key] = String(value || '');
                  });
                  
                  console.log(`📋 기본 변수 값 설정:`, {
                    templateId: template.id,
                    baseVariables,
                    personalizedVariables: { ...personalizedVariables }
                  });
                  
                  // 그 다음 매핑 정보로 덮어쓰기 (실제 데이터베이스 값으로)
                  for (const fieldMapping of targetMapping.fieldMappings) {
                    const { templateVariable, targetField, formatter, defaultValue } = fieldMapping;
                    
                    // 연락처 데이터에서 해당 필드 값 가져오기
                    let rawValue = contact[targetField];
                    
                    console.log(`🔍 필드 매핑 처리:`, {
                      templateVariable,
                      targetField,
                      rawValue,
                      hasValue: rawValue !== null && rawValue !== undefined && rawValue !== ''
                    });
                    
                    // 템플릿 변수명에서 #{} 제거
                    const variableName = templateVariable.replace(/^#{|}$/g, '');
                    
                    // 실제 데이터베이스 값이 있고 의미있는 값인 경우에만 덮어쓰기
                    if (rawValue !== null && rawValue !== undefined && rawValue !== '' && 
                        targetField !== 'id' && // id 필드는 제외 (모든 변수가 id로 매핑되는 것 방지)
                        String(rawValue) !== contact.id) { // id 값과 같은 경우도 제외
                      
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
                      
                      personalizedVariables[variableName] = formattedValue;
                      console.log(`🔧 데이터베이스 값으로 변수 덮어쓰기:`, {
                        templateVariable: variableName,
                        targetField,
                        rawValue,
                        formattedValue,
                        formatter
                      });
                    } else if (defaultValue && !personalizedVariables[variableName]) {
                      // 기본값이 있고 현재 변수 값이 없는 경우에만 기본값 사용
                      personalizedVariables[variableName] = defaultValue;
                      console.log(`🔧 기본값으로 변수 설정:`, {
                        templateVariable: variableName,
                        defaultValue
                      });
                    } else {
                      console.log(`⚠️ 기존 변수 값 유지:`, {
                        templateVariable: variableName,
                        reason: rawValue === null || rawValue === undefined || rawValue === '' ? '데이터 없음' :
                               targetField === 'id' ? 'id 필드 제외' :
                               String(rawValue) === contact.id ? 'id 값과 동일' : '알 수 없음',
                        currentValue: personalizedVariables[variableName],
                        targetField,
                        rawValue
                      });
                    }
                  }
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
          // 세미콜론 제거 후 COUNT 쿼리 생성
          let cleanCountQuery = group.dynamicQuery.sql.trim();
          if (cleanCountQuery.endsWith(';')) {
            cleanCountQuery = cleanCountQuery.slice(0, -1);
          }
          const countQuery = `SELECT COUNT(*) as total FROM (${cleanCountQuery}) as subquery`;
          
          console.log(`📊 카운트 쿼리 실행:`, {
            originalQuery: group.dynamicQuery.sql,
            cleanedQuery: cleanCountQuery,
            finalCountQuery: countQuery
          });
          
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
      messagesGenerated: previewData.reduce((total, contact) => total + contact.messages.length, 0),
      processedGroups: targetGroups.filter(g => g.type === 'dynamic' && g.dynamicQuery?.sql).length,
      totalGroups: targetGroups.length,
      templatesUsed: templates?.length || 0,
      hasPreviewData: previewData.length > 0,
      previewSample: previewData.length > 0 ? {
        firstContact: previewData[0].contact.name,
        firstGroupName: previewData[0].groupName,
        messagesCount: previewData[0].messages.length
      } : null
    });

    if (previewData.length === 0) {
      console.log('⚠️ 미리보기 데이터가 생성되지 않았습니다. 가능한 원인:');
      console.log('1. 동적 대상 그룹의 SQL 쿼리 결과가 비어있음');
      console.log('2. 매핑 정보가 올바르지 않음');
      console.log('3. 템플릿이 선택되지 않음');
      console.log('4. MySQL 연결 문제');
      
      // 추가 안내: VariableMapping 시스템 사용 방법
      console.log('💡 개인화된 변수 사용을 위해서는:');
      console.log('- 워크플로우 빌더에서 "변수 매핑" 기능을 사용하세요');
      console.log('- 각 템플릿 변수에 대해 sourceType을 "query"로 설정하고 SQL 쿼리를 입력하세요');
    }

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