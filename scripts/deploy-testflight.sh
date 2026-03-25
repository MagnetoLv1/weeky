#!/bin/bash
# iOS 배포 자동화 스크립트 (Firebase App Distribution + TestFlight)
# 사용법: ./scripts/deploy-testflight.sh
#
# 필수 환경변수 (최초 1회 설정):
#   export FIREBASE_TOKEN="xxxx"   # firebase login:ci 로 발급
#
# FIREBASE_TOKEN 발급:
#   npx firebase-tools login:ci

set -e

# ─── App Store Connect API 키 ────────────────────────────
APP_STORE_CONNECT_KEY_ID="${APP_STORE_CONNECT_KEY_ID:-9TL57TC4HJ}"
APP_STORE_CONNECT_ISSUER_ID="${APP_STORE_CONNECT_ISSUER_ID:-b08880bf-f8f7-482e-8d81-d3d5bba09b7c}"
APP_STORE_CONNECT_API_KEY_PATH="${APP_STORE_CONNECT_API_KEY_PATH:-$HOME/Documents/weeky/AuthKey_9TL57TC4HJ.p8}"

# ─── Firebase 설정 ───────────────────────────────────────
FIREBASE_IOS_APP_ID="1:698111208612:ios:057c7bbd8612cd2bcd8a31"
FIREBASE_TESTER_GROUPS="testers"

# ─── 빌드 설정 ───────────────────────────────────────────
WORKSPACE="ios/Weeky.xcworkspace"
SCHEME="Weeky"
CONFIGURATION="Release"
ARCHIVE_PATH="ios/build/Weeky.xcarchive"
EXPORT_PATH="ios/build/export"
EXPORT_OPTIONS="ios/ExportOptions.plist"

# ─── 환경변수 확인 ───────────────────────────────────────
if [ -z "$FIREBASE_TOKEN" ]; then
  echo "❌ FIREBASE_TOKEN 미설정"
  echo ""
  echo "아래 명령어로 토큰 발급 후 설정하세요:"
  echo "  npx firebase-tools login:ci"
  echo "  export FIREBASE_TOKEN=\"발급된 토큰\""
  exit 1
fi

# .p8 파일을 xcrun altool이 읽는 표준 경로에 복사
API_KEY_DIR=~/.appstoreconnect/private_keys
mkdir -p "$API_KEY_DIR"
cp "$APP_STORE_CONNECT_API_KEY_PATH" "$API_KEY_DIR/AuthKey_${APP_STORE_CONNECT_KEY_ID}.p8"

echo "🚀 iOS 배포 시작 (Firebase + TestFlight)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. JS 번들 생성 ─────────────────────────────────────
echo "📦 [1/5] JS 번들 생성..."
npx react-native bundle \
  --entry-file index.js \
  --platform ios \
  --dev false \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios/

# ─── 2. Xcode Archive ────────────────────────────────────
echo "🏗️  [2/5] Xcode 아카이브 빌드..."
rm -rf "$ARCHIVE_PATH"
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$API_KEY_DIR/AuthKey_${APP_STORE_CONNECT_KEY_ID}.p8" \
  -authenticationKeyID "$APP_STORE_CONNECT_KEY_ID" \
  -authenticationKeyIssuerID "$APP_STORE_CONNECT_ISSUER_ID" \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=YG6LQKN7M7

# ─── 3. IPA Export ───────────────────────────────────────
echo "📤 [3/5] IPA 추출..."
rm -rf "$EXPORT_PATH"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -exportPath "$EXPORT_PATH" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$API_KEY_DIR/AuthKey_${APP_STORE_CONNECT_KEY_ID}.p8" \
  -authenticationKeyID "$APP_STORE_CONNECT_KEY_ID" \
  -authenticationKeyIssuerID "$APP_STORE_CONNECT_ISSUER_ID"

IPA_FILE=$(find "$EXPORT_PATH" -name "*.ipa" | head -1)
echo "    IPA: $IPA_FILE"

# ─── 4. Firebase App Distribution 배포 ───────────────────
echo "🔥 [4/5] Firebase App Distribution 배포..."
npx firebase-tools appdistribution:distribute "$IPA_FILE" \
  --app "$FIREBASE_IOS_APP_ID" \
  --groups "$FIREBASE_TESTER_GROUPS" \
  --token "$FIREBASE_TOKEN"

# ─── 5. TestFlight 업로드 ────────────────────────────────
echo "☁️  [5/5] TestFlight 업로드..."
xcrun altool --upload-app \
  --type ios \
  --file "$IPA_FILE" \
  --apiKey "$APP_STORE_CONNECT_KEY_ID" \
  --apiIssuer "$APP_STORE_CONNECT_ISSUER_ID" \
  --verbose

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 배포 완료!"
echo "   Firebase: https://console.firebase.google.com"
echo "   TestFlight: https://appstoreconnect.apple.com"
