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

디버그 빌드의 평문 HTTP 는 그 세 주소로만 열려 있다(`android/app/src/debug/`). 릴리스는
이 설정을 받지 않는다 — 릴리스의 평문은 빌드 때 따로 만들며 「릴리스 APK 만들기」에 있다.

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

⚠ **상대 기준 주소는 브라우저에서만 선다.** `new Request('/api/...')` 를 브라우저는 문서
주소로 풀지만 Node 는 던진다(`Failed to parse URL`). 시험(vitest·node 환경)에서 이 설정을
재려다 실패하거든 설정이 틀린 것이 아니다 — 브라우저에서 실제로 도는 것을 확인했다.

### 에뮬레이터·실기에서

프록시가 없으므로 절대 주소를 주고, 요청을 네이티브로 보내 CORS 를 우회한다.

```bash
# .env.local
VITE_API_BASE_URL=http://<사내-주소>/api

CAP_NATIVE_HTTP=1 CAP_ALLOW_CLEARTEXT_HTTP=1 pnpm --filter @omf-mes/mobile build
CAP_NATIVE_HTTP=1 CAP_ALLOW_CLEARTEXT_HTTP=1 npx cap sync android
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

| 무엇        | 상태                                                     |
| ----------- | -------------------------------------------------------- |
| 인증        | 계약 경로 전건 `401`. 쓸 수 있는 단말 토큰이 없다 — 아래 |
| 미구현 경로 | 모바일이 부르는 47개 중 17개가 아직 서버에 없다          |

**인증 방식은 이미 맞다.** 계약(`app-공통`)이 `terminalToken`(http · bearer)을 두었고, 공유계약
`D-5` 가 같은 것을 적는다 — `Authorization: Bearer <단말 토큰>` 이 인증이고 `X-Worker-No` 가
귀속이다. 이 셸이 지금 싣는 방식이 그것이다.

⚠ **`/api/docs-json` 병합본에는 그 선언이 빠져 있다**(`securitySchemes` 가 비어 온다). 계약
본문은 여러 자리에서 단말 토큰을 전제한다 — 「보안 경계는 단말 토큰 하나뿐이다」
(`TerminalProcess`) · 「단말은 요청을 인증한 단말 토큰에서 서버가 푼다」(`DocumentIssueCreate`).
병합본만 보고 「운반 수단이 미확정」으로 읽지 않는다.

**필요한 것은 쓸 수 있는 단말 토큰 하나다.** 관리웹에서 단말을 등록해
`POST /mdm/terminals/{terminalId}:issue-token` 으로 받는다. 에뮬레이터 스크립트가 만드는 토큰은
서명이 개발용이라 실서버가 받지 않는다.

배선은 서 있고 상태 확인 경로로 검증된다. 진행은 착수 이슈에 적는다.

## 릴리스 APK 만들기

디버그 APK 는 개발 기기에만 선다. 배포하는 것은 우리 키로 서명한 릴리스 APK 다.

⛔ **서명 키와 비밀번호를 이 저장소에 두지 않는다.** 공개 저장소다. 키가 새면 남이 우리
이름으로 앱을 만들 수 있고, 한 번 push 되면 회수되지 않는다. `build.gradle` 은 값을
환경변수로만 받고, 그 값을 넣는 것은 아래 스크립트다.

### 한 번만 준비하는 것

키스토어를 만들고 비밀번호를 Keychain 에 넣는다. **비밀번호를 명령 인자로 주지 않는다** —
`ps` 목록과 셸 히스토리에 남는다.

```bash
PASS="$(openssl rand -base64 32)"
security add-generic-password -a "$USER" -s "omf-mes-client-android-release-storepass" -w "$PASS" -U
mkdir -p ~/.secrets && chmod 700 ~/.secrets
printf '%s\n%s\n\n' "$PASS" "$PASS" | keytool -genkeypair \
  -keystore ~/.secrets/omf-mes-client-android-release.jks -storetype PKCS12 \
  -alias omf-mes-mobile -keyalg RSA -keysize 4096 -validity 10950 \
  -dname "CN=OMF-MES Mobile, OU=Client, O=CREFLE, C=KR"
