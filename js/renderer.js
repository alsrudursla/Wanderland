/**
 * renderer.js
 * 검색 결과 카드 렌더링 (Renderer)
 * 의존: state.js, utils.js (GeoUtils, MapLinks), managers.js (SaveManager, ChipManager)
 */

const Renderer = {
  /**
   * 장소 배열을 받아 결과 카드 목록으로 렌더링
   * @param {Array} places Google Places API 응답 장소 배열
   */
  render(places) {
    const container = document.getElementById('results');
    container.innerHTML = '';

    if (!places.length) {
      container.innerHTML = '<p class="no-result">근처에 카페가 없어요 😢</p>';
      return;
    }

    const keywords = ChipManager.getAllKeywords();

    places.forEach((place, i) => {
      // API 응답에서 필요한 데이터 추출
      const name    = place.displayName?.text || '';
      const address = place.formattedAddress || '';
      const rating  = place.rating
        ? `⭐ ${place.rating.toFixed(1)} (${place.userRatingCount}개)`
        : '';
      const lat     = place.location?.latitude;
      const lng     = place.location?.longitude;
      const dist    = place.location
        ? GeoUtils.format(GeoUtils.distance(state.userLat, state.userLng, lat, lng))
        : '';
      const url     = place.googleMapsUri || ''; // 구글맵 딥링크 (G 배지 + 카드 클릭에 사용)

      // 영업 중/종료 태그
      const isOpen  = place.regularOpeningHours?.openNow;
      const openTag = isOpen === true
        ? '<span class="tag open">영업 중</span>'
        : isOpen === false
        ? '<span class="tag closed">영업 종료</span>'
        : '';

      const isSaved = SaveManager.isSaved(name, address);

      const card = document.createElement('div');
      card.className = 'result-card';
      card.style.animationDelay = `${i * 0.05}s`; // 카드가 순서대로 페이드인

      card.innerHTML = `
        <div class="result-name">${name}</div>
        <div class="result-meta">${[dist, rating, address].filter(Boolean).join(' · ')}</div>
        <div class="result-tags">
          ${openTag}
          ${keywords.map(k => `<span class="tag">${k}</span>`).join('')}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <div class="card-action-row">
            <!-- 저장 버튼: 저장 여부에 따라 하트 색상 변경 -->
            <button
              class="card-action-btn ${isSaved ? 'saved' : ''}"
              title="저장"
              data-name="${name.replace(/"/g,'&quot;')}"
              data-address="${address.replace(/"/g,'&quot;')}"
              data-url="${url}"
              data-source="${place.source || 'google'}"
              data-keywords="${ChipManager.getAllKeywords().join(',')}"
              data-lat="${lat || 0}"
              data-lng="${lng || 0}"
              onclick="toggleSaveFromCard(event, this)"
            >${isSaved ? '🧡' : '🤍'}</button>
            <!-- 좋아요/별로 피드백 버튼 -->
            <button
              class="card-action-btn"
              title="좋았어요"
              onclick="sendCafeFeedback(event, this, '${name.replace(/'/g,"\\'")}', '${address.replace(/'/g,"\\'")}', '${place.source}', 'good')"
            >👍</button>
            <button
              class="card-action-btn"
              title="별로였어요"
              onclick="sendCafeFeedback(event, this, '${name.replace(/'/g,"\\'")}', '${address.replace(/'/g,"\\'")}', '${place.source}', 'bad')"
            >👎</button>
            <!-- 정복 버튼: ConquerManager.conquer로 연결 -->
            <button
              class="card-action-btn conquer-btn"
              title="정복하기"
              onclick="ConquerManager.conquer(event, '${name.replace(/'/g,"\\'")}', '${address.replace(/'/g,"\\'")}', ${lat || 0}, ${lng || 0})"
            >🚩</button>
          </div>
          <!-- 지도 배지: N(네이버) / G(구글) / K(카카오) -->
          <div class="map-badge-row">
            <a class="map-badge naver"
               href="${MapLinks.naver(lat, lng, name)}"
               target="_blank"
               onclick="event.stopPropagation()">N</a>
            <a class="map-badge google"
               href="${url}"
               target="_blank"
               onclick="event.stopPropagation()">G</a>
            <a class="map-badge kakao"
               href="${MapLinks.kakao(lat, lng, name)}"
               target="_blank"
               onclick="event.stopPropagation()">K</a>
          </div>
        </div>
      `;

      // 카드 전체 클릭 → 구글맵 새 탭으로 열기
      card.onclick = () => window.open(url, '_blank');
      container.appendChild(card);
    });
  }
};

// ─────────────────────────────────────────────
// 저장/취소 토글 (카드 저장 버튼 onclick에서 호출)
// ─────────────────────────────────────────────
function toggleSaveFromCard(e, btn) {
  e.stopPropagation(); // 카드 전체 클릭 방지

  const name     = btn.dataset.name;
  const address  = btn.dataset.address;
  const url      = btn.dataset.url;
  const source   = btn.dataset.source;
  const lat      = parseFloat(btn.dataset.lat) || 0;
  const lng      = parseFloat(btn.dataset.lng) || 0;
  const keywords = btn.dataset.keywords
    ? btn.dataset.keywords.split(',').filter(Boolean)
    : [];

  if (SaveManager.isSaved(name, address)) {
    // 이미 저장됨 → 저장 취소
    SaveManager.remove(name, address);
    btn.textContent = '🤍';
    btn.classList.remove('saved');
  } else {
    // 미저장 → 저장
    SaveManager.save({ name, address, url, source, keywords, lat, lng });
    btn.textContent = '🧡';
    btn.classList.add('saved');
  }
}