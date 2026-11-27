import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { InfoFacts, InfoLong, type InfoFact } from '../../patterns/info-facts';

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
 *
 * 확인 팝업 시안(#360) — 굵게 보일 값(처분 유형 · 대상 · 수량)은 사실 상자(첫 칸 크게), 긴 글(선별 대상 · 적용 기간 ·
 * 사유)은 상자 아래 이름 + 글, 그 아래 질문 · 「바로 반영」 안내 줄.
 */
export const DecisionConfirmDialog = ({
  rows,
  isSaving,
  onConfirm,
  onCancel,
}: DecisionConfirmDialogProps) => {
  const facts: InfoFact[] = rows
    .filter((row) => row.strong === true)
    .map((row) => ({ label: row.label, value: row.value }));
  const [key, ...rest] = facts;
  const longRows = rows.filter((row) => row.strong !== true);

  return (
    <Dialog
      open
      onClose={onCancel}
      size="md"
      title={t.confirm.title}
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
      <div className="users-roles-worker-dialog">
        {key === undefined ? null : <InfoFacts rows={[[{ ...key, isKey: true }], rest]} />}
        {longRows.map((row) => (
          <InfoLong key={row.label} label={row.label} value={row.value} />
        ))}
        <p>{t.confirm.question}</p>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
          <Icon name="info" size={16} aria-hidden />
          {t.confirm.direct}
        </p>
      </div>
    </Dialog>
  );
};