chmod 600 ~/.secrets/omf-mes-client-android-release.jks
unset PASS
```

⚠ **키를 잃으면 같은 앱으로 갱신할 수 없다.** 사용자가 지우고 다시 깔아야 하고 그때 기기
등록이 풀린다. 설계 결정 20 ③ 이 **키스토어 사본과 비밀번호를 조직이 접근 가능한 곳에 이중
보관**하라고 정한다 — Keychain 은 담당자 개인 계정에 묶여 있어 그 자리가 아니다. **조직
보관처는 아직 정해지지 않았다.**

### 주소와 포트를 어디서 바꾸나

**고치는 곳은 `apps/mobile/.env.local` 한 줄이다.** IP 와 포트가 모두 그 값 안에 들어간다.
이 파일은 `.gitignore` 의 `*.local` 에 걸려 커밋되지 않는다 — 사내 주소를 저장소에 적지 않는다.

```bash
# apps/mobile/.env.local
VITE_API_BASE_URL=http://<IP>:<PORT>/api
```

| 무엇 | 어디 | 비고 |
| --- | --- | --- |
| **IP · PORT** | `apps/mobile/.env.local` 의 `VITE_API_BASE_URL` | 본보기는 `apps/mobile/.env.example` |
| 경로 접두 | 같은 값의 뒤쪽(`/api`) | 서버가 접두를 두지 않으면 뺀다 |
| 버전 | `apps/mobile/android/app/build.gradle` 의 `versionCode` · `versionName` | 갱신할 때마다 `versionCode` 를 올린다 |
| 서명 키 위치 | 환경변수 `OMF_RELEASE_KEYSTORE` (기본 `~/.secrets/omf-mes-client-android-release.jks`) | 저장소에 두지 않는다 |

⚠ **이 값은 빌드 시점에 APK 안으로 굳는다.** 설치한 뒤에 바꿀 수 없다 — 주소가 바뀌면 다시
굽는다. 값을 주지 않으면 스크립트가 멈춘다.

`http://` 주소를 주면 **그 호스트 하나에만** 평문이 열린다. 아래 「평문 HTTP 는 어떻게
열리나」를 읽는다.

붙는지는 앱을 깔기 전에 먼저 확인한다.

```bash
curl -s http://<IP>:<PORT>/api/health
# {"status":"ok","db":"up","uptime":...}
```

### 만들기

```bash
VITE_API_BASE_URL=http://<사내-주소>/api apps/mobile/scripts/release-build.sh
```

주소를 주지 않으면 스크립트가 멈춘다. 그냥 두면 기본값인 단말 자신(`127.0.0.1`)으로 굳어
**빌드도 설치도 성공한 채 조회만 전부 조용히 실패한다.** `.env.local` 에 적어 두어도 된다.

산출물은 `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` 다. 스크립트가
`apksigner verify` 로 서명을 확인하고 인증서를 찍는다. 이름이 `app-release-unsigned.apk` 면
서명이 붙지 않은 것이다.

### 평문 HTTP 는 어떻게 열리나

설계 결정 20 ① 이 운영 통신을 **사내망 전용 평문 HTTP** 로 정했다. 릴리스 빌드는 기본이
평문을 막으므로 열어 주어야 하는데, **주소 전체가 아니라 그 서버 하나만 연다.**

`release-build.sh` 가 `VITE_API_BASE_URL` 의 방식을 보고 `http` 일 때만 아래를 만든다.

```
android/app/src/release/AndroidManifest.xml
android/app/src/release/res/xml/network_security_config.xml   ← 호스트 하나만
```

⛔ **이 파일들을 손으로 만들어 커밋하지 않는다.** 안에 사내 호스트가 들어가고 이 저장소는
공개다. `android/.gitignore` 의 `app/src/release/` 가 막고 있으며, 스크립트가 빌드마다 지우고
다시 쓴다. `https` 주소로 구우면 아예 만들어지지 않아 평문이 그대로 막힌다.

열리는 자리는 둘이고 좁히는 자리는 하나다.

| 층 | 무엇 | 좁혀지나 |
| --- | --- | --- |
| 시스템 정책 | `network_security_config` | **호스트 하나로 좁힌다.** 나머지는 그대로 막힌다 |
| WebView 정책 | `allowMixedContent` (`CAP_ALLOW_CLEARTEXT_HTTP`) | 좁힐 수 없다 — WebView 전체에 걸린다 |

