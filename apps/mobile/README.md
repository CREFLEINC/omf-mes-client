# @omf-mes/mobile

모바일 셸 — 웹으로 만든 화면을 Capacitor 로 감싼 Android 앱. 화면(`M-` 접두)은 각자의 착수 이슈에서 이 셸 위에 붙는다.

## 무엇이 어디에 있나

```
src/app/        셸 진입점·레이아웃·전역 스타일 (화면이 참조하지 않는다)
src/routes/     라우트 정의 — routes → screens → patterns → packages
src/patterns/   화면이 함께 쓰는 비표현 부품 (네이티브 기능 통로가 여기 있다)
android/        Capacitor 가 생성한 네이티브 프로젝트
capacitor.config.ts
```

`patterns/` 에 네이티브 통로를 두는 이유는 허용 의존 규칙이 `screens`·`patterns` 에서 `app` 을 참조하는 것을 막기 때문이다. 화면이 쓸 수 있는 자리가 여기뿐이다.

| 파일                        | 무엇                                                      |
| --------------------------- | --------------------------------------------------------- |
| `patterns/photo-capture.ts` | 카메라 촬영. 권한을 확인·요청한 뒤 시스템 카메라를 띄운다 |
| `patterns/local-store.ts`   | 암호화되지 않은 로컬 키/값                                |
| `patterns/device-token.ts`  | 단말 토큰. Android Keystore 로 보호된다                   |
| `patterns/scanner.ts`       | 스캐너 어댑터와 키보드 입력 구현체                        |

## 브라우저에서 화면만 볼 때

```bash
pnpm --filter @omf-mes/mobile dev
```

네이티브 기능(카메라·보안 저장소)은 브라우저에서 동작하지 않는다. 화면 배치만 확인하는 용도다.

## 단말에서 실행하기

### 한 번만 준비하는 것

JDK 21 과 Android SDK 가 필요하다. 웹 툴체인에는 없는 것들이다.

```bash
brew install openjdk@21
brew install --cask android-commandlinetools

export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses
sdkmanager --sdk_root="$ANDROID_HOME" \
  "platform-tools" "emulator" \
  "platforms;android-36" "build-tools;36.0.0" \
  "system-images;android-33;google_apis;arm64-v8a" \
  "system-images;android-37.0;google_apis;arm64-v8a"
```

`JAVA_HOME` 과 `ANDROID_HOME` 은 아래 명령 전부에 필요하다. 셸 프로파일에 넣어 두면 매번 지정하지 않아도 된다.

### 웹 빌드 → 동기화

```bash
pnpm --filter @omf-mes/mobile sync
```

`vite build` 로 `dist/` 를 만들고 `cap sync android` 로 `android/` 안에 복사한다. 화면 코드를 고쳤으면 이것을 다시 돌려야 단말에 반영된다.

### 디버그 APK 빌드

```bash
cd apps/mobile/android && ./gradlew assembleDebug
```

산출물: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

### 에뮬레이터에 설치·실행

지원 범위의 양쪽 끝에서 확인한다 — 최소(Android 13)와 최신 세대 각각 1 대.

```bash
avdmanager create avd -n omf-pda-api33 -k "system-images;android-33;google_apis;arm64-v8a"
avdmanager create avd -n omf-pda-api37 -k "system-images;android-37.0;google_apis;arm64-v8a"
```

만든 뒤 `~/.android/avd/<이름>.avd/config.ini` 를 단말 규격에 맞춘다. 값은 화면 스펙이 전제한 것과 같다.

```
hw.lcd.width=1080
hw.lcd.height=2160
hw.lcd.density=480
hw.initialOrientation=portrait
hw.keyboard=yes
```

`hw.keyboard=yes` 는 키보드 입력 스캐너를 에뮬레이터에서 두드려 보기 위한 것이다.

```bash
emulator -avd omf-pda-api33 &
adb wait-for-device
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.crefle.omfmes.mobile/.MainActivity
```

### 앱 안의 화면을 개발자 도구로 보기

디버그 빌드는 WebView 디버깅이 켜져 있다.

```bash
adb forward tcp:9444 localabstract:$(adb shell cat /proc/net/unix | grep -o "webview_devtools_remote_[0-9]*" | head -1)
```

`chrome://inspect` 또는 `http://127.0.0.1:9444/json/list` 로 붙는다.

## 버전 조합

조합이 어긋나면 원인을 알기 어려운 빌드 오류가 난다. `minSdk` 를 뺀 나머지는 Capacitor 8.5.0 이 생성하는 기본값이다.

| 항목                       | 값              |
| -------------------------- | --------------- |
| Capacitor                  | 8.5.0           |
| Android Gradle Plugin      | 8.13.0          |
| Gradle                     | 8.14.3          |
| JDK                        | 21              |
| `minSdk`                   | 33 (Android 13) |
| `compileSdk` · `targetSdk` | 36              |

`minSdk` 를 33 보다 내리지 않는다. 그 아래를 지원하지 않기로 정해져 있다.

## 이 셸이 하지 않는 것

- iOS — `ios/` 를 만들지 않는다
- 제조사 전용 스캐너 연동, 블루투스 페어링 — 단말이 스캐너 일체형이라 페어링 대상이 없다
- 가로 화면 — 세로로 고정돼 있다
- 오프라인 동기화 정책 — 저장소라는 그릇만 있다
