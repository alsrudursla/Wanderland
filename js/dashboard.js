/**
 * dashboard.js
 * 대시보드 페이지(dashboard.html) 전용 스크립트
 * /api/feedback-data 에서 피드백 통계를 가져와 렌더링
 * 의존: 없음 (독립적으로 동작)
 */

// ─────────────────────────────────────────────
// DashboardRenderer: 대시보드 UI 렌더링
// ─────────────────────────────────────────────
class DashboardRenderer {
  /**
   * @param {Object} data API 응답 데이터
   * @param {number} data.total            전체 피드백 수
   * @param {string} data.averageRating    평균 별점
   * @param {Array}  data.recentComments   최근 코멘트 목록
   * @param {Array}  data.keywordStats     키워드별 검색 횟수 목록
   */
  constructor(data) {
    this.data = data;
  }

  /** 총 피드백 수 + 평균 별점 카드 렌더링 */
  renderSummary() {
    document.getElementById('total-count').textContent = this.data.total;
    document.getElementById('avg-rating').textContent  =
      this.data.total > 0 ? `⭐ ${this.data.averageRating}` : '-';
    document.getElementById('card-summary').style.display = '';
  }

  /**
   * Redis 키워드 카운터 기반 바 차트 렌더링
   * 가장 많이 검색된 키워드를 최대 10개까지 표시
   */
  renderKeywordStats() {
    const list  = document.getElementById('keyword-bar-list');
    const stats = this.data.keywordStats || [];

    if (!stats.length) {
      list.innerHTML = '<p class="empty">아직 검색 데이터가 없어요</p>';
      document.getElementById('card-keywords').style.display = '';
      return;
    }

    const max = stats[0].count; // 가장 많은 수 = 100% 기준

    list.innerHTML = stats.slice(0, 10).map(({ keyword, count }) => `
      <div class="bar-item">
        <div class="bar-label">
          <span>${keyword.replace(/ 카페$/, '')}</span>
          <span>${count}회</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(count / max * 100).toFixed(1)}%"></div>
        </div>
      </div>
    `).join('');

    document.getElementById('card-keywords').style.display = '';
  }

  /**
   * 최근 코멘트 목록 렌더링
   * 구글 시트1에서 가져온 앱 피드백 코멘트만 표시
   */
  renderComments() {
    const list     = document.getElementById('comment-list');
    const comments = this.data.recentComments || [];

    if (!comments.length) {
      list.innerHTML = '<p class="empty">아직 코멘트가 없어요</p>';
      document.getElementById('card-comments').style.display = '';
      return;
    }

    list.innerHTML = comments.map(({ timestamp, rating, comment }) => `
      <div class="comment-item">
        <div class="comment-rating">${'⭐'.repeat(parseInt(rating) || 0)}</div>
        <div class="comment-text">${comment}</div>
        <div class="comment-time">${timestamp}</div>
      </div>
    `).join('');

    document.getElementById('card-comments').style.display = '';
  }

  /** 전체 렌더링 실행 */
  render() {
    this.renderSummary();
    this.renderKeywordStats();
    this.renderComments();
  }
}

// ─────────────────────────────────────────────
// 데이터 로드 및 렌더링 시작
// ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    const res  = await fetch('/api/feedback-data');
    const data = await res.json();
    document.getElementById('loading-text').style.display = 'none';
    new DashboardRenderer(data).render();
  } catch {
    document.getElementById('loading-text').textContent = '데이터를 불러오지 못했어요 😢';
  }
}

loadDashboard();