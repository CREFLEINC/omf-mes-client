# 관리웹 컨테이너 배포

이 구성은 `apps/web` 관리웹만 배포한다. 모바일 Android 앱과 Windows POP 설치본은 서로 다른 실행 환경이므로 별도 릴리스로 관리한다.

## 이미지 게시

GitHub Actions는 `main`에 포함된 커밋에 정식 버전 태그(`vMAJOR.MINOR.PATCH`)가 생성된 경우에만 동작한다. 타입 검사, 관리웹 테스트와 이미지 빌드를 통과하면 다음 세 태그를 게시한다.

- 입력한 릴리스 태그(예: `v1.2.3`)
- 이동 태그 `stable`
- 불변 커밋 태그 `sha-xxxxxxx`

사전 릴리스 태그, `main` push, 수동 실행은 이미지를 게시하지 않는다. 저장소 설정에는 다음 Actions secret이 필요하다.

- `REGISTRY_HOST`: 이미지 레지스트리 호스트
- `FRONT_IMAGE_REPOSITORY`: 레지스트리를 포함한 전체 이미지 저장소
- `REGISTRY_USERNAME`: 레지스트리 사용자
- `REGISTRY_PASSWORD`: 레지스트리 비밀번호 또는 토큰

## 고객 서버 준비

- Docker Engine과 Docker Compose v2
- `curl` 또는 `wget`
- 프런트를 바인딩할 LAN IPv4와 공개 포트
- 경로를 제외한 백엔드 API 원점(예: `http://10.0.0.10:3100`)

실제 호스트와 포트는 저장소에 기록하지 않는다. 이미지는 공개 pull 대상으로 게시하므로 고객 서버에 레지스트리 계정이나 `docker login`이 필요하지 않다. 이미지 push용 Robot Account는 GitHub Actions secret에만 둔다.

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

이미 설치된 환경에서 다시 실행하면 기존 값을 기본값으로 보여준다. 기존 설정은 새 설정 적용 전에 `.previous` 파일로 한 번 백업한다. 이미지 pull에 실패하면 현재 설정을 바꾸지 않는다. 설치 스크립트는 레지스트리 인증 정보를 입력받거나 파일에 저장하지 않는다.

관리웹의 API 요청은 같은 출처의 `/api`로 나가고 컨테이너가 입력한 `API_UPSTREAM`으로 전달한다. 따라서 브라우저에 백엔드 주소를 노출하거나 CORS를 별도로 열 필요가 없다.

비대화식 실행이 필요하면 동일한 값을 옵션으로 전달할 수 있다.

```bash
./install-deploy.sh \
  --non-interactive \
  --version v1.2.3 \
  --bind-ip <LAN-IP> \
  --port <공개-포트> \
  --api-upstream <백엔드-원점> \
  --image-repository <레지스트리/저장소>
```

롤백은 스크립트를 다시 실행하고 이전 정식 버전을 입력한다. `stable`은 이동하는 태그이므로 설치·롤백 버전으로 받지 않는다.
