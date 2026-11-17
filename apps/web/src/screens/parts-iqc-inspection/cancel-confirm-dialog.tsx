import { AlertBanner, Button, Dialog, Icon, TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { FieldLabel } from '../iqc-inspection/field-label';
import type { InboundInspection } from './inbound-queries';

const t = messages.iqcInboundLot.cancel;

/** 확정 취소 막힘 한 줄 — 코드 문구와 서버가 실은 내용(LOT 번호 등). */
export interface ConfirmBlocker {
  code: string;
  message: string;
  /** 막은 자재 관리 LOT 번호(서버 `lotNos` · G2 L12). 있으면 서버 문구 대신 이것을 보인다. */
  lotNos?: readonly string[];
}

const HANGUL = /[\u3131-\uD79D]/u;

/**
 * 막힘 한 줄의 덧붙임 — LOT 번호가 있으면 그것, 없으면 서버 문구가 LOT 번호 같은 값일 때만(한국어 문장이면 빼서 베트남어 화면에
 * 한국어가 붙지 않게 · G2 L12).
 */
export const blockerDetailOf = (blocker: ConfirmBlocker, label: string): string | null => {
  if (blocker.lotNos !== undefined && blocker.lotNos.length > 0) return blocker.lotNos.join(', ');
  const message = blocker.message.trim();
  return message === '' || message === label || HANGUL.test(message) ? null : message;
};

/**
 * 판정 확정 취소 확인 창(권한 W-01-15 · screens/W-01-01.md 「확정 취소」 · US5-1). 사유는 선택.
 */
export const CancelConfirmDialog = ({
  inspection,
  busy,
  error,
  onBack,
  onProceed,
}: {
  inspection: InboundInspection;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onProceed: (reason: string) => void;
}) => {
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const inboundLotNo = inspection.inboundLotNo ?? inspection.inspectionRequestNo;

  return (
    <Dialog
      open
      size="md"
      showCloseButton={false}
      closeOnBackdropClick={false}
      title={t.title}
      onClose={onBack}
      footer={
        <>
          <Button variant="outlined" disabled={busy} onClick={onBack}>
            {t.back}
          </Button>
          <Button loading={busy} onClick={() => onProceed(reason)}>
            {t.proceed}
          </Button>
        </>
      }
    >
      {/* 사용자 시안(2026-11-17 · omf-all-around#286) — 대상 · 변경 사항 상자 · 안내 한 줄 · 사유. 보내는 값은 그대로다. */}
      <div className="iqc-cancel-confirm">
        <p className="iqc-cancel-confirm-target">{t.target(inboundLotNo)}</p>
        <h3 className="iqc-cancel-confirm-heading">{t.changesHeading}</h3>
        <dl className="iqc-cancel-confirm-changes">
          <div className="iqc-cancel-confirm-change">
            <dt>{t.lots((inspection.lots ?? []).length)}</dt>
            <dd>
              <span className="iqc-cancel-confirm-from">{t.lotsFrom}</span>
              <Icon name="arrow_forward" size={14} aria-hidden />
              <strong>{t.lotsTo}</strong>
            </dd>
          </div>
          {inspection.nonconformanceNo == null ? null : (
            <div className="iqc-cancel-confirm-change">
              <dt>{t.nonconformance(inspection.nonconformanceNo)}</dt>
              <dd>
                <strong>{t.nonconformanceTo}</strong>
              </dd>
            </div>
          )}
        </dl>
        <p className="iqc-inspection-action-note" data-tone="info">
          <Icon name="info" size={14} aria-hidden />
          {t.note}
        </p>
        <div className="iqc-cancel-confirm-reason">
          <FieldLabel htmlFor={reasonId} label={t.reason} />
          <TextArea
            id={reasonId}
            fullWidth
            rows={2}
            placeholder={t.reasonPlaceholder}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </div>
      {error === null ? null : <AlertBanner variant="error">{error}</AlertBanner>}
    </Dialog>
  );
};

/** 확정 취소 막힘 창(409 · 코드별 문구와 LOT 번호). */
export const CancelBlockedDialog = ({
  blockers,
  onClose,
}: {
  blockers: readonly ConfirmBlocker[];
  onClose: () => void;
}) => (
  <Dialog
    open
    size="md"
    showCloseButton={false}
    closeOnBackdropClick={false}
    title={t.blockedTitle}
    onClose={onClose}
    footer={<Button onClick={onClose}>{t.blockedOk}</Button>}
  >
    <p className="dialog-text">{t.blockedLead}</p>
    <ul className="iqc-inbound-confirm-lines">
      {blockers.map((blocker) => {
        const text = t.blockers[blocker.code] ?? blocker.code;
        const detail = blockerDetailOf(blocker, text);

        return (
          <li key={`${blocker.code}-${blocker.message}`}>
            <strong>{text}</strong>
            {detail === null ? null : <span className="parts-iqc-muted"> {detail}</span>}
          </li>
        );
      })}
    </ul>
    <p className="dialog-text">{t.blockedTail}</p>
  </Dialog>
);
