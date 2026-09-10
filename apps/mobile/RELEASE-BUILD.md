# 배포 빌드 참고자료

배포용 APK 를 빌드할 때 참고한다. 디버그 APK 는 개발 기기에서만 동작한다. 배포하는 것은
우리 키로 서명한 릴리스 APK 다.

| 항목 | 값 |
| --- | --- |
| 산출물 | `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` |
| 패키지 | `com.crefle.omfmes.mobile` |
| 서명 별칭 | `omf-mes-mobile` |
| 서명 방식 | v2 + v3 |
| 지원 단말 | Android 13+ (`minSdk 33`) |

## 준비물

| 항목 | 위치 | 구분 |
| --- | --- | --- |
| 빌드 스크립트 | `apps/mobile/scripts/release-build.sh` | 저장소 포함 (macOS 전용) |
| 서명 설정 | `apps/mobile/android/app/build.gradle` | 저장소 포함 |
| 키스토어 파일 | `~/.secrets/omf-mes-client-android-release.jks` | **별도 준비** |
| 키스토어 비밀번호 | macOS Keychain `omf-mes-client-android-release-storepass` | **별도 준비** |
| API 주소 | `apps/mobile/.env.local` | **별도 준비** |

⛔ **서명 키와 비밀번호를 이 저장소에 두지 않는다.** 공개 저장소다. 키가 유출되면 다른 사람이
우리 이름으로 앱을 만들 수 있고, 한 번 push 되면 회수되지 않는다. `build.gradle` 은 값을
환경변수로만 받는다.

## 키스토어 만들기

최초 1회만 한다. 이미 키스토어가 있으면 이 절을 건너뛴다.

**비밀번호를 명령 인자로 주지 않는다** — `ps` 목록과 셸 히스토리에 남는다.

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

Keychain 에 먼저 넣고 키스토어를 만든다. 순서가 반대면 중간에 실패했을 때 열 수 없는 파일만
남는다.

⚠ **키스토어를 분실하면 기존에 설치된 앱을 갱신할 수 없다.** 앱을 삭제하고 다시 설치해야
하며, 이때 기기 등록이 해제된다.

### 받은 키스토어 확인

지문이 아래 값과 일치해야 한다. 다르면 다른 키이며, 그 키로 빌드한 APK 는 기존 설치를
갱신할 수 없다.

```bash
keytool -list -v -keystore omf-mes-client-android-release.jks | grep SHA256

# SHA256: 14:DA:58:2B:3A:65:40:CA:F3:E6:EA:F1:CA:C6:09:60:
#         2B:84:A6:08:BA:7D:8D:52:D2:83:5C:EB:BB:8D:34:5A
```

## 개발 도구

최초 1회만 설치한다. 버전 조합이 맞지 않으면 원인을 파악하기 어려운 빌드 오류가 발생한다.

| 항목 | 버전 | 정의된 위치 |
| --- | --- | --- |
| Node.js | 20.19 이상 | `package.json` · `engines` |
| pnpm | 11.20.0 | `package.json` · `packageManager` |
| JDK | 21 | 이 문서 |
| Gradle | 9.5.0 | wrapper 가 자동 설치 |
| Android Gradle Plugin | 9.3.2 | `android/build.gradle` |
| Capacitor | 8.5.0 | `apps/mobile/package.json` |
| `compileSdk` · `targetSdk` | 37 | `android/variables.gradle` |
| `minSdk` | 33 | `android/variables.gradle` |

```bash
# macOS 기준
brew install openjdk@21
brew install --cask android-commandlinetools

export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses
sdkmanager --sdk_root="$ANDROID_HOME" \
  "platform-tools" "platforms;android-37.1" "build-tools;37.0.0"
```

에뮬레이터와 시스템 이미지는 빌드에 필요하지 않다. 실기 확인만 한다면 설치하지 않아도 된다.

## API 주소 설정

IP 와 포트는 `apps/mobile/.env.local` 한 줄에 들어간다. 이 파일은 `.gitignore` 의 `*.local`
규칙에 걸려 커밋되지 않는다 — 사내 주소를 저장소에 적지 않는다.

```bash
# apps/mobile/.env.local
VITE_API_BASE_URL=http://<IP>:<PORT>/api
```

빌드 스크립트와 웹 빌드가 모두 이 값을 읽는다. 명령에 직접 주면 그쪽이 우선한다.

| 무엇 | 어디 |
| --- | --- |
| IP · PORT | `apps/mobile/.env.local` 의 `VITE_API_BASE_URL` (본보기는 `.env.example`) |
| 경로 접두 | 같은 값의 뒤쪽(`/api`). 서버가 접두를 두지 않으면 뺀다 |
| 버전 | `android/app/build.gradle` 의 `versionCode` · `versionName` |
| 키스토어 위치 | 환경변수 `OMF_RELEASE_KEYSTORE` (기본 `~/.secrets/...jks`) |

