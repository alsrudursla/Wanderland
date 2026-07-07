/**
 * managers.js
 * 칩(ChipManager), 버블(BubbleManager),
 * 카페 저장(SaveManager), 위치 선택(LocationManager) 관리
 * 의존: state.js
 */

// ─────────────────────────────────────────────
// ChipManager: 칩 선택/추가/삭제 관리
// ─────────────────────────────────────────────
const ChipManager = {
  /** 기본 칩(타입/편의시설) 토글 이벤트 및 키워드 입력 엔터 이벤트 등록 */
  init() {
    // 기본 칩 클릭 시 on/off 토글
    document.querySelectorAll('#type-chips .chip, #feature-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('on'));
    });

    // 키워드 입력창 엔터키로 추가
    document.getElementById('keyword-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.addCustom();
    });
  },

  /**
   * 특정 칩 그룹에서 선택된(on) 칩의 data-value 배열 반환
   * @param {string} groupId 칩 컨테이너 id
   */
  getSelected(groupId) {
    return [...document.querySelectorAll(`#${groupId} .chip.on`)].map(c => c.dataset.value);
  },

  /** 입력창 값을 읽어서 커스텀 칩 추가 (+ 버튼 / 엔터 클릭 시 호출) */
  addCustom() {
    const input = document.getElementById('keyword-input');
    const val = input.value.trim();
    this.addKeyword(val);
    input.value = '';
  },

  /**
   * 값을 직접 받아서 커스텀 칩으로 추가
   * 버블 클릭 등 외부에서도 재사용 가능
   * @param {string} val 추가할 키워드
   */
  addKeyword(val) {
    if (!val || state.customChips.includes(val)) return;

    state.customChips.push(val);

    const chip = document.createElement('span');
    chip.className = 'chip on accent';
    chip.dataset.value = val;
    chip.innerHTML = `${val} <span class="chip-remove" onclick="ChipManager.removeCustom('${val}', this.parentElement)">✕</span>`;
    document.getElementById('custom-chips').appendChild(chip);
  },

  /**
   * 커스텀 칩 삭제
   * @param {string} val 삭제할 키워드
   * @param {HTMLElement} el 삭제할 칩 요소
   */
  removeCustom(val, el) {
    state.customChips = state.customChips.filter(v => v !== val);
    el.remove();
  },

  /** 현재 선택된 모든 키워드 반환 (기본 타입 + 편의시설 + 커스텀) */
  getAllKeywords() {
    return [
      ...this.getSelected('type-chips'),
      ...this.getSelected('feature-chips'),
      ...state.customChips
    ];
  }
};

// + 버튼 클릭 시 커스텀 칩 추가 (HTML onclick에서 호출)
function addCustomChip() { ChipManager.addCustom(); }

// ─────────────────────────────────────────────
// BubbleManager: 인기 디저트 키워드 버블 생성/클릭 처리
// ─────────────────────────────────────────────
const BubbleManager = {
  // v1: 직접 큐레이션한 인기 디저트 키워드
  // 추후 Redis 집계 데이터 기반 top-N으로 교체 예정
  keywords: [
    '딸기', '생크림', '말차', '크로플', '시그니처 라떼',
    '인절미', '바스크 치즈케이크', '마들렌', '소금빵', '쑥떡',
    '아이스크림', '흑임자', '스콘', '아인슈페너', '에그타르트'
  ],

  /** 좌우 버블 영역 초기화 — 영역당 5개 버블 생성 */
  init() {
    const zones = [
      document.getElementById('bubble-left'),
      document.getElementById('bubble-right')
    ];
    zones.forEach(zone => {
      for (let i = 0; i < 5; i++) this.spawnBubble(zone);
    });
  },

  /**
   * 버블 하나 생성해서 zone에 추가
   * 위치/속도/딜레이는 랜덤으로 자연스럽게 흩어지게
   * @param {HTMLElement} zone 버블을 넣을 컨테이너
   */
  spawnBubble(zone) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = this.keywords[Math.floor(Math.random() * this.keywords.length)];

    bubble.style.left            = `${Math.random() * 60}px`;
    bubble.style.animationDuration = `${8 + Math.random() * 6}s`;
    bubble.style.animationDelay  = `-${Math.random() * 10}s`; // 처음부터 제각각 위치에

    bubble.addEventListener('click', () => this.popBubble(bubble, zone));
    zone.appendChild(bubble);
  },

  /**
   * 버블 클릭 시 터지는 효과 + 칩으로 변환
   * 터진 버블 제거 후 같은 zone에 새 버블 보충
   * @param {HTMLElement} bubble 클릭된 버블 요소
   * @param {HTMLElement} zone 버블 컨테이너
   */
  popBubble(bubble, zone) {
    const keyword = bubble.textContent;
    bubble.classList.add('pop');
    ChipManager.addKeyword(keyword); // 클릭 키워드 → 칩으로 추가

    setTimeout(() => {
      bubble.remove();
      this.spawnBubble(zone); // 개수 유지를 위해 새 버블 보충
    }, 250);
  }
};

