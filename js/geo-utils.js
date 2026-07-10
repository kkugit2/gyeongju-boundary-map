/**
 * DOM/카카오맵 SDK에 의존하지 않는 순수 지리 계산/검증 로직 모음.
 *
 * 브라우저(<script> 태그)에서는 `window.GeoUtils`로, Node(node:test)에서는
 * `require('../js/geo-utils.js')`로 동일하게 사용할 수 있도록 UMD 패턴으로 내보낸다.
 * 이 파일의 함수들은 좌표를 항상 { lat, lng } 형태의 순수 객체로 다루며,
 * kakao.maps.LatLng 등 SDK 객체 생성은 호출하는 쪽(js/map-app.js)의 책임이다.
 *
 * 경주시 대략적인 bounding box(안강읍~외동읍~양남면~산내면 등 포함)를 위경도 유효성
 * 검증의 참고 범위로 사용한다. 실제 경주시 행정구역 전체를 넉넉히 포함하도록 잡은
 * 값이며, 정밀한 행정구역 경계 판정용이 아니라 "명백히 엉뚱한 좌표"를 걸러내기 위한
 * 용도이다.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = mod;
  }
  if (typeof root !== "undefined") {
    root.GeoUtils = mod;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  var GYEONGJU_BOUNDS = {
    minLat: 35.6,
    maxLat: 36.15,
    minLng: 128.9,
    maxLng: 129.6,
  };

  function isFiniteNumber(v) {
    return typeof v === "number" && Number.isFinite(v);
  }

  function isValidLatLng(lat, lng) {
    return (
      isFiniteNumber(lat) &&
      isFiniteNumber(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }

  function isWithinGyeongjuBounds(lat, lng) {
    if (!isValidLatLng(lat, lng)) return false;
    return (
      lat >= GYEONGJU_BOUNDS.minLat &&
      lat <= GYEONGJU_BOUNDS.maxLat &&
      lng >= GYEONGJU_BOUNDS.minLng &&
      lng <= GYEONGJU_BOUNDS.maxLng
    );
  }

  /**
   * GeoJSON geometry(Polygon 또는 MultiPolygon)를 { lat, lng } 점 배열들의
   * 목록("paths")으로 변환한다. Polygon은 ring별로, MultiPolygon은 각 하위
   * polygon의 각 ring별로 하나의 path를 생성한다(홀 포함 여부는 구분하지 않음).
   * 반환값: Array<Array<{lat:number, lng:number}>>
   */
  function geometryToPaths(geometry) {
    if (!geometry || !Array.isArray(geometry.coordinates)) return [];

    function ringToPath(ring) {
      return ring
        .filter(function (pt) {
          return Array.isArray(pt) && pt.length >= 2;
        })
        .map(function (pt) {
          return { lat: pt[1], lng: pt[0] };
        });
    }

    if (geometry.type === "Polygon") {
      return geometry.coordinates.map(ringToPath);
    }

    if (geometry.type === "MultiPolygon") {
      var paths = [];
      geometry.coordinates.forEach(function (polygon) {
        polygon.forEach(function (ring) {
          paths.push(ringToPath(ring));
        });
      });
      return paths;
    }

    return [];
  }

  /**
   * 다각형 ring(점 배열)의 중심점(centroid)을 계산한다.
   * 면적 가중 centroid 공식을 사용하며, 면적이 0에 가까운 축퇴 케이스에서는
   * 단순 평균 좌표로 폴백한다.
   */
  function computeRingCentroid(path) {
    if (!Array.isArray(path) || path.length === 0) return null;
    var n = path.length;
    if (n === 1) return { lat: path[0].lat, lng: path[0].lng };

    var area = 0;
    var cx = 0;
    var cy = 0;
    for (var i = 0; i < n; i++) {
      var p0 = path[i];
      var p1 = path[(i + 1) % n];
      var cross = p0.lng * p1.lat - p1.lng * p0.lat;
      area += cross;
      cx += (p0.lng + p1.lng) * cross;
      cy += (p0.lat + p1.lat) * cross;
    }
    area = area / 2;

    if (Math.abs(area) < 1e-12) {
      var avgLat = path.reduce(function (s, p) { return s + p.lat; }, 0) / n;
      var avgLng = path.reduce(function (s, p) { return s + p.lng; }, 0) / n;
      return { lat: avgLat, lng: avgLng };
    }

    return { lat: cy / (6 * area), lng: cx / (6 * area) };
  }

  /**
   * feature의 이름 라벨을 표시할 위치를 결정한다.
   * properties.center([lng, lat])가 유효하면 그것을 사용하고, 없거나 유효하지
   * 않으면 geometry의 첫 번째 path로부터 centroid를 계산해 대체한다.
   */
  function getFeatureLabelPosition(feature) {
    var center = feature && feature.properties && feature.properties.center;
    if (Array.isArray(center) && center.length === 2 && isValidLatLng(center[1], center[0])) {
      return { lat: center[1], lng: center[0] };
    }

    var geometry = feature && feature.geometry;
    var paths = geometryToPaths(geometry);
    if (!paths.length || !paths[0].length) return null;
    return computeRingCentroid(paths[0]);
  }

  /**
   * { lat, lng } 점들의 배열로부터 bounding box를 계산한다.
   */
  function computeBoundingBox(points) {
    if (!Array.isArray(points) || points.length === 0) return null;
    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    points.forEach(function (p) {
      if (!p || !isFiniteNumber(p.lat) || !isFiniteNumber(p.lng)) return;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });
    if (!isFinite(minLat) || !isFinite(minLng)) return null;
    return { minLat: minLat, maxLat: maxLat, minLng: minLng, maxLng: maxLng };
  }

  /**
   * FeatureCollection 전체 geometry로부터 bounding box를 계산한다.
   * (초기 지도 표시 시 전체 경계가 한 화면에 들어오도록 맞추는 데 사용)
   */
  function collectFeatureCollectionBoundingBox(featureCollection) {
    var points = [];
    var features = (featureCollection && featureCollection.features) || [];
    features.forEach(function (feature) {
      var paths = geometryToPaths(feature.geometry);
      paths.forEach(function (path) {
        points.push.apply(points, path);
      });
    });
    return computeBoundingBox(points);
  }

  /**
   * 점이 하나의 ring(폴리곤 외곽선) 내부에 있는지 판정한다 (ray casting 알고리즘).
   * 홀(hole)은 고려하지 않는 단순 판정이며, 행정구역 경계처럼 홀이 없는 폴리곤에
   * 적합하다.
   */
  function isPointInRing(point, ring) {
    if (!Array.isArray(ring) || ring.length < 3) return false;
    var x = point.lng, y = point.lat;
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i].lng, yi = ring[i].lat;
      var xj = ring[j].lng, yj = ring[j].lat;
      var intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * 점이 feature의 geometry(Polygon/MultiPolygon) 내부에 있는지 판정한다.
   * 각 path(외곽선 기준)에 대해 점-내부 판정을 수행하고, 하나라도 포함되면 true.
   */
  function isPointInFeatureGeometry(point, geometry) {
    var paths = geometryToPaths(geometry);
    return paths.some(function (ring) {
      return isPointInRing(point, ring);
    });
  }

  /**
   * 하나의 POI(명소 마커) 데이터가 유효한지 검증한다.
   */
  function validatePOI(poi) {
    var errors = [];
    if (!poi || typeof poi.name !== "string" || poi.name.trim() === "") {
      errors.push("name is required and must be a non-empty string");
    }
    if (!isFiniteNumber(poi && poi.lat) || !isFiniteNumber(poi && poi.lng)) {
      errors.push("lat/lng must be finite numbers");
    } else if (!isWithinGyeongjuBounds(poi.lat, poi.lng)) {
      errors.push("lat/lng must be within Gyeongju bounding box");
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function validatePOIList(list) {
    var errors = [];
    if (!Array.isArray(list) || list.length === 0) {
      return { valid: false, errors: ["POI list must be a non-empty array"] };
    }
    list.forEach(function (poi, idx) {
      var result = validatePOI(poi);
      result.errors.forEach(function (e) {
        errors.push("poi[" + idx + "] (" + (poi && poi.name) + "): " + e);
      });
    });
    return { valid: errors.length === 0, errors: errors };
  }

  /**
   * FeatureCollection 스키마/좌표 유효성을 검증한다.
   */
  function validateFeatureCollection(fc) {
    var errors = [];
    if (!fc || fc.type !== "FeatureCollection") {
      errors.push("type must be FeatureCollection");
    }
    var features = (fc && fc.features) || [];
    if (!Array.isArray(features) || features.length === 0) {
      errors.push("features must be a non-empty array");
    }
    features.forEach(function (feature, idx) {
      var props = feature && feature.properties;
      var name = props && props.name;
      if (!name || typeof name !== "string") {
        errors.push("feature[" + idx + "] missing properties.name");
      }
      var center = props && props.center;
      if (!Array.isArray(center) || center.length !== 2) {
        errors.push("feature[" + idx + "] (" + name + ") missing valid properties.center");
      } else if (!isValidLatLng(center[1], center[0])) {
        errors.push("feature[" + idx + "] (" + name + ") center out of lat/lng range");
      }
      var geometry = feature && feature.geometry;
      if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
        errors.push("feature[" + idx + "] (" + name + ") geometry must be Polygon or MultiPolygon");
      }
    });
    return { valid: errors.length === 0, errors: errors };
  }

  /**
   * 카카오맵 줌 레벨을 [min, max] 범위로 clamp한다.
   * 카카오맵 로드맵 기준 레벨 범위는 1(가장 확대)~14(가장 축소)이다.
   */
  function clampZoomLevel(level, min, max) {
    min = typeof min === "number" ? min : 1;
    max = typeof max === "number" ? max : 14;
    var n = Number(level);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  return {
    GYEONGJU_BOUNDS: GYEONGJU_BOUNDS,
    isFiniteNumber: isFiniteNumber,
    isValidLatLng: isValidLatLng,
    isWithinGyeongjuBounds: isWithinGyeongjuBounds,
    geometryToPaths: geometryToPaths,
    computeRingCentroid: computeRingCentroid,
    getFeatureLabelPosition: getFeatureLabelPosition,
    computeBoundingBox: computeBoundingBox,
    collectFeatureCollectionBoundingBox: collectFeatureCollectionBoundingBox,
    isPointInRing: isPointInRing,
    isPointInFeatureGeometry: isPointInFeatureGeometry,
    validatePOI: validatePOI,
    validatePOIList: validatePOIList,
    validateFeatureCollection: validateFeatureCollection,
    clampZoomLevel: clampZoomLevel,
  };
});
