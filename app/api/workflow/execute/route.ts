import { NextRequest, NextResponse } from 'next/server';
import { Workflow } from '@/lib/types/workflow';
import { KakaoAlimtalkTemplateById } from '@/lib/data/kakao-templates';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { supabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  koreaTimeToUTCString, 
  formatKoreaTime,
  debugTimeInfo 
} from '@/lib/utils/timezone';

const COOLSMS_API_KEY = process.env.COOLSMS_API_KEY;
const COOLSMS_API_SECRET = process.env.COOLSMS_API_SECRET;
const COOLSMS_SENDER = process.env.COOLSMS_SENDER;
const KAKAO_SENDER_KEY = process.env.KAKAO_SENDER_KEY;
const SMS_SENDER_NUMBER = process.env.SMS_SENDER_NUMBER;

// MySQL 설정
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'test',
  timezone: '+09:00'
};

interface ExecuteRequest {
  workflow: Workflow;
  scheduledExecution?: boolean;
  jobId?: string;
  enableRealSending?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // 🔥 Vercel Protection 우회를 위한 응답 헤더 설정
    const headers = new Headers();
    headers.set('x-vercel-bypass-protection', 'true');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // 🔥 스케줄러 내부 호출인지 확인 (Vercel 인증 우회)
    const isSchedulerInternal = request.headers.get('x-scheduler-internal') === 'true';
    const bypassSecret = request.headers.get('x-vercel-protection-bypass');
    
    if (isSchedulerInternal) {
      console.log('📋 스케줄러 내부 호출 감지됨');
      
      // Vercel Protection Bypass 검증
      if (bypassSecret && process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
        if (bypassSecret === process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
          console.log('✅ Vercel 인증 우회 성공');
        } else {
          console.warn('⚠️ Vercel 인증 우회 secret 불일치');
        }
      } else {
        console.warn('⚠️ Vercel 인증 우회 정보 누락');
        console.log('Environment VERCEL_AUTOMATION_BYPASS_SECRET:', process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? '설정됨' : '설정되지 않음');
        console.log('Bypass secret from header:', bypassSecret ? '전달됨' : '전달되지 않음');
      }
    }
    
    const body: ExecuteRequest = await request.json();
    const { workflow, scheduledExecution = false, jobId, enableRealSending = false } = body;

    console.log(`🚀 워크플로우 실행 시작: ${workflow.name} (${scheduledExecution ? '예약 실행' : '수동 실행'})`);

    const results = [];
    let totalSuccessCount = 0;
    let totalFailedCount = 0;
    const allMessageLogs = []; // 메시지 로그 저장용 배열 추가

    // 워크플로우 실행 기록 생성
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    /**
     * 🕐 시간대 처리 원칙:
     * - 저장: UTC로 DB 저장 (서버 환경 독립적)
     * - 표시: 사용자에게는 KST로 표시
     * - 연산: 내부 처리는 한국 시간 기준
     */
    const startTime = getKoreaTime(); // 🔥 시간대 처리: 한국 시간 기준으로 시작 시간 기록

