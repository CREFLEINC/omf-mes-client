import { messages } from '@omf-mes/i18n';

import {
  popGateDeniedText,
  popGateUnidentifiedText,
  type PopProcessGate,
} from '../../patterns/pop-process-gate';

const t = messages.materialInputScan;

export interface BlockReasonInput {
  gate: PopProcessGate;
  /** 작업지시를 읽지 못했을 때 서버가 준 이유 */
  processFailureReason?: string | null;
  hasWorker: boolean;
  /** 아직 기록되지 않은 줄이 남았는가. 남은 채 닫으면 그 줄이 버려진다. */
  hasPending: boolean;
}

/**
 * 다음 작업([생산 작업으로])이 잠긴 사유 한 문장. 잠겼지만 말할 것이 없으면 `undefined`.
 *
 * **잠그는 이유가 다섯이고 순서가 뜻을 정한다.** 앞에 둔 것일수록 나중 조작으로 풀리지 않는
 * 사정이다 — 순서를 뒤집으면 「담으면 열린다」를 읽은 작업자가 다 담고 나서야 막힌 것을 안다.
 *
 * ⛔ **게이팅의 갈래를 한 문장으로 합치지 않는다**(F-6). 「권한이 없다」·「확인할 수 없다」·
 * 「단말을 모른다」는 작업자가 할 일이 다르다.
 *
 * ⚠ **잠금 자체는 이 문구가 정하지 않는다** — 담긴 것이 없을 때는 말없이 잠긴 채로 둔다
 * (`confirm-panel`). 둘을 한 값으로 묶으면 문구를 지우는 순간 잠금까지 풀린다.
 *
 * 문구는 하단 바 「남은 일」 자리에 선다(C-4, `remainingText`). 판정은 여기 한 곳이라, 버튼의
 * 잠금과 문구가 갈리지 않는다.
 */
export const confirmBlockReason = ({
  gate,
  processFailureReason = null,
  hasWorker,
  hasPending,
}: BlockReasonInput): string | undefined => {
  switch (gate.verdict) {
    case 'denied':
      return popGateDeniedText(gate, 'canInputMaterial');
    case 'unavailable':
      return t.confirm.reasons.unavailable;
    case 'unidentified':
      return popGateUnidentifiedText(t.confirm.reasons.unidentified, processFailureReason);
    case 'checking':
      return t.confirm.reasons.checking;
    case 'allowed':
      break;
  }

  if (!hasWorker) return t.confirm.reasons.workerMissing;

  /*
   * ⭐ **기록되지 않은 줄을 남긴 채 닫지 않는다.** 확정은 서버를 부르지 않으므로, 닫는
   * 순간 그 줄은 아무 데도 남지 않고 사라진다 — 작업자는 다 넣었다고 믿는다.
   *
   * 「기록된 것 없음」보다 **앞에 둔다** — 담아 둔 줄이 있으면 작업자가 할 일은 「담아라」가
   * 아니라 「그것을 기록해라」다. 순서를 뒤집으면 이미 담은 자재를 앞에 두고 담으라는 말을
   * 읽는다.
   */
  if (hasPending) return t.confirm.reasons.qtyMissing;

  /* 아무것도 담지 않은 상태는 잠금 사유가 아니라 할 일이다. 「남은 일」이 스캔을 말한다(`remainingText`). */
  return undefined;
};

export interface RemainingInput {
  /** 잠금 사유(`confirmBlockReason`). 기록 안 한 자재의 사유는 아래 값으로 구체화한다. */
  blockReason: string | undefined;
  hasWorkOrder: boolean;
  /** 스캔했지만 기록하지 않은 자재의 품목 이름. 고른 것이 앞에 오도록 부르는 쪽이 정렬한다. */
  pendingItems: readonly string[];
  /** 이 W/O에 기록된 투입이 있는가(서버 기록이나 이 화면에서 방금 기록한 것). */
  hasRecorded: boolean;
}

/**
 * 하단 바 「남은 일」 한 줄(C-4, C-5). 기록하지 않은 자재가 먼저이고, 그다음 잠금 사유, 막힘이
 * 없으면 다음 할 일을 말한다. 한 줄에 들어가게 LOT 번호 전체가 아니라 품목 이름과 건수로 쓴다.
 *
 * ⛔ **잠금은 여기서 정하지 않는다.** 잠금은 `confirmBlockReason`과 기록 여부가 정하고, 이 함수는
 *    그 결과를 문장으로 옮긴다.
 */
export const remainingText = ({
  blockReason,
  hasWorkOrder,
  pendingItems,
  hasRecorded,
}: RemainingInput): string => {
  if (!hasWorkOrder) return t.remaining.workOrderMissing;

  const [firstPending] = pendingItems;
  if (blockReason === t.confirm.reasons.qtyMissing && firstPending !== undefined) {
    return pendingItems.length === 1
      ? t.remaining.record(firstPending)
      : t.remaining.recordMany(pendingItems.length);
  }
  if (blockReason !== undefined) return blockReason;

  return hasRecorded ? t.remaining.done : t.remaining.scan;
};
