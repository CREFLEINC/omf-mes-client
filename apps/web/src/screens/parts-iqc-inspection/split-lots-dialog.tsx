import { AlertBanner, Button, Checkbox, Chip, Dialog, Icon, TextField } from '@crefle/web-ui';
import type { ApiError, InboundLotSplitPreview, InboundLotSplitResult } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { formatBaseQty, formatPackage, formatQty } from '../../patterns/package-qty';
import { toApiError } from '../../patterns/request';
import {
  splitLots,
  useInboundRefresh,
  useSplitPreview,
  type InboundInspection,
} from './inbound-queries';

const t = messages.iqcInboundLot.split;
const judgmentLabel = messages.partsIqcInspection.judgment;

/** 자재 관리 LOT 번호의 끝 4자리 — 화면이 굵게 보이는 몫. */
const TAIL = 4;
const FINALIZED_CODE = 'INBOUND_LOT_FINALIZED';

const JUDGMENT_STATUS: Record<string, 'success' | 'error' | 'warning'> = {
  ACCEPTED: 'success',
  REJECTED: 'error',
  HELD: 'warning',
};

/** 오류가 실은 업무 코드들 — 봉투 모양(conflict · http 의 `code`, 잠김 · 검증의 `errors[].code`)을 가리지 않는다. */
const codesOf = (error: ApiError): string[] => {
  switch (error.kind) {
    case 'conflict':
    case 'http':
      return error.code === undefined ? [] : [error.code];
    case 'stateLocked':
    case 'validation':
      return error.errors.map((item) => item.code);
    default:
      return [];
  }
};

const failureMessage = (error: ApiError): string => {
  if (codesOf(error).includes(FINALIZED_CODE)) return t.finalized;
  if (error.kind === 'conflict') return t.conflict;

  return t.failed;
};

const LotNo = ({ lotNo }: { lotNo: string }) => (
  <span className="iqc-split-lot-no">
    {lotNo.slice(0, -TAIL)}
    <strong>{lotNo.slice(-TAIL)}</strong>
  </span>
);

const PreviewRow = ({
  icon,
  tone,
  children,
}: {
  icon: string;
  tone?: string;
  children: ReactNode;
}) => (
  <li className={tone === undefined ? 'iqc-split-row' : `iqc-split-row ${tone}`}>
    <Icon name={icon} size={18} />
    <div>{children}</div>
  </li>
);

const joined = (items: ReactNode[]): ReactNode[] =>
  items.flatMap((item, index) => (index === 0 ? [item] : [', ', item]));

export interface SplitLotsDialogProps {
  inspection: InboundInspection;
  /** 품목 기본 단위 코드 — 「1,000 EA」. */
  uomCode: string;
  onClose: () => void;
  onSplit: (result: InboundLotSplitResult) => void;
}

/**
 * W-01-01 자재 관리 LOT 분리 창(권한 W-01-01 · 확정 전만 · screens/W-01-01.md · 계약 §3 `:split-lots` · `split-preview`).
 * 고른 자재 관리 LOT 를 새 입하 LOT 로 옮긴다. 원래 입하 LOT 에 하나 이상 남아야 해서 전부 고르면 잠근다.
 * 미리 보기는 서버 `split-preview` 를 그대로 보인다(새 입하 LOT 번호는 실행 뒤 정해진다).
 */
