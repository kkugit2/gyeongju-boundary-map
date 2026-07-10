"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const GeoUtils = require("../js/geo-utils.js");
const POI_MARKERS = require("../js/poi-data.js");
const config = require("../js/config.js");

const GEOJSON_PATH = path.join(__dirname, "..", "data", "gyeongju_dong_boundaries.geojson");

function loadRealFeatureCollection() {
  const raw = fs.readFileSync(GEOJSON_PATH, "utf-8");
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// P0: 카카오맵 기본 지도 표시 (앱키 설정 확인)
// ---------------------------------------------------------------------------
test("config.js: KAKAO_JS_APP_KEY가 유효한 문자열로 설정되어 있다", () => {
  assert.equal(typeof config.KAKAO_JS_APP_KEY, "string");
  assert.ok(config.KAKAO_JS_APP_KEY.trim().length > 0);
  assert.notEqual(config.KAKAO_JS_APP_KEY, "??");
});

// ---------------------------------------------------------------------------
// P0: 행정구역 경계 폴리곤 표시
// ---------------------------------------------------------------------------
test("geometryToPaths: Polygon geometry를 {lat,lng} 경로 배열로 변환한다", () => {
  const geometry = {
    type: "Polygon",
    coordinates: [
      [
        [129.0, 35.0],
        [129.1, 35.0],
        [129.1, 35.1],
        [129.0, 35.1],
        [129.0, 35.0],
      ],
    ],
  };
  const paths = GeoUtils.geometryToPaths(geometry);
  assert.equal(paths.length, 1);
  assert.equal(paths[0].length, 5);
  assert.deepEqual(paths[0][0], { lat: 35.0, lng: 129.0 });
});

test("geometryToPaths: MultiPolygon geometry의 모든 ring을 path로 변환한다", () => {
  const geometry = {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [129.0, 35.0],
          [129.1, 35.0],
          [129.1, 35.1],
          [129.0, 35.0],
        ],
      ],
      [
        [
          [130.0, 36.0],
          [130.1, 36.0],
          [130.1, 36.1],
          [130.0, 36.0],
        ],
      ],
    ],
  };
  const paths = GeoUtils.geometryToPaths(geometry);
  assert.equal(paths.length, 2);
  assert.equal(paths[0].length, 4);
  assert.equal(paths[1].length, 4);
});

test("data/gyeongju_dong_boundaries.geojson: 실제 경계 데이터가 스키마 유효성 검증을 통과한다", () => {
  const fc = loadRealFeatureCollection();
  const result = GeoUtils.validateFeatureCollection(fc);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
  assert.equal(fc.features.length, 22);
});

test("data/gyeongju_dong_boundaries.geojson: 모든 feature가 비어있지 않은 경로로 변환된다", () => {
  const fc = loadRealFeatureCollection();
  fc.features.forEach((feature) => {
    const paths = GeoUtils.geometryToPaths(feature.geometry);
    assert.ok(paths.length > 0, `${feature.properties.name}의 path가 비어있음`);
    assert.ok(paths[0].length > 0, `${feature.properties.name}의 첫 path가 비어있음`);
  });
});

test("validateFeatureCollection: 스키마가 잘못된 데이터는 오류를 반환한다", () => {
  const badFc = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "" },
        geometry: { type: "Point", coordinates: [129.0, 35.0] },
      },
    ],
  };
  const result = GeoUtils.validateFeatureCollection(badFc);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

// ---------------------------------------------------------------------------
// P0: 행정구역 이름 라벨 표시
// ---------------------------------------------------------------------------
test("getFeatureLabelPosition: properties.center가 있으면 [lng,lat]을 {lat,lng}로 변환해 반환한다", () => {
  const feature = {
    properties: { name: "황남동", center: [129.2117, 35.8358] },
    geometry: { type: "Polygon", coordinates: [[[129.2, 35.8], [129.22, 35.8], [129.21, 35.85], [129.2, 35.8]]] },
  };
  const pos = GeoUtils.getFeatureLabelPosition(feature);
  assert.deepEqual(pos, { lat: 35.8358, lng: 129.2117 });
});

test("getFeatureLabelPosition: center가 없으면 geometry로부터 centroid를 계산해 반환한다", () => {
  const feature = {
    properties: { name: "테스트동" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [129.0, 35.0],
          [129.2, 35.0],
          [129.2, 35.2],
          [129.0, 35.2],
          [129.0, 35.0],
        ],
      ],
    },
  };
  const pos = GeoUtils.getFeatureLabelPosition(feature);
  assert.ok(pos);
  assert.ok(Math.abs(pos.lat - 35.1) < 1e-9);
  assert.ok(Math.abs(pos.lng - 129.1) < 1e-9);
});

