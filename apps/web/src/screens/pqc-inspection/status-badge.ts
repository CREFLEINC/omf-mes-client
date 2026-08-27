import { messages } from '@omf-mes/i18n';

/**
 * 검사 의뢰 상태를 배지 한 칸으로 옮긴다.
 *
 * ⭐ **두 값만 가른다.** 이 큐는 고정 축 `pendingOnly=true` 로 좁혀져 있고, 계약이 그 정의를
 * 값으로 못박았다 — `pendingOnly=true ⇔ statusCode ∈ { REQUESTED, IN_PROGRESS }`. 그래서
 * 큐에 실려 오는 값이 이 둘뿐이다.
 *
 * ⛔ **값 목록을 화면에 고정하는 것이 아니다.** 고정한다는 것은 「이 목록에 없는 값은 없다」로
 * 다루는 것인데, 여기서는 **모르는 값도 그대로 보인다** — 아래 되물림이 그 자리다. 배지 색만
 * 두 값으로 가르는 것은 계약이 지시한 처리다(공유계약 G-6 · omf-mes#170 회신).
 *
 * ⭐ **모르는 값은 코드를 그대로 보인다.** 표시명을 공통코드로 채우는 조회를 두지 않는 이유는
 * 고정 축이 값을 이미 둘로 묶기 때문이다 — 조회를 얹으면 그 조회의 실패가 대기 큐를 비어
 * 보이게 만들 수 있는데, 얻는 것이 「일어나지 않는 갈래의 표시명」뿐이다. 고정 축이 풀리는 날
 * (이 화면이 PQC·OQC 도 다루게 되면) 그때 조회를 붙인다.
 *
 * ⚠ 되물림이 **`SKIPPED` 와 `CANCELLED` 를 합치지 않는다** — 둘 다 「결과 없이 끝났다」지만
 * 앞은 검사를 안 하기로 승인된 정상 종결이고 뒤는 의뢰가 무효가 된 것이다. 코드를 그대로
 * 보이므로 서로 다른 글자로 남는다(계약 설명이 합치지 말라고 못박은 자리다).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 배지 색을 가르는 두 값. **이 상수 밖의 값도 화면에 나온다** — 되물림이 받는다. */
const REQUESTED = 'REQUESTED';
const IN_PROGRESS = 'IN_PROGRESS';

/** 디자인 시스템 `Chip` 의 상태값 중 이 화면이 쓰는 둘. */
export type StatusTone = 'idle' | 'info';

export interface StatusBadge {
  label: string;
  tone: StatusTone;
}

export const toStatusBadge = (statusCode: string): StatusBadge => {
  const t = messages.pqcInspection.status;

  if (statusCode === REQUESTED) return { label: t.requested, tone: 'idle' };
  if (statusCode === IN_PROGRESS) return { label: t.inProgress, tone: 'info' };

  /* 모르는 값 — 지어내지 않고 서버가 준 코드를 그대로 보인다. */
  return { label: statusCode, tone: 'idle' };
};