앱이 `https://localhost` 위에서 돌기 때문에 둘 다 열어야 닿는다. 시스템 정책만 열면 혼합
콘텐츠로 막히고, WebView 만 열면 시스템 정책에서 막힌다.

빌드가 끝나면 APK 안에 실제로 무엇이 적혔는지 볼 수 있다.

```bash
AAPT2=$ANDROID_HOME/build-tools/37.0.0/aapt2
APK=apps/mobile/android/app/build/outputs/apk/release/app-release.apk

$AAPT2 dump xmltree --file AndroidManifest.xml $APK | grep -i cleartext
# 아무것도 나오지 않아야 한다 - 전면 허용 플래그는 지운다
```

Capacitor 는 `usesCleartextTraffic="true"` 를 넣는데 이것은 주소를 가리지 않는 전면 허용이다.
`networkSecurityConfig` 가 있으면 무시되지만 매니페스트에 서로 다른 두 정책이 남으므로,
생성된 릴리스 매니페스트가 `tools:remove` 로 지운다.

⚠ 그 서버가 **CORS 응답 헤더를 주지 않으면** 평문을 열어도 WebView 의 `fetch` 로는 닿지
않는다. `CAP_NATIVE_HTTP=1` 을 함께 주어 요청을 네이티브로 보낸다.

### 서명 방식

키는 하나다. `v1`~`v4` 는 **같은 키를 APK 에 어떤 형식으로 찍느냐**이고, 안드로이드 버전마다
읽을 줄 아는 형식이 다르다. 넷을 `build.gradle` 에 모두 적어 둔다.

| | 켬 | 왜 |
| --- | :-: | --- |
| v1 (JAR) | ✗ | `minSdk 33` 아래를 위한 하위 호환이라 대상이 없다 |
| v2 | ✓ | APK 전체를 통째로 서명한다 |
| v3 | ✓ | **키 교체 계보**를 담는 자리. 없으면 이 키에 영구히 묶인다 |
| v4 | ✗ | `adb --incremental` 전용. 사내 반입 설치와 무관하다 |

⚠ **넷을 다 적어야 한다.** AGP 는 아무것도 지정하지 않으면 `minSdk` 를 보고 스스로 정하는데,
하나라도 명시하면 그 계산을 그만두고 나머지를 꺼 버린다 — `enableV3Signing` 만 켜면 v2 블록이
조용히 빠진다.

⚠ **`apksigner verify -v` 는 「무엇이 들어 있나」가 아니라 「그 `minSdk` 에서 무엇이 쓰이나」를
찍는다.** Android 9 위에서는 v3 이 v2 를 대신하므로 `--min-sdk-version 33` 으로 물으면 v2 가
`false` 로 나온다. 블록이 들어 있는지 보려면 낮게 묻는다.

```bash
apksigner verify -v --min-sdk-version 24 <APK>   # 들어 있는 블록
apksigner verify -v --min-sdk-version 33 <APK>   # 실기가 실제로 쓰는 것
```

### 단말에 넣기

설계 결정 20 이 정한 것을 따른다.

| | 무엇 | 정해진 것 |
| :-: | --- | --- |
| ② | 배포 경로 | 사내 반입 설치 — USB 로 옮겨 수동으로 깐다. 단말에 「알 수 없는 출처 설치」를 켜야 한다 |
| ④ | 갱신 | 덮어쓰기 보존형. **갱신 전 미전송 0건을 확인**한다 |

덮어쓰기 갱신은 **같은 키로 서명하고 `versionCode` 를 올려야** 성립한다. 지금은 `1` 이고,
배포할 때마다 `apps/mobile/android/app/build.gradle` 에서 올린다. 키가 다르면 안드로이드가
설치를 거부하고, `versionCode` 가 같으면 갱신이 아니라 재설치가 된다 — 재설치는 앱 저장소를
지우고, 미전송이 남아 있으면 그것도 함께 사라진다.

### 아직 하지 않은 것

- **난독화** — `minifyEnabled` 는 꺼져 있다. 설계에 결정이 없다. 켜면 Capacitor 플러그인
  리플렉션이 깨질 수 있어 유지 규칙을 함께 확인해야 한다

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
