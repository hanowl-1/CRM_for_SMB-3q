import { executeQuery } from '@/lib/database/mysql-connection';
import type { 
  Workflow, 
  TargetGroup, 
  WorkflowAction, 
  PersonalizationSettings,
  PersonalizationTarget 
} from '@/lib/types/workflow';
import { personalizationService } from './personalization-service';

// ExecutionTarget를 PersonalizationTarget과 호환되도록 수정
interface ExecutionTarget {
  contact: string;
  name?: string;
  data: Record<string, any>; // PersonalizationTarget과 호환성을 위해 data 필드 추가
  [key: string]: any;
}

interface PersonalizedSendRequest {
  contact: string;
  personalizedContent: string;
  variables: Record<string, string>;
  templateId: string;
}

// PersonalizationService의 실제 반환 타입에 맞게 수정
interface PersonalizedMessage {
  target: PersonalizationTarget;
  personalizedContent: string;
  error?: string;
  contact: string; // 호환성을 위해 추가
  variables: Record<string, string>; // 호환성을 위해 추가
}

/**
 * 워크플로우 실행 시 대상자를 동적으로 추출하는 서비스
 */
export class WorkflowExecutionService {
  
  /**
   * 대상자 추출
   */
  async extractTargets(targetGroup: TargetGroup): Promise<ExecutionTarget[]> {
    if (targetGroup.type === 'dynamic' && targetGroup.dynamicQuery) {
      return this.extractDynamicTargets(targetGroup);
    } else {
      return this.extractStaticTargets(targetGroup);
    }
  }

  /**
   * 동적 대상자 추출 (SQL 쿼리 기반)
   */
  private async extractDynamicTargets(targetGroup: TargetGroup): Promise<ExecutionTarget[]> {
    if (!targetGroup.dynamicQuery) {
      throw new Error('동적 대상 그룹에 쿼리가 설정되지 않았습니다.');
    }

    try {
      console.log(`동적 쿼리 실행: ${targetGroup.dynamicQuery.description}`);
      console.log(`SQL: ${targetGroup.dynamicQuery.sql}`);
      
      const rows = await executeQuery(targetGroup.dynamicQuery.sql, []) as any[];

      const targets: ExecutionTarget[] = rows.map(row => ({
        contact: row.contact || row.phone || row.mobile || '',
        name: row.name || row.customer_name || '',
        data: { ...row }, // 모든 데이터를 data 객체에 저장
        ...row // 기존 호환성 유지
      }));

      // 통계 업데이트
      await this.updateTargetGroupStats(targetGroup.id, targets.length);
      
      console.log(`동적 대상자 추출 완료: ${targets.length}명`);
      return targets;
      
    } catch (error) {
      console.error('동적 대상자 추출 실패:', error);
      throw new Error(`동적 대상자 추출 실패: ${error}`);
    }
  }

