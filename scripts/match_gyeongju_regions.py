"""
경상북도 행정구역 폴리곤(EPSG:5186, 이름 없음)을 카카오 로컬 REST API로
행정구역명과 매칭하고, 경주시에 해당하는 폴리곤만 골라 WGS84로 변환해
GeoJSON FeatureCollection으로 저장한다.

1회성 전처리 스크립트. 재실행 시 카카오 REST API 키(.env의
kakao_map_REST_APIkey)와 IP 허용 목록 등록이 필요하다.
"""
import json
import re
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

from pyproj import Transformer

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
SRC_JSON = ROOT / "gyeongsangbuk-do_adiminisrative_map.json"
OUT_DIR = ROOT / "data"
OUT_FILE = OUT_DIR / "gyeongju_dong_boundaries.geojson"

SRC_EPSG = "EPSG:5186"
DST_EPSG = "EPSG:4326"
TARGET_SIGUNGU = "경주시"


def load_rest_key():
    env_text = (ROOT / ".env").read_text(encoding="utf-8")
    m = re.search(r"kakao_map_REST_APIkey\s*=\s*(\S+)", env_text)
    if not m:
        raise RuntimeError(".env에서 kakao_map_REST_APIkey를 찾지 못했습니다.")
    return m.group(1)


def polygon_groups(geometry):
    """Polygon -> [ [exterior, hole, ...] ], MultiPolygon -> 하위 Polygon들의 ring 그룹 목록."""
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["coordinates"]
    raise ValueError(f"unsupported geometry type: {geometry['type']}")


def ring_area(ring):
    area = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def ring_centroid(ring):
    area = 0.0
    cx = 0.0
    cy = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
        cross = x1 * y2 - x2 * y1
        area += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    area /= 2.0
    if area == 0:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    cx /= 6 * area
    cy /= 6 * area
    return cx, cy


def representative_point(geometry):
    """가장 넓은 외곽 ring의 중심점과 그 면적을 대표 좌표로 사용."""
    groups = polygon_groups(geometry)
    exterior_rings = [g[0] for g in groups]
    largest = max(exterior_rings, key=ring_area)
    x, y = ring_centroid(largest)
    return x, y, ring_area(largest)


def as_multipolygon_coords(geometry):
    """Polygon -> [coordinates], MultiPolygon -> coordinates (이미 폴리곤 목록)."""
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    return geometry["coordinates"]


def transform_geometry(geometry, transformer):
    def tf_ring(ring):
        return [list(transformer.transform(x, y)) for x, y in ring]

    if geometry["type"] == "Polygon":
        return {
            "type": "Polygon",
            "coordinates": [tf_ring(ring) for ring in geometry["coordinates"]],
        }
    if geometry["type"] == "MultiPolygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [
                [tf_ring(ring) for ring in polygon]
                for polygon in geometry["coordinates"]
            ],
        }
    raise ValueError(f"unsupported geometry type: {geometry['type']}")


def coord2regioncode(rest_key, lon, lat):
    params = urllib.parse.urlencode({"x": lon, "y": lat})
    url = f"https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?{params}"
    req = urllib.request.Request(url, headers={"Authorization": f"KakaoAK {rest_key}"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    for doc in body.get("documents", []):
        if doc.get("region_type") == "H":
            return doc
    return body["documents"][0] if body.get("documents") else None


def main():
    rest_key = load_rest_key()
    transformer = Transformer.from_crs(SRC_EPSG, DST_EPSG, always_xy=True)

    raw = json.loads(SRC_JSON.read_text(encoding="utf-8"))
    geometries = raw["geometries"]
    print(f"총 {len(geometries)}개 폴리곤 로드")

    features = []
    matched = 0
    for i, geom in enumerate(geometries):
        lon5186, lat5186, area5186 = representative_point(geom)
        lon, lat = transformer.transform(lon5186, lat5186)

        try:
            region = coord2regioncode(rest_key, lon, lat)
        except Exception as e:
            print(f"[{i}] API 오류: {e}")
            time.sleep(0.3)
            continue

        time.sleep(0.05)

        if not region:
            continue

        sigungu = region.get("region_2depth_name", "")
        dong = region.get("region_3depth_name", "")

        if TARGET_SIGUNGU not in sigungu:
            continue

        matched += 1
        print(f"[{i}] 매칭: {sigungu} {dong}  (rep point wgs84={lon:.5f},{lat:.5f})")

        wgs84_geom = transform_geometry(geom, transformer)
        features.append({
            "name": dong,
            "sigungu": sigungu,
            "region_code": region.get("code", ""),
            "center": [lon, lat],
            "area": area5186,
            "geometry": wgs84_geom,
        })

    print(f"경주시 매칭 결과: {matched}개 (병합 전)")

    merged = {}
    for f in features:
        name = f["name"]
        if name not in merged:
            merged[name] = f
            continue
        existing = merged[name]
        existing_polys = as_multipolygon_coords(existing["geometry"])
        new_polys = as_multipolygon_coords(f["geometry"])
        existing["geometry"] = {
            "type": "MultiPolygon",
            "coordinates": existing_polys + new_polys,
        }
        if f["area"] > existing["area"]:
            existing["center"] = f["center"]
            existing["area"] = f["area"]
        print(f"  - '{name}' 폴리곤 병합 (조각 {len(existing_polys)}개 + {len(new_polys)}개)")

    print(f"병합 후 행정구역 수: {len(merged)}개")

    out_features = [
        {
            "type": "Feature",
            "properties": {
                "name": f["name"],
                "sigungu": f["sigungu"],
                "region_code": f["region_code"],
                "center": f["center"],
            },
            "geometry": f["geometry"],
        }
        for f in merged.values()
    ]

    OUT_DIR.mkdir(exist_ok=True)
    feature_collection = {"type": "FeatureCollection", "features": out_features}
    OUT_FILE.write_text(
        json.dumps(feature_collection, ensure_ascii=False, indent=None),
        encoding="utf-8",
    )
    print(f"저장 완료: {OUT_FILE}")


if __name__ == "__main__":
    main()
