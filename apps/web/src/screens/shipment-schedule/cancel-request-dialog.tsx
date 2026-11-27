import { Button, Dialog, Icon, TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { InfoFacts } from '../../patterns/info-facts';
import { InfoLabel } from '../../patterns/info-tip';
import './cancel-request-dialog.css';

const t = messages.shipmentConfirm.cancelDialog;

/** 취소 사유의 길이 상한. 계약이 상한을 두지 않아 화면이 정한다. */
export const CANCEL_REASON_MAX = 500;

export const cancelReasonError = (raw: string): string | undefined => {
  const value = raw.trim();

  if (value === '') return t.reasonRequired;
  if (value.length > CANCEL_REASON_MAX) return t.reasonTooLong;

  return undefined;
};

/**
 * 취소가 실행되면 일어나는 것(POP 완료 출하만 · 시안 W0412-After 취소 요청 창). 옛 흐름 미확정
 * 출하는 재고·전표가 아직 확정 전이라 이 목록을 두지 않는다.
 */
export interface CancelConsequences {
  qty: number | null;
  /** 지시서 라인이 모두 같은 단위면 그 코드, 아니면 빈 글. */
  unit: string;
  /** 재고가 빠진 창고들 — 여럿이면 창고마다 몫을 붙인다. */
  warehouses: { name: string; qty: number | null }[];
  shipmentRequestNo: string | null;
}

export interface CancelRequestDialogProps {
  shipmentNo: string;
  consequences: CancelConsequences | null;
  reason: string;
  showError: boolean;
  banner: ReactNode;
  isSubmitting: boolean;
  onChangeReason: (reason: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const qtyText = (qty: number, unit: string): string =>
  `${qty.toLocaleString('ko-KR')} ${unit}`.trim();

/** 창고 하나면 이름만, 여럿이면 「이름 수량 단위」를 쉼표로. */
const warehouseText = (consequences: CancelConsequences): string => {
  const { warehouses, unit } = consequences;
  if (warehouses.length === 1) return warehouses[0]?.name ?? '';
  return warehouses
    .map((w) => (w.qty === null ? w.name : `${w.name} ${qtyText(w.qty, unit)}`))
    .join(', ');
};

/**
 * 취소 «요청» 창(출하 취소 결재 상신).
 *
 * ⭐ **요청과 실행이 다른 액션이다**(§5-8) — 승인된 뒤에도 취소는 저절로 실행되지 않고, 이 화면의 [취소 실행]이
 * 실행한다. 그 사실을 요청하는 자리에서 한 줄로 말한다.
 *
 * ⚠ **사유가 필수인 이유가 있다**(A-12) — 승인자가 이것 하나를 읽고 판단한다. 그 말은 사유 라벨 옆 ⓘ 로 둔다.
 * 빈 칸을 처음부터 연한 빨강으로 칠하지 않는다(이 창만 — 팝업 디자인 시안 #360). 빈 사유는 [취소 결재 요청]을 누를 때
 * 칸 아래 오류로 알린다.
 */
export const CancelRequestDialog = ({
  shipmentNo,
  consequences,
  reason,
  showError,
  banner,
  isSubmitting,
  onChangeReason,
  onClose,
  onSubmit,
}: CancelRequestDialogProps) => {
  const reasonId = useId();

  return (
    <Dialog
      className="ship-cancel-request-dialog dialog-icon-cancel"
      closeOnBackdropClick={false}
      footer={
        <>
          <Button disabled={isSubmitting} variant="outlined" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button loading={isSubmitting} variant="filled" onClick={onSubmit}>
            {t.submit}
          </Button>
        </>
      }
      open
      showCloseButton={false}
      title={t.title}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      {banner === null || banner === undefined ? null : <div>{banner}</div>}
      <InfoFacts rows={[[{ label: t.shipmentNo, value: shipmentNo, isKey: true }]]} />
      <p className="iqc-inspection-action-note" data-tone="info">
        <Icon name="info" size={14} aria-hidden />
        {t.approvalNote}
      </p>

      <div className="ship-cancel-reason">
        <InfoLabel htmlFor={reasonId} label={t.reasonLabel} info={t.reasonHelp} required />
        <TextArea
          id={reasonId}
          placeholder={t.reasonPlaceholder}
          value={reason}
          required
          fullWidth
          rows={3}
          maxLength={CANCEL_REASON_MAX}
          error={showError ? cancelReasonError(reason) : undefined}
          onChange={(event) => onChangeReason(event.target.value)}
        />
      </div>

      {consequences !== null && (
        <>
          {/* FR-024 — 상신 중에는 러너가 그 출하를 보내지 않는다. 단추를 누르기 전에 보이게 둔다. */}
          <p className="iqc-inspection-action-note" data-tone="warning">
            <Icon name="warning" size={14} aria-hidden />
            {t.hold}
          </p>
          <section className="ship-cancel-effects" aria-label={t.effectsTitle}>
            <h3 className="field-label">{t.effectsTitle}</h3>
            <ul>
              {consequences.qty !== null && (
                <li>
                  <span className="ship-cancel-effect-name">{t.effects.stockLabel}</span>
                  {t.effects.stock(
                    qtyText(consequences.qty, consequences.unit),
                    warehouseText(consequences),
                  )}
                </li>
              )}
              <li>
                <span className="ship-cancel-effect-name">{t.effects.documentsLabel}</span>
                {t.effects.documents}
              </li>
              <li>
                <span className="ship-cancel-effect-name">{t.effects.salesOrderLabel}</span>
                {t.effects.salesOrder}
              </li>
              {consequences.shipmentRequestNo !== null && (
                <li>
                  <span className="ship-cancel-effect-name">{t.effects.requestLabel}</span>
                  {t.effects.request(consequences.shipmentRequestNo)}
                </li>
              )}
            </ul>
          </section>
          {/* 종전 지시서 줄에 붙어 있던 말 — 지시서가 있을 때만(되돌릴 피킹 LOT 이 지시서에 있다). */}
          {consequences.shipmentRequestNo !== null && (
            <section className="ship-cancel-records" aria-label={t.records.title}>
              <h4 className="field-label">{t.records.title}</h4>
              <p>{t.records.body}</p>
            </section>
          )}
        </>
      )}
    </Dialog>
  );
};
