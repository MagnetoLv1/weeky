import appsFlyer from 'react-native-appsflyer';

// AppsFlyer 개발자 키 — AppsFlyer 콘솔에서 발급 후 교체
export const DEV_KEY = 'Q27fVQM4ucHR47jDvc6PqG';
// iOS App Store ID — 앱 등록 후 교체 (미등록 시 '0' 유지)
export const IOS_APP_ID = '0';

/**
 * AppsFlyer SDK 초기화.
 * App.tsx의 useEffect에서 앱 시작 시 1회 호출.
 * __DEV__ 모드에서는 디버그 로그 활성화.
 */
export function initAppsFlyer() {
    appsFlyer.initSdk({
        devKey: DEV_KEY,
        isDebug: __DEV__,
        appId: IOS_APP_ID,
        onInstallConversionDataListener: true,
        onDeepLinkListener: false,
        timeToWaitForATTUserAuthorization: 10,
    });
}
