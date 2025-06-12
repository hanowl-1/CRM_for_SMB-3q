# API 문서

- https://developers.coolsms.co.kr/references/

## 사용량 제한 (Rate Limit)

사용량 제한이란 특정 시간 내에 할 수 있는 API 호출 수를 의미합니다.
COOLSMS API에는 각 Resource Path별 호출제한이 있으며,
기본적으로 인증을 한 요청의 경우 조회 API는 5초에 20회 발송 API의 경우 5초에 100회의 API의 호출이 가능합니다.
인증을 하지 않은 요청의 경우 5초에 5건으로 제한됩니다.

- API 요청 시 Response Header값에 아래와 같은 형식으로 응답을 줍니다.

```
Response Header: {
    x-ratelimit-limit: 3;w=4.554;b=5 // 남은 요청 수;남은 시간;API Resource별 정해진 호출제한 시간
    x-ratelimit-remaining: 3 // 남은 요청 수
    x-ratelimit-reset: Mon Jul 24 2023 03:21:17 GMT+0000 (Coordinated Universal Time) // 호출제한이 Reset되는 시간
    x-retry-after: 4.554 // 제한이 초기화될 떄까지 남은 시간
}
```

- 사용자의 API 호출 수가 제한값을 초과하면 HTTP 429 코드를 반환하여 요청이 실패합니다.

```
Http Status Code: 429
Response Body: {
  errorCode: 'TooManyRequests',
  message: '잦은 호출로 제한되었습니다.'
}
```
