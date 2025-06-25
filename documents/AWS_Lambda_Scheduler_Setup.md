# AWS Lambda + EventBridge 스케줄러 설정 가이드

Vercel의 10초 함수 실행 제한을 우회하기 위해 AWS Lambda + EventBridge를 사용한 외부 cron 스케줄러를 구축하는 방법입니다.

## 🏗️ 아키텍처 개요

```
EventBridge (Cron) → Lambda Function → Vercel API (/api/cron) → 워크플로우 실행
```

## 📋 사전 준비사항

1. **AWS 계정** (Free Tier 사용 가능)
2. **Vercel 프로젝트 URL** (예: `your-project.vercel.app`)
3. **Secret Token** (보안을 위한 인증 토큰)

## 🔧 1. Secret Token 생성

먼저 안전한 토큰을 생성합니다:

```bash
# 랜덤 토큰 생성 (32자리)
openssl rand -hex 32
```

또는 온라인 생성기 사용: https://www.uuidgenerator.net/

## 🌐 2. Vercel 환경변수 설정

Vercel 대시보드에서 환경변수를 추가합니다:

1. Vercel 프로젝트 → Settings → Environment Variables
2. 다음 변수들을 추가:

```
CRON_SECRET_TOKEN=c7f3c323144444ca876786803871097a
NEXT_PUBLIC_SITE_URL=https://v0-kakao-beryl.vercel.app/
```

## ☁️ 3. AWS Lambda 함수 생성

### 3.1 Lambda 함수 생성

1. **AWS Console** → **Lambda** → **Create function**
2. **Function name**: `vercel-cron-scheduler`
3. **Runtime**: `Node.js 18.x` 또는 최신 버전
4. **Create function** 클릭

### 3.2 함수 코드 업로드

생성된 Lambda 함수에 다음 코드를 복사/붙여넣기:

```javascript
const https = require('https');

exports.handler = async (event, context) => {
  console.log('🚀 AWS Lambda cron scheduler started');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const projectUrl = process.env.VERCEL_PROJECT_URL;
  const secretToken = process.env.CRON_SECRET_TOKEN;
  
  if (!projectUrl || !secretToken) {
    const error = 'Missing required environment variables';
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error })
    };
  }

  const options = {
    hostname: projectUrl,
    path: '/api/cron',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${secretToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'AWS-Lambda-Scheduler/1.0'
    },
    timeout: 30000
  };

  return new Promise((resolve, reject) => {
    console.log(`📡 Calling Vercel API: https://${projectUrl}/api/cron`);
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const responseBody = JSON.parse(data);
          console.log('✅ Vercel API response:', responseBody);
          
          resolve({
            statusCode: res.statusCode,
            body: JSON.stringify({
              success: true,
              timestamp: new Date().toISOString(),
              vercelResponse: responseBody,
              lambdaRequestId: context.awsRequestId
            })
          });
        } catch (parseError) {
          console.error('❌ Failed to parse response:', parseError);
          
          resolve({
            statusCode: res.statusCode || 500,
            body: JSON.stringify({
              success: false,
              error: 'Failed to parse response',
              rawResponse: data
            })
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error);
      
      resolve({
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error.message
        })
      });
    });

    req.end();
  });
};
```

### 3.3 환경변수 설정

Lambda 함수 → **Configuration** → **Environment variables**:

```
VERCEL_PROJECT_URL=your-project.vercel.app
CRON_SECRET_TOKEN=your_generated_token_here
```

### 3.4 타임아웃 설정

Lambda 함수 → **Configuration** → **General configuration**:
- **Timeout**: `1분 0초`로 설정

## ⏰ 4. EventBridge 스케줄 설정

### 4.1 EventBridge Rule 생성

1. **AWS Console** → **EventBridge** → **Rules** → **Create rule**
2. **Name**: `vercel-cron-schedule`
3. **Rule type**: `Schedule`
4. **Schedule pattern**: `Rate expression`

### 4.2 스케줄 표현식

매분 실행 (테스트용):
```
rate(1 minute)
```

매 5분 실행 (권장):
```
rate(5 minutes)
```

Cron 표현식 사용 (고급):
```
cron(0/5 * * * ? *)  # 매 5분
cron(0 9 * * ? *)    # 매일 오전 9시
cron(0 */2 * * ? *)  # 2시간마다
```

### 4.3 타겟 설정

1. **Target type**: `AWS service`
2. **Select a target**: `Lambda function`
3. **Function**: 생성한 Lambda 함수 선택
4. **Create rule** 클릭

## 🧪 5. 테스트

### 5.1 Lambda 함수 직접 테스트

1. Lambda 함수 → **Test** 탭
2. **Test event**: 기본값 사용
3. **Test** 클릭
4. 로그에서 Vercel API 호출 결과 확인

### 5.2 Vercel API 직접 테스트

```bash
curl -X GET https://your-project.vercel.app/api/cron \
  -H "Authorization: Bearer your_generated_token_here" \
  -H "Content-Type: application/json"
```

## 📊 6. 모니터링

### 6.1 CloudWatch 로그

- **AWS Console** → **CloudWatch** → **Log groups**
- `/aws/lambda/vercel-cron-scheduler` 로그 그룹 확인

### 6.2 Vercel 로그

- Vercel 대시보드 → Functions → Logs
- `/api/cron` 엔드포인트 로그 확인

## 💰 7. 비용 정보

### AWS Free Tier (월간):
- **Lambda**: 1백만 호출 무료
- **EventBridge**: 1천만 이벤트 무료
- **CloudWatch 로그**: 5GB 무료

### 예상 비용 (Free Tier 초과 시):
- 매 5분 실행 (월 8,640회): **거의 무료**
- 매분 실행 (월 43,200회): **$0.02 미만**

## 🔒 8. 보안 고려사항

1. **Secret Token**: 충분히 복잡한 토큰 사용
2. **HTTPS 전용**: HTTP 요청 차단
3. **IP 제한**: 필요시 AWS IP 범위로 제한
4. **로그 관리**: 민감한 정보 로그 출력 금지

## 🚨 9. 문제 해결

### 401 Unauthorized
- Secret Token 확인
- 환경변수 설정 확인

### 500 Internal Server Error
- Vercel 함수 로그 확인
- 데이터베이스 연결 상태 확인

### 타임아웃
- Lambda 타임아웃 설정 증가
- Vercel API 응답 시간 확인

## 📈 10. 고급 설정

### 10.1 여러 스케줄 설정

서로 다른 주기로 여러 EventBridge 규칙 생성:
- 매분: 긴급 알림
- 매 5분: 일반 스케줄
- 매시간: 배치 작업

### 10.2 오류 처리

Lambda 함수에 DLQ (Dead Letter Queue) 설정으로 실패한 요청 재처리

### 10.3 알림 설정

CloudWatch Alarm으로 실패 시 SNS 알림 설정

---

이제 Vercel의 10초 제한 없이 안정적인 스케줄링 시스템을 사용할 수 있습니다! 🎉 