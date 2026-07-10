# 프로젝트 규칙

이 문서는 프로젝트의 전역 규칙과 서브에이전트 워크플로우를 관리하는 문서입니다.
이 문서는 "현재 시점의 최신 상태"만 담는 Living Document로 관리합니다.
과거에 무엇이 어떻게 바뀌어왔는지는 이 문서에 남기지 않으며, 그 이력은 git 커밋 히스토리가 담당합니다.
아래 "PRD 반영 사항" 섹션은 개발자 서브에이전트가 관리하며,
PRD.md가 갱신될 때마다 해당 섹션 전체를 최신 내용으로 덮어씁니다 (append 아님).

## 서브에이전트 워크플로우

새 기능 요청이 들어오면 아래 순서로 서브에이전트를 자동으로 이어서 실행합니다.
각 단계가 완료되면 사용자에게 다시 묻지 않고 다음 단계로 자동 진행합니다
(단, 각 서브에이전트 프롬프트에 명시된 개별 확인 절차는 그대로 따릅니다).

1. **PRD-writer** 실행 → `PRD.md` 작성/갱신 (최신 상태로 덮어쓰기)
2. PRD.md 작성 완료 →  **developer** 자동 실행 →
   - PRD.md의 최신 내용을 이 CLAUDE.md의 해당 섹션에 반영 (섹션 전체 갱신, append 아님)
   - 코드 작성 및 테스트 진행
3. developer의 테스트가 모두 통과하면 → **deploy-manager** 자동 실행 →
   - git diff로 이번 버전의 변경 내용 파악
   - README.md 갱신 (기능 목록, 설치 방법, 배포 정보, 수정된 부분 — 수정된 부분도 누적 아닌 이번 버전 요약만)
   - git commit / push
   - 필요 시 GitHub Actions 워크플로 갱신 및 GitHub Pages 배포

기존 기능을 수정/확장하는 요청인지, 완전히 새로운 기능 요청인지 판단이 애매한 경우
(아래 "기능 인덱스" 참고), 서브에이전트는 임의로 새 문서를 만들지 말고 사용자에게 먼저 확인합니다.

## 기능 인덱스

- 경주시 행정구역 경계 지도 웹앱: 카카오맵 위에 경주시 동/읍/면 경계 폴리곤과 이름 라벨을 표시하고,
  화면 상단 +/- 버튼 및 슬라이더로 줌을 조절하며, 경주역/황리단길/경주월드/석굴암 4곳에 마커를 표시.
  (`index.html`, `css/style.css`, `js/config.js`, `js/poi-data.js`, `js/geo-utils.js`, `js/map-app.js`)

## PRD 반영 사항

### 프로젝트 개요
경상북도 경주시의 동/읍/면 단위 행정구역 경계를 카카오맵 위에 시각화하고, 주요 명소 4곳(경주역,
황리단길, 경주월드, 석굴암)에 마커를 표시하는 순수 프론트엔드 웹앱. 백엔드/DB 없이 정적 파일만으로
동작하며, 기존에 전처리(`scripts/match_gyeongju_regions.py`)로 만들어진
`data/gyeongju_dong_boundaries.geojson`을 그대로 재사용한다. 로컬 정적 서버로 실행 가능해야 하고,
GitHub Pages 배포까지 목표로 한다(배포 자체는 deploy-manager 담당).

### 핵심 기능 및 우선순위
- **P0 카카오맵 기본 지도 표시**: 경주시 전체가 한 화면에 들어오도록 초기 지도 렌더링(초기 표시 후
  경계 데이터 로드 시 전체 feature를 포함하는 bounds로 자동 맞춤).
- **P0 행정구역 경계 폴리곤 표시**: `data/gyeongju_dong_boundaries.geojson`을 fetch로 불러와 각
  동/읍/면 경계를 `kakao.maps.Polygon`으로 표시(Polygon/MultiPolygon 지오메트리 모두 지원).
