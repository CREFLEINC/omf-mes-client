import { messages } from '@omf-mes/i18n';

/**
 * 검사 의뢰 상태를 배지 한 칸으로 옮긴다.
 *
 * ⭐ **다섯 값을 가른다.** 이 화면의 「대기·진행만 보기」는 **고정 축이 아니라 토글**이라, 끄면
 * 계약이 확정한 5값이 전부 온다(`REQUESTED`·`IN_PROGRESS`·`COMPLETED`·`SKIPPED`·`CANCELLED`).
 *
 * ⛔ **값 목록을 화면에 고정하는 것이 아니다.** 고정한다는 것은 「이 목록에 없는 값은 없다」로
 * 다루는 것인데, 여기서는 **모르는 값도 그대로 보인다** — 아래 되물림이 그 자리다. 배지 색을
 * 가르는 것은 계약이 지시한 처리다(공유계약 G-6).
 *
 * ⚠ **`SKIPPED` 와 `CANCELLED` 를 합치지 않는다** — 둘 다 「결과 없이 끝났다」지만 앞은 검사를
 * 안 하기로 승인된 정상 종결이고 뒤는 의뢰가 무효가 된 것이다. 합치면 「검사를 몇 건
 * 생략했나」를 셀 수 없다(계약 설명이 합치지 말라고 못박은 자리다).
 *
 * ⭐ **모르는 값은 코드를 그대로 보인다.** 표시명을 지어내면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 디자인 시스템 `Chip` 의 상태값. 다섯 코드가 서로 다른 색을 갖는다. */
export type StatusTone = 'idle' | 'info' | 'success' | 'warning' | 'error';

export interface StatusBadge {
  label: string;
  tone: StatusTone;
}

/**
 * 계약이 확정한 5값. **이 표 밖의 값도 화면에 나온다** — 아래 되물림이 받는다.
 *
 * 표를 함수 밖에 두는 이유는, 값이 늘 때 고칠 자리가 하나여야 하기 때문이다.
 */
const BADGE_OF: Record<string, StatusBadge> = {
  REQUESTED: { label: messages.oqcInspection.status.requested, tone: 'idle' },
  IN_PROGRESS: { label: messages.oqcInspection.status.inProgress, tone: 'info' },
  COMPLETED: { label: messages.oqcInspection.status.completed, tone: 'success' },
  SKIPPED: { label: messages.oqcInspection.status.skipped, tone: 'warning' },
  CANCELLED: { label: messages.oqcInspection.status.cancelled, tone: 'error' },
};

export const toStatusBadge = (statusCode: string): StatusBadge =>
  /* 모르는 값 — 지어내지 않고 서버가 준 코드를 그대로 보인다. */
  BADGE_OF[statusCode] ?? { label: statusCode, tone: 'idle' };
