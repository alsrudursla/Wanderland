/**
 * utils.js
 * 거리 계산(GeoUtils), 지도 딥링크(MapLinks) 등
 * 순수 유틸리티 함수 모음 — 상태나 DOM에 의존하지 않음
 */

// ─────────────────────────────────────────────
// GeoUtils: 거리 계산 유틸리티
// ─────────────────────────────────────────────
const GeoUtils = {
  /**
   * Haversine 공식으로 두 좌표 사이 거리(m) 계산
   * @param {number} lat1 출발 위도
   * @param {number} lng1 출발 경도
   * @param {number} lat2 도착 위도
   * @param {number} lng2 도착 경도
   * @returns {number} 거리 (미터)
   */
  distance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  },

  /**
   * 거리를 보기 좋게 포맷 (1000m 이상은 km 단위)
   * @param {number} meters 거리 (미터)
   * @returns {string} 예: '350m' 또는 '1.2km'
   */
  format(meters) {
    return meters >= 1000
      ? `${(meters / 1000).toFixed(1)}km`
      : `${meters}m`;
  }
};

// ─────────────────────────────────────────────
// MapLinks: 네이버/카카오/구글 지도앱 딥링크 생성
// ─────────────────────────────────────────────
const MapLinks = {
  /**
   * 네이버 지도 — 카페 이름으로 검색
   * @param {number} lat 위도 (현재 미사용, 확장성을 위해 유지)
   * @param {number} lng 경도
   * @param {string} name 카페 이름
   */
  naver(lat, lng, name) {
    return `https://map.naver.com/p/search/${encodeURIComponent(name)}`;
  },

  /**
   * 카카오 지도 — 카페 이름으로 검색
   * 좌표 기반 딥링크는 정보 없이 핀만 찍혀서, 검색 방식으로 변경
   * @param {number} lat 위도 (현재 미사용)
   * @param {number} lng 경도
   * @param {string} name 카페 이름
   */
  kakao(lat, lng, name) {
    return `https://map.kakao.com/?q=${encodeURIComponent(name)}`;
  }
  // 구글은 place.googleMapsUri (API 응답값)를 직접 사용하므로 여기에 없음
};

// ─────────────────────────────────────────────
// Sorter: 검색 결과 정렬
// ─────────────────────────────────────────────
const Sorter = {
  /**
   * 장소 배열을 지정된 기준으로 정렬해 새 배열 반환
   * @param {Array} places 장소 배열
   * @param {string} type 'distance' | 'rating' | 'trend'
   * @returns {Array} 정렬된 새 배열 (원본 불변)
   */
  sort(places, type) {
    return [...places].sort((a, b) => {
      if (type === 'distance') {
        const da = a.location
          ? GeoUtils.distance(state.userLat, state.userLng, a.location.latitude, a.location.longitude)
          : Infinity;
        const db = b.location
          ? GeoUtils.distance(state.userLat, state.userLng, b.location.latitude, b.location.longitude)
          : Infinity;
        return da - db;
      }
      if (type === 'rating') {
        return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
      }
      if (type === 'trend') {
        return 0; // 네이버 API 응답 순서 그대로 유지
      }
    });
  }
};