import moment from 'moment-timezone';
import https from 'https';

// 한국 시간대 상수
const KOREA_TIMEZONE = 'Asia/Seoul';

/**
 * 현재 한국 시간을 반환 (Vercel 서버와 동일한 방식)
 * 🔥 시간대 처리: 서버 환경에 관계없이 항상 한국 시간 기준 Date 객체 반환
 */
function getKoreaTime() {
  const koreaMoment = moment.tz(KOREA_TIMEZONE);
  
  // 🔥 Vercel 서버와 동일한 방식: 한국 시간 값으로 Date 객체 생성
  return new Date(
    koreaMoment.year(),
    koreaMoment.month(),
    koreaMoment.date(),
    koreaMoment.hour(),
    koreaMoment.minute(),
    koreaMoment.second(),
    koreaMoment.millisecond()
  );
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
export const handler = async (event, context) => {
  const now = getKoreaTime();
  const utcNow = new Date();
  
  console.log(`🚀 AWS Lambda 스케줄러 실행: ${formatKoreaTime(now)}`);
  console.log(`🕐 AWS Lambda 환경 시간 정보:`);
  console.log(`   한국 시간 (계산): ${formatKoreaTime(now)}`);
  console.log(`   UTC 시간 (서버): ${utcNow.toISOString()}`);
  console.log(`   시간차 확인: ${(now.getTime() - utcNow.getTime()) / 1000 / 60 / 60}시간`);
  
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
    path: '/api/cron',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${secretToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'AWS-Lambda-Scheduler/1.0'
    },
    timeout: 30000 // 30초 타임아웃
  };

  return new Promise((resolve, reject) => {
    console.log(`📡 Calling Vercel API: https://${projectUrl}/api/cron`);
    
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