import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { TerminalGate } from './terminal-gating';

const t = messages.materialInputScan;

export interface ConfirmPanelProps {
  hasMaterials: boolean;
  gate: TerminalGate;
}

/**
 * 투입 확정 구획.
 *
 * **잠그는 이유가 둘이고 순서가 뜻을 정한다.**
 *
 * 1. **게이팅** — 이 단말이 이 공정에서 투입할 수 있는가(스펙 §5-1). 앞에 둔다: 담기 전에 이미
 *    정해지는 사정이라, 뒤에 두면 자재를 다 담은 작업자가 그제서야 막힌 것을 안다
 * 2. **담은 것이 없음** — 담으면 풀린다
 *
 * ⛔ **게이팅의 갈래를 한 문장으로 합치지 않는다**(공유계약 F-6). 「권한이 없다」·「확인할 수
 * 없다」·「단말을 모른다」는 작업자가 할 일이 다르다. 특히 **「확인할 수 없다」에는 다시 시도할
 * 경로를 준다**(G-3) — 그것만이 작업자가 스스로 풀 수 있는 갈래다.
 *
 * ⛔ **화면의 잠금은 방어가 아니다.** 집행은 서버가 한다(쓰기의 403) — 오프라인 큐로 들어온
 * 투입은 이 화면을 지나지 않기 때문이다.
 */
export const ConfirmPanel = ({ hasMaterials, gate }: ConfirmPanelProps) => {
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
        return hasMaterials ? undefined : t.confirm.reasons.nothingScanned;
    }
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
    </div>
  );
};