⚠ **이 값은 빌드 시점에 APK 안에 고정된다.** 설치한 뒤에는 바꿀 수 없다. 주소가 바뀌면 다시
빌드한다. 값을 주지 않으면 스크립트가 중단된다 — 기본값인 `127.0.0.1` 은 단말 자신을 가리켜
빌드와 설치는 성공하고 조회만 전부 실패한다.

앱을 설치하기 전에 서버부터 확인한다. 인증 없이 호출할 수 있는 경로는 상태 확인 하나다.

```bash
curl -s http://<IP>:<PORT>/api/health
# {"status":"ok","db":"up","uptime":...}
```

## 빌드

스크립트가 Keychain 에서 비밀번호를 읽어 gradle 에 전달하고 서명 검증까지 수행한다. 값이
저장소에도 셸 히스토리에도 `argv` 에도 남지 않는다.

```bash
apps/mobile/scripts/release-build.sh
```

산출물 이름이 `app-release-unsigned.apk` 면 서명되지 않은 것이며 단말에 설치할 수 없다.

### macOS 외 운영체제

스크립트는 macOS Keychain(`security` 명령)을 사용한다. 다른 운영체제에서는 아래 순서로 직접
실행한다. `build.gradle` 은 환경변수만 참조하므로 운영체제 제약이 없다.

```bash
# ① 웹 빌드 — 이 시점에 API 주소가 APK 에 고정된다
VITE_API_BASE_URL=http://<IP>:<PORT>/api pnpm --filter @omf-mes/mobile build

# ② 평문 HTTP 설정 작성 — http 주소인 경우에만. 아래 「평문 HTTP」 참고

# ③ 네이티브 동기화 — 웹 자산과 플러그인이 이 단계에서 생성된다
cd apps/mobile
CAP_ALLOW_CLEARTEXT_HTTP=1 npx cap sync android   # http 인 경우에만 지정

# ④ 서명 빌드
cd android
OMF_RELEASE_KEYSTORE=/경로/omf-mes-client-android-release.jks \
OMF_RELEASE_KEY_ALIAS=omf-mes-mobile \
OMF_RELEASE_KEYSTORE_PASSWORD='<비밀번호>' \
  ./gradlew assembleRelease
```

⚠ ③을 생략하고 ④만 실행하면 **이전 웹 화면이 포함된 APK** 가 생성된다. 웹 자산과 Capacitor
플러그인은 저장소에 없고 ③에서 생성된다.

| 환경변수 | 용도 | 기본값 |
| --- | --- | --- |
| `OMF_RELEASE_KEYSTORE` | 키스토어 경로 | `~/.secrets/omf-mes-client-android-release.jks` |
| `OMF_RELEASE_KEY_ALIAS` | 키 별칭 | `omf-mes-mobile` |
| `OMF_RELEASE_KEYSTORE_PASSWORD` | 키스토어 비밀번호 | 필수 |
| `VITE_API_BASE_URL` | API 주소·포트 | 필수 |

## 평문 HTTP

릴리스 빌드는 기본적으로 평문 HTTP 를 차단한다. 설계 결정 20 ① 이 운영 통신을 사내망 전용
평문으로 정했으므로 허용이 필요하다. 다만 **주소 전체가 아니라 해당 호스트 하나만** 허용한다.

`release-build.sh` 가 `VITE_API_BASE_URL` 의 방식을 보고 `http` 인 경우에만 아래를 생성한다.
`https` 면 생성하지 않으며 평문은 그대로 차단된다.

```
android/app/src/release/AndroidManifest.xml
android/app/src/release/res/xml/network_security_config.xml   ← 호스트 하나만
```

⛔ **이 파일들을 커밋하지 않는다.** 사내 호스트가 포함되며 저장소는 공개다.
`android/.gitignore` 의 `app/src/release/` 규칙이 차단하고 있으므로 그 규칙을 삭제하지 않는다.
스크립트가 빌드마다 삭제하고 다시 작성한다.

수동 빌드에서는 직접 작성해야 한다. 없으면 빌드는 성공하지만 앱이 서버와 통신하지 못한다.

```xml
<!-- res/xml/network_security_config.xml -->
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false"><IP></domain>
    </domain-config>
</network-security-config>
```

```xml
<!-- AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
    <application
        android:networkSecurityConfig="@xml/network_security_config"
        tools:replace="android:networkSecurityConfig"
        tools:remove="android:usesCleartextTraffic" />
</manifest>
```

`<domain>` 에는 호스트만 입력한다. 포트는 포함하지 않는다.

### 허용되는 계층은 둘이다

| 계층 | 무엇 | 범위를 좁힐 수 있나 |
| --- | --- | --- |
| 시스템 정책 | `network_security_config` | **호스트 하나로 좁힌다.** 나머지는 차단된다 |
| WebView 정책 | `allowMixedContent` (`CAP_ALLOW_CLEARTEXT_HTTP`) | 좁힐 수 없다. WebView 전체에 적용된다 |

