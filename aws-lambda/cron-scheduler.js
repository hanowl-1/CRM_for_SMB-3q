const https = require('https');

/**
 * AWS Lambda function to trigger Vercel cron jobs
 * 
 * Environment Variables Required:
 * - VERCEL_PROJECT_URL: Your Vercel project URL (e.g., your-project.vercel.app)
 * - CRON_SECRET_TOKEN: Secret token for authentication
 */
exports.handler = async (event, context) => {
  console.log('🚀 AWS Lambda cron scheduler started');
  console.log('Event:', JSON.stringify(event, null, 2));
  
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
              timestamp: new Date().toISOString(),
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