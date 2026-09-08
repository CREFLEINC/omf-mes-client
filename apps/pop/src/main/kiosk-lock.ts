/**
 * 키오스크 키 잠금 — 셸 밖으로 나가는 키 조합을 판정한다(#901).
 *
 * ⭐ **왜 창 옵션으로 부족한가.** `window-options` 의 `kiosk` · `frame:false` 는 창의 **모양**만
 *   정한다. 키 입력은 그대로 통과해서 `Alt+F4` 로 닫히고 `F11` 로 전체 화면이 풀렸다. 모양과
 *   입력은 다른 축이라 각각 잠가야 한다.
 *
 * 이 모듈은 Electron 런타임 없이 **입력 한 건을 보고 판정만** 한다. 그래야 「무엇을 막는가」를
 * 앱을 띄우지 않고 감지기로 잴 수 있다. 실제 가로채기 배선은 index.ts 가 한다.
 */

/** `before-input-event` 가 주는 값 중 판정에 쓰는 것만 추린 모양. */
export interface KeyInput {
  /** `keyDown` · `keyUp` — 누를 때 한 번만 판정한다. */
  type: string;
  /** `KeyboardEvent.key` 와 같은 값. `'F4'` · `'Tab'` · `'q'` 처럼 온다. */
  key: string;
  control: boolean;
  alt: boolean;
  shift: boolean;
  /** Windows 키 · macOS Command. */
  meta: boolean;
}

const eq = (key: string, name: string): boolean => key.toLowerCase() === name.toLowerCase();

/**
 * 정비용 탈출구 — **Ctrl+Alt+Shift+Q**.
 *
 * ⭐ **왜 하나는 남기는가.** 전부 막으면 현장에서 단말을 끌 방법이 없다. 전원을 뽑는 것이
 *   유일한 수단이 되면 쓰다 만 작업이 통째로 날아간다. 손가락 넷이 필요한 조합이라 작업 중
 *   실수로 눌리지 않고, 화면 어디에도 적혀 있지 않아 작업자가 우연히 밟지 않는다.
 */
export function isMaintenanceExit(input: KeyInput): boolean {
  return (
    input.type === 'keyDown' &&
    eq(input.key, 'q') &&
    input.control &&
    input.alt &&
    input.shift &&
    !input.meta
  );
}

/**
 * 삼켜야 하는가.
 *
 * 막는 것은 **셸 밖으로 나가는 길**뿐이다 — 창을 닫는 것, 전체 화면을 푸는 것, 다른 창으로
 * 넘어가는 것. 화면 안에서 쓰는 키(숫자 · 탭 이동 · 엔터)는 건드리지 않는다.
 */
export function isBlockedKey(input: KeyInput): boolean {
  if (input.type !== 'keyDown') return false;
  /* ⚠ 지금 아래 규칙 중 탈출구와 겹치는 것은 없다 — 이 줄은 **나중에 겹치는 규칙이 붙어도**
     탈출구가 삼켜지지 않게 하는 빗장이다. 겹치는 날 이 줄이 없으면 나갈 길이 조용히 사라진다. */
  if (isMaintenanceExit(input)) return false;

  /* 창을 닫는다 — Alt+F4 · Ctrl+W · Ctrl+Shift+W. */
  if (eq(input.key, 'F4') && input.alt) return true;
  if (eq(input.key, 'w') && (input.control || input.meta)) return true;

  /* 전체 화면을 푼다 — F11 은 Electron 기본 가속기이기도 하다. */
  if (eq(input.key, 'F11')) return true;

  /* 다른 창으로 넘어간다 — Alt+Tab · Alt+Esc · Ctrl+Esc(시작 메뉴) · Windows 키 단독.
     ⚠ 이 조합들은 대부분 OS 가 먼저 채 가서 앱까지 오지 않는다. 와도 막는다는 뜻이지
     이것만으로 Alt+Tab 이 완전히 막히지는 않는다 — 초점 회복이 실제로 일하는 몫이다. */
  if (eq(input.key, 'Tab') && input.alt) return true;
  if (eq(input.key, 'Escape') && (input.alt || input.control)) return true;
  if (eq(input.key, 'Meta')) return true;

  /* Alt+Space 는 창 제어 메뉴를 연다 — 거기에 「닫기」가 있다. */
  if (input.key === ' ' && input.alt) return true;

  return false;
}

/**
 * 화면 안의 링크를 따라가도 되는가 — #901 의 넷째 증상(「화면 안 링크는 미확인」).
 *
 * ⚠ **앞자리만 같은지 보면 새어 나간다.** `startsWith(allowed)` 하나로 재면 `pop://app` 을
 *   허용한 것이 `pop://appevil` 까지 허용한다. 오리진은 앞자리가 아니라 **경계**로 끊어야 한다 —
 *   허용값과 똑같거나, 그 뒤가 `/` · `?` · `#` 로 이어질 때만 같은 곳이다.
 */
export function isAllowedNavigation(url: string, allowedOrigin: string): boolean {
  if (url === allowedOrigin) return true;
  if (!url.startsWith(allowedOrigin)) return false;

  return ['/', '?', '#'].includes(url.charAt(allowedOrigin.length));
}

/**
 * 잠금을 걸 것인가.
 *
 * ⛔ **개발본에는 걸지 않는다** — 개발 PC에서 창이 안 닫히면 화면 작업이 막힌다.
 *
 * ⚠ 그런데 그러면 **고쳤는지 확인할 방법이 없다.** 실기 증상은 개발본에서 나타났는데
 *   개발본은 잠기지 않으니, 확인하려면 매번 배포본을 말아야 한다. 그래서 손잡이를 하나 둔다 —
 *   `POP_KIOSK_LOCK=1` 이면 개발본에서도 잠기고, `=0` 이면 배포본에서도 풀린다.
 *   ⛔ `=0` 은 확인용이다. 현장 단말에 그 값을 두면 키오스크가 아니다.
 */
export function shouldLockKiosk({
  isDev,
  override,
}: {
  isDev: boolean;
  override?: string;
}): boolean {
  if (override === '1') return true;
  if (override === '0') return false;

  return !isDev;
}
