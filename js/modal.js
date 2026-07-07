/**
 * modal.js
 * 모달 열기/닫기 및 모달별 초기화 로직 관리
 * ContentLoader (앱 안내, 개발자 노트) 포함
 * 의존: state.js, managers.js (LocationManager, SaveManager)
 */

// ─────────────────────────────────────────────
// ContentLoader: content/ 폴더 데이터를 API로 가져와 모달에 렌더링
// ─────────────────────────────────────────────
const ContentLoader = {
  /**
   * 앱 안내 (i) 모달 내용 로드
   * /api/content?type=info 에서 섹션 목록을 가져와 렌더링
   */
  async loadInfo() {
    const res  = await fetch('/api/content?type=info');
    const data = await res.json();

    document.getElementById('info-content').innerHTML =
      data.sections.map(s => `
        <div class="info-section">
          <p class="info-section-title">${s.title}</p>
          <p class="info-item">${s.body}</p>
        </div>
      `).join('');
  },

  /**
   * 개발자 노트 모달 내용 로드
   * /api/content?type=devnotes 에서 릴리즈 노트 목록을 가져와 렌더링
   */
  async loadDevNotes() {
    const res   = await fetch('/api/content?type=devnotes');
    const notes = await res.json();

    document.getElementById('devnote-content').innerHTML =
      notes.map((note, i) => `
        <div class="release-note" style="transform: rotate(${['-0.5deg','0.3deg','-0.2deg'][i % 3]})">
          <p class="release-version">
            ${note.version}${i === 0 ? ' — NEW!' : ''}${note.label ? ` — ${note.label}` : ''}
            <span class="release-date">${note.date ?? ''}</span>
          </p>
          ${note.items.map(item => `<p class="release-item">${item}</p>`).join('')}
        </div>
      `).join('');
  }
};

// ─────────────────────────────────────────────
// 모달 열기
// ─────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('show');

  // 앱 안내 모달 — 최초 1회만 API 호출
  if (id === 'info-modal' && !ContentLoader._infoLoaded) {
    ContentLoader.loadInfo();
    ContentLoader._infoLoaded = true;
  }

  // 개발자 노트 모달 — 최초 1회만 API 호출
  if (id === 'devnote-modal' && !ContentLoader._devLoaded) {
    ContentLoader.loadDevNotes();
    ContentLoader._devLoaded = true;
  }

  // 위치 선택 모달 — 카카오 지도 초기화 (DOM 렌더 후 실행)
  if (id === 'location-modal') {
    setTimeout(() => LocationManager.initMap(), 100);
  }

  // 저장한 카페 모달 — 목록 렌더링
  if (id === 'saved-modal') SaveManager.renderModal();

  // 피드백 모달 — 카페 피드백에서 열린 경우 타이틀/플레이스홀더 변경
  if (id === 'feedback-modal') {
    const title = document.querySelector('#feedback-modal .modal-title');
    if (state.pendingCafeName) {
      const emoji = state.pendingSatisfaction === 'good' ? '👍' : '👎';
      title.textContent = `${emoji} 이유가 있나요? 🗒`;
      document.getElementById('feedback-comment').placeholder =
        `${state.pendingCafeName}에 대해 한 마디 남겨줘요! (선택)`;
    } else {
      title.textContent = '어떠셨어요? 🗒';
      document.getElementById('feedback-comment').placeholder =
        '불편한 점, 원하는 기능, 뭐든요!';
    }
  }
}

// ─────────────────────────────────────────────
// 모달 닫기
// ─────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).classList.remove('show');

  // 피드백 모달 닫을 때 상태 초기화
  if (id === 'feedback-modal') {
    state.feedbackRating     = 0;
    state.pendingCafeName    = null;
    state.pendingSatisfaction = null;
    state.pendingKeywords    = null;
    document.querySelectorAll('.star').forEach(s => s.classList.remove('on'));
    document.getElementById('feedback-comment').value = '';
  }
}

// 모달 바깥 영역 클릭 시 닫기
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('show');
  });
});