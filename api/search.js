/**
 * api/search.js
 * 카페 검색 API
 * - Google Places API (searchText)로 카페 검색
 * - Naver Search API 로 검색 품질 보완
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
    const data    = encodeURIComponent(JSON.stringify(value));
    await this._call('set', encoded, data, 'EX', this.ttl);
  }

  // 키워드 검색 카운터 증가
  // "keyword:카공 카페" 형태의 키로 카운트를 1씩 올림
  async incrementKeyword(keyword) {
    const key = encodeURIComponent(`keyword:${keyword}`);
    await this._call('incr', key);
  }
}

// ─────────────────────────────────────────────
// PlacesSearcher: Google Places API 검색 클래스
// ─────────────────────────────────────────────
class PlacesSearcher {
  constructor(apiKey) {
    this.apiKey   = apiKey;
    this.endpoint = 'https://places.googleapis.com/v1/places:searchText';
    this.fields   = [
      'places.displayName',
      'places.formattedAddress',
      'places.rating',
      'places.userRatingCount',
      'places.location',
      'places.googleMapsUri',
      'places.regularOpeningHours'
    ].join(',');
  }

  // 특정 반경을 사각형(rectangle)으로 변환해서 검색
  // locationRestriction은 circle 미지원 → rectangle로 근사
  async searchWithRadius(keyword, lat, lng, radiusMeters) {
    // 위도 1도 ≈ 111km → 반경을 도(degree)로 변환
    const delta = radiusMeters / 111000;

    const body = {
      textQuery: keyword,
      locationRestriction: {
        rectangle: {
          low:  { latitude: lat - delta, longitude: lng - delta },
          high: { latitude: lat + delta, longitude: lng + delta }
        }
      },
      maxResultCount: 20,
      languageCode: 'ko'
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Goog-Api-Key':  this.apiKey,
        'X-Goog-FieldMask': this.fields
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    // location 필터링과 동시에 source: 'google' 태그 추가
    return (data.places || [])
      .filter(place => place.location) // 위치 정보 없는 결과 제거
      .map(place => ({ 
        ...place, 
        source: 'google' // 구글 데이터임을 명시
      }));
  }

  // 반경을 단계적으로 늘려가며 결과 찾기
  // 500m → 1km → 2km → 5km 순서로 확장
  async searchWithAutoExpand(keyword, lat, lng, startRadius = 500) {
    const allRadii = [500, 1000, 2000, 5000];
    const radii = allRadii.slice(allRadii.indexOf(startRadius));
    console.log(`[GOOGLE] 자동 확장 검색 시작: keyword=${keyword}, lat=${lat}, lng=${lng}, startRadius=${startRadius}`);

    for (const radius of radii) {
      console.log(`[GOOGLE] 반경 ${radius}m 시도`);
      const places = await this.searchWithRadius(keyword, lat, lng, radius);
      console.log(`[GOOGLE] 반경 ${radius}m 결과: ${places.length}개`);
      if (places.length > 0) {
        console.log(`[GOOGLE] 성공: 반경 ${radius}m에서 ${places.length}개 찾음`);
        return { places, radius }; // 결과가 나온 반경도 함께 반환
      }
    }

    console.log(`[GOOGLE] 실패: 모든 반경에서 결과 없음`);
    return { places: [], radius: null };
  }
}

// ─────────────────────────────────────────────
// NaverSearcher: 네이버 검색 API 클래스
// ─────────────────────────────────────────────
class NaverSearcher {
  constructor() {
    this.clientId = process.env.NAVER_CLIENT_ID;
    this.clientSecret = process.env.NAVER_CLIENT_SECRET;
    this.endpoint = 'https://openapi.naver.com/v1/search/local.json';
  }

  async search(keyword, lat, lng) {
    const query = encodeURIComponent(`${keyword} 카페`);

    // 네이버 지역 API는 coordinate로 검색 중심점 지정 가능 (선택 사항이나 정확도 향상)
    const url = `${this.endpoint}?query=${query}&display=20&coordinate=${lng},${lat}`;
    console.log(`[NAVER] 검색 시작: keyword=${keyword}, lat=${lat}, lng=${lng}, url=${url}`);

    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': this.clientId,
        'X-Naver-Client-Secret': this.clientSecret
      }
    });

    const data = await res.json();
    console.log(`[NAVER] API 응답: ${data.items?.length || 0}개 항목`);

    return (data.items || []).map(item => {
      // HTML 태그 제거 (네이버가 <b>태그로 감싸서 반환함)
      const cleanName = item.title.replace(/<[^>]*>/g, '');
      
      // 네이버 좌표는 KATEC(카텍) 좌표계 → 이미 WGS84로 변환된 값으로 반환됨
      // mapx: 경도(longitude), mapy: 위도(latitude) — 단위는 1e-7도
      const latitude  = parseFloat(item.mapy) / 1e7;
      const longitude = parseFloat(item.mapx) / 1e7;

      // 좌표가 유효하지 않으면 제외
      if (isNaN(latitude) || isNaN(longitude)) return null;
      
      return {
        // 구글 형식 맞춤: displayName, formattedAddress, location, googleMapsUri, source
        displayName:         { text: cleanName },
        formattedAddress:    item.roadAddress || item.address,
        location:            { latitude, longitude },
        // 네이버 지도 검색 링크 (카페 이름으로 검색)
        googleMapsUri:       `https://map.naver.com/v5/search/${encodeURIComponent(cleanName)}`,
        rating:              null, // 네이버 지역 API는 별점 미제공
        userRatingCount:     null,
        regularOpeningHours: null, // 영업시간 미제공
        source:              'naver'
      };
    }).filter(Boolean); // null 제거
  }
}

// ─────────────────────────────────────────────
// 캐시 키 생성 헬퍼
// 위치는 소수점 2자리로 반올림 (약 1km 단위로 동일 취급)
// ─────────────────────────────────────────────
function makeCacheKey(lat, lng, keyword, radius) {
  const rLat = parseFloat(lat).toFixed(2);
  const rLng = parseFloat(lng).toFixed(2);
  return `wanderland:search:${rLat},${rLng}:${radius}:${keyword}`;
}

// ─────────────────────────────────────────────
// Handler: Vercel 서버리스 함수 진입점
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { lat, lng, keyword, radius } = req.query;
  console.log(`[SEARCH] 요청 시작: lat=${lat}, lng=${lng}, keyword=${keyword}`);

  if (!lat || !lng || !keyword) {
    console.log(`[SEARCH] 파라미터 부족: lat=${lat}, lng=${lng}, keyword=${keyword}`);
    return res.status(400).json({ error: '파라미터가 부족해요 (lat, lng, keyword 필요)' });
  }

  const cache    = new RedisCache();
  const startRadius = radius ? parseInt(radius) : 500;
  const cacheKey = makeCacheKey(lat, lng, keyword, startRadius);
  console.log(`[SEARCH] 캐시 키 생성: ${cacheKey}`);

  // 1. 키워드 카운터 증가 (캐시 히트와 무관하게 항상 카운트)
  await cache.incrementKeyword(keyword).catch(() => {}); // 실패해도 검색은 계속

  // 2. 캐시 확인
  const cached = await cache.get(cacheKey).catch(() => null);
  if (cached) {
    console.log(`[SEARCH] 캐시 히트: ${cached.places?.length || 0}개 결과 반환`);
    return res.status(200).json({ ...cached, cached: true });
  }
  console.log(`[SEARCH] 캐시 미스: API 검색 시작`);

  // 3. 캐시 미스 → Google Places API + Naver Search API 병렬 검색
  const googleSearcher = new PlacesSearcher(process.env.GOOGLE_API_KEY);
  const naverSearcher  = new NaverSearcher();

  try {
    console.log(`[SEARCH] API 호출 시작: Google + Naver 병렬 검색`);
    // 구글과 네이버 동시 호출
    const [googlePlaces, naverPlaces] = await Promise.all([
      googleSearcher.searchWithAutoExpand(keyword, parseFloat(lat), parseFloat(lng), startRadius),
      naverSearcher.search(keyword, parseFloat(lat), parseFloat(lng))
    ]);

    console.log(`[SEARCH] API 결과: Google=${googlePlaces.places.length}개 (반경:${googlePlaces.radius}m), Naver=${naverPlaces.length}개`);

    // 구글이 성공한 반경 가져오기 (결과가 없으면 기본 500m 적용)
    const activeRadius = googlePlaces.radius || 500;

    const result = {
      places: googlePlaces.places,        // 구글 결과만 (가까운 순/별점 순용)
      trendPlaces: naverPlaces,           // 네이버 결과만 (트렌드용)
      expandedRadius: activeRadius,
      sources: {
        google: googlePlaces.places.length,
        naver: naverPlaces.length
      }
    };

    // 5. 결과 캐시에 저장
    if (googlePlaces.places.length > 0 || naverPlaces.length > 0) {
      await cache.set(cacheKey, result).catch(() => {});
      console.log(`[SEARCH] 캐시 저장 완료: ${cacheKey}`);
    } else {
      console.log(`[SEARCH] 결과 없음: 캐시 저장 생략`);
    }

    console.log(`[SEARCH] 응답 완료: Google=${googlePlaces.places.length}개, Naver=${naverPlaces.length}개`);
    return res.status(200).json(result);

  } catch (error) {
    console.error('[SEARCH] 검색 오류:', error);
    return res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
}