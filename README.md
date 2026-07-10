# 경주시 행정구역 경계 지도 웹앱

경상북도 경주시의 동/읍/면 행정구역 경계와 주요 명소를 카카오맵 위에 시각화하는 정적 웹앱입니다.

## 소개

이 프로젝트는 사전에 전처리된 경주시 행정구역 경계 데이터(GeoJSON)를 카카오맵 JavaScript SDK 위에
폴리곤으로 표시하고, 주요 관광/교통 명소(경주역, 황리단길, 경주월드, 석굴암) 위치를 마커로 보여주는
순수 프론트엔드 웹앱입니다. 별도의 백엔드 서버나 데이터베이스 없이 정적 파일만으로 동작하며, 로컬
정적 서버 실행과 GitHub Pages 배포를 모두 지원합니다.

## 기능 목록

- **카카오맵 기본 지도 표시**: 경주시 전체가 한 화면에 들어오도록 초기 지도를 렌더링하고, 경계 데이터
  로드 후 전체 feature를 포함하는 bounds로 자동 맞춤
- **행정구역 경계 폴리곤 표시**: `data/gyeongju_dong_boundaries.geojson`을 fetch로 불러와 각 동/읍/면
  경계를 `kakao.maps.Polygon`으로 표시 (Polygon/MultiPolygon 모두 지원)
- **행정구역 이름 라벨 표시**: 각 구역의 `properties.center` 위치에 `kakao.maps.CustomOverlay`로 이름
  라벨을 표시 (center가 없거나 유효하지 않으면 폴리곤 좌표로 중심점을 계산해 대체)
- **지도 확대/축소 컨트롤**: 화면 상단에 '-' 버튼, 슬라이더(레벨 1~14), '+' 버튼을 배치해
  `map.setLevel()`로 줌 레벨을 제어하며, 지도 자체 조작(휠 줌 등)과 슬라이더 값이 항상 동기화됨
- **주요 명소 마커 표시**: 경주역(현재 운영 중인 역사), 황리단길, 경주월드, 석굴암 4곳에
  `kakao.maps.Marker` 표시 (좌표는 `js/poi-data.js`에 하드코딩)
- (P1, 향후 확장) 마커 클릭 시 InfoWindow로 장소명 표시, 모바일 반응형 레이아웃 대응
- (P2, 향후 확장) 행정구역 폴리곤 클릭 시 면적/인구 등 상세 정보 팝업 표시

## 설치 및 실행 방법

### 요구 사항

- Node.js (테스트 실행용 — Node 내장 테스트 러너 `node --test`만 사용하며 외부 npm 의존성 없음)
- 정적 파일을 서빙할 수 있는 임의의 HTTP 서버 (카카오맵 SDK와 `fetch`는 `file://` 프로토콜에서 정상
  동작하지 않을 수 있으므로 반드시 HTTP 서버로 구동)

### 로컬 실행

```bash
python -m http.server 8000
# 브라우저에서 http://localhost:8000/index.html 접속
```

또는 `npx http-server` 등 원하는 정적 서버 도구를 사용해도 됩니다.

### 카카오맵 API 키 안내

- `js/config.js`에 카카오맵 JavaScript SDK 앱키가 평문으로 포함되어 있습니다. 카카오맵 JS 앱키는 카카오
  디벨로퍼스 콘솔에 등록한 서비스 도메인(화이트리스트) 기반으로 보안이 관리되므로, 클라이언트 코드에
  노출되는 것이 정상적인 사용 방식입니다.
- 지도가 정상 동작하려면 카카오 디벨로퍼스 콘솔에 서비스 도메인(로컬 `localhost`, 배포 후 GitHub
  Pages 도메인)을 등록해야 합니다.
- `.env` 파일에는 전처리 스크립트(`scripts/match_gyeongju_regions.py`) 전용 REST API 키가 들어 있으며,
  이 파일은 `.gitignore`에 등록되어 저장소에 커밋되지 않습니다.

### 테스트

```bash
node --test
# 또는
npm test
```

## 배포

- GitHub Pages를 통한 정적 사이트 배포를 목표로 합니다.
- 배포 워크플로: `.github/workflows/deploy.yml` (main 브랜치 push 시 저장소 루트를 정적 사이트로 배포)
- 배포 상태: 미배포 (저장소 생성 및 GitHub Pages 활성화 대기 중)

## 수정된 부분

(최초 버전)

## 라이선스

이 프로젝트는 아직 별도의 라이선스가 지정되지 않았습니다 (`package.json`상 `UNLICENSED`).