  /**
   * 정적 대상자 추출 (기존 방식)
   */
  private async extractStaticTargets(targetGroup: TargetGroup): Promise<ExecutionTarget[]> {
    if (!targetGroup.table) {
      throw new Error('정적 대상 그룹에 테이블이 설정되지 않았습니다.');
    }

    try {
      let query = `SELECT * FROM ${targetGroup.table}`;
      const params: any[] = [];

      // 조건 추가
      if (targetGroup.conditions && targetGroup.conditions.length > 0) {
        const whereConditions = targetGroup.conditions.map(condition => {
          params.push(condition.value);
          switch (condition.operator) {
            case 'equals':
              return `${condition.field} = ?`;
            case 'contains':
              return `${condition.field} LIKE ?`;
            case 'greater_than':
              return `${condition.field} > ?`;
            case 'less_than':
              return `${condition.field} < ?`;
            case 'in_list':
              const values = condition.value.split(',').map(v => v.trim());
              params.pop(); // 마지막 파라미터 제거
              params.push(...values);
              return `${condition.field} IN (${values.map(() => '?').join(',')})`;
            default:
              return `${condition.field} = ?`;
          }
        });
        
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      console.log(`정적 쿼리 실행: ${query}`);
      
      const rows = await executeQuery(query, params) as any[];

      const targets: ExecutionTarget[] = rows.map(row => ({
        contact: row.contact || row.phone || row.mobile || '',
        name: row.name || row.customer_name || '',
        data: { ...row }, // 모든 데이터를 data 객체에 저장
        ...row // 기존 호환성 유지
      }));

      // 통계 업데이트
      await this.updateTargetGroupStats(targetGroup.id, targets.length);
      
      console.log(`정적 대상자 추출 완료: ${targets.length}명`);
      return targets;
      
    } catch (error) {
      console.error('정적 대상자 추출 실패:', error);
      throw new Error(`정적 대상자 추출 실패: ${error}`);
    }
  }

  /**
   * 워크플로우의 모든 대상자 추출
   */
  async extractAllTargets(workflow: Workflow): Promise<ExecutionTarget[]> {
    if (!workflow.targetGroups || workflow.targetGroups.length === 0) {
      console.warn('워크플로우에 대상 그룹이 설정되지 않았습니다.');
      return [];
    }

    const allTargets: ExecutionTarget[] = [];
    
    for (const targetGroup of workflow.targetGroups) {
      try {
        const targets = await this.extractTargets(targetGroup);
        allTargets.push(...targets);
        console.log(`대상 그룹 '${targetGroup.name}': ${targets.length}명 추출`);
      } catch (error) {
        console.error(`대상 그룹 '${targetGroup.name}' 추출 실패:`, error);
      }
    }

    // 중복 제거 (연락처 기준)
    const uniqueTargets = allTargets.filter((target, index, self) => 
      index === self.findIndex(t => t.contact === target.contact)
    );

    console.log(`전체 대상자: ${allTargets.length}명, 중복 제거 후: ${uniqueTargets.length}명`);
    return uniqueTargets;
  }

  /**
   * 대상 그룹 통계 업데이트
   */
  private async updateTargetGroupStats(targetGroupId: string, count: number) {
    try {
      await executeQuery(
        `UPDATE target_groups SET 
         estimated_count = ?, 
         last_executed = NOW() 
         WHERE id = ?`,
        [count, targetGroupId]
      );
    } catch (error) {
      console.error('대상 그룹 통계 업데이트 실패:', error);
    }
  }

  /**
   * 대상자를 배치로 분할
   */
  splitTargetsIntoBatches(targets: ExecutionTarget[], batchSize: number = 5): ExecutionTarget[][] {
    const batches: ExecutionTarget[][] = [];
    for (let i = 0; i < targets.length; i += batchSize) {
      batches.push(targets.slice(i, i + batchSize));
    }
    
    console.log(`대상자를 ${batches.length}개 배치로 분할 (배치 크기: ${batchSize})`);
    return batches;
  }

  /**
   * 템플릿 변수 매핑
   */
  mapTemplateVariables(target: ExecutionTarget, templateVariables: string[]): Record<string, string> {
    const variableMap: Record<string, string> = {};
    
    templateVariables.forEach(variable => {
      // 대상자 데이터에서 변수값 찾기 (data 객체 우선 검색)
      let value = target.data?.[variable] || target[variable];
      
      if (value !== undefined) {
        variableMap[variable] = String(value);
      } else {
        // 기본값 설정
        variableMap[variable] = `[${variable}]`;
        console.warn(`변수 ${variable}에 대한 값을 찾을 수 없습니다. 기본값 사용.`);
      }
    });
    
    return variableMap;
  }

  /**
   * ExecutionTarget을 PersonalizationTarget으로 변환
   */
  private convertToPersonalizationTargets(targets: ExecutionTarget[]): PersonalizationTarget[] {
    return targets.map(target => ({
      contact: target.contact,
      data: target.data || {}
    }));
  }

  /**
   * 워크플로우 액션 실행 (개인화 포함)
   */
  async executeWorkflowAction(
    action: WorkflowAction,
    targets: ExecutionTarget[],
    templateContent: string
  ): Promise<void> {
    
    if (action.type !== 'send_alimtalk') {
      console.log(`액션 타입 ${action.type}은 아직 지원되지 않습니다.`);
      return;
    }

    if (!action.personalization?.enabled) {
      // 개인화 비활성화 시 기존 방식으로 발송
      await this.sendBulkMessages(targets, templateContent, action.templateId!);
      return;
    }

    // ExecutionTarget을 PersonalizationTarget으로 변환
    const personalizationTargets = this.convertToPersonalizationTargets(targets);

    // 개인화된 메시지 생성
    console.log('개인화된 메시지 생성 시작...');
    const personalizedMessages = await personalizationService.generatePersonalizedMessages(
      personalizationTargets,
      templateContent,
      action.personalization
    );

    // PersonalizedMessage 타입으로 변환 (success 속성 추가)
    const convertedMessages: PersonalizedMessage[] = personalizedMessages.map(msg => ({
      target: msg.target,
      personalizedContent: msg.personalizedContent,
      error: msg.error,
      contact: msg.target.contact,
      variables: {} // 기본값으로 빈 객체 설정
    }));

    // 성공한 메시지만 필터링 (error가 없는 메시지)
    const successfulMessages = convertedMessages.filter(msg => !msg.error && msg.personalizedContent.trim());
    
    console.log(`개인화 완료: ${successfulMessages.length}/${convertedMessages.length}개 메시지`);

    // 개인화된 메시지 발송
    await this.sendPersonalizedMessages(successfulMessages, action.templateId!);

    // 실패한 메시지 로깅
    const failedMessages = convertedMessages.filter(msg => msg.error);
    if (failedMessages.length > 0) {
      console.warn(`개인화 실패한 메시지 ${failedMessages.length}개:`, 
        failedMessages.map(msg => ({ contact: msg.contact, error: msg.error }))
      );
    }
  }

  /**
   * 개인화된 메시지 발송
   */
  private async sendPersonalizedMessages(
    messages: PersonalizedMessage[],
    templateId: string
  ): Promise<void> {
    
    console.log(`개인화된 메시지 발송 시작: ${messages.length}개`);

    // 배치 처리
    const batches = this.splitMessagesIntoBatches(messages, 5);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`배치 ${i + 1}/${batches.length} 처리 중... (${batch.length}개 메시지)`);
      
      try {
        // 각 메시지를 개별적으로 발송 (개인화된 내용이므로)
        const sendPromises = batch.map(message => 
          this.sendIndividualMessage(message.contact, message.personalizedContent, templateId, message.variables)
        );
        
        await Promise.allSettled(sendPromises);
        
        // 배치 간 딜레이 (API 제한 고려)
        if (i < batches.length - 1) {
          await this.delay(1000); // 1초 대기
        }
        
      } catch (error) {
        console.error(`배치 ${i + 1} 처리 실패:`, error);
      }
    }
    