// ─────────────────────────────────────────────
// SaveManager: 카페 저장/삭제 (로컬스토리지)
// ─────────────────────────────────────────────
const SaveManager = {
  KEY: 'wanderland_saved', // localStorage 키

  /** 저장된 카페 목록 전체 반환 */
  getAll() {
    return JSON.parse(localStorage.getItem(this.KEY) || '[]');
  },

  /**
   * 카페 저장 (중복이면 저장 안 함)
   * @param {Object} place 저장할 카페 정보 (name, address, url, source, keywords, lat, lng)
   * @returns {boolean} 저장 성공 여부
   */
  save(place) {
    const list = this.getAll();
    const exists = list.some(p => p.name === place.name && p.address === place.address);
    if (exists) return false;

    list.unshift({ // 최신 항목이 맨 위로
      name:     place.name,
      address:  place.address,
      url:      place.url,
      source:   place.source,
      keywords: place.keywords || [],
      lat:      place.lat,      // 정복 버튼에서 사용
      lng:      place.lng,
      savedAt:  new Date().toISOString()
    });
    localStorage.setItem(this.KEY, JSON.stringify(list));
    return true;
  },

  /**
   * 카페 삭제 (이름+주소로 식별)
   * @param {string} name 카페 이름
   * @param {string} address 카페 주소
   */
  remove(name, address) {
    const list = this.getAll().filter(
      p => !(p.name === name && p.address === address)
    );
    localStorage.setItem(this.KEY, JSON.stringify(list));
  },

  /**
   * 특정 카페 저장 여부 확인
   * @param {string} name 카페 이름
   * @param {string} address 카페 주소
   * @returns {boolean}
   */
  isSaved(name, address) {
    return this.getAll().some(p => p.name === name && p.address === address);
  },

  /** 저장한 카페 모달 렌더링 */
  renderModal() {
    const list = this.getAll();
    const container = document.getElementById('saved-list');

    if (!list.length) {
      container.innerHTML = '<p style="font-size:13px; color:var(--ink-faint)">아직 저장한 카페가 없어요</p>';
      return;
    }

    container.innerHTML = list.map(p => `
      <div class="saved-item" style="flex-direction:column; align-items:flex-start; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div>
            <div class="saved-item-name">${p.name}</div>
            <div style="font-size:11px; color:var(--ink-faint)">${p.address}</div>
            ${p.keywords?.length ? `
              <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                ${p.keywords.map(k => `<span class="tag">${k}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <a href="${p.url}" target="_blank" style="font-size:11px; color:var(--ink-faint); text-decoration:none;">지도 →</a>
            <button class="saved-delete-btn" onclick="SaveManager.remove('${p.name.replace(/'/g,"\\'")}', '${p.address.replace(/'/g,"\\'")}'); SaveManager.renderModal();">삭제</button>
          </div>
        </div>
        <div class="card-action-row" style="width:100%; justify-content:flex-start;">
          <button
            class="card-action-btn"
            title="좋았어요"
            data-name="${p.name.replace(/"/g,'&quot;')}"
            data-address="${p.address.replace(/"/g,'&quot;')}"
            data-source="${p.source}"
            data-keywords="${(p.keywords || []).join(',')}"
            data-satisfaction="good"
            onclick="sendCafeFeedbackFromSaved(event, this)"
          >👍</button>
          <button
            class="card-action-btn"
            title="별로였어요"
            data-name="${p.name.replace(/"/g,'&quot;')}"
            data-address="${p.address.replace(/"/g,'&quot;')}"
            data-source="${p.source}"
            data-keywords="${(p.keywords || []).join(',')}"
            data-satisfaction="bad"
            onclick="sendCafeFeedbackFromSaved(event, this)"
          >👎</button>
          <button
            class="card-action-btn conquer-btn"
            title="정복하기"
            onclick="ConquerManager.conquer(event, '${p.name.replace(/'/g,"\\'")}', '${p.address.replace(/'/g,"\\'")}', ${p.lat || 0}, ${p.lng || 0})"
          >🚩</button>
          <span style="font-size:11px; color:var(--ink-faint); margin-left:4px;">다녀오셨나요?</span>
        </div>
      </div>
    `).join('');
  }
};

// ─────────────────────────────────────────────
// LocationManager: 위치 선택 관리 (GPS + 카카오맵 핀)
// ─────────────────────────────────────────────
const LocationManager = {
  map:    null, // 카카오맵 인스턴스
  marker: null, // 현재 선택된 핀 마커
  lat:    null, // 선택된 위도
  lng:    null, // 선택된 경도

  /** 위치 선택 모달이 열릴 때 카카오 지도 초기화 (최초 1회만 실행) */
  initMap() {
    if (this.map) return; // 이미 초기화됐으면 스킵

    const center = new kakao.maps.LatLng(
      state.userLat || 37.5665, // GPS 위치 없으면 서울 시청 기본값
      state.userLng || 126.9780
    );
    this.map = new kakao.maps.Map(
      document.getElementById('kakao-map'),
      { center, level: 4 }
    );

    // 타일 로드 완료 시 로딩 인디케이터 숨기기
    kakao.maps.event.addListener(this.map, 'tilesloaded', () => {
      const loading = document.getElementById('map-loading');
      if (loading) loading.style.display = 'none';
    });

    // 지도 클릭 시 핀 설정
    kakao.maps.event.addListener(this.map, 'click', e => {
      this.setPin(e.latLng.getLat(), e.latLng.getLng());
    });

    // 현재 GPS 위치에 기본 핀 표시
    if (state.userLat) this.setPin(state.userLat, state.userLng);
  },

  /**
   * 지도에 핀 설정 (이미 있으면 이동, 없으면 새로 생성)
   * @param {number} lat 위도
   * @param {number} lng 경도
   */
  setPin(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    const pos = new kakao.maps.LatLng(lat, lng);
    if (this.marker) {
      this.marker.setPosition(pos);
    } else {
      this.marker = new kakao.maps.Marker({ position: pos, map: this.map });
    }
    this.map.panTo(pos);
  },

  /** 주소 검색 → 핀 이동 (/api/search?geocode= 활용) */
  async search() {
    const query = document.getElementById('location-search-input').value.trim();
    if (!query) return;

    const loading = document.getElementById('map-loading');
    if (loading) loading.style.display = 'flex';

    const res  = await fetch(`/api/search?geocode=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.lat) {
      this.setPin(data.lat, data.lng);
    } else {
      alert('주소를 찾지 못했어요');
    }
  },

  /** 핀 위치를 최종 검색 위치로 확정하고 모달 닫기 */
  confirm() {
    if (!this.lat) { alert('지도를 클릭해서 위치를 선택해줘요!'); return; }

    state.selectedLat = this.lat;
    state.selectedLng = this.lng;
    state.usingCustomLocation = true;

    document.getElementById('location-display').textContent =
      `📍 ${state.selectedAddr || '선택한 위치'}로 검색`;

    // 역지오코딩으로 선택한 위치의 실제 주소 가져오기
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2Address(this.lng, this.lat, (result, status) => {
      if (status === kakao.maps.services.Status.OK) {
        const addr = result[0].road_address?.address_name
          || result[0].address?.address_name || '';
        state.selectedAddr = addr;
        document.getElementById('location-display').textContent =
          `📍 ${addr}으로 검색`;
      }
    });

    closeModal('location-modal');
  }
};