/**
 * api/feedback.js
 * 피드백 저장 API
 * - 별점, 선택된 칩, 자유 코멘트를 Google Sheets에 저장
 * - 서비스 계정으로 인증 (OAuth 불필요)
 */

// ─────────────────────────────────────────────
// GoogleSheetsWriter: Google Sheets에 데이터를 쓰는 클래스
// ─────────────────────────────────────────────
class GoogleSheetsWriter {
  constructor() {
    this.sheetId = process.env.SHEET_ID;
    this.email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    this.privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  }

  // JWT 액세스 토큰 생성 (서비스 계정 인증)
  async getAccessToken() {
    const now = Math.floor(Date.now() / 1000);

    // JWT 헤더와 페이로드 구성
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: this.email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    // base64url 인코딩
    const encode = obj =>
      btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const signingInput = `${encode(header)}.${encode(payload)}`;

    // RSA-SHA256 서명 (Web Crypto API 사용)
    const keyData = this.privateKey
      .replace('-----BEGIN RSA PRIVATE KEY-----', '')
      .replace('-----END RSA PRIVATE KEY-----', '')
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');

    const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signingInput)
    );

    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const jwt = `${signingInput}.${sigB64}`;

    // JWT로 액세스 토큰 발급
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const tokenData = await tokenRes.json();
    return tokenData.access_token;
  }

  // 구글 시트에 행 추가
  async appendRow(values, sheetName = '시트1') {
    const token = await this.getAccessToken();

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${encodeURIComponent(sheetName)}!A:E:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [values] })
      }
    );

    return res.json();
  }
}

// ─────────────────────────────────────────────
// Handler: Vercel 서버리스 함수 진입점
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // CORS preflight 처리
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용' });

  // type이 'cafe'면 카페 피드백, 없으면 기존 서비스 피드백
  const { rating, chips, comment, type, cafeName, cafeAddress, cafeSource, satisfaction, keywords } = req.body;

  if (type === 'cafe') {
    // 카페 피드백(추천 결과) → 시트2에 저장
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const row = [timestamp, cafeName || '', cafeAddress || '', satisfaction || '', cafeSource || '', (keywords || []).join(', ')];
    const writer = new GoogleSheetsWriter();
    await writer.appendRow(row, '시트2'); // 시트2에 저장
    return res.status(200).json({ success: true });
  } else {
    // 서비스 피드백 → 시트1에 저장
    if (!rating) return res.status(400).json({ error: '별점은 필수예요' });

    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const chipsStr = Array.isArray(chips) ? chips.join(', ') : '';

    // 시트에 저장할 행: [시간, 별점, 선택한 칩, 코멘트]
    const row = [timestamp, rating, chipsStr, comment || ''];

    const writer = new GoogleSheetsWriter();
    await writer.appendRow(row);

    return res.status(200).json({ success: true });
  }
}