    console.log('개인화된 메시지 발송 완료');
  }

  /**
   * 개별 메시지 발송
   */
  private async sendIndividualMessage(
    contact: string,
    personalizedContent: string,
    templateId: string,
    variables: Record<string, string>
  ): Promise<void> {
    
    try {
      // 실제 알림톡 발송 API 호출
      const response = await fetch('/api/alimtalk/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          contact,
          content: personalizedContent,
          variables,
          personalized: true
        })
      });

      if (!response.ok) {
        throw new Error(`발송 실패: ${response.statusText}`);
      }

      console.log(`개인화 메시지 발송 성공: ${contact}`);
      
    } catch (error) {
      console.error(`개인화 메시지 발송 실패 - ${contact}:`, error);
      throw error;
    }
  }

  /**
   * 기존 벌크 메시지 발송 (개인화 없음)
   */
  private async sendBulkMessages(
    targets: ExecutionTarget[],
    templateContent: string,
    templateId: string
  ): Promise<void> {
    
    console.log(`벌크 메시지 발송: ${targets.length}개`);
    
    const batches = this.splitTargetsIntoBatches(targets, 10);
    
    for (const batch of batches) {
      try {
        const response = await fetch('/api/alimtalk/send-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId,
            targets: batch.map(t => ({ contact: t.contact, name: t.name })),
            content: templateContent
          })
        });

        if (!response.ok) {
          throw new Error(`벌크 발송 실패: ${response.statusText}`);
        }
        
      } catch (error) {
        console.error('벌크 발송 실패:', error);
      }
    }
  }

  /**
   * 메시지 배치 분할
   */
  private splitMessagesIntoBatches<T>(messages: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < messages.length; i += batchSize) {
      batches.push(messages.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 딜레이 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스
export const workflowExecutionService = new WorkflowExecutionService(); 