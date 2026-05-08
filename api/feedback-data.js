/**
 * api/feedback-data.js
 * 대시보드용 피드백 데이터 조회 API
 * - Google Sheets에서 피드백 읽어서 통계 계산
 * - 평균 별점, 칩별 사용 횟수, 최근 코멘트 반환
 */

// ─────────────────────────────────────────────
// GoogleSheetsReader: Google Sheets에서 데이터를 읽는 클래스
// feedback.js의 GoogleSheetsWriter와 인증 방식 동일
// ─────────────────────────────────────────────
class GoogleSheetsReader {
  constructor() {
    this.sheetId = process.env.SHEET_ID;
    this.email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    this.privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  }

  async getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: this.email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const encode = obj =>
      btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const signingInput = `${encode(header)}.${encode(payload)}`;

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

    return `${signingInput}.${sigB64}`;
  }

  // 시트 전체 데이터 읽기
  async readAll() {
    const jwt = await this.getAccessToken();

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const { access_token } = await tokenRes.json();

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/시트1!A:D`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const data = await res.json();
    return data.values || [];
  }
}

// ─────────────────────────────────────────────
// FeedbackAnalyzer: 피드백 데이터 분석 클래스
// ─────────────────────────────────────────────
class FeedbackAnalyzer {
  constructor(rows) {
    // 첫 번째 행은 헤더 제외
    this.rows = rows.slice(1);
  }

  // 평균 별점 계산
  averageRating() {
    if (!this.rows.length) return 0;
    const sum = this.rows.reduce((acc, row) => acc + (parseFloat(row[1]) || 0), 0);
    return (sum / this.rows.length).toFixed(1);
  }

  // 칩별 사용 횟수 집계
  chipStats() {
    const counts = {};
    this.rows.forEach(row => {
      const chips = (row[2] || '').split(', ').filter(Boolean);
      chips.forEach(chip => {
        counts[chip] = (counts[chip] || 0) + 1;
      });
    });
    // 많이 쓴 순으로 정렬
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([chip, count]) => ({ chip, count }));
  }

  // 최근 코멘트 10개
  recentComments() {
    return this.rows
      .filter(row => row[3])
      .slice(-10)
      .reverse()
      .map(row => ({ timestamp: row[0], rating: row[1], comment: row[3] }));
  }

  // 전체 통계 반환
  analyze() {
    return {
      total: this.rows.length,
      averageRating: this.averageRating(),
      chipStats: this.chipStats(),
      recentComments: this.recentComments()
    };
  }
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const reader = new GoogleSheetsReader();
  const rows = await reader.readAll();

  const analyzer = new FeedbackAnalyzer(rows);
  return res.status(200).json(analyzer.analyze());
}