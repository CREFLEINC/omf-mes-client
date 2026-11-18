import type { components } from '@omf-mes/api-client';

import type { SplitError } from '../../patterns/master';

type InspectionResultCreate = components['schemas']['InspectionResultCreate'];

/**
 * PQC 결과를 내보내는 쪽이 갖출 모양 — 관리웹 바로 저장(`pqc-panel/direct-submitter`)이 이것을 채운다.
 *
 * POP PQC 제품 검사(P-02-13)의 오프라인 큐는 화면과 함께 없앴다(omf-all-around#293). 단말에 남은 큐는
 * `patterns/pop-legacy-outbox` 가 마저 보낸다.
 */
export interface Outbox {
  /** 아직 서버에 닿지 않은 건수. **상시 표시가 필수 요건이다**(C-1 #4). */
  pendingCount: number;
  /** 서버가 받은 횟수. 늘어나면 화면이 조회를 다시 한다(#601 1-7). */
  sentCount: number;
  /** 지금 연결돼 있는가. 건수와 함께 낸다 — 끊긴 것과 밀리는 것은 다르다. */
  isOnline: boolean;
  /** 큐에 담는다. **이것이 곧 성공이다** — 통신을 기다리지 않는다(C-1 #2). */
  enqueue: (workerNo: string, body: InspectionResultCreate) => void;
  /** 서버가 거부한 것 — 인라인용·배너용으로 갈라 둔다. 없으면 `null`. */
  rejection: SplitError | null;
  /**
   * 거부된 항목이 **무엇이었는가**(`DRAFT` 또는 `CONFIRMED`). 거부가 없으면 `null`.
   *
   * ⛔ **「거부가 섰다」만으로는 무엇이 거부됐는지 알 수 없다** — 큐는 밀릴 수 있어 임시 저장과
   * 확정이 함께 서 있을 수 있고, 그때 앞의 임시 저장이 거부됐다고 «확정»에 걸린 잠금을 풀면
   * 아직 큐에 살아 있는 확정 위에 두 번째 확정이 얹힌다.
   */
  rejectedStatusCode: string | null;
  /** 거부 표시를 지운다 — 사용자가 값을 고쳐 다시 저장할 때 부른다. */
  clearRejection: () => void;
  /**
   * 자동 재전송을 멈춘 상태인가. **항목은 큐에 그대로 있다** — 사라진 것이 아니라 멈춘 것이다.
   * 연결이 살아나거나 사람이 다시 시도하면 풀린다.
   */
  isStalled: boolean;
  /** 멈춘 큐를 사람이 깨운다. */
  retryNow: () => void;
  /**
   * 이 의뢰의 **확정이 아직 큐에 남아 있는가.**
   *
   * ⭐ **잠금의 수명이 잠글 대상의 수명보다 짧으면 안 된다.** 확정은 저장소에 남아 새로고침과
   * 화면 이동을 넘기는데, 「방금 확정했다」는 화면 상태 하나로 잠그면 화면을 다시 세우는 순간
   * 잠금만 사라진다 — 끊긴 망에서 나갔다 돌아온 검사자가 빈 화면을 다시 채워 **같은 검사를
   * 두 건으로 만든다**(#1091 리뷰).
   */
  hasPendingConfirm: (inspectionRequestId: number) => boolean;
}