- **P0 행정구역 이름 라벨 표시**: 각 feature의 `properties.center` 위치에 `kakao.maps.CustomOverlay`로
  이름 라벨 표시. `center` 값이 없거나 유효하지 않으면 폴리곤 좌표로부터 중심점을 계산해 대체.
- **P0 지도 확대/축소 컨트롤**: 화면 상단에 '-' 버튼, 슬라이더(레벨 1~14), '+' 버튼을 배치하고
  `map.setLevel()`로 줌 레벨 제어. 지도 자체 조작(휠 줌 등)과 슬라이더 값이 항상 동기화되어야 함.
- **P0 주요 명소 마커 표시**: 경주역/황리단길/경주월드/석굴암 4곳에 `kakao.maps.Marker` 표시. 좌표는
  아래 "명소 마커 좌표" 표에 확정된 값을 `js/poi-data.js`에 하드코딩.
- P1 마커 클릭 시 이름 표시: 마커 클릭 시 `kakao.maps.InfoWindow`로 장소명 표시.
- P1 반응형(모바일) 레이아웃: 좁은 화면에서도 지도와 상단 줌 컨트롤이 정상적으로 보이도록 대응.
- P2(향후, 이번 범위 아님) 행정구역 폴리곤 클릭 시 면적/인구 등 상세 정보 팝업 표시.

### 기술 스택 / 코딩 컨벤션
- 프론트엔드: 순수 HTML/CSS/JavaScript. 프레임워크, 번들러/빌드 도구 사용 금지.
- 지도: 카카오맵 JavaScript SDK. 런타임에는 `kakao_map_JavaScript_APIkey`만 사용한다.
  `kakao_map_REST_APIkey`는 전처리·좌표 조사 등 개발 시점 도구 전용이며 앱 코드/런타임에 절대 포함하지 않는다.
- 카카오맵 JS 앱키는 도메인 화이트리스트 기반 보안 방식이므로 `js/config.js`에 평문 상수로 노출하는
  것을 정상으로 간주한다(카카오 디벨로퍼스 콘솔의 도메인 등록은 사용자가 별도로 수행하는 범위 밖 작업).
- 서버: 없음. 로컬 실행은 정적 파일 서버만 사용(예: `python -m http.server`, `npx http-server`).
  `file://` 프로토콜에서는 카카오맵 SDK/`fetch`가 정상 동작하지 않을 수 있으므로 반드시 HTTP 서버로 구동.
- 데이터: 파일 기반 GeoJSON, DB 없음.
- 배포: GitHub Pages. 배포 작업(commit/push, Actions, Pages 설정)은 deploy-manager 서브에이전트 담당.
- 순수 로직(GeoJSON 좌표 변환, 중심점 계산, 유효성 검증 등)은 브라우저 `<script>` 태그와 Node 테스트
  러너 양쪽에서 재사용 가능하도록 UMD 패턴(`module.exports` 존재 시 CommonJS export, 아니면
  `window`/`globalThis`에 바인딩)으로 작성한다. DOM/카카오 SDK에 의존하는 코드(`js/map-app.js`)와
  분리해서 관리한다.

### 데이터 구조
- **행정구역 경계 데이터** (`data/gyeongju_dong_boundaries.geojson`, 기존 파일 그대로 재사용, 스키마
  변경 금지, 22개 feature): `FeatureCollection`. 각 `Feature.properties`는 `name`(동/읍/면 이름),
  `sigungu`(항상 "경주시"), `region_code`, `center: [lng, lat]`(WGS84)를 가지며, `geometry`는
  `Polygon` 또는 `MultiPolygon`(WGS84 좌표).
