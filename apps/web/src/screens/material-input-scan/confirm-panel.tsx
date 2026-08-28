import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { toApiError } from '../../patterns/request';
import { PartialConfirmError, type ConfirmResult } from './mutations';
import type { TerminalGate } from './terminal-gating';

const t = messages.materialInputScan;

export interface ConfirmPanelProps {
  hasMaterials: boolean;
  hasEveryQty: boolean;
  hasWorker: boolean;
  gate: TerminalGate;
  confirm: ConfirmResult;
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
  hasMaterials,
  hasEveryQty,
  hasWorker,
  gate,
  confirm,
  onConfirm,
}: ConfirmPanelProps) => {
  const reasonId = useId();

  const blockReason = ((): string | undefined => {
    if (confirm.isPending) return t.confirm.reasons.sending;

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
    if (!hasMaterials) return t.confirm.reasons.nothingScanned;

    return hasEveryQty ? undefined : t.confirm.reasons.qtyMissing;
  })();

  const recorded = confirm.data;

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

      {/* 되돌릴 수 없는 기록이 남았다는 사실을 그 자리에서 말한다. */}
      {recorded !== undefined && !confirm.isError && (
        <p className="field-note" role="status">
          {t.confirm.recorded(recorded.length)}
        </p>
      )}

      {/*
       * ⚠ **몇 건이 들어갔는지 함께 말한다.** 자재마다 한 건씩 보내므로 중간에 실패하면 앞서
       * 들어간 것은 남는다 — 서버에 일괄 취소가 없고 정정 경로도 없다(§8 미결 9).
       */}
      {confirm.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.confirm.failed}>
            {confirm.error instanceof PartialConfirmError
              ? t.confirm.partiallyRecorded(confirm.error.recordedCount)
              : describeConfirmError(confirm.error)}
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
