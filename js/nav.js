/**
 * nav.js
 * 비행기 네비게이션 (홈 ↔ 탐험 페이지 전환)
 * 모든 Manager 초기화도 여기서 담당 (가장 마지막에 로드)
 * 의존: 모든 다른 JS 파일
 */

// ─────────────────────────────────────────────
// PageNav: 홈 → 탐험 페이지 전환
// ─────────────────────────────────────────────
const PageNav = {
  init() {
    // 비행기 버튼 클릭 → 힌트 숨기기 + 비행 애니메이션 → explore.html 이동
    document.getElementById('plane-next').addEventListener('click', (e) => {
      document.getElementById('hint-next').classList.add('hidden');
      e.currentTarget.classList.add('flying-right');
      setTimeout(() => { location.href = '/explore.html'; }, 1600);
    });
  }
};

// ─────────────────────────────────────────────
// 초기화 (모든 파일 로드 완료 후 실행)
// ─────────────────────────────────────────────
ChipManager.init();   // 칩 토글 이벤트 등록
BubbleManager.init(); // 디저트 키워드 버블 생성
PageNav.init();       // 비행기 버튼 이벤트 등록