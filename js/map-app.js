/**
 * 경주시 행정구역 경계 지도 웹앱 - 메인 로직.
 * 카카오맵 SDK/DOM에 의존하는 코드는 이 파일에만 둔다.
 * 순수 좌표 계산/검증 로직은 js/geo-utils.js(GeoUtils)를, 마커 데이터는
 * js/poi-data.js(POI_MARKERS)를, 앱키는 js/config.js(KAKAO_JS_APP_KEY)를 사용한다.
 */
(function () {
  "use strict";

  var GEOJSON_URL = "data/gyeongju_dong_boundaries.geojson";
  var MIN_ZOOM_LEVEL = 1;
  var MAX_ZOOM_LEVEL = 14;
  var DEFAULT_CENTER = { lat: 35.8562, lng: 129.2247 }; // 경주시 대략적 중심 (fallback)
  var DEFAULT_LEVEL = 9;

  function loadKakaoSdk(appKey, onReady) {
    var existing = document.querySelector("script[data-kakao-sdk]");
    if (existing) {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(onReady);
      } else {
        existing.addEventListener("load", function () {
          window.kakao.maps.load(onReady);
        });
      }
      return;
    }

    var script = document.createElement("script");
    script.setAttribute("data-kakao-sdk", "true");
    script.src =
      "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" +
      encodeURIComponent(appKey) +
      "&autoload=false";
    script.onload = function () {
      window.kakao.maps.load(onReady);
    };
    script.onerror = function () {
      console.error(
        "카카오맵 SDK 로드에 실패했습니다. js/config.js의 KAKAO_JS_APP_KEY와 " +
          "카카오 디벨로퍼스 콘솔의 도메인 등록 상태를 확인하세요."
      );
    };
    document.head.appendChild(script);
  }

  function createMap() {
    var container = document.getElementById("map");
    var options = {
      center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      level: DEFAULT_LEVEL,
    };
    return new kakao.maps.Map(container, options);
  }

  function setupZoomControls(map) {
    var slider = document.getElementById("zoom-slider");
    var zoomInBtn = document.getElementById("zoom-in-btn");
    var zoomOutBtn = document.getElementById("zoom-out-btn");

    slider.min = String(MIN_ZOOM_LEVEL);
    slider.max = String(MAX_ZOOM_LEVEL);
    slider.value = String(map.getLevel());

    function applyLevel(level) {
      var clamped = window.GeoUtils.clampZoomLevel(level, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
      map.setLevel(clamped);
    }

    zoomInBtn.addEventListener("click", function () {
      applyLevel(map.getLevel() - 1);
    });

    zoomOutBtn.addEventListener("click", function () {
      applyLevel(map.getLevel() + 1);
    });

    slider.addEventListener("input", function () {
      applyLevel(slider.value);
    });

    kakao.maps.event.addListener(map, "zoom_changed", function () {
      slider.value = String(map.getLevel());
    });
  }

  function renderBoundaries(map, featureCollection) {
    var validation = window.GeoUtils.validateFeatureCollection(featureCollection);
    if (!validation.valid) {
      console.warn("gyeongju_dong_boundaries.geojson 유효성 검증 경고:", validation.errors);
    }

    var features = (featureCollection && featureCollection.features) || [];
    var allPoints = [];

    features.forEach(function (feature) {
      var paths = window.GeoUtils.geometryToPaths(feature.geometry);
      if (!paths.length) return;

      var kakaoPaths = paths.map(function (path) {
        return path.map(function (pt) {
          allPoints.push(pt);
          return new kakao.maps.LatLng(pt.lat, pt.lng);
        });
      });

      new kakao.maps.Polygon({
        map: map,
        path: kakaoPaths,
        strokeWeight: 2,
        strokeColor: "#004c80",
        strokeOpacity: 0.8,
        strokeStyle: "solid",
        fillColor: "#00a0e9",
        fillOpacity: 0.15,
      });

      var labelPos = window.GeoUtils.getFeatureLabelPosition(feature);
      if (labelPos) {
        var content = document.createElement("div");
        content.className = "region-label";
        content.textContent = feature.properties.name;

        new kakao.maps.CustomOverlay({
          map: map,
          position: new kakao.maps.LatLng(labelPos.lat, labelPos.lng),
          content: content,
          yAnchor: 0.5,
        });
      }
    });

    if (allPoints.length) {
      var bounds = new kakao.maps.LatLngBounds();
      allPoints.forEach(function (pt) {
        bounds.extend(new kakao.maps.LatLng(pt.lat, pt.lng));
      });
      map.setBounds(bounds);
    }
  }

  function renderPoiMarkers(map) {
    var pois = window.POI_MARKERS || [];
    var infoWindow = new kakao.maps.InfoWindow({ removable: true });

    pois.forEach(function (poi) {
      var validation = window.GeoUtils.validatePOI(poi);
      if (!validation.valid) {
        console.warn("잘못된 POI 데이터 건너뜀:", poi, validation.errors);
        return;
      }

      var position = new kakao.maps.LatLng(poi.lat, poi.lng);
      var marker = new kakao.maps.Marker({ map: map, position: position, title: poi.name });

      kakao.maps.event.addListener(marker, "click", function () {
        infoWindow.setContent(
          '<div style="padding:6px 10px;font-size:13px;white-space:nowrap;">' +
            "<strong>" + poi.name + "</strong>" +
            (poi.description ? "<br>" + poi.description : "") +
            "</div>"
        );
        infoWindow.open(map, marker);
      });
    });
  }

  function initApp() {
    var map = createMap();
    setupZoomControls(map);
    renderPoiMarkers(map);

    fetch(GEOJSON_URL)
      .then(function (res) {
        if (!res.ok) {
          throw new Error("failed to fetch " + GEOJSON_URL + ": " + res.status);
        }
        return res.json();
      })
      .then(function (featureCollection) {
        renderBoundaries(map, featureCollection);
      })
      .catch(function (err) {
        console.error("행정구역 경계 데이터를 불러오지 못했습니다.", err);
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.KAKAO_JS_APP_KEY) {
      console.error("js/config.js에 KAKAO_JS_APP_KEY가 설정되어 있지 않습니다.");
      return;
    }
    loadKakaoSdk(window.KAKAO_JS_APP_KEY, initApp);
  });
})();
