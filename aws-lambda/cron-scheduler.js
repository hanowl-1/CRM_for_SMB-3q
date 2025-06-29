const moment = require('moment-timezone');
const https = require('https');

// 한국 시간대 상수
const KOREA_TIMEZONE = 'Asia/Seoul';

/**
 * 현재 한국 시간을 반환
 */
function getKoreaTime() {
  return moment.tz(KOREA_TIMEZONE).toDate();
}

/**
 * 한국 시간을 포맷된 문자열로 반환
 */
function formatKoreaTime(date, formatString = 'YYYY-MM-DD HH:mm:ss') {
  return moment.tz(date, KOREA_TIMEZONE).format(formatString);
}

/**
 * 디버깅용 시간 정보 출력
 */
function debugTimeInfo(label, date) {
  const koreaTime = moment.tz(date, KOREA_TIMEZONE);
  const utcTime = moment.utc(date);
  
  console.log(`🕐 ${label}:`);
  console.log(`   한국 시간: ${koreaTime.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`   UTC 시간: ${utcTime.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`   KST ISO: ${koreaTime.format()}`);
  console.log(`   UTC ISO: ${utcTime.format()}`);
}

/**
 * AWS Lambda function to trigger Vercel cron jobs
 * 
 * Environment Variables Required:
 * - VERCEL_PROJECT_URL: Your Vercel project URL (e.g., your-project.vercel.app)
 * - CRON_SECRET_TOKEN: Secret token for authentication
 */
exports.handler = async (event, context) => {
  const now = getKoreaTime();
  
  console.log(`🚀 AWS Lambda 스케줄러 실행: ${formatKoreaTime(now)}`);
  debugTimeInfo('Lambda 실행 시간', now);
  
  const projectUrl = process.env.VERCEL_PROJECT_URL;
  const secretToken = process.env.CRON_SECRET_TOKEN;
  
  if (!projectUrl || !secretToken) {
    const error = 'Missing required environment variables: VERCEL_PROJECT_URL or CRON_SECRET_TOKEN';
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error })
    };
  }

  const options = {
    hostname: projectUrl,
    path: '/api/scheduler/execute',
    method: 'GET',
    headers: {
      'x-cron-secret': secretToken,
      'Content-Type': 'application/json',
      'User-Agent': 'AWS-Lambda-Scheduler/1.0'
    },
    timeout: 30000 // 30초 타임아웃
  };

  return new Promise((resolve, reject) => {
    console.log(`📡 Calling Vercel API: https://${projectUrl}/api/scheduler/execute`);
    
    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(`📊 Response status: ${res.statusCode}`);
      console.log(`📊 Response headers:`, res.headers);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const responseBody = JSON.parse(data);
          console.log('✅ Vercel API response:', responseBody);
          
          resolve({
            statusCode: res.statusCode,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              success: true,
              timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
              vercelResponse: responseBody,
              lambdaRequestId: context.awsRequestId
            })
          });
        } catch (parseError) {
          console.error('❌ Failed to parse response:', parseError);
          console.log('Raw response:', data);
          
          resolve({
            statusCode: res.statusCode || 500,
            body: JSON.stringify({
              success: false,
              error: 'Failed to parse response',
              rawResponse: data,
              lambdaRequestId: context.awsRequestId
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
          error: error.message,
          lambdaRequestId: context.awsRequestId
        })
      });
    });

    req.on('timeout', () => {
      console.error('❌ Request timeout');
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