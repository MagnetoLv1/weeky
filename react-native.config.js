module.exports = {
  assets: ['./src/assets/fonts'],
  dependencies: {
    // react-native-appsflyer autolinking이 PCAppsFlyerPackage를 full qualified name으로 처리하지 못하는 버그 우회
    'react-native-appsflyer': {
      platforms: {
        android: {
          // extractFqcnFromImport이 첫 번째 import만 파싱하므로,
          // PCAppsFlyerPackage만 import에 두고 RNAppsFlyerPackage는 packageInstance에 FQCN으로 직접 명시
          packageImportPath: 'import com.appsflyer.reactnative.PCAppsFlyerPackage;',
          packageInstance: 'new com.appsflyer.reactnative.RNAppsFlyerPackage(),\nnew PCAppsFlyerPackage()',
        },
      },
    },
  },
};
