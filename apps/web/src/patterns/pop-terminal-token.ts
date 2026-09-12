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
 * ⭐ **주입 경로가 정해졌다**(공유계약 F-4 · 요청 #536 반영 2026-09-10). 관리웹이 발급
 *    대화상자에서 POP 에는 **토큰 필드·복사 버튼**으로 한 번 내주고, 설치 담당자가 그것을
 *    P-CO-01 등록 패널에 **붙여넣는다.** QR·POP 카메라·수기 입력·짧은 등록코드 교환은
 *    채택되지 않았다. 그래서 이 파일은 읽기에 더해 **쓰기**(`writeTerminalToken`)를 갖는다.
 *
 * ⛔ **검증하지 않은 토큰을 쓰지 않는다.** 쓰기는 「서버가 200 으로 확인해 준 바로 그 후보
 *    토큰」에만 쓴다 — 등록 절차는 `patterns/pop-registration` 이 소유하고, 이 파일은
 *    보관 통로일 뿐 판정하지 않는다.
 */

/** 셸이 여는 통로 중 **이 자리가 쓰는 것만** 좁게 읽는다(#441 — 통로를 넓히지 않는다). */
interface PopTokenBridge {
  deviceToken: {
    get: () => Promise<string | undefined>;
    set: (value: string) => Promise<void>;
  };
}

const isBridge = (value: unknown): value is PopTokenBridge => {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as { deviceToken?: { get?: unknown; set?: unknown } };

  return (
    typeof candidate.deviceToken?.get === 'function' &&
    typeof candidate.deviceToken?.set === 'function'
  );
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

/*
 * 검증 중인 후보 토큰. **적용 전에만** 선다 — 등록 패널이 「이 토큰이 진짜인가」를 서버에
 * 물을 때, 그 한 번의 조회는 «아직 보관하지 않은» 토큰으로 나가야 하기 때문이다.
 */
let candidate: string | null = null;

/**
 * 후보 토큰을 임시로 세운다. **등록 검증 조회를 감싸는 동안만** 쓴다.
 *
 * ⛔ **업무 요청이 도는 동안 켜지 않는다.** 이 값은 모든 요청에 실리므로, 켜 둔 채 다른
 *    조회가 나가면 그것까지 후보 토큰으로 인증된다. 등록이 끝나기 전에는 업무 요청이
 *    열리지 않으므로(F-4 「등록 전 차단」) 그 창 안에서만 안전하다.
 */
export const setCandidateTerminalToken = (value: string | null): void => {
  candidate = value === '' ? null : value;
};

/**
 * 지금 요청에 실을 단말 토큰. **아직 읽기 전이거나 셸 밖이면 `null`** 이고, 그때 요청은
 * 인증 헤더 없이 나간다.
 *
 * 검증 중인 후보가 있으면 그것이 이긴다 — 등록 검증은 보관된 토큰이 아니라 **확인하려는
 * 그 토큰**으로 물어야 답이 뜻을 갖는다.
 */
export const currentTerminalToken = (): string | null => candidate ?? cached;

/**
 * 검증을 마친 후보 토큰을 셸의 자격증명 저장소에 보관하고, 이후 요청이 쓸 값으로 세운다.
 *
 * ⛔ **셸이 없으면 보관하지 않는다** — 브라우저로 여는 개발 확인에는 자격증명 저장소가
 *    없다. 그 경우 `false` 를 돌려주고 부르는 쪽이 「이 단말에는 보관할 수 없다」를 말한다.
 *    메모리에만 남겨 성공한 것처럼 보이면, 단말을 껐다 켠 뒤에야 등록이 풀린 것이 드러난다.
 *
 * ⚠ **보관이 성공해야 메모리 값도 바꾼다.** 순서를 뒤집으면 저장에 실패한 토큰으로 요청이
 *    나가고, 다시 켰을 때만 원래 토큰으로 돌아가 같은 단말이 회차마다 다르게 움직인다.
 */
export const writeTerminalToken = async (
  value: string,
  options: { allowMemoryOnly?: boolean } = {},
): Promise<boolean> => {
  const pop = bridge();

  if (pop === null) {
    /*
     * ⚠ **개발 서버에서 브라우저로 여는 경우만** 메모리에 둔다 — 셸이 없어 자격증명
     *   저장소가 아예 없고, 막으면 등록 흐름 자체를 화면에서 확인할 수 없다. 새로고침하면
     *   사라지는 것이 정직한 동작이다. ⛔ 배포 번들에서는 이 갈래가 서지 않는다.
     */
    if (options.allowMemoryOnly === true) {
      cached = value;

      return true;
    }

    return false;
  }

  try {
    await pop.deviceToken.set(value);
  } catch {
    return false;
  }

  cached = value;

  return true;
};

/**
 * 보관된 토큰을 **버린다** — 서버가 그 토큰을 보고 「더는 못 쓴다」고 답했을 때만 부른다(#1137).
 *
 * ⛔ **못 물어본 것을 버리지 않는다.** 판정 여부는 부르는 쪽(`patterns/pop-registration`)이
 *    가리고, 이 자리는 지우기만 한다 — 여기서 다시 판단하면 규칙이 두 곳에 생긴다.
 *
 * ⚠ **빈 값으로 덮어쓴다.** 셸의 보관 통로에는 지우는 문이 따로 없고(`deviceToken` 은
 *   `get`·`set` 둘뿐), 읽는 쪽이 빈 문자열을 「없음」으로 본다(`readTerminalToken`). 통로를
 *   넓히지 않고 같은 결과를 낸다.
 *
 * ⚠ **메모리 값을 먼저 비우지 않는다.** 보관에 실패했는데 메모리만 비우면, 껐다 켠 뒤 죽은
 *   토큰이 되살아나 같은 화면이 다시 선다 — 지금 세션에서만 사라져 더 헷갈린다.
 */
export const discardStoredTerminalToken = async (): Promise<void> => {
  const pop = bridge();

  if (pop !== null) {
    try {
      await pop.deviceToken.set('');
    } catch {
      /* 못 지웠으면 다음 기동에서 같은 길을 다시 지난다 — 화면을 막을 일은 아니다. */
    }
  }

  cached = null;
  candidate = null;
};

/** 시험 전용 — 모듈에 남은 값을 지운다. 시험 사이에 토큰이 새지 않게 한다. */
export const forgetTerminalToken = (): void => {
  cached = null;
  candidate = null;
};
