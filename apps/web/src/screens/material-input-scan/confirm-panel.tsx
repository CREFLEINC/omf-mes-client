import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { toApiError } from '../../patterns/request';

import type { TerminalGate } from './terminal-gating';

const t = messages.materialInputScan;

export interface ConfirmPanelProps {
  /** 기록된 자재가 하나라도 있는가. 닫을 것이 있어야 닫는다. */
  hasRecorded: boolean;
  /** 아직 기록되지 않은 줄이 남았는가. 남은 채 닫으면 그 줄이 버려진다. */
  hasPending: boolean;
  hasWorker: boolean;
  gate: TerminalGate;
  /** 서버가 거부한 건의 오류. 없으면 `null`. **그 건만** 되돌린다(C-2). */
  rejection: unknown;
  /** 닫은 뒤 남길 문구. 닫기 전에는 `null`. */
  closedCount: number | null;
  onConfirm: () => void;
}

/**
 * 투입 확정 구획 — **이 화면의 유일한 쓰기**이고 되돌릴 수 없는 기록이다.
 *
 * **잠그는 이유가 다섯이고 순서가 뜻을 정한다.** 앞에 둔 것일수록 나중 조작으로 풀리지 않는
 * 사정이다 — 순서를 뒤집으면 「담으면 열린다」를 읽은 작업자가 다 담고 나서야 막힌 것을 안다.
 *
 * 1. **보내는 중** — 지금 일어나는 일이 먼저다
 * 2. **게이팅** — 이 단말이 이 공정에서 투입할 수 있는가(§5-1)
 * 3. **작업자** — 귀속 사번이 없으면 서버가 거절한다(D-5)
 * 4. **담은 것 없음** — 담으면 풀린다
 * 5. **수량 미입력** — 채우면 풀린다
 *
 * ⛔ **게이팅의 갈래를 한 문장으로 합치지 않는다**(F-6). 「권한이 없다」·「확인할 수 없다」·
 * 「단말을 모른다」는 작업자가 할 일이 다르다. **「확인할 수 없다」에만 다시 시도할 경로를
 * 준다**(G-3) — 그것만이 작업자가 스스로 풀 수 있는 갈래다.
 *
 * ⛔ **화면의 잠금은 방어가 아니다.** 집행은 서버의 403이고, 오프라인 큐로 들어온 투입은 이
 * 화면을 지나지 않는다.
 */
export const ConfirmPanel = ({
  hasRecorded,
  hasPending,
  hasWorker,
  gate,
  rejection,
  closedCount,
  onConfirm,
}: ConfirmPanelProps) => {
  const reasonId = useId();

  const blockReason = ((): string | undefined => {
    switch (gate.verdict) {
      case 'denied':
        return t.confirm.reasons.denied;
      case 'unavailable':
        return t.confirm.reasons.unavailable;
      case 'unidentified':
        return t.confirm.reasons.unidentified;
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

    return hasRecorded ? undefined : t.confirm.reasons.nothingScanned;
  })();

  return (
    <div className="confirm-row">
      {/*
       * 잠긴 버튼은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 사유에 닿을 수
       * 없다. 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다.
       */}
      <Button
        variant="filled"
        size="xl"
        className="pop-touch-target"
        disabled={blockReason !== undefined}
        aria-describedby={blockReason === undefined ? undefined : reasonId}
        onClick={onConfirm}
      >
        {t.confirm.action}
      </Button>

      {blockReason !== undefined && (
        <span id={reasonId} className="field-note">
          {blockReason}
        </span>
      )}

      {/* 다시 시도가 뜻이 있는 갈래는 하나뿐이다 — 조회가 실패했을 때. */}
      {gate.verdict === 'unavailable' && (
        <Button variant="outlined" size="sm" onClick={gate.retry}>
          {t.confirm.retry}
        </Button>
      )}

      {/* 몇 건으로 닫았는지 그 자리에서 말한다. 기록 자체는 이미 건별로 끝나 있다. */}
      {closedCount !== null && (
        <p className="field-note" role="status">
          {t.confirm.closed(closedCount)}
        </p>
      )}

      {/*
       * 건별 기록의 실패다 — **그 한 건에만 미친다.** 앞서 기록된 것은 남고 이 건은 남지
       * 않는다. 부분 기록이라는 모호한 상태가 생기지 않는 것이 건별 저장의 값이다.
       *
       * ⭐ BOM 불일치가 여기로 온다(§6) — 서버가 판정하고 화면은 그 말을 옮긴다. 실패한
       * 자재는 목록에서 빠지므로 **자재LOT 스캔부터 루프백**이 성립한다.
       */}
      {rejection !== null && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.confirm.failed}>
            {describeConfirmError(rejection)}
          </AlertBanner>
        </div>
      )}
    </div>
  );
};

/** 실패의 원인을 한 줄로 옮긴다. 권한 없음은 서버가 집행한 것이라 게이팅과 다른 자리다. */
const describeConfirmError = (error: unknown): string => {
  const apiError = toApiError(error);

  switch (apiError.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      return apiError.status === 403
        ? messages.httpError.forbidden
        : messages.httpError.description;
    case 'conflict':
      return apiError.message === '' ? messages.httpError.description : apiError.message;
    case 'stateLocked':
    case 'validation': {
      const lines = apiError.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};
