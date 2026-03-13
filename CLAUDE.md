# Weeky 프로젝트 Claude 규칙

## 기본 규칙

### spec.md 업데이트
- 새 기능 추가, 기존 기능 변경, 화면/데이터 구조 수정 시 **반드시** `spec/spec.md`를 함께 업데이트한다.
- 구현 완료 항목은 `- [x]`로, 미완료는 `- [ ]`로 표시한다.
- spec.md의 내용은 항상 실제 코드 구현 상태와 일치해야 한다.

### 코드 스타일
- 스타일링은 NativeWind v4 (Tailwind CSS className) 사용을 원칙으로 한다.
- 단, 애니메이션/동적 값이 필요한 경우 `StyleSheet` 또는 인라인 style 사용.
- 컴포넌트 분리는 재사용이 명확한 경우에만 수행한다.

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

## 현재 구현 상태 (spec.md 기준)

구현 완료 여부는 `spec/spec.md`의 체크리스트를 기준으로 한다.
