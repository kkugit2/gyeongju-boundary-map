/**
 * 경주시 주요 명소 마커 데이터.
 *
 * 좌표는 런타임에 카카오 장소검색(Keyword) API를 호출하지 않고, 개발 시점에
 * 카카오 로컬 키워드 검색 API(dapi.kakao.com/v2/local/search/keyword.json)로 직접
 * 조회하여 확인한 값을 고정 상수로 포함한다.
 *
 * 특히 '경주역'은 과거 시내(황남동 인근)에 있던 구 역사가 2021년 폐역되고 동해선
 * 복선전철화에 따라 현재 건천읍의 역사로 이전되었으므로, 카카오 로컬 API 조회 결과
 * 중 "교통,수송 > 기차,철도 > 기차역 > KTX,SRT정차역" 카테고리로 확인되는 현재
 * 운영 중인 역(경북 경주시 건천읍 경주역로 80)의 좌표를 사용한다.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = mod;
  }
  if (typeof root !== "undefined") {
    root.POI_MARKERS = mod;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  return [
    {
      name: "경주역",
      lat: 35.798377,
      lng: 129.138999,
      description: "현재 운영 중인 경주역 (건천읍, KTX·SRT 정차역)",
    },
    {
      name: "황리단길",
      lat: 35.839335,
      lng: 129.209645,
      description: "황남동 카페거리",
    },
    {
      name: "경주월드",
      lat: 35.836253,
      lng: 129.282066,
      description: "보문 관광단지 테마파크",
    },
    {
      name: "석굴암",
      lat: 35.795242,
      lng: 129.350521,
      description: "토함산 소재 사찰·석굴 (유네스코 세계유산)",
    },
  ];
});
