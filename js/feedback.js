/**
 * feedback.js
 * 카페 좋아요/별로(sendCafeFeedback) 및 앱 피드백 제출(submitFeedback) 처리
 * /api/feedback 엔드포인트로 POST 요청
 * 의존: state.js, managers.js (ChipManager), modal.js (openModal, closeModal)
 */

// ─────────────────────────────────────────────
// 카페 만족/불만족 피드백
// ─────────────────────────────────────────────

/**
 * 결과 카드에서 👍👎 클릭 시 호출
 * 버튼 상태 변경 → 시트2(간단 기록) 저장 → 피드백 모달 오픈(시트1 코멘트 저장)
 * @param {Event}  e            클릭 이벤트
 * @param {HTMLElement} btn     클릭된 버튼
 * @param {string} cafeName     카페 이름
 * @param {string} cafeAddress  카페 주소
 * @param {string} cafeSource   데이터 출처 ('google' | 'naver')
 * @param {string} satisfaction 'good' | 'bad'
 * @param {Array}  keywords     사용된 검색 키워드 (선택)
 */
async function sendCafeFeedback(e, btn, cafeName, cafeAddress, cafeSource, satisfaction, keywords) {
  e.stopPropagation(); // 카드 전체 클릭 방지

  // 이미 투표한 버튼이면 무시
  if (
    btn.classList.contains('voted') ||
    btn.classList.contains('voted-good') ||
    btn.classList.contains('voted-bad')
  ) return;

  const isGood = satisfaction === 'good';

  // 클릭된 버튼에 색상 클래스 추가
  btn.classList.add(isGood ? 'voted-good' : 'voted-bad');

  // 같은 카드의 반대쪽 버튼 비활성화
  const row = btn.closest('.card-action-row');
  if (row) {
    row.querySelectorAll('.card-action-btn[title="좋았어요"], .card-action-btn[title="별로였어요"]')
      .forEach(b => { if (b !== btn) b.classList.add('voted'); });
  }

  // 구글 시트2에 간단 기록 (실패해도 UX에 영향 없게 catch 무시)
  fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'cafe',
      cafeName,
      cafeAddress,
      cafeSource,
      satisfaction,
      keywords: keywords !== undefined
        ? keywords
        : ChipManager.getAllKeywords()
    })
  }).catch(() => {});

  // 피드백 모달 오픈 (코멘트 입력 → 구글 시트1에 추가 저장)
  state.pendingCafeName     = cafeName;
  state.pendingSatisfaction = satisfaction;
  state.pendingKeywords     = keywords !== undefined
    ? keywords
    : ChipManager.getAllKeywords();
  openModal('feedback-modal');
}

/**
 * 저장 목록 모달에서 👍👎 클릭 시 호출
 * data-* 속성에서 값 읽어와 sendCafeFeedback으로 위임
 * @param {Event} e         클릭 이벤트
 * @param {HTMLElement} btn 클릭된 버튼
 */
function sendCafeFeedbackFromSaved(e, btn) {
  const name         = btn.dataset.name;
  const address      = btn.dataset.address;
  const source       = btn.dataset.source;
  const satisfaction = btn.dataset.satisfaction;
  const keywords     = btn.dataset.keywords
    ? btn.dataset.keywords.split(',').filter(Boolean)
    : [];

  sendCafeFeedback(e, btn, name, address, source, satisfaction, keywords);
}

// ─────────────────────────────────────────────
// 별점 이벤트 등록
// ─────────────────────────────────────────────
document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', () => {
    state.feedbackRating = parseInt(star.dataset.v);
    // 선택된 별점 이하는 on, 초과는 off
    document.querySelectorAll('.star').forEach(s => {
      s.classList.toggle('on', parseInt(s.dataset.v) <= state.feedbackRating);
    });
  });
});

// ─────────────────────────────────────────────
// 앱 피드백 제출 (피드백 모달 제출 버튼)
// ─────────────────────────────────────────────

/**
 * 앱 피드백 모달의 "제출할게요" 버튼 클릭 시 호출
 * /api/feedback POST → 구글 시트1에 저장
 */
async function submitFeedback() {
  // 카페 피드백에서 열린 경우 별점 없어도 제출 가능, 앱 피드백은 별점 필수
  if (!state.feedbackRating && !state.pendingCafeName) {
    alert('별점을 선택해줘요!');
    return;
  }

  const btn = document.getElementById('modal-submit');
  btn.disabled = true;
  btn.textContent = '제출 중...';

  await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rating:  state.feedbackRating || '',
      chips: state.pendingCafeName
        ? (state.pendingKeywords || [])  // 카페 피드백에서 열린 경우
        : ChipManager.getAllKeywords(),   // 앱 피드백 버튼에서 열린 경우
      comment: document.getElementById('feedback-comment').value
    })
  }).catch(() => {});

  btn.textContent = '감사해요 🎉';
  setTimeout(() => {
    closeModal('feedback-modal');
    btn.disabled = false;
    btn.textContent = '제출할게요 →';
  }, 1500);
}