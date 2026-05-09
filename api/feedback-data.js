/**
 * api/feedback-data.js
 * 대시보드용 피드백 + 키워드 통계 조회 API
 * - Google Sheets에서 피드백 읽어서 통계 계산
 * - Upstash Redis에서 실제 검색 키워드 카운터 읽기
 */

// ─────────────────────────────────────────────
// RedisStats: Upstash Redis에서 키워드 카운터 읽기
// ─────────────────────────────────────────────
class RedisStats {
  constructor() {
    this.url   = process.env.UPSTASH_REDIS_REST_URL;
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN;
  }

  async _call(command, ...args) {
    const res = await fetch(`${this.url}/${command}/${args.join('/')}`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return res.json();
  }

  // "keyword:*" 패턴의 모든 키 조회 → 카운트와 함께 반환
  async getKeywordStats() {
    // KEYS 커맨드로 keyword: 로 시작하는 모든 키 조회
    const keysResult = await this._call('keys', encodeURIComponent('keyword:*'));
    const keys = keysResult.result || [];

    if (!keys.length) return [];

    // 각 키의 값(카운트) 가져오기
    const stats = await Promise.all(
      keys.map(async key => {
        const val = await this._call('get', encodeURIComponent(key));
        const keyword = key.replace('keyword:', ''); // 키에서 prefix 제거
        return { keyword, count: parseInt(val.result) || 0 };
      })
    );

    // 많이 검색된 순으로 정렬
    return stats.sort((a, b) => b.count - a.count);
  }
}

// ─────────────────────────────────────────────
// GoogleSheetsReader: Google Sheets에서 피드백 읽기
// ─────────────────────────────────────────────
class GoogleSheetsReader {
  constructor() {
    this.sheetId    = process.env.SHEET_ID;
    this.email      = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    this.privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  }

  async getAccessToken() {
    const now     = Math.floor(Date.now() / 1000);
    const header  = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss:   this.email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud:   'https://oauth2.googleapis.com/token',
      exp:   now + 3600,
      iat:   now
    };

    const encode = obj =>
      btoa(JSON.stringify(obj))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const signingInput = `${encode(header)}.${encode(payload)}`;

    const keyData = this.privateKey
      .replace(/-----BEGIN.*?-----/g, '')
      .replace(/-----END.*?-----/g, '')
      .replace(/\s/g, '');

    const binaryKey  = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    const cryptoKey  = await crypto.subtle.importKey(
      'pkcs8', binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    );
    const signature  = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5', cryptoKey,
      new TextEncoder().encode(signingInput)
    );
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const jwt = `${signingInput}.${sigB64}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const { access_token } = await tokenRes.json();
    return access_token;
  }

  async readAll() {
    const token = await this.getAccessToken();
    const res   = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/시트1!A:D`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return data.values || [];
  }
}

// ─────────────────────────────────────────────
// FeedbackAnalyzer: 피드백 데이터 분석
// ─────────────────────────────────────────────
class FeedbackAnalyzer {
  constructor(rows) {
    this.rows = rows.slice(1); // 첫 번째 행(헤더) 제외
  }

  averageRating() {
    if (!this.rows.length) return 0;
    const sum = this.rows.reduce((acc, row) => acc + (parseFloat(row[1]) || 0), 0);
    return (sum / this.rows.length).toFixed(1);
  }

  recentComments() {
    return this.rows
      .filter(row => row[3])
      .slice(-10).reverse()
      .map(row => ({ timestamp: row[0], rating: row[1], comment: row[3] }));
  }

  analyze() {
    return {
      total:          this.rows.length,
      averageRating:  this.averageRating(),
      recentComments: this.recentComments()
    };
  }
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 피드백 통계 + 키워드 통계 병렬로 가져오기
  const [feedbackData, keywordStats] = await Promise.all([
    new GoogleSheetsReader().readAll().then(rows => new FeedbackAnalyzer(rows).analyze()),
    new RedisStats().getKeywordStats()
  ]);

  return res.status(200).json({ ...feedbackData, keywordStats });
}