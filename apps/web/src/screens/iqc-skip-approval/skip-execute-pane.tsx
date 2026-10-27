import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';

import type { SkipExecuteState } from './target';

const IQC_TEXTS = messages.iqcSkipApproval.skipExecute;

/** 실행 구획의 글 — IQC 생략이 기본이고, 품질 승인 처리의 OQC 생략이 같은 구획을 자기 글로 쓴다(#193). */
export type SkipExecuteTexts = Record<
  | 'heading'
  | 'note'
  | 'action'
  | 'dialogTitle'
  | 'dialogBody'
  | 'irreversible'
  | 'executed'
  | 'checking',
  string
> & { notPending: (status: string) => string };

export interface SkipExecutePaneProps {
  /** 대상 LOT 상태로 정한 모양 — 버튼은 검사 대기일 때만(`target.ts` `judgeSkipExecute`). */
  state: SkipExecuteState;
  isSaving: boolean;
  onExecute: () => void;
  /** 실패 배너 슬롯. 오류 갈래를 아는 것은 화면이다. */
  banner: ReactNode;
  texts?: SkipExecuteTexts;
  /**
   * 한 줄 압축형(#193 — 품질 승인 처리의 OQC 생략) — 왼쪽에 이름 · 한 줄 요약, 오른쪽에 짧은 단추.
   * 확인 창은 그대로다(되돌릴 수 없는 조작이라 「정말 실행할 것인가」를 한 번 묻는다).
   */
  compact?: { title: string; summary: string; action: string; done: string };
}

/**
 * 승인된 요청의 **생략 실행** 구획(omf-all-around#105).
 *
 * 승인은 요청 상태만 바꾼다(《승인 시 결과》 구획 · 공유계약 J-8). 의뢰·보류·LOT 을 옮기는 것은
 * 이 실행이다 — 그래서 결재 구획과 따로 세우고, 되돌릴 수 없는 조작이라 확인 창을 한 번 거친다.
 */
export const SkipExecutePane = ({
  state,
  isSaving,
  onExecute,
  banner,
  texts: t = IQC_TEXTS,
  compact,
}: SkipExecutePaneProps) => {
  const [isConfirming, setIsConfirming] = useState(false);

  /*
   * 한 줄 압축형에서 실행할 수 없을 때 — 단추 자리에 결과(완료 초록 글)나 사정(확인 중·실행 불가)이 선다.
   * 완료면 상자 전체가 결재 사유 승인 칸과 같은 초록 칸이 된다(#193 · 사용자 지시 2026-10-27).
   */
  if (compact !== undefined && state.kind !== 'executable') {
    return (
      <section
        className={`iqc-skip-approval-section iqc-skip-approval-execute is-compact${
          state.kind === 'executed' ? ' is-done' : ''
        }`}
        aria-label={t.heading}
      >
        <div className="iqc-skip-approval-execute-text">
          <h3 className="iqc-skip-approval-heading">{compact.title}</h3>
          <p>{compact.summary}</p>
        </div>
        {state.kind === 'executed' ? (
          <p className="iqc-skip-approval-done">{compact.done}</p>
        ) : (
          <p className="field-note iqc-skip-approval-execute-note">
            {state.kind === 'checking' ? t.checking : t.notPending(state.statusCode)}
          </p>
        )}
      </section>
    );
  }

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

  const openButton = (
    <Button
      loading={isSaving}
      disabled={isSaving}
      onClick={() => {
        setIsConfirming(true);
      }}
    >
      {compact?.action ?? t.action}
    </Button>
  );

  return (
    <section
      className={`iqc-skip-approval-section iqc-skip-approval-execute${compact === undefined ? '' : ' is-compact'}`}
      aria-label={t.heading}
    >
      {compact === undefined ? (
        <>
          <h3 className="iqc-skip-approval-heading">{t.heading}</h3>
          {banner}
          <p className="field-note">{t.note}</p>
          {openButton}
        </>
      ) : (
        <>
          {banner}
          <div className="iqc-skip-approval-execute-text">
            <h3 className="iqc-skip-approval-heading">{compact.title}</h3>
            <p>{compact.summary}</p>
          </div>
          {openButton}
        </>
      )}

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
