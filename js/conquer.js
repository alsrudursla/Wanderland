/**
 * conquer.js
 * 카페 정복 기능 (ConquerManager)
 * 현재: 콘솔 확인용 스텁 (Supabase 연동 전)
 * TODO: Supabase 연동 후 실제 저장 로직으로 교체
 * 의존: state.js
 */

const ConquerManager = {
  /**
   * 카페 정복 처리
   * 코멘트/태그 입력받고 Supabase에 저장 (현재는 콘솔 출력만)
   * @param {Event}  event   클릭 이벤트 (카드 전체 클릭 방지용)
   * @param {string} name    카페 이름
   * @param {string} address 카페 주소
   * @param {number} lat     위도
   * @param {number} lng     경도
   */
  conquer(event, name, address, lat, lng) {
    event.stopPropagation(); // 카드 전체 onclick(구글맵 열기)이 함께 실행되지 않도록 차단

    // TODO: prompt 대신 모달로 입력받도록 개선 예정
    const comment  = prompt(`"${name}" 한 줄로 어땠어요? (선택)`) || '';
    const tagsInput = prompt('태그 (쉼표로 구분, 예: 조용함, 콘센트많음)') || '';
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    // ── Supabase 연동 전 임시: 콘솔에만 출력 ──
    // 연동 후 아래 console.log를 supabase.from('conquests').insert({...})로 교체
    console.log('정복 기록 (Supabase 연동 전):', { name, address, lat, lng, comment, tags });

    alert('🚩 정복 완료!');

    // ── 추후 Supabase 연동 시 사용할 코드 (주석 해제) ──
    // const deviceId = getOrCreateDeviceId();
    // await supabase.from('conquests').insert({
    //   device_id:    deviceId,
    //   name,
    //   address,
    //   lat,
    //   lng,
    //   comment,
    //   tags,
    //   conquered_at: new Date().toISOString()
    // });
  }
};