test("computeRingCentroid: 정사각형 ring의 중심을 정확히 계산한다", () => {
  const ring = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 2 },
    { lat: 2, lng: 2 },
    { lat: 2, lng: 0 },
  ];
  const centroid = GeoUtils.computeRingCentroid(ring);
  assert.ok(Math.abs(centroid.lat - 1) < 1e-9);
  assert.ok(Math.abs(centroid.lng - 1) < 1e-9);
});

test("data/gyeongju_dong_boundaries.geojson: 모든 feature의 라벨 위치를 계산할 수 있다", () => {
  const fc = loadRealFeatureCollection();
  fc.features.forEach((feature) => {
    const pos = GeoUtils.getFeatureLabelPosition(feature);
    assert.ok(pos, `${feature.properties.name}의 라벨 위치를 계산하지 못함`);
    assert.ok(GeoUtils.isWithinGyeongjuBounds(pos.lat, pos.lng), `${feature.properties.name} 라벨 위치가 경주시 범위를 벗어남`);
  });
});

// ---------------------------------------------------------------------------
// P0: 지도 확대/축소 컨트롤
// ---------------------------------------------------------------------------
test("clampZoomLevel: 범위를 벗어난 값은 min/max로 clamp된다", () => {
  assert.equal(GeoUtils.clampZoomLevel(0, 1, 14), 1);
  assert.equal(GeoUtils.clampZoomLevel(20, 1, 14), 14);
  assert.equal(GeoUtils.clampZoomLevel(7, 1, 14), 7);
});

test("clampZoomLevel: 숫자가 아닌 값은 min으로 폴백된다", () => {
  assert.equal(GeoUtils.clampZoomLevel(NaN, 1, 14), 1);
  assert.equal(GeoUtils.clampZoomLevel(undefined, 1, 14), 1);
});

// ---------------------------------------------------------------------------
// P0: 주요 명소 마커 표시
// ---------------------------------------------------------------------------
test("POI_MARKERS: 경주역/황리단길/경주월드/석굴암 4곳이 정확히 정의되어 있다", () => {
  assert.equal(POI_MARKERS.length, 4);
  const names = POI_MARKERS.map((p) => p.name).sort();
  assert.deepEqual(names, ["경주월드", "경주역", "석굴암", "황리단길"].sort());
});

test("POI_MARKERS: 모든 마커 좌표가 유효하고 경주시 범위 내에 있다", () => {
  const result = GeoUtils.validatePOIList(POI_MARKERS);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test("POI_MARKERS: 경주역 좌표는 건천읍 행정구역 폴리곤 내부에 위치한다 (구 역사와 혼동 방지)", () => {
  const fc = loadRealFeatureCollection();
  const geoncheonFeature = fc.features.find((f) => f.properties.name === "건천읍");
  assert.ok(geoncheonFeature, "건천읍 feature를 찾을 수 없음");

  const gyeongjuStation = POI_MARKERS.find((p) => p.name === "경주역");
  assert.ok(gyeongjuStation, "경주역 POI를 찾을 수 없음");

  const isInside = GeoUtils.isPointInFeatureGeometry(
    { lat: gyeongjuStation.lat, lng: gyeongjuStation.lng },
    geoncheonFeature.geometry
  );
  assert.equal(isInside, true, "경주역 좌표가 건천읍 폴리곤 내부에 있지 않음 (현재 운영 중인 역 위치와 다를 수 있음)");
});

test("validatePOI: 경주시 범위를 벗어난 좌표는 무효로 판정한다", () => {
  const result = GeoUtils.validatePOI({ name: "서울역", lat: 37.5547, lng: 126.9707 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("validatePOI: 이름이 없는 마커는 무효로 판정한다", () => {
  const result = GeoUtils.validatePOI({ name: "", lat: 35.8, lng: 129.2 });
  assert.equal(result.valid, false);
});

// ---------------------------------------------------------------------------
// 지도 초기 표시(전체 경계 bounds 계산)를 위한 보조 로직
// ---------------------------------------------------------------------------
test("collectFeatureCollectionBoundingBox: 실제 데이터의 bounding box가 경주시 범위 내에 있다", () => {
  const fc = loadRealFeatureCollection();
  const bbox = GeoUtils.collectFeatureCollectionBoundingBox(fc);
  assert.ok(bbox);
  assert.ok(GeoUtils.isWithinGyeongjuBounds(bbox.minLat, bbox.minLng));
  assert.ok(GeoUtils.isWithinGyeongjuBounds(bbox.maxLat, bbox.maxLng));
  assert.ok(bbox.minLat < bbox.maxLat);
  assert.ok(bbox.minLng < bbox.maxLng);
});

test("isPointInRing: 사각형 내부/외부 점을 올바르게 판정한다", () => {
  const ring = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 2 },
    { lat: 2, lng: 2 },
    { lat: 2, lng: 0 },
  ];
  assert.equal(GeoUtils.isPointInRing({ lat: 1, lng: 1 }, ring), true);
  assert.equal(GeoUtils.isPointInRing({ lat: 5, lng: 5 }, ring), false);
});