    try {
      // 🔥 3단계 워크플로우 구조에 맞춘 데이터 추출
      const workflowWithSupabaseProps = workflow as Workflow & {
        target_config?: any;
        message_config?: any;
        mapping_config?: any;
      };
      
      console.log('📋 워크플로우 실행 시작:', {
        id: workflow.id,
        name: workflow.name,
        targetGroupsCount: workflow.targetGroups?.length || 0,
        stepsCount: workflow.steps?.length || 0,
        hasTargetConfig: !!workflowWithSupabaseProps.target_config,
        hasMessageConfig: !!workflowWithSupabaseProps.message_config,
        hasMappingConfig: !!workflowWithSupabaseProps.mapping_config
      });
      
      // 🔥 1단계: 대상 그룹 정보 추출 (target_config 우선)
      let targetGroups = [];
      if (workflowWithSupabaseProps.target_config?.targetGroups) {
        targetGroups = workflowWithSupabaseProps.target_config.targetGroups;
        console.log('📋 target_config에서 타겟 그룹 추출:', targetGroups.length, '개');
      } else if (workflow.targetGroups) {
        targetGroups = workflow.targetGroups;
        console.log('📋 기존 targetGroups에서 타겟 그룹 추출:', targetGroups.length, '개');
      }
      
      // 🔥 2단계: 메시지 스텝 정보 추출 (message_config 우선)
      let messageSteps = [];
      if (workflowWithSupabaseProps.message_config?.steps) {
        messageSteps = workflowWithSupabaseProps.message_config.steps;
        console.log('📋 message_config에서 메시지 스텝 추출:', messageSteps.length, '개');
      } else if (workflow.steps) {
        messageSteps = workflow.steps;
        console.log('📋 기존 steps에서 메시지 스텝 추출:', messageSteps.length, '개');
      }
      
      // 🔥 3단계: 매핑 설정 정보 추출 (mapping_config 우선)
      let targetTemplateMappings = [];
      if (workflowWithSupabaseProps.mapping_config?.targetTemplateMappings) {
        targetTemplateMappings = workflowWithSupabaseProps.mapping_config.targetTemplateMappings;
        console.log('📋 mapping_config에서 매핑 설정 추출:', targetTemplateMappings.length, '개');
      } else if (workflowWithSupabaseProps.target_config?.targetTemplateMappings) {
        targetTemplateMappings = workflowWithSupabaseProps.target_config.targetTemplateMappings;
        console.log('📋 target_config에서 매핑 설정 추출 (하위 호환):', targetTemplateMappings.length, '개');
      } else if (workflow.targetTemplateMappings) {
        targetTemplateMappings = workflow.targetTemplateMappings;
        console.log('📋 기존 targetTemplateMappings에서 매핑 설정 추출:', targetTemplateMappings.length, '개');
      }
      
      // 🔥 데이터 검증
      if (targetGroups.length === 0) {
        throw new Error('대상 그룹이 설정되지 않았습니다. target_config.targetGroups를 확인해주세요.');
      }
      
      if (messageSteps.length === 0) {
        throw new Error('메시지 스텝이 설정되지 않았습니다. message_config.steps를 확인해주세요.');
      }

      // 각 스텝(템플릿) 실행
      for (let i = 0; i < messageSteps.length; i++) {
        const step = messageSteps[i];
        
        if (step.action.type !== 'send_alimtalk') {
          console.log(`⏭️ 지원하지 않는 액션 타입: ${step.action.type}`);
          continue;
        }

        console.log(`📤 스텝 ${i + 1} 실행: ${step.name}`);

        // 대상 그룹별로 메시지 발송
        for (const targetGroup of targetGroups) {
          const stepResult = await executeStep(step, targetGroup, workflow, enableRealSending, targetTemplateMappings);
          results.push({
            step: i + 1,
            stepName: step.name,
            targetGroup: targetGroup.name,
            ...stepResult
          });

          // 메시지 로그 수집
          if (stepResult.messageLogs) {
            allMessageLogs.push(...stepResult.messageLogs);
          }

          if (stepResult.status === 'success') {
            totalSuccessCount += stepResult.successCount || 1;
          } else {
            totalFailedCount += stepResult.failedCount || 1;
          }
        }

        // 스텝 간 지연 시간 적용
        if (step.action.delay && step.action.delay > 0) {
          console.log(`⏱️ ${step.action.delay}분 대기 중...`);
          await new Promise(resolve => setTimeout(resolve, step.action.delay! * 60000));
        }
      }

      // 🔥 시간대 처리: 한국 시간 기준으로 종료 시간 기록
      const endTime = getKoreaTime();
      const executionTimeMs = endTime.getTime() - startTime.getTime();

      // 실행 결과를 데이터베이스에 저장
      try {
        await supabaseWorkflowService.createWorkflowRun({
          id: runId,
          workflowId: workflow.id,
          status: totalFailedCount > 0 ? 'partial_success' : 'success',
          triggerType: scheduledExecution ? 'scheduled' : 'manual',
          targetCount: totalSuccessCount + totalFailedCount,
          successCount: totalSuccessCount,
          failedCount: totalFailedCount,
          totalCost: 0, // 비용 계산 로직 추가 필요
          executionTimeMs,
          // 🔥 시간대 처리: 한국 시간을 UTC로 변환하여 DB 저장
          startedAt: koreaTimeToUTCString(startTime),
          completedAt: koreaTimeToUTCString(endTime),
          logs: results
        });

        // 메시지 로그 저장
        if (allMessageLogs.length > 0) {
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || (process.env.NODE_ENV === 'production' 
              ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-domain.vercel.app')
              : 'http://localhost:3000')}/api/supabase/message-logs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'bulk_create',
                logs: allMessageLogs
              })
            });

            if (!response.ok) {
              console.error('메시지 로그 저장 실패:', await response.text());
            } else {
              console.log(`✅ ${allMessageLogs.length}개 메시지 로그 저장 완료`);
            }
          } catch (logError) {
            console.error('메시지 로그 저장 오류:', logError);
          }
        }
      } catch (dbError) {
        console.error('워크플로우 실행 기록 저장 실패:', dbError);
      }

      return NextResponse.json({
        success: true,
        message: '워크플로우 실행이 완료되었습니다.',
        runId,
        results,
        summary: {
          totalSteps: messageSteps.length,
          totalTargetGroups: targetGroups.length,
          successCount: totalSuccessCount,
          failedCount: totalFailedCount,
          executionTimeMs
        },
        scheduledExecution,
        jobId
      }, {
        headers: {
          'x-vercel-bypass-protection': 'true',
          'x-vercel-set-bypass-cookie': 'true',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });

    } catch (error) {
      // 실행 실패 기록
      try {
        await supabaseWorkflowService.createWorkflowRun({
          id: runId,
          workflowId: workflow.id,
          status: 'failed',
          triggerType: scheduledExecution ? 'scheduled' : 'manual',
          targetCount: 0,
          successCount: 0,
          failedCount: 0,
          totalCost: 0,
          executionTimeMs: Date.now() - startTime.getTime(),
          startedAt: startTime.toISOString(),
          errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
          logs: results
        });
      } catch (dbError) {
        console.error('워크플로우 실행 실패 기록 저장 실패:', dbError);
      }

      throw error;
    }

  } catch (error) {
    console.error('워크플로우 실행 실패:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '워크플로우 실행에 실패했습니다.',
        error: error
      },
      { status: 500 }
    );
  }
}

