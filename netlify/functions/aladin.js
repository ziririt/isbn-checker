/**
 * Netlify 서버리스 함수 — 알라딘 API 프록시
 *
 * 브라우저가 알라딘을 직접 호출하면 Referer 차단이 발생한다.
 * 이 함수가 서버에서 대신 호출해 결과를 반환한다.
 *
 * 호출 예시:
 *   /.netlify/functions/aladin?_ep=ItemSearch.aspx&ttbkey=xxx&Query=삼체&...
 *   /.netlify/functions/aladin?_ep=ItemLookUp.aspx&ttbkey=xxx&ItemId=9791234567890&...
 */
const https = require('https');

exports.handler = async (event) => {
  const params = { ...(event.queryStringParameters || {}) };

  // _ep 파라미터로 엔드포인트 구분
  const endpoint = params._ep || 'ItemSearch.aspx';
  delete params._ep;

  // JSONP 콜백 제거 (서버에서 호출하므로 불필요, JSON으로 받음)
  delete params.callback;

  const qs = new URLSearchParams({
    ...params,
    output: 'js',
    Version: '20131101',
  }).toString();

  const url = `https://www.aladin.co.kr/ttb/api/${endpoint}?${qs}`;

  try {
    const body = await new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ISBN-Checker/1.0)',
          'Accept': '*/*',
        },
        timeout: 12000,
      }, (res) => {
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          // 알라딘은 callback 없어도 JSONP 래퍼가 붙는 경우 있음 → 순수 JSON 추출
          const match = raw.match(/^[^(]*\((.+)\);?\s*$/s);
          resolve(match ? match[1] : raw);
        });
      }).on('error', reject).on('timeout', () => reject(new Error('TIMEOUT')));
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
      body,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
