import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, type KeyboardEvent } from 'react';

import { masterName } from '../../patterns/master-name';

const t = messages.productionResult.flow.underReason;

type CodeValue = components['schemas']['CodeValue'];

export interface UnderReasonDialogProps {
  open: boolean;
  reasons: CodeValue[];
  isLoading: boolean;
  isError: boolean;
  /** 앞 마감이 사유 때문에 거부됐을 때 서버가 준 문구 */
  error: string | null;
  /** 「목표 n · 실적 m」 — 왜 사유를 묻는지 숫자로 보인다 */
  summary: string | null;
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

  const dropScanTail = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Enter' && Date.now() - openedAt.current < SCAN_TAIL_MS) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={t.title}
      showCloseButton={false}
      /* 터치 단말의 오조작 — 바깥을 눌러 닫히지 않는다. */
      closeOnBackdropClick={false}
      onKeyDownCapture={dropScanTail}
      footer={
        <Button variant="outlined" size="xl" onClick={onCancel}>
          {t.cancel}
        </Button>
      }
    >
      <div ref={headRef} tabIndex={-1} className="production-flow-reason-body">
        {summary !== null && <p className="pop-figures-line">{summary}</p>}
        {error !== null && (
          <div className="banner-slot">
            <AlertBanner variant="error" title={error} />
          </div>
        )}
        {isLoading ? (
          <p role="status">{t.loading}</p>
        ) : isError ? (
          <AlertBanner variant="error" title={t.loadFailed} />
        ) : reasons.length === 0 ? (
          <p>{t.empty}</p>
        ) : (
          <div className="production-flow-reason-tiles">
            {reasons.map((reason) => (
              <Button
                key={reason.code}
                variant="outlined"
                size="xl"
                onClick={() => onPick(reason.code)}
              >
                {masterName(reason, reason.codeName)}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
};
