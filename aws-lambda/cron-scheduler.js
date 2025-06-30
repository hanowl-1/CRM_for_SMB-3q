import https from 'https';

export const handler = async (event, context) => {
  console.log('🚀 AWS Lambda cron scheduler started');
  const startTime = Date.now();

  // AWS 이벤트 로그 출력
  console.log('📦 Event payload:', JSON.stringify(event, null, 2));

  // 한국 시간대 설정
  process.env.TZ = 'Asia/Seoul';
  const currentTime = new Date();
  console.log('🕒 Current KST Time:', currentTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));

  // 환경 변수 로딩
  const projectUrl = process.env.VERCEL_PROJECT_URL || process.env.ERCEL_PROJECT_URL;
  const secretToken = process.env.CRON_SECRET_TOKEN;

  // 유효성 체크
  if (!projectUrl || !secretToken) {
    const error = '❌ Missing required environment variables: VERCEL_PROJECT_URL or CRON_SECRET_TOKEN';
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error })
    };
  }

  // 도메인 유효성 검사
  if (projectUrl.includes('https://')) {
    console.warn('⚠️ VERCEL_PROJECT_URL에는 "https://"를 포함하지 말아야 합니다. 자동으로 붙습니다.');
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

  return new Promise((resolve) => {
    console.log(`📡 Calling Vercel API: https://${projectUrl}/api/cron`);
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const elapsedMs = Date.now() - startTime;
        try {
          const responseBody = JSON.parse(data);
          console.log('✅ Vercel API response:', responseBody);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ 호출 성공 (HTTP ${res.statusCode}) - 소요 시간: ${elapsedMs}ms`);
          } else {
            console.warn(`⚠️ 호출 실패 (HTTP ${res.statusCode}) - 응답 내용:`, responseBody);
          }

          resolve({
            statusCode: res.statusCode,
            body: JSON.stringify({
              success: true,
              vercelResponse: responseBody,
              calledEndpoint: '/api/cron',
              elapsedMs,
              lambdaRequestId: context.awsRequestId
            })
          });
        } catch (e) {
          console.error('❌ JSON 파싱 실패:', e);
          console.log('📄 Raw response:', data);

          resolve({
            statusCode: 502,
            body: JSON.stringify({
              success: false,
              error: 'Invalid JSON response from Vercel',
              raw: data,
              elapsedMs
            })
          });
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ 요청 중 오류 발생:', err);
      resolve({
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: err.message,
          lambdaRequestId: context.awsRequestId
        })
      });
    });

    req.on('timeout', () => {
      console.error('⏱ 요청 타임아웃');
      req.destroy();
      resolve({
        statusCode: 408,
        body: JSON.stringify({
          success: false,
          error: 'Request timeout',
          lambdaRequestId: context.awsRequestId
        })
      });
    });

    req.end();
  });
}; 