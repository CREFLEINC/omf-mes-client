import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { BatchResultView } from './batch-result';

const t = messages.integrationSync;

export interface BatchRetryDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** 확인 단계의 문구에 들어가는 건수. */
  selectedCount: number;
  isSaving: boolean;
  /** 결과를 받았으면 결과 단계다. null이면 확인 단계다. */
  result: BatchResultView | null;
  /** 요청 자체가 실패했을 때의 표시(권한 없음·형식 오류·연결 끊김 등). */
  banner: ReactNode;
}

/**
 * 선택 일괄 재처리 — 확인과 결과를 한 창에서 이어 보인다.
 *
 * **바깥 어둠 클릭으로 닫히지 않는다.** 여러 건을 한 번에 보내는 조작의 확인이고,
 * 결과 단계에서는 건별 사유가 이 창에만 있어 잘못 닫히면 무엇이 실패했는지 알 길이 없다.
 */
export const BatchRetryDialog = ({
  open,
  onClose,
  onConfirm,
  selectedCount,
  isSaving,
  result,
  banner,
}: BatchRetryDialogProps) => {
  const isResultPhase = result !== null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      closeOnBackdropClick={false}
      title={isResultPhase ? t.batch.resultTitle : t.batch.confirmTitle(selectedCount)}
      footer={
        isResultPhase ? (
          <Button onClick={onClose}>{messages.common.close}</Button>
        ) : (
          <>
            <Button variant="outlined" onClick={onClose}>
              {messages.common.cancel}
            </Button>
            {/* loading이 곧 비활성이다 — 연타해도 같은 요청이 두 번 나가지 않는다. */}
            <Button loading={isSaving} onClick={onConfirm}>
              {t.actions.batchRetry}
            </Button>
          </>
        )
      }
    >
      {banner}

      {result === null ? (
        <p>{t.batch.confirmDescription}</p>
      ) : (
        <>
          {/* 성공이 하나도 없으면 성공 안내를 내지 않는다. 실패 목록만 남는다. */}
          {result.summary !== null && <p>{result.summary}</p>}

          {result.failed.length > 0 && (
            <section aria-label={t.batch.failedListLabel}>
              <span className="field-label">{t.batch.failedListLabel}</span>
              <ul>
                {result.failed.map((item, index) => (
                  <li key={`${String(index)}-${item.label}`}>
                    {item.label}
                    <ul>
                      {item.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Dialog>
  );
};
