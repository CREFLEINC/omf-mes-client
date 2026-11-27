import { AlertBanner, Button, Dialog, Icon, TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { FieldLabel } from '../iqc-inspection/field-label';
import type { InboundInspection } from './inbound-queries';
import { lotJudgmentsOf } from './lot-judgment';

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
 * 판정 수정(확정 취소) 확인 창(권한 W-01-15 · screens/W-01-01.md 「확정 취소」 · US5-1). 사유는 선택.
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
  const results = inspection.results ?? [];
  /* 적용 검사 — LOT 판정에 쓰인 회차(상세 표 「적용 검사」와 같은 값)와 그 검사 일시(사용자 지시 2026-11-18 · #296). */
  const appliedSeqs = new Set(
    lotJudgmentsOf(inspection).flatMap((each) =>
      each.resultSeqNo === null ? [] : [each.resultSeqNo],
    ),
  );
  const applied = results
    .filter((result) => appliedSeqs.has(result.seqNo))
    .sort((a, b) => a.seqNo - b.seqNo);

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
      {/* 확인 팝업 시안(#360) — 단말 사용 중지 창처럼 대상 상자 · 질문, 변경 사항 상자 아래 안내 줄, 그 아래 사유. */}
      <div className="users-roles-worker-dialog iqc-cancel-confirm">
        <div className="users-roles-worker-block">
          <span className="users-roles-worker-block-caption">{t.targetCaption}</span>
          <strong>{inboundLotNo}</strong>
        </div>
        <p>{t.question}</p>
        <h3 className="iqc-cancel-confirm-heading">{t.changesHeading}</h3>
        {/* 시안(사용자 지시 2026-11-19 · omf-all-around#296) — LOT 묶음 · 결과 묶음을 한 상자에, 묶음 사이만 선. 안내는 한 줄. */}
        <div className="iqc-cancel-confirm-changes">
          <dl className="iqc-cancel-confirm-group">
            <div className="iqc-cancel-confirm-change">
              <dt>{t.lotsLabel}</dt>
              <dd>{t.lotsCount((inspection.lots ?? []).length)}</dd>
            </div>
            <div className="iqc-cancel-confirm-change">
              <dt>{t.qualityState}</dt>
              <dd>
                <span className="iqc-cancel-confirm-from">{t.lotsFrom}</span>
                <Icon name="arrow_forward" size={14} aria-hidden />
                <strong>{t.lotsTo}</strong>
              </dd>
            </div>
          </dl>
          <dl className="iqc-cancel-confirm-group">
            <div className="iqc-cancel-confirm-change">
              <dt>{t.resultsLabel}</dt>
              <dd>
                <strong>{t.resultsKept(results.length)}</strong>
              </dd>
            </div>
            {applied.length === 0 ? null : (
              <div className="iqc-cancel-confirm-change">
                <dt>{t.applied}</dt>
                <dd className="iqc-cancel-confirm-applied">
                  {applied.map((result) => (
                    <span key={result.inspectionResultId}>
                      {t.appliedValue(result.seqNo, formatPlantDateTime(result.inspectedAt) ?? '-')}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {inspection.nonconformanceNo == null ? null : (
              <div className="iqc-cancel-confirm-change">
                <dt>{t.nonconformance(inspection.nonconformanceNo)}</dt>
                <dd>
                  <strong>{t.nonconformanceTo}</strong>
                </dd>
              </div>
            )}
          </dl>
        </div>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
          <Icon name="info" size={16} aria-hidden />
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
