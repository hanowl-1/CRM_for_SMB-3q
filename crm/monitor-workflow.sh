#!/bin/bash

# 워크플로우 실행 실시간 모니터링 스크립트
# 8시 10분 테스트 워크플로우 발송 모니터링

echo "🔍 워크플로우 실시간 모니터링 시작..."
echo "📅 예정 시간: 오늘 밤 23:10 (11시 10분)"
echo "============================================"

# 현재 시간 표시
current_time=$(date '+%Y-%m-%d %H:%M:%S')
echo "⏰ 현재 시간: $current_time"

# 1. 예정된 스케줄 작업 확인
echo ""
echo "📋 예정된 스케줄 작업:"
curl -s "http://localhost:3000/api/scheduler/monitor" | jq -r '.data.scheduledJobs[] | select(.workflowName == "테스트" and .status == "pending") | "• \(.workflowName): \(.scheduledTime) (\(.timeDiffMinutes)분 후)"'

# 2. 실시간 로그 모니터링 함수
monitor_logs() {
    echo ""
    echo "🔄 실시간 로그 모니터링 중... (Ctrl+C로 종료)"
    echo "============================================"
    
    while true; do
        # 스케줄러 실행 로그 확인
        scheduler_status=$(curl -s "http://localhost:3000/api/scheduler/monitor" | jq -r '.data.stats')
        
        # 메시지 로그 확인 (최근 5분 내)
        message_logs=$(curl -s "http://localhost:3000/api/supabase/message-logs?limit=10" 2>/dev/null)
        
        # 현재 시간
        now=$(date '+%H:%M:%S')
        
        # 스케줄러 상태 출력
        echo "[$now] 📊 스케줄러 상태: pending=$(echo $scheduler_status | jq -r '.pendingJobs'), running=$(echo $scheduler_status | jq -r '.runningJobs')"
        
        # 최근 메시지 로그가 있다면 출력
        if [[ "$message_logs" != *"error"* ]] && [[ "$message_logs" != "null" ]]; then
            recent_count=$(echo $message_logs | jq -r '.data | length' 2>/dev/null || echo "0")
            if [[ "$recent_count" != "0" ]] && [[ "$recent_count" != "null" ]]; then
                echo "[$now] 📱 최근 메시지 로그: ${recent_count}개"
                echo $message_logs | jq -r '.data[] | select(.created_at > (now - 300)) | "  → \(.message_type): \(.recipient_name) (\(.status))"' 2>/dev/null | head -3
            fi
        fi
        
        # 23:10에 가까워지면 더 자주 체크
        current_hour=$(date '+%H')
        current_minute=$(date '+%M')
        
        if [[ "$current_hour" == "23" ]] && [[ "$current_minute" -ge "08" ]]; then
            echo "[$now] 🚨 실행 시간 임박! 더 자주 체크합니다..."
            sleep 10  # 10초마다 체크
        else
            sleep 30  # 30초마다 체크
        fi
    done
}

# 3. 발송 결과 확인 함수
check_results() {
    echo ""
    echo "📊 발송 결과 확인:"
    echo "============================================"
    
    # 메시지 로그에서 테스트 워크플로우 관련 발송 확인
    curl -s "http://localhost:3000/api/supabase/message-logs?workflowName=테스트" | jq -r '.data[] | "• \(.created_at): \(.recipient_name) - \(.status) (\(.message_type))"' | head -10
}

# 메인 실행
case "${1:-monitor}" in
    "monitor")
        monitor_logs
        ;;
    "check")
        check_results
        ;;
    "status")
        echo "📊 현재 상태 확인:"
        curl -s "http://localhost:3000/api/scheduler/monitor" | jq '.data.stats'
        ;;
    *)
        echo "사용법:"
        echo "  ./monitor-workflow.sh monitor  # 실시간 모니터링"
        echo "  ./monitor-workflow.sh check   # 발송 결과 확인"
        echo "  ./monitor-workflow.sh status  # 현재 상태만 확인"
        ;;
esac 