// 개별 스텝 실행
async function executeStep(step: any, targetGroup: any, workflow: Workflow, enableRealSending: boolean, targetTemplateMappings: any) {
  try {
    const templateId = step.action.templateId;
    const templateCode = step.action.templateCode;
    
    // 템플릿 정보 조회
    const templateInfo = KakaoAlimtalkTemplateById[templateId as keyof typeof KakaoAlimtalkTemplateById];
    if (!templateInfo) {
      throw new Error(`템플릿을 찾을 수 없습니다: ${templateId}`);
    }

    // 대상 그룹에서 실제 대상자 조회
    const targets = await getTargetsFromGroup(targetGroup);
    
    let successCount = 0;
    let failedCount = 0;
    const messageResults = [];
    const messageLogs = []; // 메시지 로그 배열 추가

    for (const target of targets) {
      try {
        // 🔥 3단계 매핑 설정을 활용한 변수 치환
        const variables = { ...step.action.variables };
        
        // 해당 템플릿에 대한 매핑 설정 찾기
        const templateMapping = targetTemplateMappings.find(
          (mapping: any) => mapping.templateId === templateId && mapping.targetGroupId === targetGroup.id
        );
        
        if (templateMapping && templateMapping.fieldMappings) {
          console.log('📋 매핑 설정 발견:', templateMapping.fieldMappings.length, '개 매핑');
          
          // 매핑 설정에 따른 변수 치환
          for (const fieldMapping of templateMapping.fieldMappings) {
            const { templateVariable, targetField, formatter, defaultValue } = fieldMapping;
            const rawData = target.rawData || target;
            
            // 대상 데이터에서 값 추출
            let value = rawData[targetField] || defaultValue || `[${templateVariable}]`;
            
            // 포맷터 적용
            if (formatter && value !== `[${templateVariable}]`) {
              switch (formatter) {
                case 'number':
                  value = Number(value).toLocaleString();
                  break;
                case 'currency':
                  value = `${Number(value).toLocaleString()}원`;
                  break;
                case 'date':
                  value = new Date(value).toLocaleDateString('ko-KR');
                  break;
                case 'text':
                default:
                  value = String(value);
                  break;
              }
            }
            
            // 변수 치환
            variables[templateVariable] = value;
            console.log(`📋 매핑 적용: ${templateVariable} = ${value} (from ${targetField})`);
          }
        } else {
          console.log('⚠️ 매핑 설정 없음, 기본 변수 치환 사용');
          
          // 기본 변수 치환 (기존 로직)
          for (const [key, value] of Object.entries(variables)) {
            if (typeof value === 'string' && value.includes('{{')) {
              const rawData = target.rawData || target;
              variables[key] = value.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
                return rawData[fieldName] || target[fieldName] || match;
              });
            }
          }
        }
        
        // 🔥 개인화 설정 활용 (step.action.personalization)
        if (step.action.personalization?.enabled && step.action.personalization.variableMappings) {
          console.log('📋 개인화 설정 발견:', step.action.personalization.variableMappings.length, '개 매핑');
          
          for (const variableMapping of step.action.personalization.variableMappings) {
            const { templateVariable, sourceType, sourceField, selectedColumn, defaultValue, formatter } = variableMapping;
            
            let value = defaultValue || '--'; // 🔥 기본값이 없으면 '--' 사용
            
            if (sourceType === 'field' && sourceField) {
              const rawData = target.rawData || target;
              value = rawData[sourceField] || defaultValue || '--'; // 🔥 데이터가 없으면 '--' 사용
            } else if (sourceType === 'query' && variableMapping.actualValue) {
              // 이미 계산된 쿼리 결과값 사용
              value = variableMapping.actualValue || defaultValue || '--'; // 🔥 쿼리 결과가 없으면 '--' 사용
            }
            
            // 🔥 저장된 개별 변수 매핑 정보도 확인하여 실제 쿼리 실행
            try {
              const { data: savedMappings } = await supabase
                .from('individual_variables')
                .select('*')
                .eq('variableName', `#{${templateVariable}}`);

              if (savedMappings && savedMappings.length > 0) {
                const mapping = savedMappings[0];
                const { sourceType, sourceField, selectedColumn, keyColumn } = mapping;
                
                if (sourceType === 'query' && sourceField && selectedColumn) {
                  console.log(`🔍 실행 시 쿼리 변수 처리:`, { variableName: templateVariable, sourceField, selectedColumn, keyColumn });
                  
                  // 🔥 새로운 방식: 전체 쿼리 실행 후 메모리에서 매칭
                  console.log(`🔍 실행 시 전체 변수 데이터 조회 시작: ${templateVariable}`);
                  
                  // 1. 변수 쿼리 전체 실행 (WHERE 조건 없이)
                  const variableQueryResult = await fetch('http://localhost:3000/api/mysql/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      query: sourceField, // 원본 쿼리 그대로 실행
                      limit: 50000, // 🔥 더 큰 limit 설정 (개인화 변수는 모든 데이터 필요)
                      params: []
                    })
                  });

                  if (variableQueryResult.ok) {
                    const variableData = await variableQueryResult.json();
                    
                    if (variableData.success && variableData.data && variableData.data.length > 0) {
                      console.log(`📊 실행 시 변수 데이터 조회 완료: ${variableData.data.length}개 행`);
                      
                      // 2. 현재 대상자의 매칭 키 값 결정
                      const rawData = target.rawData || target;
                      let targetMappingValue = rawData.id || target.id; // 기본값
                      
                      if (keyColumn) {
                        if (keyColumn.includes('.')) {
                          // 'a.id' 같은 경우 -> 'id'로 변환
                          const simpleColumn = keyColumn.split('.').pop();
                          targetMappingValue = rawData[simpleColumn] || rawData.id || target.id;
                        } else {
                          targetMappingValue = rawData[keyColumn] || rawData.id || target.id;
                        }
                      }
                      
                      console.log(`🔍 실행 시 매칭 키 값:`, { 
                        keyColumn, 
                        targetMappingValue, 
                        rawDataKeys: Object.keys(rawData),
                        targetId: target.id
                      });
                      
                      // 3. 메모리에서 매칭 수행
                      const mappingColumn = keyColumn || 'id'; // 매칭에 사용할 변수 데이터의 컬럼
                      const simpleMappingColumn = mappingColumn.includes('.') ? mappingColumn.split('.').pop() : mappingColumn;
                      
                      const matchedRow = variableData.data.find(row => {
                        const variableMappingValue = row[simpleMappingColumn];
                        const isMatched = String(variableMappingValue) === String(targetMappingValue);
                        
                        if (isMatched) {
                          console.log(`✅ 실행 시 매칭 성공:`, {
                            templateVariable,
                            targetValue: targetMappingValue,
                            variableValue: variableMappingValue,
                            mappingColumn: simpleMappingColumn
                          });
                        }
                        
                        return isMatched;
                      });
                      
                      // 4. 매칭 결과에 따른 개인화 값 설정
                      if (matchedRow) {
                        const personalizedValue = matchedRow[selectedColumn];
                        if (personalizedValue !== null && personalizedValue !== undefined) {
                          value = String(personalizedValue);
                          console.log(`✅ 실행 시 개인화 변수 설정 성공:`, {
                            templateVariable,
                            selectedColumn,
                            personalizedValue: String(personalizedValue)
                          });
                        } else {
                          value = '--';
                          console.log(`⚠️ 실행 시 매칭된 행에서 출력 컬럼 값 없음:`, { 
                            templateVariable, 
                            selectedColumn 
                          });
                        }
                      } else {
                        value = '--';
                        console.log(`⚠️ 실행 시 매칭되는 데이터 없음:`, { 
                          templateVariable,
                          targetValue: targetMappingValue,
                          mappingColumn: simpleMappingColumn,
                          availableKeys: variableData.data.length > 0 ? Object.keys(variableData.data[0]) : []
                        });
                      }
                    } else {
                      value = '--';
                      console.log(`⚠️ 실행 시 변수 쿼리 결과 데이터 없음:`, { templateVariable });
                    }
                  } else {
                    value = '--';
                    console.log(`❌ 실행 시 변수 쿼리 실행 실패:`, { templateVariable, status: variableQueryResult.status });
                  }
                } else if (sourceType === 'field' && sourceField) {
                  // 필드 매핑인 경우
                  const rawData = target.rawData || target;
                  const fieldValue = rawData[sourceField];
                  if (fieldValue !== null && fieldValue !== undefined) {
                    value = String(fieldValue);
                    console.log(`✅ 실행 시 필드 매핑 성공:`, {
                      templateVariable,
                      sourceField,
                      fieldValue: String(fieldValue)
                    });
                  }
                }
              }
            } catch (mappingError) {
              console.error(`❌ 실행 시 변수 매핑 오류 (${templateVariable}):`, mappingError);
            }
            
            // 포맷터 적용 (기본값 '--'일 때는 포맷터 적용하지 않음)
            if (formatter && value !== '--') {
              switch (formatter) {
                case 'number':
                  value = Number(value).toLocaleString();
                  break;
                case 'currency':
                  value = `${Number(value).toLocaleString()}원`;
                  break;
                case 'date':
                  value = new Date(value).toLocaleDateString('ko-KR');
                  break;
                case 'text':
                default:
                  value = String(value);
                  break;
              }
            }
            
            // 템플릿 변수명 정리 (#{변수명} -> 변수명)
            const cleanVariableName = templateVariable.replace(/[#{}]/g, '');
            variables[cleanVariableName] = value;
            console.log(`📋 개인화 적용: ${cleanVariableName} = ${value}`);
          }
        }

        console.log(`📤 대상자: ${target.name} (${target.phoneNumber})`);
        console.log(`📋 최종 변수 치환 결과:`, variables);

        const result = await sendAlimtalk({
          templateId,
          templateContent: templateInfo.content,
          phoneNumber: target.phoneNumber,
          variables,
          enableRealSending
        });

        messageResults.push({
          target: target.name || target.phoneNumber,
          status: 'success',
          messageId: result.messageId,
          variables
        });

        // 메시지 로그 생성
        messageLogs.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          messageType: 'kakao',
          recipientPhone: target.phoneNumber,
          recipientEmail: target.email || null,
          recipientName: target.name || null,
          templateId: templateId,
          templateName: templateInfo.templateName || step.name,
          messageContent: result.processedContent || templateInfo.content,
          variables: variables,
          status: enableRealSending ? 'sent' : 'pending',
          provider: 'coolsms',
          providerMessageId: result.messageId,
          costAmount: 15, // 카카오 알림톡 기본 비용
          // 🔥 시간대 처리: 발송 시간을 한국 시간 기준으로 기록 후 UTC 저장
          sentAt: enableRealSending ? koreaTimeToUTCString(getKoreaTime()) : null
        });

        successCount++;

      } catch (error) {
        messageResults.push({
          target: target.name || target.phoneNumber,
          status: 'failed',
          error: error instanceof Error ? error.message : '발송 실패'
        });

        // 실패한 메시지 로그도 생성
        messageLogs.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          messageType: 'kakao',
          recipientPhone: target.phoneNumber,
          recipientEmail: target.email || null,
          recipientName: target.name || null,
          templateId: templateId,
          templateName: templateInfo.templateName || step.name,
          messageContent: templateInfo.content,
          variables: step.action.variables,
          status: 'failed',
          provider: 'coolsms',
          errorMessage: error instanceof Error ? error.message : '발송 실패',
          costAmount: 0
        });

        failedCount++;
      }
    }

    return {
      status: failedCount === 0 ? 'success' : 'partial_success',
      successCount,
      failedCount,
      totalTargets: targets.length,
      messageResults,
      messageLogs // 메시지 로그 반환
    };

  } catch (error) {
    return {
      status: 'failed',
      successCount: 0,
      failedCount: 1,
      totalTargets: 0,
      error: error instanceof Error ? error.message : '스텝 실행 실패'
    };
  }
}

