import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/database/supabase-client';
import { KakaoAlimtalkTemplateById } from '@/lib/data/kakao-templates';
import { createSuccessResponse, logAndCreateErrorResponse } from '@/lib/utils/api-response';
import { personalizeBatch } from '@/lib/services/personalization-service';

function getSampleValueForVariable(variableName: string): string {
  const lowerName = variableName.toLowerCase();
  
  if (lowerName.includes('review') && lowerName.includes('count')) return '127';
  if (lowerName.includes('total') && lowerName.includes('review')) return '127';
  if (lowerName.includes('monthly') && lowerName.includes('review')) return '45';
  if (lowerName.includes('post') && lowerName.includes('view')) return '1,234';
  if (lowerName.includes('total') && lowerName.includes('view')) return '2,456';
  if (lowerName.includes('place') && lowerName.includes('rank')) return '3위';
  if (lowerName.includes('blog') && lowerName.includes('rank')) return '3위';
  if (lowerName.includes('naver') && lowerName.includes('rank')) return '3위';
  if (lowerName.includes('top') && lowerName.includes('reviewer')) return '127';
  if (lowerName.includes('5p') && lowerName.includes('reviewer')) return '127';
  if (lowerName.includes('view')) return '1,234';
  if (lowerName.includes('rank')) return '3위';
  if (lowerName.includes('count')) return '45';
  if (lowerName.includes('total')) return '127';
  
  return '샘플값';
}

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
  const executionLogs: string[] = [];
  
  try {
    const { targetGroups, templates, templatePersonalizations = {} } = await request.json();
    
    if (!targetGroups || !templates) {
      return NextResponse.json(
        { error: 'targetGroups와 templates가 필요합니다.' },
        { status: 400 }
      );
    }

    // 🔥 동적 베이스 URL 결정
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://v0-kakao-beryl.vercel.app')
      : 'http://localhost:3000';

    executionLogs.push('🚀 워크플로우 미리보기 시작');
    executionLogs.push(`🌐 베이스 URL: ${baseUrl}`);
    console.log('🚀 워크플로우 미리보기 시작');
    console.log('📋 템플릿 개인화 설정:', templatePersonalizations);

    // 🔥 1단계: 실제 알림톡 템플릿 데이터 로드
    const actualTemplates = templates.map((template: any) => {
      const templateKey = template.id || template.templateCode;
      
      // 여러 방법으로 템플릿 찾기
      let realTemplate = null;
      
      // 1) 직접 키 매칭
      realTemplate = KakaoAlimtalkTemplateById[templateKey];
      
      // 2) 113번 템플릿을 특별히 찾기
      if (!realTemplate && template.templateName && template.templateName.includes('113.')) {
        const templateEntries = Object.entries(KakaoAlimtalkTemplateById);
        for (const [key, tmpl] of templateEntries) {
          if (tmpl.templateName && tmpl.templateName.includes('113.') && tmpl.templateName.includes('상위 블로거 참여 O')) {
            realTemplate = tmpl;
            executionLogs.push(`✅ 113번 템플릿 매칭 성공: ${key}`);
            break;
          }
        }
      }
      
      // 3) 템플릿 이름으로 매칭
      if (!realTemplate && template.templateName) {
        const templateEntries = Object.entries(KakaoAlimtalkTemplateById);
        for (const [key, tmpl] of templateEntries) {
          if (tmpl.templateName === template.templateName) {
            realTemplate = tmpl;
            break;
          }
        }
      }

      if (realTemplate) {
        executionLogs.push(`✅ 실제 템플릿 로드 성공: ${realTemplate.templateName}`);
        return {
          id: template.id || templateKey,
          templateName: realTemplate.templateName,
          templateCode: templateKey,
          content: realTemplate.content,
          templateParams: realTemplate.templateParams || []
        };
      } else {
        executionLogs.push(`⚠️ 템플릿 데이터 없음: ${template.templateName}`);
        return {
          id: template.id || templateKey,
          templateName: template.templateName || '알 수 없는 템플릿',
          templateCode: templateKey,
          content: '템플릿 내용을 불러올 수 없습니다.',
          templateParams: []
        };
      }
    });

    console.log('✅ 실제 템플릿 로드 완료:', actualTemplates.map(t => t.templateName));

    // 🔥 2단계: 저장된 개별 변수 매핑 정보 조회
    executionLogs.push('🔍 저장된 개별 변수 매핑 정보 조회 중...');
    const supabase = getSupabaseAdmin();
    
    const { data: savedMappings, error: mappingError } = await supabase
      .from('individual_variable_mappings')
      .select('*');

    if (mappingError) {
      console.error('❌ 매핑 정보 조회 오류:', mappingError);
      executionLogs.push(`❌ 매핑 정보 조회 오류: ${mappingError.message}`);
    } else {
      executionLogs.push(`📋 ${savedMappings?.length || 0}개의 저장된 변수 매핑 발견`);
      console.log('📋 저장된 매핑:', savedMappings);
    }

    // 🔥 3단계: Feature_Workflow_Builder.md 4.1.1 범용적 매칭 시스템
    // 알림톡 변수 쿼리 실행 (전체 데이터 조회하여 캐시)
    const variableDataCache = new Map<string, any[]>();

    if (savedMappings && savedMappings.length > 0) {
      for (const mapping of savedMappings) {
        if (mapping.source_type === 'query' && mapping.source_field) {
          try {
            executionLogs.push(`🔍 변수 쿼리 실행: ${mapping.variable_name}`);
            console.log(`🔍 변수 쿼리 실행: ${mapping.variable_name}`);
            console.log(`📝 쿼리: ${mapping.source_field}`);

            // MySQL API 호출 - 전체 데이터 조회
            const variableResponse = await fetch(`${baseUrl}/api/mysql/query`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
                'x-vercel-set-bypass-cookie': 'true'
              },
              body: JSON.stringify({ 
                query: mapping.source_field,
                limit: 10000 // 충분한 데이터 로드
              })
            });

            if (variableResponse.ok) {
              const variableResult = await variableResponse.json();
              if (variableResult.success && variableResult.data && variableResult.data.rows) {
                const rows = variableResult.data.rows;
                variableDataCache.set(mapping.variable_name, rows);
                executionLogs.push(`✅ 변수 데이터 캐시됨: ${mapping.variable_name} (${rows.length}개 행)`);
                console.log(`✅ 변수 데이터 캐시됨: ${mapping.variable_name}`, {
                  rowCount: rows.length,
                  sampleData: rows.slice(0, 3),
                  keyColumn: mapping.key_column,
                  outputColumn: mapping.selected_column,
                  query: mapping.source_field
                });
                
                // 실행 로그에도 쿼리와 샘플 데이터 추가
                executionLogs.push(`📝 쿼리: ${mapping.source_field}`);
                executionLogs.push(`📊 샘플 데이터: ${JSON.stringify(rows.slice(0, 2))}`);
              } else {
                executionLogs.push(`❌ 변수 쿼리 결과 없음: ${mapping.variable_name}`);
              }
            } else {
              const errorText = await variableResponse.text();
              executionLogs.push(`❌ 변수 쿼리 API 호출 실패: ${mapping.variable_name} (${variableResponse.status})`);
              console.error(`❌ MySQL API 오류 (${mapping.variable_name}):`, errorText);
            }
          } catch (queryError) {
            console.error(`❌ 변수 쿼리 실행 오류 (${mapping.variable_name}):`, queryError);
            executionLogs.push(`❌ 변수 쿼리 실행 오류: ${mapping.variable_name} - ${queryError instanceof Error ? queryError.message : '알 수 없는 오류'}`);
          }
        }
      }
    }

    console.log(`🔍 변수 캐시 상태: ${variableDataCache.size}개 변수, 총 ${Array.from(variableDataCache.values()).reduce((sum, arr) => sum + arr.length, 0)}개 행`);

    // 🔥 4단계: 대상 그룹별 처리
    const previewData: ContactPreview[] = [];
    executionLogs.push(`🚀 대상 그룹 처리 시작 (총 ${targetGroups.length}개)`);

    for (const group of targetGroups) {
      if (group.type !== 'dynamic' || !group.dynamicQuery?.sql) {
        continue;
      }

      executionLogs.push(`🔍 그룹 "${group.name}" 처리 시작`);
      console.log(`🔍 그룹 "${group.name}" 처리 시작`);

      try {
        // 대상자 쿼리 실행 (미리보기용 5명만)
        let targetQuery = group.dynamicQuery.sql.trim();
        if (targetQuery.endsWith(';')) {
          targetQuery = targetQuery.slice(0, -1);
        }
        
        // 기존 LIMIT 절 제거 후 새로 추가
        targetQuery = targetQuery.replace(/\s+LIMIT\s+\d+\s*$/i, '');
        const limitedQuery = `${targetQuery} LIMIT 5`;

        executionLogs.push(`📊 대상자 쿼리 실행: ${limitedQuery}`);
        console.log(`📊 대상자 쿼리 실행: ${limitedQuery}`);

        // MySQL API 호출
        const response = await fetch(`${baseUrl}/api/mysql/query`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
            'x-vercel-set-bypass-cookie': 'true'
          },
          body: JSON.stringify({ 
            query: limitedQuery,
            limit: 5
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`MySQL API 호출 실패: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log(`📋 MySQL API 응답:`, { success: result.success, dataLength: result.data?.rows?.length });

        if (!result.success || !result.data || !result.data.rows || result.data.rows.length === 0) {
          executionLogs.push(`⚠️ 그룹 "${group.name}"에서 데이터 없음`);
          continue;
        }

        const contacts = result.data.rows;
        executionLogs.push(`✅ 그룹 "${group.name}"에서 ${contacts.length}개 연락처 조회됨`);

        // 🔥 5단계: 각 연락처별 개인화 메시지 생성
          for (const contact of contacts) {
            const contactPreview: ContactPreview = {
              groupName: group.name,
              contact: {
              id: String(contact.id || 'unknown'),
              name: String(contact.name || '이름 없음'),
              phone: String(contact.contacts || contact.phone || '번호 없음'),
              email: contact.email,
              company: contact.company_name || contact.company,
              position: contact.position,
                tags: [],
                customFields: contact
              },
              messages: []
            };

          // 🔥 6단계: 각 템플릿별 개인화 처리
          for (const template of actualTemplates) {
            // 기본 변수 설정
            const personalizedVariables: Record<string, string> = {
              'name': contactPreview.contact.name,
              'id': contactPreview.contact.id,
              'company_name': contactPreview.contact.company || contactPreview.contact.name,
            };

            // 🔥 7단계: Feature_Workflow_Builder.md 4.1.1 범용적 매칭 시스템
            // AA열(변수 쿼리의 매칭 컬럼) ↔ BB열(대상자 쿼리의 매칭 컬럼) 매칭
            if (savedMappings) {
              for (const mapping of savedMappings) {
                if (mapping.source_type === 'query' && variableDataCache.has(mapping.variable_name)) {
                  const variableData = variableDataCache.get(mapping.variable_name) || [];
                  
                  // BB열: 대상자 쿼리의 매칭 컬럼 (기본값: id)
                  // keyColumn에서 테이블 별칭 제거 (예: "a.id" → "id")
                  const rawKeyColumn = mapping.key_column || 'id';
                  const targetMatchingColumn = rawKeyColumn.includes('.') ? rawKeyColumn.split('.').pop() : rawKeyColumn;
                  const targetMatchingValue = contact[targetMatchingColumn];
                  
                  console.log(`🔍 매칭 시도: ${mapping.variable_name}`, {
                    rawKeyColumn: rawKeyColumn,
                    targetColumn: targetMatchingColumn,
                    targetValue: targetMatchingValue,
                    variableDataCount: variableData.length,
                    outputColumn: mapping.selected_column,
                    contactKeys: Object.keys(contact)
                  });
                  
                  // AA열(변수 쿼리의 매칭 컬럼) ↔ BB열(대상자 쿼리의 매칭 컬럼) 매칭
                  const matchedRow = variableData.find(row => {
                    // 변수 쿼리 결과에서 실제 사용 가능한 컬럼 확인
                    const availableColumns = Object.keys(row);
                    let variableMatchingValue;
                    
                    // 1) 설정된 keyColumn 사용 시도
                    if (row[rawKeyColumn] !== undefined) {
                      variableMatchingValue = row[rawKeyColumn];
                    }
                    // 2) adId 컬럼 사용 시도 (리뷰 데이터의 경우)
                    else if (row['adId'] !== undefined) {
                      variableMatchingValue = row['adId'];
                    }
                    // 3) id 컬럼 사용 시도
                    else if (row['id'] !== undefined) {
                      variableMatchingValue = row['id'];
                    }
                    // 4) 첫 번째 컬럼 사용
                    else {
                      variableMatchingValue = row[availableColumns[0]];
                    }
                    
                    const isMatch = String(variableMatchingValue) === String(targetMatchingValue);
                    if (isMatch) {
                      console.log(`✅ 매칭 발견: ${variableMatchingValue} === ${targetMatchingValue} (컬럼: ${availableColumns.join(', ')})`);
                    }
                    return isMatch;
                  });
                  
                  if (matchedRow) {
                    // AB열(변수 쿼리의 출력 컬럼) → 최종 개인화 값
                    const personalizedValue = matchedRow[mapping.selected_column];
                    personalizedVariables[mapping.variable_name] = String(personalizedValue || mapping.default_value || '');
                    
                    executionLogs.push(`🔗 매칭 성공: ${mapping.variable_name} = "${personalizedValue}" (${targetMatchingColumn}=${targetMatchingValue})`);
                    console.log(`🔗 매칭 성공: ${mapping.variable_name} = "${personalizedValue}"`);
                    } else {
                    // 매칭 실패 시 기본값 사용
                    const defaultValue = mapping.default_value || getSampleValueForVariable(mapping.variable_name);
                    personalizedVariables[mapping.variable_name] = defaultValue;
                    executionLogs.push(`⚠️ 매칭 실패, 기본값 사용: ${mapping.variable_name} = "${defaultValue}" (대상값: ${targetMatchingValue})`);
                    console.log(`⚠️ 매칭 실패: ${mapping.variable_name}, 대상값: ${targetMatchingValue}, 변수데이터 샘플:`, variableData.slice(0, 3));
                    }
                  }
              }
            }

            // 🔥 8단계: 템플릿에서 모든 변수 패턴 찾기
            let processedContent = template.content;
            const templateVariableMatches = processedContent.match(/#{([^}]+)}/g) || [];
                  
            // 발견된 모든 변수에 대해 기본값 설정 (우선순위: 개별 매핑 > 템플릿 개인화 설정 > 샘플 값)
            templateVariableMatches.forEach(fullVar => {
              const variableName = fullVar.replace(/^#{|}$/g, '');
              
              // 매칭된 실제 값이 없는 경우에만 기본값 사용
              if (personalizedVariables[variableName] === undefined) {
                // 1순위: 템플릿 개인화 설정에서 기본값 찾기
                const templatePersonalization = templatePersonalizations[template.id];
                const variableMapping = templatePersonalization?.variableMappings?.find(
                  (vm: any) => vm.templateVariable === fullVar
                );
                
                if (variableMapping?.defaultValue) {
                  personalizedVariables[variableName] = variableMapping.defaultValue;
                  executionLogs.push(`📋 템플릿 개인화 기본값 사용: ${fullVar} = "${variableMapping.defaultValue}"`);
                } else {
                  // 2순위: 샘플 값 사용
                  personalizedVariables[variableName] = getSampleValueForVariable(variableName);
                  executionLogs.push(`🎲 샘플 값 사용: ${fullVar} = "${personalizedVariables[variableName]}"`);
                }
              }
            });

            // 🔥 9단계: 변수 치환 (매칭된 실제 값 우선 사용)
            for (const [key, value] of Object.entries(personalizedVariables)) {
              // #{key} 패턴으로 저장된 값이 있으면 그것을 우선 사용
              const actualValue = personalizedVariables[`#{${key}}`] || personalizedVariables[key] || value;
              const patterns = [`#{${key}}`, `{${key}}`];
              patterns.forEach(pattern => {
                processedContent = processedContent.replace(new RegExp(pattern.replace(/[{}]/g, '\\$&'), 'g'), actualValue);
              });
            }

            // 메시지 정보 추가
                contactPreview.messages.push({
                  templateId: template.id,
                  templateName: template.templateName,
                  templateCode: template.templateCode,
              originalContent: template.content,
              processedContent: processedContent,
                  variables: personalizedVariables,
                  characterCount: processedContent.length
                });

            executionLogs.push(`✅ 메시지 생성 완료: ${contactPreview.contact.name} - ${template.templateName}`);
            }

            previewData.push(contactPreview);
          }

      } catch (error) {
        console.error(`❌ 그룹 "${group.name}" 처리 오류:`, error);
        executionLogs.push(`❌ 그룹 "${group.name}" 처리 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    // 🔥 최종 응답
    const response = {
      success: true,
      data: previewData,
      totalEstimatedCount: previewData.length,
      debug: {
        savedMappingsCount: savedMappings?.length || 0,
        variableCacheSize: variableDataCache.size,
        templatesLoaded: actualTemplates.length,
        realTemplatesFound: actualTemplates.filter(t => t.content !== '템플릿 내용을 불러올 수 없습니다.').length,
        totalCachedRows: Array.from(variableDataCache.values()).reduce((sum, arr) => sum + arr.length, 0)
      },
      executionLogs
    };

    console.log('🎉 워크플로우 미리보기 완료');
    console.log('📊 최종 결과:', {
      contactsCount: previewData.length,
      messagesCount: previewData.reduce((sum, contact) => sum + contact.messages.length, 0),
      variableCacheHits: Array.from(variableDataCache.entries()).map(([name, data]) => ({ name, rows: data.length }))
    });

    return createSuccessResponse(response, '워크플로우 미리보기 생성 완료');

  } catch (error) {
    console.error('❌ 워크플로우 미리보기 오류:', error);
    executionLogs.push(`❌ 전체 처리 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    
    return logAndCreateErrorResponse(error, '워크플로우 미리보기', '미리보기 생성 중 오류가 발생했습니다.');
  }
} 