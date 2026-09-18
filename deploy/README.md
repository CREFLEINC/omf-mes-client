# 관리웹 컨테이너 배포

이 구성은 `apps/web` 관리웹만 배포한다. 모바일 Android 앱과 Windows POP 설치본은 서로 다른 실행 환경이므로 별도 릴리스로 관리한다.

## 이미지 게시

클라이언트 릴리스 태그는 `[platform]-vMAJOR.MINOR.PATCH` 형식으로 분류한다. 플랫폼은 `mobile`, `web`, `desktop`이며 예시는 `mobile-v1.2.0`, `web-v1.2.0`, `desktop-v1.2.0`이다.

현재 GitHub Actions는 `main`에 포함된 커밋에 정식 웹 버전 태그(`web-vMAJOR.MINOR.PATCH`)가 생성된 경우에만 동작한다. `mobile-v*`와 `desktop-v*` 태그에는 반응하지 않는다. 타입 검사, 관리웹 테스트와 이미지 빌드를 통과하면 다음 세 태그를 게시한다.

- 입력한 웹 릴리스 태그(예: `web-v1.2.3`)
- 이동 태그 `stable`
- 불변 커밋 태그 `sha-xxxxxxx`

⛔ **이미지가 게시돼도 서버는 그대로다.** 병합도 태그 push도 고객 서버를 바꾸지 않는다 — 반영은 그 서버에서 `install-deploy.sh`를 **사람이 다시 실행**해야 일어난다. 실제로 게시만 되고 며칠 동안 옛 버전이 돌던 적이 있다. 배포를 마쳤다고 말하기 전에 아래 「설치 후 확인」의 커밋 대조까지 한다.

사전 릴리스 태그, `main` push, 수동 실행은 이미지를 게시하지 않는다. 저장소 설정에는 다음 Actions secret이 필요하다.

- `REGISTRY_HOST`: 이미지 레지스트리 호스트
- `FRONT_IMAGE_REPOSITORY`: 레지스트리를 포함한 전체 이미지 저장소
- `REGISTRY_USERNAME`: 레지스트리 사용자
- `REGISTRY_PASSWORD`: 레지스트리 비밀번호 또는 토큰

## 고객 서버 준비

- Docker Engine과 Docker Compose v2
- `curl` 또는 `wget`
- 프런트를 바인딩할 LAN IPv4와 공개 포트
- 경로를 제외한 백엔드 API 원점(예: `http://10.0.0.10:3100`) — 고르는 기준은 아래 「API 원점 고르기」를 먼저 읽는다

**환경마다 아래 항목을 [environments.md](./environments.md)에 남긴다.** 배포 대상이 둘 이상이면 값이 서로 다르고(포트·바인딩 IP·API 원점이 전부 갈린다), 다음 담당자가 그 차이를 스스로 알아낼 방법이 없다. 다만 **계정 비밀번호·토큰·레지스트리 자격은 적지 않는다** — 공개 저장소다.

| 남길 항목            | 비고                                                         |
| -------------------- | ------------------------------------------------------------ |
| 접속 방법            | ssh 별칭·계정·`sudo` 가능 여부                               |
| 배포 디렉터리        | `install-deploy.sh`와 `.env`가 사는 곳                       |
| 바인딩 IP·공개 포트  | 그 포트를 고른 이유도 함께(이미 점유된 포트가 있으면 그것도) |
| API 원점             | 「API 원점 고르기」의 판단 근거까지                          |
| 고객이 접속하는 주소 | 서버가 나가는 주소와 다를 수 있다                            |
| 앞단 프록시·방화벽   | 출발지 제한이 있으면 어디서 확인해야 하는지                  |
| 마지막 배포          | 버전과 커밋, 확인한 날짜                                     |

이미지는 공개 pull 대상으로 게시하므로 고객 서버에 레지스트리 계정이나 `docker login`이 필요하지 않다. 이미지 push용 Robot Account는 GitHub Actions secret에만 둔다.

