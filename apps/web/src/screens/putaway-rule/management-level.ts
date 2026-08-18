import { messages } from '@omf-mes/i18n';

/**
 * 창고 관리수준에 따른 **위치 입력의 개폐**.
 *
 * ## 자리표시 상수 하나뿐이다
 *
 * 위치를 쓰는 창고와 쓰지 않는 창고를 가르는 **값 목록이 아직 정해지지 않았다**(`omf-mes#64`).
 * 계약은 `Warehouse.managementLevelCode`를 열린 문자열로 두었고 어떤 값이 「위치까지
 * 관리한다」인지는 설계가 정한다.
 *
 * 그래서 **빈 배열**을 둔다 — 비어 있는 것이 지금의 사실이다.
 *
 * - 배열이 비어 있는 동안 **모든 창고에서 위치 입력이 열린다**(이슈 §4 · 계획 §6-2 미결 1)
 * - 값이 채워지는 순간 개폐가 **저절로 살아난다** — 다른 자리를 고칠 필요가 없다
 * - 그동안 화면은 「아직 정해지지 않았다」를 안내로 밝힌다. 감추면 사용자는 위치를 쓰지 않는
 *   창고에도 위치를 넣어도 되는 것으로 읽는다
 *
 * ⚠ **막는 쪽으로 기울지 않는다.** 확정 전에 잠그면 위치를 실제로 쓰는 창고에서 규칙을 만들
 * 수 없고, 그 창고는 규칙 없는 품목으로 남아 현장이 위치 검증 없이 통과한다(공유계약 G-12).
 * 열어 두었을 때의 위험(쓰지 않는 창고에 위치가 박힌다)은 규칙을 고쳐 되돌릴 수 있다.
 *
 * ## 코드 목록을 **인자로 받는다**
 *
 * 상수를 함수 안에서 직접 읽으면 「채워진 뒤의 동작」을 잴 방법이 없어진다 — 자리표시의
 * 요점이 *값이 오는 날 저절로 사는 것*인데, 그 사실을 지금 확인할 수 없으면 확인되지 않은
 * 약속이 된다. 부르는 자리가 상수를 넘긴다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.putawayRule;

/**
 * 위치까지 관리하는 창고의 관리수준 코드.
 *
 * **비어 있는 것이 지금의 사실이다**(`omf-mes#64` — 비공개 저장소이므로 번호로만 참조한다).
 * 값이 정해지면 이 배열만 채운다.
 */
export const LOCATION_MANAGED_LEVEL_CODES: readonly string[] = [];

/**
 * 위치 입력을 열 것인가.
 *
 * **목록이 비어 있으면 언제나 연다** — 아직 가를 근거가 없는데 가르면 화면이 없는 규칙을
 * 지어내는 것이다. 목록이 채워지면 그 목록에 든 창고에서만 열리고, **관리수준을 모르는
 * 창고는 잠근다**(확인하지 못한 것을 「열어도 되는 것」으로 읽지 않는다).
 */
export const isLocationInputOpen = (
  managedLevelCodes: readonly string[],
  managementLevelCode: string | null,
): boolean =>
  managedLevelCodes.length === 0 ||
  (managementLevelCode !== null && managedLevelCodes.includes(managementLevelCode));

/**
 * 「아직 정해지지 않았다」는 안내. 정해진 뒤에는 서지 않는다.
 *
 * 값이 확정되면 개폐가 사실을 말하므로 안내가 설 이유가 사라진다 — 남겨 두면 화면이
 * 이미 지난 사정을 계속 말하게 된다.
 */
export const locationInputPendingNote = (
  managedLevelCodes: readonly string[],
): string | undefined =>
  managedLevelCodes.length === 0 ? t.notes.managementLevelPending : undefined;
