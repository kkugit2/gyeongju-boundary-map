/**
 * 카카오맵 JavaScript SDK 앱키 설정.
 *
 * 카카오맵 JS 앱키는 카카오 디벨로퍼스 콘솔에 등록된 서비스 도메인(화이트리스트) 기반으로
 * 보안이 관리되므로, 클라이언트(브라우저) 코드에 그대로 노출하는 것이 정상적인 사용 방식이다.
 * REST API 키(kakao_map_REST_APIkey)는 서버/개발 시점 전용이며 이 파일이나 다른 런타임
 * 코드에 절대 포함하지 않는다.
 *
 * 브라우저(<script> 태그)와 Node(node:test) 양쪽에서 동일하게 사용할 수 있도록
 * UMD 패턴으로 내보낸다.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = mod;
  }
  if (typeof root !== "undefined") {
    root.KAKAO_JS_APP_KEY = mod.KAKAO_JS_APP_KEY;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  return {
    KAKAO_JS_APP_KEY: "192353dfcbd4f411874129bdcea63fd7",
  };
});
