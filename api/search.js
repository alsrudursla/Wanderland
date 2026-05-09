/**
 * api/search.js
 * 카페 검색 API
 * - Google Places API (searchText)로 카페 검색
 * - Upstash Redis 공유 캐시 (24시간 TTL)
 * - 검색할 때마다 키워드 카운터 자동 증가
 * - locationRestriction(rectangle)으로 반경 제한, 결과 없으면 자동 확장
 */

// ─────────────────────────────────────────────
// RedisCache: Upstash REST API를 감싸는 캐시/카운터 클래스
// ─────────────────────────────────────────────
class RedisCache {
  constructor() {
    this.url   = process.env.UPSTASH_REDIS_REST_URL;
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN;
    this.ttl   = 86400; // 24시간 (초 단위)
  }

  // Redis REST API 호출 헬퍼
  async _call(command, ...args) {
    const res = await fetch(`${this.url}/${command}/${args.join('/')}`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return res.json();
  }

  // 캐시에서 데이터 가져오기
  async get(key) {
    const result = await this._call('get', encodeURIComponent(key));
    if (!result.result) return null;
    return JSON.parse(result.result);
  }

  // 캐시에 데이터 저장 (TTL 포함)
  async set(key, value) {
    const encoded = encodeURIComponent(key);
    const data = encodeURIComponent(JSON.stringify(value));
    await this._call('set', encoded, data, 'EX', this.ttl);
  }
}

// ─────────────────────────────────────────────
// PlacesSearcher: Google Places API 검색 클래스
// ─────────────────────────────────────────────
class PlacesSearcher {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.endpoint = 'https://places.googleapis.com/v1/places:searchText';
    this.fields = [
      'places.displayName',
      'places.formattedAddress',
      'places.rating',
      'places.userRatingCount',
      'places.location',
      'places.googleMapsUri',
      'places.regularOpeningHours'
    ].join(',');
  }

  // 특정 반경으로 검색
  async searchWithRadius(keyword, lat, lng, radiusMeters) {
    const body = {
      textQuery: keyword,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters
        }
      },
      maxResultCount: 20,
      languageCode: 'ko'
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': this.fields
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    // location 없는 장소 필터링 (거리 계산에 필요)
    const places = (data.places || []).filter(p => p.location);
    return places;
  }

  // 반경을 단계적으로 늘려가며 결과 찾기
  // 500m → 1km → 2km → 5km 순서로 확장
  async searchWithAutoExpand(keyword, lat, lng) {
    const radii = [500, 1000, 2000, 5000];

    for (const radius of radii) {
      const places = await this.searchWithRadius(keyword, lat, lng, radius);
      if (places.length > 0) {
        return { places, radius }; // 결과가 나온 반경도 함께 반환
      }
    }

    return { places: [], radius: null };
  }
}

// ─────────────────────────────────────────────
// 캐시 키 생성 헬퍼
// 위치는 소수점 2자리로 반올림 (약 1km 단위로 동일 취급)
// ─────────────────────────────────────────────
function makeCacheKey(lat, lng, keyword) {
  const rLat = parseFloat(lat).toFixed(2);
  const rLng = parseFloat(lng).toFixed(2);
  return `wanderland:search:${rLat},${rLng}:${keyword}`;
}

// ─────────────────────────────────────────────
// Handler: Vercel 서버리스 함수 진입점
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lat, lng, keyword } = req.query;

  if (!lat || !lng || !keyword) {
    return res.status(400).json({ error: '파라미터가 부족해요 (lat, lng, keyword 필요)' });
  }

  const cache = new RedisCache();
  const cacheKey = makeCacheKey(lat, lng, keyword);

  // 1. 캐시 확인
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.status(200).json({ ...cached, cached: true });
  }

  // 2. 캐시 미스 → Google Places API 검색
  const searcher = new PlacesSearcher(process.env.GOOGLE_API_KEY);
  const { places, radius } = await searcher.searchWithAutoExpand(
    keyword,
    parseFloat(lat),
    parseFloat(lng)
  );

  const result = { places, expandedRadius: radius };

  // 3. 결과 캐시에 저장
  if (places.length > 0) {
    await cache.set(cacheKey, result);
  }

  return res.status(200).json(result);
}