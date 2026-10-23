import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';

import type { SkipExecuteState } from './target';

const t = messages.iqcSkipApproval.skipExecute;

export interface SkipExecutePaneProps {
  /** 대상 LOT 상태로 정한 모양 — 버튼은 검사 대기일 때만(`target.ts` `judgeSkipExecute`). */
  state: SkipExecuteState;
  isSaving: boolean;
  onExecute: () => void;
  /** 실패 배너 슬롯. 오류 갈래를 아는 것은 화면이다. */
  banner: ReactNode;
}

/**
 * 승인된 요청의 **생략 실행** 구획(omf-all-around#105).
 *
 * 승인은 요청 상태만 바꾼다(《승인 시 결과》 구획 · 공유계약 J-8). 의뢰·보류·LOT 을 옮기는 것은
 * 이 실행이다 — 그래서 결재 구획과 따로 세우고, 되돌릴 수 없는 조작이라 확인 창을 한 번 거친다.
 */
export const SkipExecutePane = ({ state, isSaving, onExecute, banner }: SkipExecutePaneProps) => {
  const [isConfirming, setIsConfirming] = useState(false);

  if (state.kind !== 'executable') {
    return (
      <section
        className="iqc-skip-approval-section iqc-skip-approval-execute"
        aria-label={t.heading}
      >
        <h3 className="iqc-skip-approval-heading">{t.heading}</h3>
        {state.kind === 'executed' ? (
          /* 완료는 초록 글자로 — 실행 단추 대신 결과가 선다. */
          <p className="iqc-skip-approval-done">{t.executed}</p>
        ) : (
          <p className="field-note">
            {state.kind === 'checking' ? t.checking : t.notPending(state.statusCode)}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="iqc-skip-approval-section iqc-skip-approval-execute" aria-label={t.heading}>
      <h3 className="iqc-skip-approval-heading">{t.heading}</h3>
      {banner}
      <p className="field-note">{t.note}</p>
      <Button
        loading={isSaving}
        disabled={isSaving}
        onClick={() => {
          setIsConfirming(true);
        }}
      >
        {t.action}
      </Button>

      {isConfirming && (
        <Dialog
          open
          onClose={() => {
            setIsConfirming(false);
          }}
          size="sm"
          closeOnBackdropClick={false}
          showCloseButton={false}
          title={t.dialogTitle}
          footer={
            <>
              <Button
                variant="outlined"
                disabled={isSaving}
                onClick={() => {
                  setIsConfirming(false);
                }}
              >
                {messages.common.cancel}
              </Button>
              <Button
                loading={isSaving}
                disabled={isSaving}
                onClick={() => {
                  setIsConfirming(false);
                  onExecute();
                }}
              >
                {t.action}
              </Button>
            </>
          }
        >
          <p>{t.dialogBody}</p>
          <p>{t.irreversible}</p>
        </Dialog>
      )}
    </section>
  );
};
