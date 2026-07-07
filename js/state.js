/**
 * state.js
 * 앱 전체에서 공유하는 전역 상태 객체
 * 다른 모든 JS 파일보다 먼저 로드되어야 함
 */

const state = {
  places: [],               // 구글 Places API 검색 결과
  trendPlaces: [],          // 네이버 검색 결과 (트렌드 정렬용)
  sort: 'distance',         // 현재 정렬 기준 ('distance' | 'rating' | 'trend')
  userLat: null,            // 현재 위치 위도
  userLng: null,            // 현재 위치 경도
  customChips: [],          // 사용자가 직접 추가한 키워드 칩 목록
  feedbackRating: 0,        // 앱 피드백 모달 별점
  currentRadius: 500,       // 현재 검색 반경 (m), 기본 500m
  selectedLat: null,        // 직접 선택한 위치 위도 (GPS 대신 핀으로 선택 시)
  selectedLng: null,        // 직접 선택한 위치 경도
  selectedAddr: '현재 위치', // 위치 표시용 주소 문자열
  usingCustomLocation: false, // 직접 위치 선택 여부 (true면 GPS 대신 핀 위치 사용)
  pendingCafeName: null,    // 카페 피드백 모달 열릴 때 임시 저장되는 카페 이름
  pendingSatisfaction: null, // 카페 피드백 임시 저장 (good | bad)
  pendingKeywords: null,    // 카페 피드백 임시 저장 키워드 배열
};