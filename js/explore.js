/**
 * explore.js
 * 탐험 페이지(explore.html) 전용 스크립트
 * 비행기 버튼 클릭 시 홈(index.html)으로 복귀
 * 추후: Supabase에서 정복 데이터 가져와 Leaflet 지도에 마커/영역 표시 예정
 */

// ─────────────────────────────────────────────
// 비행기 버튼: 탐험 → 홈으로 복귀
// ─────────────────────────────────────────────
document.getElementById('plane-back').addEventListener('click', (e) => {
  document.getElementById('hint-back').classList.add('hidden'); // 힌트 텍스트 숨기기
  e.currentTarget.classList.add('flying-left');                 // 왼쪽으로 날아가는 애니메이션
  setTimeout(() => { location.href = '/index.html'; }, 1600);  // 애니메이션 끝나면 이동
});

// ─────────────────────────────────────────────
// TODO: Supabase 연동 후 추가 예정
// ─────────────────────────────────────────────
// 1. Supabase에서 내 정복 목록 가져오기
//    const { data } = await supabase.from('conquests').select('*').eq('device_id', getDeviceId());
//
// 2. Leaflet 지도에 마커 + 정복 영역(원) 표시
//    data.forEach(({ name, lat, lng, comment, tags }) => {
//      L.marker([lat, lng]).addTo(map).bindPopup(`🚩 ${name}<br>${comment}`);
//      L.circle([lat, lng], { radius: 150, color: '#e8895a', fillOpacity: 0.4 }).addTo(map);
//    });