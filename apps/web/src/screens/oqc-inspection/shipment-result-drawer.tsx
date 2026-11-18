import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import type { InspectionLotForward, InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { LotMatchField } from '../parts-iqc-inspection/lot-match-field';
import { overriddenLotsOf } from '../parts-iqc-inspection/lot-judgment';
import { ReinspectionReasonField } from '../parts-iqc-inspection/reinspection-reason-field';
import { SerialJudgments } from './serial-judgments';
import { toSerialInputs, type SerialRow } from './serials';
import { ruleCodeOf, type PickedLotView } from './shipment-oqc';
import { LotJudgmentChip } from './shipment-oqc-parts';
import { useSaveShipmentResult } from './shipment-oqc-queries';

const s = messages.oqcInspection.shipment;
const d = s.drawer;

/** 판정 셋 — 합격 · 불합격 · 보류(계약 `overallJudgmentCode`). */
export const SHIPMENT_JUDGMENTS = ['ACCEPTED', 'REJECTED', 'HELD'] as const;

export interface ShipmentResultDrawerProps {
  inspectionRequestId: number;
  itemId: number;
  uomId: number;
  uomCode: string;
  /** 매칭 후보 — 지금 피킹된(살아 있는) LOT. 교체된 LOT 은 빠진다(US3-5). */
  views: readonly PickedLotView[];
  results: readonly InspectionResultSummaryForward[];
  /** 고칠 결과 — 새로 더하면 `null`. */
  editing: InspectionResultSummaryForward | null;
  /** 제목의 순번 — 고칠 때는 그 결과의 순번, 더할 때는 다음 순번. */
  seqNo: number;
  /** 새 결과의 미리 고른 LOT — 미검사 LOT(시안 W0403 ②). */
  preselectedLotIds: readonly number[];
  onClose: () => void;
  onSaved: (seqNo: number, edited: boolean) => void;
}

/**
 * W-04-03 결과 추가 · 수정 드로어(시안 W0403-After ②③④) — 피킹 LOT 매칭(1개 이상 필수 · [전부 선택]) · 판정 하나(합격 · 불합격
 * · 보류) · 재검 사유(불합격 · 보류를 가볍게 덮을 때만 필수). 수량 칸 · 자동 판정 · 확정이 없다 — 결과는 작성중으로 쌓이고 출하
 * 완료 때 확정된다. IQC 드로어(`parts-iqc-inspection/result-drawer.tsx`)의 매칭 · 사유 부품을 문구만 바꿔 쓴다.
 * ⛔ 측정치 · 불량은 서버가 새 흐름에서 받지 않는다 — 칸을 두지 않는다. 시리얼은 결과를 더할 때만(서버가 작성중 저장에서 받는다).
 */
export const ShipmentResultDrawer = ({
  inspectionRequestId,
  itemId,
  uomId,
  uomCode,
  views,
  results,
  editing,
  seqNo,
  preselectedLotIds,
  onClose,
  onSaved,
}: ShipmentResultDrawerProps) => {
  const resultId = editing?.inspectionResultId ?? null;
  const lots: InspectionLotForward[] = views.map((view) => view.lot);
  const activeIds = lots.map((lot) => lot.lotId);
  const initialMatch = (editing?.matchedLotIds ?? preselectedLotIds).filter((id) =>
    activeIds.includes(id),
  );
  const initialJudgment = editing?.overallJudgmentCode ?? null;
  const initialReason = editing?.reinspectionReasonCode ?? null;
  const [matched, setMatched] = useState<number[]>([...initialMatch]);
  const [judgment, setJudgment] = useState<string | null>(initialJudgment);
  const [reason, setReason] = useState<string | null>(initialReason);
  const [serialRows, setSerialRows] = useState<SerialRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [asking, setAsking] = useState(false);
  const savingId = useId();
  const judgmentNoteId = useId();

  const save = useSaveShipmentResult(inspectionRequestId, () => onSaved(seqNo, editing !== null));

  const dirty =
    matched.length !== initialMatch.length ||
    matched.some((id) => !initialMatch.includes(id)) ||
    judgment !== initialJudgment ||
    reason !== initialReason ||
    serialRows.length > 0;

  const overridden = overriddenLotsOf({
    results,
    editingResultId: resultId,
    seqNo,
    matchedLotIds: matched,
    judgmentCode: judgment,
  });
  const needsReason = overridden.length > 0;
  const ruleCode = ruleCodeOf(save.error);
  const matchError =
    checked && matched.length === 0
      ? d.matchRequired
      : ruleCode === 'MATCHED_LOT_REQUIRED'
        ? d.ruleErrors.MATCHED_LOT_REQUIRED
        : null;
  const reasonError =
    checked && needsReason && reason === null
      ? d.reasonRequired
      : ruleCode === 'REINSPECTION_REASON_REQUIRED'
        ? d.ruleErrors.REINSPECTION_REASON_REQUIRED
        : null;
  const judgmentError = checked && judgment === null ? d.judgmentRequired : null;
  const lotNoOf = (lotId: number): string =>
    lots.find((lot) => lot.lotId === lotId)?.lotNo ?? String(lotId);

  const submit = () => {
    setChecked(true);
    if (matched.length === 0 || judgment === null || (needsReason && reason === null)) return;
    save.write({
      inspectionRequestId,
      uomId,
      judgmentCode: judgment,
      matchedLotIds: matched,
      reinspectionReasonCode: reason,
      inspectedAt: new Date().toISOString(),
      serials: toSerialInputs(serialRows),
      editing:
        editing === null
          ? null
          : { inspectionResultId: editing.inspectionResultId, versionNo: editing.versionNo },
    });
  };

  const requestClose = () => {
    if (save.isSaving) return;
    if (dirty) setAsking(true);
    else onClose();
  };

  const title = editing === null ? d.addTitle(seqNo) : d.editTitle(seqNo);
  /* 규칙 오류는 칸 옆에 문구로 — 나머지만 배너로(서버 원문을 삼키지 않는다). */
  const bannerError =
    ruleCode === 'MATCHED_LOT_REQUIRED' || ruleCode === 'REINSPECTION_REASON_REQUIRED'
      ? null
      : save.error;

  return (
    <>
      <Dialog
        open
        placement="right"
        size="lg"
        className="iqc-inbound-drawer oqc-shipment-drawer"
        closeOnBackdropClick={false}
        showCloseButton={false}
        aria-label={title}
        onClose={requestClose}
        footer={
          <>
            <Button variant="outlined" disabled={save.isSaving} onClick={requestClose}>
              {d.cancel}
            </Button>
            <Button
              disabled={save.isSaving}
              aria-describedby={save.isSaving ? savingId : undefined}
              onClick={submit}
            >
              {save.isSaving ? d.saving : d.save}
            </Button>
          </>
        }
      >
        <div className="oqc-shipment-drawer-body">
          {/* 저장이 도는 동안 단추가 잠기는 까닭(C-4) — 화면 낭독기에 이어 준다. */}
          <span id={savingId} className="visually-hidden" aria-live="polite">
            {save.isSaving ? d.saving : ''}
          </span>
          <h2 className="parts-iqc-sub-title oqc-shipment-drawer-title">{title}</h2>
          {bannerError === null ? null : ruleCode === 'CONFIRMED_BY_SHIPMENT_COMPLETION' ? (
            <AlertBanner variant="error">{d.confirmedByShipment}</AlertBanner>
          ) : (
            <SaveErrorBanner error={bannerError} />
          )}
          <LotMatchField
            lots={lots}
            otherResults={results.filter((result) => result.inspectionResultId !== resultId)}
            uomCode={uomCode}
            value={matched}
            error={matchError}
            disabled={save.isSaving}
            onChange={setMatched}
            text={d}
            renderExtra={(lot) => {
              const view = views.find((each) => each.lot.lotId === lot.lotId);
              return view === undefined ? null : <LotJudgmentChip code={view.judgmentCode} />;
            }}
          />
          <section
            className="parts-iqc-card oqc-shipment-judgment"
            aria-labelledby="oqc-shipment-judgment-head"
          >
            <div className="parts-iqc-block-head">
              <h3 id="oqc-shipment-judgment-head" className="parts-iqc-sub-title">
                {d.judgmentHeading}{' '}
                <span className="required-mark" aria-hidden="true">
                  *
                </span>
              </h3>
            </div>
            <div
              className="oqc-shipment-judgment-options"
              role="group"
              aria-label={d.judgmentHeading}
            >
              {SHIPMENT_JUDGMENTS.map((code) => (
                <Button
                  key={code}
                  variant={judgment === code ? 'filled' : 'outlined'}
                  aria-pressed={judgment === code}
                  disabled={save.isSaving}
                  aria-describedby={judgmentNoteId}
                  onClick={() => setJudgment(code)}
                >
                  {s.judgments[code]}
                </Button>
              ))}
            </div>
            <p id={judgmentNoteId} className="field-note">
              {d.judgmentNote}
            </p>
            {judgmentError === null ? null : (
              <p className="field-error" role="alert">
                {judgmentError}
              </p>
            )}
          </section>
          {needsReason && judgment !== null ? (
            <ReinspectionReasonField
              overridden={overridden}
              lotNoOf={lotNoOf}
              judgmentCode={judgment}
              value={reason}
              error={reasonError}
              disabled={save.isSaving}
              onChange={setReason}
              text={d}
              lotLabel={(lotNo) => lotNo}
            />
          ) : reasonError !== null ? (
            /* 화면 셈은 덮지 않는다는데 서버가 사유를 요구했다 — 문구만 세운다(서버가 정본). */
            <p className="field-error" role="alert">
              {reasonError}
            </p>
          ) : null}
          {/* 시리얼별 OK/NG — 지금 부품 그대로(시안 「그대로」). 고침(PUT)은 시리얼을 받지 않아 더할 때만. */}
          {editing === null ? (
            <SerialJudgments
              inspectionRequestId={inspectionRequestId}
              itemId={itemId}
              rows={serialRows}
              onChange={setSerialRows}
              disabled={save.isSaving}
            />
          ) : null}
        </div>
      </Dialog>
      {asking && (
        <Dialog
          open
          size="sm"
          showCloseButton={false}
          closeOnBackdropClick={false}
          title={title}
          onClose={() => setAsking(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setAsking(false)}>
                {d.discardStay}
              </Button>
              <Button
                onClick={() => {
                  setAsking(false);
                  onClose();
                }}
              >
                {d.discardLeave}
              </Button>
            </>
          }
        >
          <p className="dialog-text">{d.discardBody}</p>
        </Dialog>
      )}
    </>
  );
};