// 대상 그룹에서 실제 대상자 목록 조회
async function getTargetsFromGroup(targetGroup: any) {
  try {
    // MySQL 동적 쿼리 실행하여 실제 대상자 조회
    if (targetGroup.type === 'dynamic' && targetGroup.dynamicQuery?.sql) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/mysql/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: targetGroup.dynamicQuery.sql
        })
      });

      if (!response.ok) {
        throw new Error(`MySQL 쿼리 실행 실패: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(`MySQL 쿼리 결과 없음: ${result.message}`);
      }

      // MySQL 결과를 대상자 형식으로 변환
      return result.data.map((row: any, index: number) => {
        // 연락처 필드 찾기 (contacts, phone, phoneNumber 등)
        const phoneNumber = row.contacts || row.phone || row.phoneNumber || '01000000000';
        const name = row.name || row.company || row.title || `대상자${index + 1}`;
        const email = row.email || null;

        return {
          id: row.id || index + 1,
          name: name,
          phoneNumber: phoneNumber,
          email: email,
          rawData: row // 원본 데이터 보관 (변수 치환용)
        };
      });
    }
  } catch (error) {
    console.error('대상자 조회 실패:', error);
    // 에러 발생 시 빈 배열 반환
    return [];
  }

  // fallback으로 테스트 데이터 사용
  console.log('⚠️ fallback 테스트 데이터 사용');
  return [
    {
      id: 1,
      name: '테스트 고객',
      phoneNumber: '01012345678',
      email: 'test@example.com',
      rawData: { id: 1, name: '테스트 고객' }
    }
  ];
}

// 알림톡 발송
async function sendAlimtalk({
  templateId,
  templateContent,
  phoneNumber,
  variables,
  enableRealSending
}: {
  templateId: string;
  templateContent: string;
  phoneNumber: string;
  variables: Record<string, string>;
  enableRealSending: boolean;
}) {
  if (!enableRealSending) {
    // 테스트 모드
    console.log('📱 테스트 모드 - 알림톡 발송 시뮬레이션');
    return {
      messageId: `test_${Date.now()}`,
      processedContent: templateContent.replace(/#{(\w+)}/g, (match, key) => variables[key] || match)
    };
  }

  // 실제 발송
  const templateInfo = KakaoAlimtalkTemplateById[templateId as keyof typeof KakaoAlimtalkTemplateById];
  const pfId = getPfIdForTemplate(templateId);
  
  // 🔥 시간대 처리: API 인증을 위한 현재 시간 (UTC 기준)
  const date = new Date().toISOString();
  const salt = Date.now().toString();
  const signature = generateSignature(COOLSMS_API_KEY!, COOLSMS_API_SECRET!, date, salt);

  // 변수 치환된 메시지 내용 생성
  const processedContent = templateContent.replace(/#{(\w+)}/g, (match, key) => variables[key] || match);

  const messageData = {
    to: phoneNumber,
    from: SMS_SENDER_NUMBER,
    type: 'ATA',
    text: processedContent,
    kakaoOptions: {
      pfId: pfId,
      templateId: templateId,
      variables: variables
    }
  };

  console.log(`📱 실제 알림톡 발송: ${phoneNumber} - 템플릿: ${templateId}`);
  console.log(`📋 메시지 내용: ${processedContent}`);
  console.log(`🔑 발신프로필: ${pfId}`);

  const response = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
    method: 'POST',
    headers: {
      'Authorization': `HMAC-SHA256 apiKey=${COOLSMS_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: messageData
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ CoolSMS API 오류: ${response.status} - ${errorText}`);
    throw new Error(`CoolSMS API 오류: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`✅ 알림톡 발송 성공: ${result.groupId || result.messageId}`);
  
  return {
    messageId: result.groupId || result.messageId,
    processedContent: processedContent
  };
}

// CoolSMS HMAC-SHA256 서명 생성
function generateSignature(apiKey: string, apiSecret: string, date: string, salt: string): string {
  const data = `${date}${salt}`;
  return crypto.createHmac('sha256', apiSecret).update(data).digest('hex');
}

// 발신프로필 선택
function getPfIdForTemplate(templateId: string): string {
  const templateInfo = KakaoAlimtalkTemplateById[templateId as keyof typeof KakaoAlimtalkTemplateById];
  
  if (templateInfo) {
    const channel = templateInfo.channel;
    
    if (channel === 'CEO') {
      return process.env.PFID_CEO || templateInfo.channelId || KAKAO_SENDER_KEY || '';
    } else if (channel === 'BLOGGER') {
      return process.env.PFID_BLOGGER || templateInfo.channelId || KAKAO_SENDER_KEY || '';
    }
  }
  
  return KAKAO_SENDER_KEY || '';
} 