export const SplitLotsDialog = ({
  inspection,
  uomCode,
  onClose,
  onSplit,
}: SplitLotsDialogProps) => {
  const { client } = useApiClient();
  const refresh = useInboundRefresh();
  const reasonId = useId();
  const lots = inspection.lots ?? [];
  const results = inspection.results ?? [];
  const inboundLotId = inspection.inboundLotId ?? null;
  const versionNo = inspection.inboundLotVersionNo ?? null;

  const [selected, setSelected] = useState<number[]>([]);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /* 고른 순서가 아니라 표의 순서로 보낸다 — 미리 보기 캐시 열쇠와 요청이 같은 순서를 쓴다. */
  const lotIds = lots.map((lot) => lot.lotId).filter((id) => selected.includes(id));
  const allSelected = lots.length > 0 && lotIds.length === lots.length;
  const showPreview = lotIds.length > 0 && !allSelected;
  const preview = useSplitPreview(showPreview ? inboundLotId : null, lotIds);

  const lockReason =
    lotIds.length === 0
      ? t.noneSelected
      : allSelected
        ? t.allSelected
        : inboundLotId === null || versionNo === null
          ? t.noVersion
          : null;

  const toggle = (lotId: number, checked: boolean) => {
    setFailure(null);
    setSelected((current) =>
      checked ? [...current, lotId] : current.filter((id) => id !== lotId),
    );
  };

  const submit = async () => {
    if (lockReason !== null || inboundLotId === null || versionNo === null) return;
    setPending(true);
    setFailure(null);
    try {
      const result = await splitLots(client, inboundLotId, {
        lotIds,
        versionNo,
        reason: reason.trim() === '' ? null : reason,
      });
      await refresh();
      onSplit(result);
    } catch (error) {
      setFailure(failureMessage(toApiError(error)));
      setPending(false);
    }
  };

  const tailOf = (lotId: number): string => {
    const lot = lots.find((candidate) => candidate.lotId === lotId);

    return lot === undefined ? String(lotId) : lot.lotNo.slice(-TAIL);
  };

  const renderPreview = (data: InboundLotSplitPreview) => {
    const before = data.movedQty + data.remainingQty;
    const none = <span className="iqc-split-muted">{t.none}</span>;

    return (
      <ul className="iqc-split-preview-list">
        <PreviewRow icon="add_box">
          {t.newLot(
            data.movedLotCount,
            formatBaseQty(data.movedQty, uomCode),
            data.newInspectionInProgress,
          )}
        </PreviewRow>
        <PreviewRow icon="remove">
          {t.remaining(
            inspection.inboundLotNo ?? '-',
            formatQty(before),
            formatBaseQty(data.remainingQty, uomCode),
            data.remainingLotCount,
          )}
        </PreviewRow>
        <PreviewRow icon="arrow_forward" tone="is-moved">
          <strong>{t.movedResults}</strong> {t.movedResultsNote}:{' '}
          {data.movedResults.length === 0 ? (
            none
          ) : (
            <>
              {joined(
                data.movedResults.map((moved) => (
                  <span key={moved.inspectionResultId} className="iqc-split-result">
                    {t.resultChip(moved.seqNo)}{' '}
                    {moved.overallJudgmentCode !== null && (
                      <Chip
                        variant="status"
                        size="sm"
                        status={JUDGMENT_STATUS[moved.overallJudgmentCode] ?? 'idle'}
                      >
                        {judgmentLabel[moved.overallJudgmentCode] ?? moved.overallJudgmentCode}
                      </Chip>
                    )}
                  </span>
                )),
              )}{' '}
              — {t.renumber}
            </>
          )}
        </PreviewRow>
        <PreviewRow icon="link_off" tone="is-unmatched">
          <strong>{t.unmatchedResults}</strong> {t.unmatchedResultsNote}:{' '}
          {data.unmatchedResults.length === 0
            ? none
            : joined(
                data.unmatchedResults.map((unmatched) => (
                  <span key={unmatched.inspectionResultId}>
                    {t.resultChip(unmatched.seqNo)} —{' '}
                    {t.matchRemoved(unmatched.removedLotIds.map(tailOf).join(', '))}
                  </span>
                )),
              )}
        </PreviewRow>
        <PreviewRow icon="check" tone="is-kept">
          {t.keptResults}:{' '}
          {data.keptResults.length === 0
            ? none
            : joined(
                data.keptResults.map((kept) => {
                  const summary = results.find(
                    (result) => result.inspectionResultId === kept.inspectionResultId,
                  );
                  const unmatchedNote =
                    summary !== undefined && summary.matchedLotIds.length === 0 ? t.noMatch : '';

                  return (
                    <span key={kept.inspectionResultId}>
                      {t.resultChip(kept.seqNo)}
                      {unmatchedNote}
                    </span>
                  );
                }),
              )}
        </PreviewRow>
        <PreviewRow icon="sync_alt">
          <strong>{t.movedAllocations}</strong>:{' '}
          {data.movedAllocations.length === 0
            ? none
            : joined(
                data.movedAllocations.map((allocation, index) => (
                  <span key={`${String(allocation.purchaseOrderLineId)}-${String(index)}`}>
                    {allocation.purchaseOrderLineId === null
                      ? t.noPo
                      : t.poLine(allocation.purchaseOrderNo ?? '-', allocation.lineNo ?? 0)}{' '}
                    {formatQty(allocation.qty)} {t.toNewLot}
                  </span>
                )),
              )}
        </PreviewRow>
      </ul>
    );
  };

  return (
    <Dialog
      open
      size="lg"
      title={t.title}
      showCloseButton={false}
      closeOnBackdropClick={false}
      onClose={onClose}
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>
            {t.cancel}
          </Button>
          <Button
            variant="filled"
            disabled={lockReason !== null || pending}
            aria-describedby={lockReason === null ? undefined : reasonId}
            onClick={() => void submit()}
          >
            {t.submit}
          </Button>
        </>
      }
    >
      <div className="iqc-split">
        <p className="iqc-split-intro">
          {t.intro} {t.introFollow}
        </p>

        <ul className="iqc-split-lots" aria-label={t.lotList}>
          {lots.map((lot) => {
            const matched = results.filter((result) => result.matchedLotIds.includes(lot.lotId));
            const pkg = formatPackage(lot.package);

            return (
              <li key={lot.lotId} className="iqc-split-lot">
                <Checkbox
                  checked={selected.includes(lot.lotId)}
                  disabled={pending}
                  onChange={(event) => toggle(lot.lotId, event.target.checked)}
                >
                  <LotNo lotNo={lot.lotNo} />
                </Checkbox>
                <span className="iqc-split-lot-qty">
                  {formatBaseQty(lot.lotQty, uomCode)}
                  {pkg !== null && <span className="iqc-split-muted"> ({pkg})</span>}
                </span>
                {matched.map((result) => (
                  <Chip
                    key={result.inspectionResultId}
                    variant="status"
                    size="sm"
                    status={
                      result.overallJudgmentCode === null
                        ? 'idle'
                        : (JUDGMENT_STATUS[result.overallJudgmentCode] ?? 'idle')
                    }
                  >
                    {t.resultChip(result.seqNo)}
                  </Chip>
                ))}
              </li>
            );
          })}
        </ul>

        {allSelected ? (
          <AlertBanner id={reasonId} variant="error">
            {t.allSelected}
          </AlertBanner>
        ) : lockReason !== null ? (
          <p id={reasonId} className="iqc-split-hint">
            {lockReason}
          </p>
        ) : null}

        {showPreview && (
          <section className="iqc-split-preview" aria-label={t.preview}>
            <strong>{t.preview}</strong>
            {preview.isError ? (
              <p className="iqc-split-hint">{t.previewFailed}</p>
            ) : preview.data === undefined ? (
              <p className="iqc-split-hint">{t.previewLoading}</p>
            ) : (
              renderPreview(preview.data)
            )}
          </section>
        )}

        <TextField
          label={t.reason}
          placeholder={t.reasonPlaceholder}
          value={reason}
          disabled={pending}
          fullWidth
          onChange={(event) => setReason(event.target.value)}
        />

        {failure !== null && <AlertBanner variant="error">{failure}</AlertBanner>}
      </div>
    </Dialog>
  );
};
