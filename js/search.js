/**
 * search.js
 * 카페 검색 흐름 전체 관리
 * GPS 위치 가져오기 → API 호출 → 결과 렌더링 → 반경 확장 → 정렬 변경
 * 의존: state.js, utils.js (Sorter), managers.js (ChipManager), renderer.js (Renderer)
 */

// ─────────────────────────────────────────────
// 검색 시작 (찾아줘 버튼 클릭 시 호출)
// ─────────────────────────────────────────────

/**
 * GPS 또는 직접 선택한 위치로 검색 시작
 * 위치 가져온 후 fetchPlaces() 호출
 */
function search() {
  const errorEl = document.getElementById('error-msg');
  errorEl.classList.remove('show');

  // 새 검색 시작할 때 반경 500m로 초기화
  state.currentRadius = 500;

  if (!navigator.geolocation) {
    errorEl.classList.add('show');
    return;
  }

  // 로딩 UI 표시 및 이전 결과 초기화
  document.getElementById('loading').classList.add('show');
  document.getElementById('results').innerHTML = '';
  document.getElementById('sort-bar').classList.remove('show');
  document.getElementById('expand-notice').classList.remove('show');
  document.getElementById('action-bar').classList.remove('show');

  // 로딩 인디케이터로 부드럽게 스크롤
  document.getElementById('loading').scrollIntoView({ behavior: 'smooth', block: 'center' });

  if (state.usingCustomLocation && state.selectedLat) {
    // 사용자가 직접 선택한 위치로 검색
    state.userLat = state.selectedLat;
    state.userLng = state.selectedLng;
    fetchPlaces();
  } else {
    // GPS로 현재 위치 가져와서 검색
    navigator.geolocation.getCurrentPosition(
      pos => {
        state.userLat = pos.coords.latitude;
        state.userLng = pos.coords.longitude;
        document.getElementById('location-display').textContent = '📍 현재 위치로 검색';
        fetchPlaces();
      },
      () => {
        // 위치 권한 거부 시 에러 메시지 표시
        document.getElementById('loading').classList.remove('show');
        errorEl.classList.add('show');
      }
    );
  }
}

// ─────────────────────────────────────────────
// API 호출 (Places 검색)
// ─────────────────────────────────────────────

/**
 * /api/search 엔드포인트 호출 → 결과 렌더링
 * 초기 검색은 항상 500m로 시작, 캐시도 radius=500 키로 활용
 */
async function fetchPlaces() {
  const keywords = ChipManager.getAllKeywords();
  const keyword  = keywords.length ? keywords.join(' ') + ' 카페' : '카페';

  try {
    const res  = await fetch(
      `/api/search?lat=${state.userLat}&lng=${state.userLng}&keyword=${encodeURIComponent(keyword)}&radius=500`
    );
    const data = await res.json();

    document.getElementById('loading').classList.remove('show');

    if (data.places?.length) {
      state.places      = data.places      || [];
      state.trendPlaces = data.trendPlaces || [];
      state.sort        = 'distance';

      // 반경 자동 확장 안내 메시지 (500m 안에 결과 없어서 더 넓게 검색한 경우)
      if (data.expandedRadius && data.expandedRadius > 500) {
        const notice = document.getElementById('expand-notice');
        notice.textContent = `근처에 없어서 ${(data.expandedRadius / 1000).toFixed(1)}km 범위로 넓혀봤어요 🗺`;
        notice.classList.add('show');
      }

      // 정렬 버튼 상태 초기화 (거리순 선택)
      ['sort-distance', 'sort-rating', 'sort-trend'].forEach(id => {
        document.getElementById(id).classList.remove('on');
      });
      document.getElementById('sort-distance').classList.add('on');
      document.getElementById('sort-bar').classList.add('show');
      document.getElementById('action-bar').classList.add('show');

      Renderer.render(Sorter.sort(state.places, 'distance'));

      state.currentRadius = data.expandedRadius || 500;
      // 5km 미만이면 반경 넓히기 버튼 표시
      document.getElementById('expand-btn-row').style.display =
        state.currentRadius < 5000 ? '' : 'none';
    } else {
      document.getElementById('results').innerHTML =
        '<p class="no-result">근처에 카페가 없어요 😢</p>';
    }
  } catch (err) {
    console.error('fetchPlaces 에러:', err);
    document.getElementById('loading').classList.remove('show');
    document.getElementById('results').innerHTML =
      '<p class="no-result">오류가 났어요 😢</p>';
  }
}

// ─────────────────────────────────────────────
// 반경 넓히기
// ─────────────────────────────────────────────

/**
 * 현재 반경에서 다음 단계로 넓혀서 재검색
 * 단계: 500m → 1km → 2km → 5km
 */
async function expandSearch() {
  const steps = [500, 1000, 2000, 5000];
  const currentIdx = steps.indexOf(state.currentRadius);

  if (currentIdx === steps.length - 1) {
    alert('더 이상 넓힐 수 없어요!');
    return;
  }

  state.currentRadius = steps[currentIdx + 1];

  document.getElementById('loading').classList.add('show');
  document.getElementById('results').innerHTML = '';
  document.getElementById('expand-btn-row').style.display = 'none';
  document.getElementById('sort-bar').classList.remove('show');

  const keywords = ChipManager.getAllKeywords();
  const keyword  = keywords.length ? keywords.join(' ') + ' 카페' : '카페';

  try {
    const res  = await fetch(
      `/api/search?lat=${state.userLat}&lng=${state.userLng}&keyword=${encodeURIComponent(keyword)}&radius=${state.currentRadius}`
    );
    const data = await res.json();

    document.getElementById('loading').classList.remove('show');

    if (data.places?.length) {
      state.places = data.places;

      const notice = document.getElementById('expand-notice');
      notice.textContent = `${(state.currentRadius / 1000).toFixed(1)}km 범위로 찾아봤어요 🗺`;
      notice.classList.add('show');

      document.getElementById('sort-bar').classList.add('show');
      document.getElementById('expand-btn-row').style.display =
        state.currentRadius < 5000 ? '' : 'none';

      Renderer.render(Sorter.sort(state.places, state.sort));
    }
  } catch (err) {
    console.error('expandSearch 에러:', err);
    document.getElementById('loading').classList.remove('show');
  }
}

// ─────────────────────────────────────────────
// 정렬 변경
// ─────────────────────────────────────────────

/**
 * 정렬 기준 변경 및 결과 재렌더링
 * @param {string} type 'distance' | 'rating' | 'trend'
 */
function sortBy(type) {
  state.sort = type;

  // 모든 정렬 버튼 off
  ['sort-distance', 'sort-rating', 'sort-trend'].forEach(id => {
    document.getElementById(id).classList.remove('on');
  });

  // 선택된 버튼 on
  const idMap = { distance: 'sort-distance', rating: 'sort-rating', trend: 'sort-trend' };
  document.getElementById(idMap[type]).classList.add('on');

  // 트렌드 정렬일 때 반경 관련 UI 숨기기
  const isTrend = type === 'trend';
  const expandNotice = document.getElementById('expand-notice');
  const expandBtnRow = document.getElementById('expand-btn-row');

  if (expandNotice) {
    expandNotice.classList.toggle('show', !isTrend && expandNotice.textContent !== '');
  }
  if (expandBtnRow) {
    expandBtnRow.style.display = isTrend
      ? 'none'
      : state.currentRadius < 5000 ? '' : 'none';
  }

  // 트렌드는 네이버 결과, 나머지는 구글 결과 사용
  const places = type === 'trend' ? state.trendPlaces : state.places;
  Renderer.render(Sorter.sort(places, type));
}