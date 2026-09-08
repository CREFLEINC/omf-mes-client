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
  "platforms;android-37.1" "build-tools;37.0.0" \
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

여기까지가 한 번만 하는 준비다. 그 뒤로는 아래 스크립트가 같은 일을 한다.

## 에뮬레이터에서 실기기처럼 보기

목 서버를 먼저 띄우고(다른 창), 그다음 앱을 올린다. 서버를 스크립트가 들고 있지 않은 이유는
앱을 다시 설치할 때마다 씨앗이 초기화되기 때문이다.

```bash
pnpm mock                              # 창 1 — 목 서버 (4010)
apps/mobile/scripts/emulator-run.sh    # 창 2 — 부팅 → 빌드 → 동기화 → 설치 → 실행
```

`emulator-run.sh` 는 웹을 빌드할 때 `VITE_API_BASE_URL=http://10.0.2.2:4010` 을 준다.
단말 안의 `127.0.0.1` 은 **단말 자신**이라 목 서버에 닿지 않는다 — `10.0.2.2` 가 호스트다.

평문 HTTP 는 디버그 빌드에서만, 그 세 주소로만 열려 있다
(`android/app/src/debug/`). 운영 서버의 HTTPS 여부는 아직 정해지지 않았고(#580) 릴리스
빌드는 이 설정을 받지 않는다.

| 스크립트 | 무엇을 하나 |
| --- | --- |
| `emulator-run.sh [AVD]` | 부팅·빌드·동기화·설치·실행. 이미 떠 있으면 그것을 쓴다 |
| `emulator-register.sh` | 기기 등록 관문을 넘겨 준다 |
| `emulator-scan.sh <값>` | 스캐너 일체형 PDA 처럼 스캔값을 넣는다 |
| `emulator-qr.sh <값>` | 카메라가 읽을 QR 을 가상 장면 벽에 건다 |
| `emulator-inspect.sh` | 앱 안의 화면을 개발자 도구로 연다 |

### 기기 등록 관문 넘기

앱은 등록되지 않은 기기에서 **아무 화면도 열지 않는다.** 등록은 카메라로 단말 QR 을 읽는
것인데, 이 호스트의 에뮬레이터 카메라가 프레임을 내지 못해(`Camera3-Stream: timestamp is not
increasing`) 그 경로가 서지 않는다.

```bash
apps/mobile/scripts/emulator-register.sh
```

⚠ **이것은 지름길이다.** 앱이 이미 쓰는 보관 API 를 개발자 도구로 불러 단말 토큰과 작업자
명부를 넣는다 — 앱 코드에 시험용 뒷문을 만들지 않는다. **등록 경로 자체를 재지 않으므로**
`M-CO-01` 의 검증으로 삼지 않는다.

넘고 나면 사번 확인이 나온다. 목 서버의 씨앗 사번은 `100028`(김영수)이다.

### 스캔을 실기기와 같은 형태로 넣기

이 단말의 스캐너는 **키보드 입력**으로 들어온다. 앱은 그것을 일반 키보드와 구별하지 못해
「빠른 버스트」로 판정한다(`patterns/scanner.ts` — 평균 간격 60ms 이하 · 입력 3건 이상).
`adb shell input text` 가 문자를 한 묶음으로 밀어 넣어 그 기준 안에 든다.

```bash
apps/mobile/scripts/emulator-scan.sh GI-2026-000402            # 종료 문자까지
apps/mobile/scripts/emulator-scan.sh --no-enter CTN-2026-0091  # 종료 문자 없는 단말
apps/mobile/scripts/emulator-scan.sh --slow ABC-1              # 사람이 손으로 친 속도
```

⭐ **`--slow` 는 통과하면 결함이다.** 사람 손을 스캔으로 오인하지 않는지 보는 자리다.

### 카메라 QR — 기기등록만

기기등록(`M-CO-01`)만 카메라로 QR 을 읽는다. 값을 코드로 밀어 넣으면 MLKit 이 프레임에서
코드를 찾는 부분을 통째로 건너뛰므로, **카메라 앞에 진짜 QR 을 둔다.**

```bash
brew install qrencode
apps/mobile/scripts/emulator-qr.sh 'DEV-2026-0001'
adb emu kill && apps/mobile/scripts/emulator-run.sh
```

에뮬레이터가 가상 장면으로 뜨고(`-camera-back virtualscene`), 그 벽에 QR 이 걸린다. 앱에서
카메라를 열고 방향키로 시점을 벽 쪽으로 돌리면 읽힌다.

### 앱 안의 화면을 개발자 도구로 보기

디버그 빌드는 WebView 디버깅이 켜져 있다.

```bash
apps/mobile/scripts/emulator-inspect.sh
```

`chrome://inspect` 또는 `http://127.0.0.1:9444/json/list` 로 붙는다.

## 개발 백엔드에 붙이기

기본값은 로컬 목 서버(`http://127.0.0.1:4010`)다. 사내 개발 백엔드에 붙이려면 주소를 준다.

⛔ **주소를 파일에 적어 커밋하지 않는다.** 이 저장소는 공개다. 값은 `.env.local` 에 두고,
그 이름은 `.gitignore` 의 `*.local` 에 걸린다. 본보기는 `.env.example` 에 있다.

### 브라우저에서

그 서버는 **CORS 응답 헤더를 주지 않는다** — preflight(`OPTIONS`)가 404 로 떨어져 직접
부르면 닿지 않는다. 같은 출처로 부르게 해서 우회한다.

```bash
# .env.local
VITE_API_BASE_URL=/api

MOBILE_API_PROXY_TARGET=http://<사내-주소> pnpm --filter @omf-mes/mobile dev
```

`MOBILE_API_PROXY_TARGET` 이 없으면 프록시를 걸지 않는다 — 목 서버로 도는 경로가 그대로
남는다.

### 에뮬레이터·실기에서

프록시가 없으므로 절대 주소를 주고, 요청을 네이티브로 보내 CORS 를 우회한다.

```bash
# .env.local
VITE_API_BASE_URL=http://<사내-주소>/api

CAP_NATIVE_HTTP=1 CAP_ALLOW_LOCAL_HTTP=1 pnpm --filter @omf-mes/mobile build
CAP_NATIVE_HTTP=1 CAP_ALLOW_LOCAL_HTTP=1 npx cap sync android
```

`CAP_NATIVE_HTTP` 는 기본이 꺼짐이다. 켜면 목 서버로 도는 경로까지 함께 바뀐다.

### 붙었는지 확인하기

인증이 필요 없는 것은 상태 확인 경로 하나다. 나머지 계약 경로는 전부 `401` 이다.

```bash
curl -s http://<사내-주소>/api/health
# {"status":"ok","db":"up","uptime":...}
```

브라우저에서 프록시가 도는지는 dev 서버를 띄운 뒤 같은 경로를 상대 주소로 부른다.

```bash
curl -s http://127.0.0.1:5173/api/health
```

### 지금 막혀 있는 것

| 무엇        | 상태                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------ |
| 인증        | 계약 경로 전건 `401`. 세션 운반 수단이 계약에 없고(`securitySchemes` 비어 있음) 시험 계정도 없다 |
| 미구현 경로 | 모바일이 부르는 47개 중 17개가 아직 서버에 없다                                                  |

배선은 서 있고 상태 확인 경로로 검증된다. 화면이 실제 응답으로 도는 것은 위 둘이 풀린
뒤다. 진행은 착수 이슈에 적는다.

## 버전 조합

바꾸기 전에 `docs/decisions.md` 14 번을 읽는다. 조합이 어긋나면 원인을 알기 어려운 빌드 오류가 난다.

| 항목                       | 값              |
| -------------------------- | --------------- |
| Capacitor                  | 8.5.0           |
| Android Gradle Plugin      | 9.3.2           |
| Gradle                     | 9.5.0           |
| JDK                        | 21              |
| `minSdk`                   | 33 (Android 13) |
| `compileSdk` · `targetSdk` | 37              |

`minSdk` 를 33 보다 내리지 않는다. 그 아래를 지원하지 않기로 정해져 있다.

## 이 셸이 하지 않는 것

- iOS — `ios/` 를 만들지 않는다
- 제조사 전용 스캐너 연동, 블루투스 페어링 — 단말이 스캐너 일체형이라 페어링 대상이 없다
- 가로 화면 — 세로로 고정돼 있다
- 오프라인 동기화 정책 — 저장소라는 그릇만 있다