## API 원점 고르기

`--api-upstream`은 **브라우저가 아니라 관리웹 컨테이너가 부르는 주소**다. 그래서 「고객이 접속하는 주소」가 아니라 **그 컨테이너에서 실제로 닿는 주소**를 적어야 한다. 이 둘은 흔히 다르다.

- 백엔드가 **같은 호스트이거나 같은 LAN**에 있으면 **LAN 주소**를 쓴다(예: `http://10.0.0.10:9000`).
- **NAT 뒤의 공인 IP·공인 도메인을 쓰지 않는다.** 서버가 자기 공인 주소로 나가면 자신에게 되돌아와야 하는데(헤어핀 NAT) 대개 열려 있지 않아 `/api`가 **전부 504**가 된다. 브라우저는 그 공인 주소로 잘 들어오기 때문에 「화면은 뜨는데 API만 안 되는」 모습으로 나타난다.
- 고르기 전에 **컨테이너 관점에서 재 본다.** 호스트에서 되는 것으로는 부족하다.

```bash
# 설치 전: 후보 주소가 이 서버에서 닿는가
curl -s -o /dev/null -w '%{http_code}\n' <후보-원점>/api/health

# 설치 후: 관리웹 컨테이너 안에서도 닿는가(여기서 갈리는 경우가 있다)
docker exec "$(docker compose ps -q)" wget -q -O /dev/null -S <후보-원점>/api/health
```

## 단일 스크립트 배포

고객 서버의 배포 디렉터리에 `install-deploy.sh` 하나만 복사하고 실행한다.

```bash
chmod +x install-deploy.sh
./install-deploy.sh
```

스크립트는 다음 작업을 순서대로 수행한다.

1. 정식 배포 버전, LAN IP, 공개 포트, 백엔드 API 원점과 이미지 저장소 입력
2. 입력값과 Docker Compose 실행 환경 검증
3. 선택한 버전 이미지 pull
4. 권한 `0600`의 `.env`와 `compose.yaml` 생성
5. `docker compose up -d` 실행
6. 외부 공개 주소의 `/healthz` 응답 확인

이미 설치된 환경에서 다시 실행하면 기존 값을 기본값으로 보여준다(두 번째부터는 아래 「업그레이드」를 본다). 기존 설정은 새 설정 적용 전에 `.previous` 파일로 한 번 백업한다. 이미지 pull에 실패하면 현재 설정을 바꾸지 않는다. 설치 스크립트는 레지스트리 인증 정보를 입력받거나 파일에 저장하지 않는다.

관리웹의 API 요청은 같은 출처의 `/api`로 나가고 컨테이너가 입력한 `API_UPSTREAM`으로 전달한다. 따라서 브라우저에 백엔드 주소를 노출하거나 CORS를 별도로 열 필요가 없다.

비대화식 실행이 필요하면 동일한 값을 옵션으로 전달할 수 있다.

```bash
./install-deploy.sh \
  --non-interactive \
  --version web-v1.2.3 \
  --bind-ip <LAN-IP> \
  --port <공개-포트> \
  --api-upstream <백엔드-원점> \
  --image-repository <레지스트리/저장소>
```

## 업그레이드

두 번째 배포부터는 **바꿀 값만** 주면 된다. 나머지는 스크립트가 그 서버의 `.env`에서 읽는다(`load_existing_defaults`가 `FRONT_BIND_IP`·`FRONT_PORT`·`API_UPSTREAM`·`IMAGE_REPOSITORY`·`IMAGE_TAG`를 채운다).

```bash
cd /opt/services/omf-mes-front
./install-deploy.sh --non-interactive --version web-vX.Y.Z
```

### 이미지와 함께 오는 것 / 오지 않는 것

