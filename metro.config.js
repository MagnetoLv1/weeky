const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

module.exports = withNativeWind(mergeConfig(getDefaultConfig(__dirname), config), {
  input: './src/global.css',
  // rem 기준을 웹 표준(16px)으로 설정 — 기본값 14px이므로 모든 rem 기반 클래스가 작게 적용되는 문제 수정
  inlineRem: 16,
});
