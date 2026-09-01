import { messages } from '@omf-mes/i18n';

import { PLACEHOLDER_CAUSE_CODES } from './code-options';
import { DONE_STATUS, RECEIVED_STATUS, type BreakdownDetailView } from './types';

/**
 * 상태 전이와 저장을 **막을 수 있는가**의 판정.
 *
 * ⭐ **상태를 본문으로 받지 않는다.** 「처리 중으로」와 「완료」는 각각 전용 경로이고 **되돌리는
 * 경로가 없다** — 사건 기록이라 전표와 다르다. 그래서 판정을 한 자리에 모아 둔다: 버튼을
 * 잠그는 규칙과 사유가 흩어지면 한쪽만 고쳐져 「눌리는데 실패하는 버튼」이나 「이유 없이 잠긴
 * 버튼」이 생긴다.
 *
 * **막는 사유를 문자열로 낸다** — 잠그기만 하고 이유를 감추면 사용자가 할 수 있는 것이 없다
 * (배치 규범 4 · 공유계약 G-2·G-3).
 *
 * **순수 함수만 둔다.** 「지금 저장 중인가」는 화면이 따로 본다 — 그것은 자료의 성질이 아니라
 * 요청의 상태다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.equipmentFailure;

/** 처리 내역이 실제로 적혔는가. 공백만 친 값은 적은 것이 아니다. */
const hasText = (value: string): boolean => value.trim() !== '';

/**
 * 「처리 중으로」를 막는 사유. 없으면 `null`.
 *
 * ⭐ **접수 상태에서만** 열린다. 처리중·완료에서 다시 누를 수 있게 두면 서버가 거부하는데,
 * 사용자에게는 「눌렀는데 아무 일도 없다」로 보인다.
 */
export const startHandlingLockReason = (detail: BreakdownDetailView | null): string | null => {
  if (detail === null) return t.actions.startHandlingLocked;

  return detail.statusCode === RECEIVED_STATUS ? null : t.actions.startHandlingLocked;
};

/**
 * 「완료」를 막는 사유. 없으면 `null`.
 *
 * ⭐ **원인 코드와 처리 내역이 둘 다** 있어야 한다(계약이 완료 본문에 둘을 필수로 두었다).
 * ⚠ 원인 코드 목록이 아직 없으면 그 사실이 **첫 사유**다 — 「원인 코드를 고르세요」로 안내하면
 * 고를 것이 없는 칸을 가리키게 되어 사용자가 풀 수 없다.
 *
 * ⭐ **경미한 건은 처리 중을 거치지 않고 바로 완료할 수 있다**(계약). 그래서 접수 상태에서도
 * 완료를 막지 않는다 — 상태로 막는 것은 이미 완료된 건 하나뿐이다.
 */
export const completeLockReason = (
  detail: BreakdownDetailView | null,
  causeCode: string,
  handlingNote: string,
): string | null => {
  if (detail === null) return t.actions.completeLockedDone;
  if (detail.statusCode === DONE_STATUS) return t.actions.completeLockedDone;
  if (PLACEHOLDER_CAUSE_CODES.length === 0) return t.actions.completeLockedNoCauseCodes;
  if (causeCode === '') return t.actions.completeLockedCause;
  if (!hasText(handlingNote)) return t.actions.completeLockedNote;

  return null;
};

/**
 * 처리 내용 저장을 막는 사유. 없으면 `null`.
 *
 * 완료된 건은 잠긴다(계약: 「완료된 건은 잠기며 되돌리는 길은 없다」). 그 밖에는 언제든 적을
 * 수 있다 — 원인 코드만 먼저 적어 두고 처리 내역을 나중에 채우는 것이 정상 경로다.
 */
export const saveLockReason = (detail: BreakdownDetailView | null): string | null => {
  if (detail === null) return t.actions.saveLockedDone;

  return detail.statusCode === DONE_STATUS ? t.actions.saveLockedDone : null;
};

/**
 * 완료 전에 알릴 경고. 없으면 `null`.
 *
 * ⚠ **완료가 비가동을 닫아 주지 않는다**(계약이 못 박았다). 끝나지 않은 비가동이 남아 있으면
 * 그 사실을 **완료를 누르기 전에** 알린다 — 완료한 뒤에 알면 이미 되돌릴 수 없고, 비가동은
 * 계속 열린 채로 집계에서 빠진다.
 */
export const openDowntimeWarning = (detail: BreakdownDetailView | null): string | null => {
  if (detail === null || detail.openLinkedDowntimeCount === 0) return null;

  return t.detail.openDowntimeWarning(detail.openLinkedDowntimeCount);
};