|                                           | 새 버전을 올리면    | 왜                                                                                                              |
| ----------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| 화면(정적 파일)                           | 갱신된다            | 이미지 안에 있다                                                                                                |
| nginx 설정(`nginx/default.conf.template`) | 갱신된다            | 이미지에 굽는다(`Dockerfile`) — **서버에서 고칠 파일이 아니다.** 설정을 바꾸려면 저장소에서 고쳐 새 버전을 낸다 |
| `compose.yaml`                            | 갱신된다            | 스크립트가 실행할 때마다 다시 쓴다                                                                              |
| **`install-deploy.sh` 자체**              | **갱신되지 않는다** | 서버 사본은 복사한 시점의 것이다                                                                                |

⛔ **스크립트가 바뀐 릴리스에서는 스크립트부터 다시 복사한다.** 컨테이너 구성이 달라지는 변경(포트 매핑 형식·새 환경변수·헬스체크 방식)이 여기 해당하고, 옛 스크립트로 실행하면 새 구성이 반영되지 않은 채 「배포 완료」가 뜬다.

```bash
# 해시가 같으면 그대로 쓰고, 다르면 복사한다
shasum -a 256 deploy/install-deploy.sh                       # 개발 PC(저장소 루트)
ssh <서버> 'sha256sum /opt/services/omf-mes-front/install-deploy.sh'

script=/opt/services/omf-mes-front/install-deploy.sh
cat deploy/install-deploy.sh | ssh <서버> "cat > $script && chmod +x $script"
```

### 안전장치

- 이미지 pull에 실패하면 **현재 설정을 바꾸지 않는다** — 받지 못한 버전으로 갈아타다 멈추는 일은 없다.
- 기존 `.env`와 `compose.yaml`은 새 설정을 쓰기 전에 `.previous`로 한 번 백업한다.

## 설치 후 확인

⛔ **스크립트의 통과 기준은 `/healthz` 하나뿐이고 `/api`는 보지 않는다.** 「배포가 완료되었습니다」는 정적 파일이 떴다는 뜻이지 API까지 산다는 뜻이 아니다. 아래 네 가지를 직접 본다.

```bash
# ① 컨테이너가 healthy 인가 · 어느 이미지인가
docker compose ps

# ② 배포한 커밋이 맞는가 — 태그가 가리키는 커밋과 대조한다
docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker compose ps -q)"

# ③ 정적 파일
curl -s <바인딩-주소>/healthz   # → ok
curl -s -o /dev/null -w '%{http_code}\n' <바인딩-주소>/

# ④ API 중계 — 여기까지 봐야 배포가 끝난 것이다
curl -s -w '\n%{http_code}\n' <바인딩-주소>/api/health
```

④가 **504**면 업스트림에 닿지 못한 것이다(「API 원점 고르기」 참고). **401**은 정상이다 — 로그인 전이라는 뜻이고 API까지 닿았다는 증거다.

### 증상을 읽는 법

- **브라우저에 백엔드 포트가 보이지 않는 것은 정상이다.** 화면은 같은 출처의 `/api`로 부르므로 주소창·개발자도구에는 관리웹 포트만 보인다. 백엔드 포트는 컨테이너 안에서 nginx가 붙인다. 이것을 「포트가 빠진 채 호출된다」로 읽고 화면 코드를 뒤지면 엉뚱한 곳을 판다.
- **판정은 컨테이너 로그로 한다.** 실제로 나간 주소와 포트가 여기 찍힌다.

```bash
docker compose logs --tail=50 | grep upstream
# upstream: "http://10.0.0.10:9000/api/app/sessions/current"  ← 실제로 나간 주소
```

- 로그의 `upstream:` 주소가 의도한 값인데도 타임아웃이면 **주소는 맞고 경로가 막힌 것**이다(방화벽·NAT·백엔드 미기동). 주소 자체가 다르면 `.env`의 `API_UPSTREAM`을 잘못 넣은 것이니 스크립트를 다시 실행해 바로잡는다.

## 롤백

롤백은 스크립트를 다시 실행하고 이전 정식 버전을 입력한다. `stable`은 이동하는 태그이므로 설치·롤백 버전으로 받지 않는다.