- **명소 마커 데이터** (`js/poi-data.js`의 `POI_MARKERS` 상수, 신규): `{ name, lat, lng, description }`
  객체 배열. 런타임에 카카오 장소검색(Keyword) API를 호출하지 않고, 아래처럼 사전에 확인된 고정 좌표를
  코드에 직접 포함한다.

  | 이름 | lat | lng | 확인 근거 |
  |---|---|---|---|
  | 경주역 | 35.798377 | 129.138999 | 카카오 로컬 키워드 검색 결과, 경북 경주시 건천읍 경주역로 80, 카테고리 "기차역 > KTX,SRT정차역" — 현재 운영 중인 역사. 과거 시내(황남동 인근)에 있던 구 역사(2021년 폐역)와는 다른 위치이므로 혼동 없음. |
  | 황리단길 | 35.839335 | 129.209645 | 카카오 로컬 키워드 검색 결과, 경북 경주시 태종로 746, 카테고리 "테마거리 > 카페거리"(황남동 소재). |
  | 경주월드 | 35.836253 | 129.282066 | 카카오 로컬 키워드 검색 결과, 경북 경주시 보문로 544, 카테고리 "테마파크". |
  | 석굴암 | 35.795242 | 129.350521 | 카카오 로컬 키워드 검색 결과, 경북 경주시 석굴로 238, 카테고리 "절,사찰"(토함산 소재, 유네스코 세계유산). |

### 파일 구조
- `index.html`: 지도 컨테이너(`#map`) + 상단 줌 컨트롤(버튼 2개 + 슬라이더) 마크업.
- `css/style.css`: 전체 레이아웃 및 줌 컨트롤 스타일, 기본 반응형 대응.
- `js/config.js`: `KAKAO_JS_APP_KEY` 상수 정의 (UMD).
- `js/poi-data.js`: `POI_MARKERS` 상수 정의 (UMD, 위 표의 좌표 하드코딩).
- `js/geo-utils.js`: DOM/카카오 SDK에 의존하지 않는 순수 로직 함수 모음(GeoJSON→좌표 경로 변환, 라벨
  위치/중심점 계산, bounding box 계산, 점-폴리곤 포함 판정, POI/FeatureCollection 유효성 검증 등).
  UMD 패턴으로 브라우저와 Node 테스트에서 모두 사용.
- `js/map-app.js`: 카카오맵 SDK 동적 로드, 지도 초기화, GeoJSON fetch 및 폴리곤/라벨 렌더링, POI 마커
  렌더링, 상단 줌 컨트롤(버튼/슬라이더) 이벤트 처리. 브라우저 전용(카카오 SDK/DOM 의존).
- `tests/geo-utils.test.js`: Node 내장 테스트 러너(`node --test`)로 `geo-utils.js`/`poi-data.js`/
  `config.js` 로직 및 실제 `data/gyeongju_dong_boundaries.geojson` 데이터를 검증.
- `package.json`: `npm test` → `node --test` 스크립트만 정의(외부 의존성 없음).

### 실행 방법
- 로컬 실행: 프로젝트 루트에서 정적 서버 실행 후 `index.html` 접속.
  예: `python -m http.server 8000` → `http://localhost:8000/index.html`
- 테스트: 프로젝트 루트에서 `node --test` (또는 `npm test`). 인자 없이 실행해야 하며(디렉터리를
  인자로 명시하면 이 환경의 Node 버전에서 모듈 경로 충돌 오류가 발생함), 기본 glob으로
  `tests/*.test.js`를 자동 탐색한다.

### 확인된 가정 (사용자 확인 완료)
- 카카오 디벨로퍼스 콘솔의 서비스 도메인 등록(로컬 `localhost`, 배포 후 GitHub Pages 도메인)은
  사용자가 콘솔에서 직접 수행하며, 본 웹앱 코드 범위 밖이다.
- 카카오맵 JS 앱키는 클라이언트 코드(`js/config.js`)에 그대로 노출하는 것으로 확정했다(도메인
  화이트리스트 기반 보안).
- 명소 마커 좌표는 developer가 카카오 로컬 키워드 검색 API로 개발 시점에 직접 조회하여 확정했으며
  (위 표 참고), 특히 경주역은 현재 운영 중인 역사 좌표임을 카테고리("KTX,SRT정차역")로 확인했다.