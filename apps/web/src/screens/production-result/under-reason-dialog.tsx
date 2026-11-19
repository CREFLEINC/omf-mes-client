import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';

import { masterName } from '../../patterns/master-name';
import { PuButton, PuDialog, PuNote } from '../../patterns/pop-uniform';

const t = messages.productionResult.flow.underReason;

type CodeValue = components['schemas']['CodeValue'];

export interface UnderReasonDialogProps {
  open: boolean;
  reasons: CodeValue[];
  isLoading: boolean;
  isError: boolean;
  /** 앞 마감이 사유 때문에 거부됐을 때 서버가 준 문구 */
  error: string | null;
  /** LOT 수량 · 생산 실적(단위 붙은 글자) — 왜 사유를 묻는지 숫자로 보인다 */
  summary: { target: string; actual: string } | null;
  onPick: (code: string) => void;
  onCancel: () => void;
}

/**
 * 스캐너는 LOT 번호 뒤에 Enter 를 붙인다. 창이 그 번호로 열린 직후 같은 스캔의 Enter 가 들어오므로,
 * 이 동안의 Enter 는 버린다 — 첫 단추가 눌려 창이 닫히거나 사유가 골라지면 안 된다.
 */
const SCAN_TAIL_MS = 500;

/** 목표에 못 미친 LOT 을 마감하기 전에 사유 하나를 고른다. 고르는 즉시 마감한다. */
export const UnderReasonDialog = ({
  open,
  reasons,
  isLoading,
  isError,
  error,
  summary,
  onPick,
  onCancel,
}: UnderReasonDialogProps) => {
  const headRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);

  /*
   * 첫 포커스는 단추가 아니라 창 머리다 — 창이 스스로 첫 단추(취소)에 포커스를 두면 스캔의 Enter 가
   * 그것을 누른다. 창의 열기 효과가 먼저 돌고 이 효과가 뒤에 돌아 그 포커스를 옮긴다.
   */
  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    headRef.current?.focus();
  }, [open]);

  const dropScanTail = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && Date.now() - openedAt.current < SCAN_TAIL_MS) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  if (!open) return null;

  /* 머리 X 없이 아래 [취소] 하나(#295 규칙 16). 사유를 고르는 즉시 마감한다 — 지금과 같다. */
  return (
    <PuDialog
      wide
      title={t.title}
      onClose={onCancel}
      footer={<PuButton onClick={onCancel}>{t.cancel}</PuButton>}
    >
      <div
        ref={headRef}
        tabIndex={-1}
        className="pu-stack pr-reason-body"
        onKeyDownCapture={dropScanTail}
      >
        {/* 「LOT 수량 10 EA | 생산 실적 1 EA」(사용자 지시 2026-11-16 시안). */}
        {summary !== null && (
          <dl className="pu-kv cols2">
            <dt>{t.lotQty}</dt>
            <dd>{summary.target}</dd>
            <dt>{t.actualQty}</dt>
            <dd>{summary.actual}</dd>
          </dl>
        )}
        {error !== null && <PuNote tone="bad">{error}</PuNote>}
        {isLoading ? (
          <p role="status" className="pu-dialog-text">
            {t.loading}
          </p>
        ) : isError ? (
          <PuNote tone="bad">{t.loadFailed}</PuNote>
        ) : reasons.length === 0 ? (
          <p className="pu-dialog-text">{t.empty}</p>
        ) : (
          <div className="pu-tiles" style={{ '--cols': '2' } as CSSProperties}>
            {reasons.map((reason) => (
              <button
                key={reason.code}
                type="button"
                className="pu-tile"
                onClick={() => onPick(reason.code)}
              >
                {masterName(reason, reason.codeName)}
              </button>
            ))}
          </div>
        )}
      </div>
    </PuDialog>
  );
};
