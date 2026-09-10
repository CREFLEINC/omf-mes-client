/**
 * POP 단말 토큰 — 셸이 보관한 것을 읽어 요청에 실을 수 있게 들고 있는 자리(#999).
 *
 * ## 왜 필요한가
 *
 * 설계는 POP 을 **단말 토큰으로 인증**하고(`Authorization: Bearer <단말 토큰>`), 그 토큰을
 * OS 자격증명 저장소에 보관하도록 정했다. 셸은 보관 통로(`window.pop.deviceToken`)를 이미
 * 열어 두었는데 **읽어서 요청에 싣는 쪽이 없었다** — POP 은 지금까지 어떤 요청에도 토큰을
 * 싣지 않았고, 그래서 인증층이 통째로 비어 있었다.
 *
 * ## 왜 동기 읽기와 비동기 읽기가 갈라져 있는가
 *
 * 셸에서 읽는 것은 프로세스를 건너가므로 **비동기**인데, 요청을 가로채 헤더를 붙이는 자리는
 * **동기**다. 그래서 한 번 읽어 여기 두고(`readTerminalToken`), 요청은 그 값을 즉시
 * 꺼내 쓴다(`currentTerminalToken`). 모바일 셸이 같은 사정을 같은 형태로 풀었다.
 *
 * ⛔ **읽기 전에 화면을 세우지 않는다.** 먼저 세우면 첫 조회들이 토큰 없이 나가 401 로
 *    떨어지고, 화면은 「단말이 확인되지 않았습니다」를 잠깐 보였다가 스스로 고쳐지는
 *    것처럼 움직인다 — 진짜 미등록과 구분되지 않는다. 부르는 쪽이 순서를 지킨다.
 *
 * ⚠ **토큰을 여기에 «넣는» 길은 아직 없다.** 단말에 토큰을 주입하는 방법은 설계 미결이라
 *    (설계 사양서 §3.2.4 파급 목록) 이 파일은 **읽기만** 한다. 주입 방식이 정해지면 쓰기와
 *    등록 관문이 그때 붙는다 — 그때까지 현장 단말은 토큰이 없고, 그 상태에서 화면이 잠기는
 *    것은 「모르는 것을 통과로 처리하지 않는다」에 맞다.
 */

/** 셸이 여는 통로 중 **이 자리가 쓰는 것만** 좁게 읽는다(#441 — 통로를 넓히지 않는다). */
interface PopTokenBridge {
  deviceToken: {
    get: () => Promise<string | undefined>;
  };
}

const isBridge = (value: unknown): value is PopTokenBridge => {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as { deviceToken?: { get?: unknown } };

  return typeof candidate.deviceToken?.get === 'function';
};

const bridge = (): PopTokenBridge | null => {
  const pop = (globalThis as { pop?: unknown }).pop;

  return isBridge(pop) ? pop : null;
};

/* 마지막으로 읽은 값. 요청 가로채기가 동기라 여기서 꺼내 간다. */
let cached: string | null = null;

/**
 * 셸에서 단말 토큰을 읽어 둔다. **화면을 세우기 전에 한 번 부른다.**
 *
 * ⛔ **던지지 않는다.** 셸이 없는 것(브라우저·관리웹)도, 자격증명 저장소를 쓸 수 없는 것도
 *    여기서는 똑같이 「토큰이 없다」로 끝난다 — 기동을 막을 일이 아니다. 무엇이 잘못됐는지는
 *    토큰이 필요한 요청이 거절될 때 그 자리에서 드러난다.
 */
export const readTerminalToken = async (): Promise<string | null> => {
  const pop = bridge();

  if (pop === null) {
    cached = null;

    return null;
  }

  try {
    const token = await pop.deviceToken.get();

    cached = token === undefined || token === '' ? null : token;
  } catch {
    cached = null;
  }

  return cached;
};

/**
 * 지금 요청에 실을 단말 토큰. **아직 읽기 전이거나 셸 밖이면 `null`** 이고, 그때 요청은
 * 인증 헤더 없이 나간다.
 */
export const currentTerminalToken = (): string | null => cached;

/** 시험 전용 — 모듈에 남은 값을 지운다. 시험 사이에 토큰이 새지 않게 한다. */
export const forgetTerminalToken = (): void => {
  cached = null;
};
