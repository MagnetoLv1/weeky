# Weeky 프로젝트 Claude 규칙

## 기본 규칙

### spec.md 업데이트

- 새 기능 추가, 기존 기능 변경, 화면/데이터 구조 수정 시 **반드시** `spec/spec.md`를 함께 업데이트한다.
- 구현 완료 항목은 `- [x]`로, 미완료는 `- [ ]`로 표시한다.
- spec.md의 내용은 항상 실제 코드 구현 상태와 일치해야 한다.

### 코드 스타일

- 작성한 코드에 중요한 내용을 요약해서 주석을 달아야 한다
- 스타일링은 NativeWind v4 (Tailwind CSS className) 사용을 원칙으로 한다.

### 컴포넌트 분리 원칙

- 파일 하나에 컴포넌트 하나를 원칙으로 한다.
- 한 파일에 여러 컴포넌트가 생기면 `src/components/` 하위 적절한 디렉토리로 분리한다.
- 공유 상수·헬퍼 함수는 컴포넌트 파일이 아닌 별도 `constants.ts` 또는 `src/utils/`에 위치시킨다.
- 특정 컴포넌트 전용 상수(A4_RATIO 등)는 해당 컴포넌트 파일 내부에 위치해도 된다.

### 의존성 설치 규칙

- `react-native-mmkv` 설치 시 `react-native-nitro-modules`도 함께 설치.
- `react-native-reanimated` v4.x 설치 시 `react-native-worklets`도 함께 설치.
- `react-native-print` 설치 시 `--legacy-peer-deps` 플래그 필요.
- iOS pod install: `pod install` 직접 실행 (`bundle exec pod install` 사용 금지).

### 파일 구조 원칙

- 화면 컴포넌트: `src/screens/`
- 공통 컴포넌트: `src/components/`
- 저장소(스토어): `src/store/`
- 타입 정의: `src/types/index.ts`
- 유틸리티: `src/utils/`

## 도메인 용어 정의

### 헤더버튼
MainScreen 상단 헤더 영역에 위치한 UI 요소 모음을 말한다.

- **시간표 메뉴**: 헤더 왼쪽의 시간표 이름 + 화살표(ChevronDown) — 탭 시 시간표 선택 BottomSheet 열림
- **추가하기 버튼**: 헤더 오른쪽 Plus 아이콘 버튼 — 탭 시 새 시간표 생성
- **더보기 버튼**: 헤더 오른쪽 Ellipsis 아이콘 버튼 — 탭 시 ContextMenu(수정/삭제 등) 표시

추가하기 버튼과 더보기 버튼은 `GlassButtonPill` 컴포넌트(`src/components/timetable/GlassIconButton.tsx`) 안에 함께 묶여 하나의 pill 형태로 표시된다.

---

## 현재 구현 상태 (spec.md 기준)

구현 완료 여부는 `spec/spec.md`의 체크리스트를 기준으로 한다.
