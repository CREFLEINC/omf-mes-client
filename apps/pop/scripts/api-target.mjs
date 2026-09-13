/**
 * `POP_API_TARGET` 판정 — **셸이 `/api` 요청을 대신 보낼 백엔드 원점.**
 *
 * ⭐ 화면은 언제나 자기 주소(`pop://app/api/...`)를 부르고, 셸이 그 경로를 **그대로 이어 붙여**
 *    이 원점으로 보낸다(`src/main/api-relay.ts`). 그래서 여기 오는 값은 **경로가 없는 원점**이다.
 *
 * ⛔ **`/api` 를 붙인 값을 받지 않는다.** 붙이면 `http://…/api/api/mdm/…` 로 나가고, 화면에는
 *    404 나 「서버에 연결하지 못했습니다」로만 보여 원인이 설치본에서만 드러난다. 굽는 시점에
 *    멈추는 편이 낫다.
 *
 * ⛔ **주소를 코드에 적지 않는다.** 이 저장소는 공개다 — 값은 굽는 사람이 환경변수로 준다.
 */

/** 굽는 사람이 읽을 안내. 실패 문구가 곧 사용법이다. */
const USAGE = [
  'POP_API_TARGET 에 백엔드 «원점»을 준다 — 경로(/api)는 붙이지 않는다.',
  '',
  '  VITE_API_BASE_URL 없이 화면을 굽고(기본이 pop://app/api 다):',
  '    pnpm --filter @omf-mes/web build:pop',
  '  셸을 굽는다:',
  '    POP_API_TARGET=http://<백엔드-호스트>[:포트] pnpm --filter @omf-mes/pop dist',
].join('\n');

/**
 * @param {string | undefined} value  `POP_API_TARGET` 원문
 * @param {boolean} isRelease         릴리스 빌드인가(`POP_RELEASE=1`)
 * @returns {string} 끝 슬래시를 턴 원점. 중계를 켜지 않는 개발 빌드에서는 빈 문자열
 */
export const resolveApiTarget = (value, isRelease) => {
  const raw = (value ?? '').trim();

  if (raw === '') {
    /*
     * ⚠ 릴리스에서만 막는다. 개발 빌드는 셸만 띄워 보는 일이 잦고, 그때 중계는 필요 없다.
     * ⛔ 릴리스에서 비면 설치본이 `pop://app/api` 를 부르고 셸이 그것을 화면 파일로 찾아
     *    404 를 돌려준다 — 켜지긴 하는데 아무것도 안 되는 설치본이 나간다.
     */
    if (isRelease) throw new Error(`POP_API_TARGET 이 비어 있다.\n\n${USAGE}`);
    return '';
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`POP_API_TARGET 이 주소가 아니다: ${raw}\n\n${USAGE}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`POP_API_TARGET 은 http·https 여야 한다: ${raw}\n\n${USAGE}`);
  }

  /* `/` 하나는 원점을 적다 보면 붙는다 — 그것만 봐준다. */
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== '' || url.search !== '' || url.hash !== '') {
    throw new Error(
      `POP_API_TARGET 에 경로가 붙어 있다: ${raw}\n` +
        '셸이 화면의 경로(/api/...)를 그대로 이어 붙이므로 이 값에는 원점만 준다.\n' +
        `예: ${url.origin}\n\n${USAGE}`,
    );
  }

  return url.origin;
};