앱이 `https://localhost` 위에서 동작하므로 둘 다 열어야 통신된다. 시스템 정책만 열면 혼합
콘텐츠로 차단되고, WebView 만 열면 시스템 정책에서 차단된다.

빌드 후 APK 에 기록된 내용을 확인할 수 있다.

```bash
AAPT2=$ANDROID_HOME/build-tools/37.0.0/aapt2
APK=apps/mobile/android/app/build/outputs/apk/release/app-release.apk

$AAPT2 dump xmltree --file AndroidManifest.xml $APK | grep -i cleartext
# networkSecurityConfig 만 나와야 한다
```

Capacitor 는 `usesCleartextTraffic="true"` 를 추가하는데, 이는 주소를 가리지 않는 전면 허용이다.
`networkSecurityConfig` 가 있으면 무시되지만 매니페스트에 서로 다른 두 정책이 남으므로,
생성된 릴리스 매니페스트가 `tools:remove` 로 제거한다.

⚠ API 서버가 **CORS 응답 헤더를 반환하지 않으면** 평문을 허용해도 화면에서 호출한 요청이
실패한다. 빌드 시 `CAP_NATIVE_HTTP=1` 을 함께 지정해 요청을 네이티브 계층으로 보낸다.

## 서명 확인

```bash
APKSIGNER=$ANDROID_HOME/build-tools/37.0.0/apksigner
APK=apps/mobile/android/app/build/outputs/apk/release/app-release.apk

$APKSIGNER verify --print-certs $APK
# certificate SHA-256 digest: 14da582b3a6540caf3e6eaf1cac60960...
```

스크립트로 빌드한 경우 이 검증이 마지막 단계에 포함되어 있다. 출력된 지문이 「받은 키스토어
확인」의 값과 일치해야 한다.

### 서명 방식

키는 하나다. `v1`~`v4` 는 **같은 키를 APK 에 기록하는 형식**의 차이이며, 안드로이드 버전마다
읽을 수 있는 형식이 다르다. 넷을 `build.gradle` 에 모두 명시한다.

| | 사용 | 이유 |
| --- | :-: | --- |
| v1 (JAR) | ✗ | `minSdk 33` 미만을 위한 하위 호환이라 대상이 없다 |
| v2 | ✓ | APK 전체를 서명한다 |
| v3 | ✓ | **키 교체 계보**를 담는다. 없으면 이 키에 영구히 묶인다 |
| v4 | ✗ | `adb --incremental` 전용. 사내 반입 설치와 무관하다 |

⚠ **넷을 다 명시해야 한다.** AGP 는 아무것도 지정하지 않으면 `minSdk` 를 보고 스스로 정하는데,
하나라도 명시하면 그 계산을 중단하고 나머지를 끈다 — `enableV3Signing` 만 켜면 v2 블록이
누락된다.

⚠ **`apksigner verify -v` 는 APK 에 포함된 형식이 아니라 「해당 `minSdk` 에서 실제로 사용되는
형식」을 출력한다.** Android 9 이상에서는 v3 이 v2 를 대체하므로 `--min-sdk-version 33` 으로
조회하면 v2 가 `false` 로 표시된다. 포함 여부를 보려면 낮은 값으로 조회한다.

```bash
$APKSIGNER verify -v --min-sdk-version 24 $APK   # 포함된 형식 → v2·v3 모두 true
$APKSIGNER verify -v --min-sdk-version 33 $APK   # 실제 사용 형식 → v3 만 true
```

## 단말 설치

설계 결정 20 이 정한 것을 따른다.

| | 무엇 | 정해진 것 |
| :-: | --- | --- |
| ② | 배포 경로 | 사내 반입 설치. USB 로 옮겨 수동 설치하며, 단말에서 「알 수 없는 출처 설치」를 허용해야 한다 |
| ④ | 갱신 | 덮어쓰기 보존형. **갱신 전 미전송 0건을 확인**한다 |

덮어쓰기 갱신은 **동일한 키로 서명하고 `versionCode` 를 상향해야** 성립한다. 현재 값은 `1` 이며
배포할 때마다 `android/app/build.gradle` 에서 올린다. 키가 다르면 설치가 거부되고,
`versionCode` 가 같으면 갱신이 아닌 재설치가 된다. 재설치는 앱 저장소를 초기화하므로 미전송
데이터가 남아 있으면 함께 사라진다.

## 참고

| 항목 | 현재 상태 |
| --- | --- |
| 난독화 | `minifyEnabled` 비활성. 설계에 결정이 없다. 활성화하면 Capacitor 플러그인 리플렉션에 영향을 줄 수 있어 별도 확인이 필요하다 |
| 실기 통신 | APK 에 기록된 네트워크 정책까지 확인했다. 실제 사내 서버와의 통신은 확인하지 않았다 |
