import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

const t = messages.dispositionDecision;

export interface DecisionConfirmRow {
  label: string;
  value: string;
  /** 먼저 눈에 들어와야 할 값(처분 유형 · LOT 수 · 총 수량)은 굵게(#352 사용자 시안). */
  strong?: boolean;
}

export interface DecisionConfirmDialogProps {
  /** 처분 유형 · 대상 · 수량 · 사유 등 저장할 내용 — 화면이 고른 유형에 맞춰 만든다. */
  rows: DecisionConfirmRow[];
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 판정 확인 팝업(omf-all-around#352 사용자 지시) — 폐기 · 선별 · 특채 저장 전에 늘 띄운다. 결재 없이 저장하면 바로
 * 반영되므로(사용자 결정 2026-11-23) 저장할 내용을 마지막으로 보인다.
 */
export const DecisionConfirmDialog = ({
  rows,
  isSaving,
  onConfirm,
  onCancel,
}: DecisionConfirmDialogProps) => {
  const titleId = useId();

  return (
    <Dialog
      open
      onClose={onCancel}
      size="md"
      title={<span id={titleId}>{t.confirm.title}</span>}
      aria-labelledby={titleId}
      showCloseButton={false}
      closeOnBackdropClick={false}
      footer={
        <>
          <Button
            variant="outlined"
            className="app-button-neutral"
            disabled={isSaving}
            onClick={onCancel}
          >
            {messages.common.cancel}
          </Button>
          <Button disabled={isSaving} loading={isSaving} onClick={onConfirm}>
            {t.confirm.save}
          </Button>
        </>
      }
    >
      <div className="disposition-confirm">
        <dl className="disposition-confirm-rows">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.strong === true ? <strong>{row.value}</strong> : row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="iqc-inspection-action-note" data-tone="info">
          <Icon name="info" size={14} aria-hidden />
          {t.confirm.direct}
        </p>
      </div>
    </Dialog>
  );
};
