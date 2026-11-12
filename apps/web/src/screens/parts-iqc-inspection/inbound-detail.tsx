import {
  AlertBanner,
  Button,
  Chip,
  Dialog,
  Icon,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import type { InspectionLotForward, InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { formatPackage, formatQty } from '../../patterns/package-qty';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { toApiError } from '../../patterns/request';
import {
  deleteInspectionResult,
  useInboundInspection,
  useInboundRefresh,
  type InboundInspection,
} from './inbound-queries';
import { InboundHistory } from './inbound-history';
import { LotNo } from './lot-match-field';
import { ResultDrawer, type ResultDrawerProps } from './result-drawer';
import { LotJudgmentList } from './lot-judgment-list';
import { lotJudgmentsOf } from './lot-judgment';
import { ResultList, judgmentStatus, judgmentText } from './result-list';
import { SplitLotsDialog } from './split-lots-dialog';
import { ConfirmActions, ConfirmPermissionNote } from './confirm-bar';

const t = messages.iqcInboundLot.detail;
const tr = messages.iqcInboundLot.results;
const td = messages.iqcInboundLot.drawer;
const th = messages.iqcInboundLot.history;
const ts = messages.iqcInboundLot.split;

/** 부적합 처분 관리(W-03-10) — 불합격 확정 배너의 부적합 번호가 이 화면으로 간다. */
const DISPOSITION_PATH = '/quality/dispositions';

/** 품질 상태 칩 색. */
const lotStatusTone = (code: string): 'success' | 'error' | 'warning' | 'idle' =>
  code === 'NORMAL'
    ? 'success'
    : code === 'DEFECTIVE'
      ? 'error'
      : code === 'SUSPECT_HOLD'
        ? 'warning'
        : 'idle';

/** 판정 확정됐는가 — 새 흐름은 의뢰 단위 확정(`confirmedAt`). */
export const isConfirmed = (inspection: InboundInspection): boolean =>
  inspection.confirmedAt != null;

export interface InboundDetailProps {
  inspectionRequestId: number;
  /** 품목 「이름 · 코드」 — 상세가 품목 풀이를 이미 읽어 두었다. */
  itemParts: { code: string; name: string } | null;
  /** 검사 조건(「AQL 1.0 · 육안 검사」) — 기준 버전에서. */
  planText: string;
  uomCode: string;
  /** 결과 드로어의 양식 — 지금 IQC 양식 그대로(드로어 모드). */
  renderForm: ResultDrawerProps['renderForm'];
  /** 머리 오른쪽 단추 자리 — [판정 확정] · [확정 취소](C4)와 [자재 관리 LOT 분리]. */
  headActions?: (inspection: InboundInspection) => ReactNode;
  /** 머리 아래 줄(권한 안내 등 · C4). */
  headNote?: (inspection: InboundInspection) => ReactNode;
}

/**
 * W-01-01 새 흐름 상세 — **입하 LOT 하나 = 검사 의뢰 하나**(005 · screens/W-01-01.md · US3). 결과를 여러 건 기록 · 수정 ·
 * 삭제하고 결과마다 자재 관리 LOT 를 매칭한다. 결과의 저장은 확정이 아니다 — 판정 확정은 검사 단위(W-01-15, C4).
 *
 * ⭐ 이전된 옛 IQC(대상 LOT)는 이 화면을 쓰지 않는다 — `InspectionDetail` 의 지금 경로 그대로(FR-051 · R18-1).
 */
export const InboundDetail = ({
  inspectionRequestId,
  itemParts,
  planText,
  uomCode,
  renderForm,
  headActions,
  headNote,
}: InboundDetailProps) => {
  const { client } = useApiClient();
  const toast = useToast();
  const refresh = useInboundRefresh();
  const query = useInboundInspection(inspectionRequestId);
  const [drawer, setDrawer] = useState<{ editing: InspectionResultSummaryForward | null } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<InspectionResultSummaryForward | null>(null);
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState<'conflict' | 'locked' | 'failed' | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const splitLockId = useId();

  if (query.isPending) return <p className="field-note">{t.loading}</p>;
  if (query.isError || query.data === undefined) {
    return (
      <AlertBanner variant="error">
        <span className="parts-iqc-no-plan">
          <span>{t.loadFailed}</span>
          <Button variant="outlined" size="sm" onClick={() => void query.refetch()}>
            {t.retry}
          </Button>
        </span>
      </AlertBanner>
    );
  }

  const inspection = query.data;
  const confirmed = isConfirmed(inspection);
  const lots = inspection.lots ?? [];
  const results = inspection.results ?? [];
  const inboundLotNo = inspection.inboundLotNo ?? inspection.inspectionRequestNo;
  const qty = (value: number): string => `${formatQty(value)} ${uomCode}`;
  /* 다음 순번은 서버가 주면 그것(지운 순번은 다시 쓰지 않는다), 없으면 지금 결과의 가장 큰 순번 + 1. */
  const nextSeq =
    inspection.nextResultSeqNo ??
    results.reduce((max, result) => Math.max(max, result.seqNo), 0) + 1;
  const statusKey = confirmed
    ? 'CONFIRMED'
    : inspection.statusCode === 'IN_PROGRESS'
      ? 'IN_PROGRESS'
      : 'REQUESTED';
  const preview = inspection.previewJudgmentCode ?? null;

  const remove = async (result: InspectionResultSummaryForward): Promise<void> => {
    setBusy(true);
    setWriteError(null);
    try {
      await deleteInspectionResult(client, result.inspectionResultId, result.versionNo);
      setDeleting(null);
      toast.show({ variant: 'success', description: tr.deleted(result.seqNo) });
    } catch (cause) {
      const error = toApiError(cause);

      setDeleting(null);
      setWriteError(
        error.kind === 'conflict' ? 'conflict' : error.kind === 'stateLocked' ? 'locked' : 'failed',
      );
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const lotColumns: Column<InspectionLotForward>[] = [
    { key: 'lotNo', header: t.columns.lotNo, render: (row) => <LotNo lotNo={row.lotNo} /> },
    {
      key: 'qty',
      header: t.columns.qty,
      render: (row) => (
        <span>
          {qty(row.lotQty)}
          <span className="parts-iqc-muted">
            {' / '}
            {formatPackage(row.package) ?? t.noPackage}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: t.columns.status,
      render: (row) => (
        <span className="iqc-inbound-chips">
          <Chip size="sm" status={lotStatusTone(row.statusCode)}>
            {row.statusCode === 'INSPECTION_PENDING' && !confirmed ? (
              <Icon name="lock" size={12} aria-hidden />
            ) : null}
            {(t.lotStatus as Record<string, string | undefined>)[row.statusCode] ?? row.statusCode}
          </Chip>
          {row.goodsReceived ? <Chip size="sm">{t.goodsReceived}</Chip> : null}
        </span>
      ),
    },
    {
      key: 'matched',
      header: t.columns.matched,
      render: (row) => {
        const matched = results.filter((result) => result.matchedLotIds.includes(row.lotId));

        return matched.length === 0 ? (
          <span className="parts-iqc-muted">{t.none}</span>
        ) : (
          <span className="iqc-inbound-chips">
            {matched.map((result) => (
              <Chip
                key={result.inspectionResultId}
                size="sm"
                status={judgmentStatus(result.overallJudgmentCode)}
              >
                {t.matchedChip(result.seqNo)}
              </Chip>
            ))}
          </span>
        );
      },
    },
  ];

  const banner = (() => {
    if (!confirmed) {
      return results.length === 0 ? (
        <AlertBanner variant="info">{t.banner.empty}</AlertBanner>
      ) : (
        <AlertBanner variant={preview === 'REJECTED' ? 'warning' : 'info'}>
          {t.banner.preview(judgmentText(preview), results.length)}
        </AlertBanner>
      );
    }
    const by =
      inspection.confirmedByName == null
        ? null
        : t.banner.by(
            inspection.confirmedByName,
            formatPlantDateTime(inspection.confirmedAt ?? null) ?? '',
          );
    const code = inspection.overallJudgmentCode ?? null;

    if (code === 'REJECTED') {
      return (
        <AlertBanner variant="error">
          <span>{t.banner.rejected(lots.length)}</span>{' '}
          {inspection.nonconformanceNo == null ? null : (
            <span>
              {t.banner.ncLabel}{' '}
              <Link
                to={`${DISPOSITION_PATH}${
                  inspection.nonconformanceId == null
                    ? ''
                    : `?nonconformanceId=${String(inspection.nonconformanceId)}`
                }`}
              >
                {inspection.nonconformanceNo}
              </Link>{' '}
              {t.banner.rejectedNcTail}
            </span>
          )}
          {by === null ? null : <span className="parts-iqc-muted"> {by}</span>}
        </AlertBanner>
      );
    }

    return (
      <AlertBanner variant={code === 'HELD' ? 'warning' : 'success'}>
        {code === 'HELD' ? t.banner.held : t.banner.accepted(lots.length)}
        {by === null ? null : <span className="parts-iqc-muted"> {by}</span>}
      </AlertBanner>
    );
  })();

  const splitLock = confirmed ? ts.lockedConfirmed : lots.length < 2 ? ts.lockedSingle : null;
  const allocations = inspection.poAllocations ?? [];
  const unallocated = inspection.unallocatedQty ?? 0;

  return (
    <div className="parts-iqc-detail-body iqc-inbound-detail">
      <div className="parts-iqc-detail-head">
        <h2 className="pane-title iqc-inbound-title">{inboundLotNo}</h2>
        <Chip
          size="sm"
          status={confirmed ? 'success' : statusKey === 'IN_PROGRESS' ? 'info' : 'idle'}
        >
          {t.status[statusKey]}
        </Chip>
        {confirmed ? (
          <Chip size="sm" status={judgmentStatus(inspection.overallJudgmentCode ?? null)}>
            {judgmentText(inspection.overallJudgmentCode ?? null)}
          </Chip>
        ) : preview === null ? null : (
          <Chip size="sm" status={judgmentStatus(preview)}>
            {t.preview(judgmentText(preview))}
          </Chip>
        )}
        {/*
         * 단추는 한 묶음 — 좁거나 글이 길면(베트남어 · 1024) 묶음째 다음 줄로 내려간다. 단추 이름은 한 줄(L14-2).
         * 전에는 단추마다 낱말 사이에서 세 줄로 꺾이고 머리가 칸 밖으로 밀렸다.
         */}
        <div className="iqc-inbound-head-actions">
          <Button variant="outlined" size="sm" onClick={() => setHistoryOpen(true)}>
            {th.open}
          </Button>
          {/* 분리는 확정 전 · 자재 관리 LOT 2개 이상(US7-1 · screens/W-01-01.md 「자재 관리 LOT 분리 창」). */}
          <Button
            variant="outlined"
            size="sm"
            disabled={splitLock !== null}
            aria-describedby={splitLock === null ? undefined : splitLockId}
            title={splitLock ?? undefined}
            onClick={() => setSplitOpen(true)}
          >
            {ts.open}
          </Button>
          {/* 판정 확정 · 확정 취소 — W-01-15 가 있을 때만(US4-7, C4). */}
          <ConfirmActions inspection={inspection} confirmed={confirmed} />
          {headActions?.(inspection)}
        </div>
      </div>
      <ConfirmPermissionNote />
      {splitLock === null ? null : (
        <span id={splitLockId} className="visually-hidden">
          {splitLock}
        </span>
      )}
      {headNote?.(inspection)}

      <dl className="parts-iqc-facts iqc-inbound-facts">
        <div className="parts-iqc-fact">
          <dt className="field-label">{t.facts.item}</dt>
          <dd className="parts-iqc-fact-key">
            {itemParts?.code ?? '-'}
            {itemParts === null ? null : (
              <span className="parts-iqc-fact-sub">{itemParts.name}</span>
            )}
          </dd>
        </div>
        <div className="parts-iqc-fact">
          <dt className="field-label">{t.facts.supplier}</dt>
          <dd>{inspection.supplierName ?? '-'}</dd>
        </div>
        <div className="parts-iqc-fact">
          <dt className="field-label">{t.facts.request}</dt>
          <dd>{inspection.inspectionRequestNo}</dd>
        </div>
        <div className="parts-iqc-fact">
          <dt className="field-label">{t.facts.inspectedQty}</dt>
          <dd>{t.facts.inspectedQtyValue(qty(inspection.targetQty), lots.length)}</dd>
        </div>
        <div className="parts-iqc-fact">
          <dt className="field-label">{t.facts.received}</dt>
          <dd>
            {t.facts.receivedValue(
              formatPlantDateTime(inspection.receivedAt ?? null) ?? '-',
              inspection.receivedChannelCode ?? null,
            )}
          </dd>
        </div>
        <div className="parts-iqc-fact">
          <dt className="field-label">{t.facts.plan}</dt>
          <dd>{planText}</dd>
        </div>
        {inspection.splitFromInboundLotNo == null ? null : (
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.facts.splitFrom}</dt>
            <dd>{inspection.splitFromInboundLotNo}</dd>
          </div>
        )}
      </dl>

      {banner}
      {writeError === null ? null : (
        <AlertBanner variant="error">
          <span className="parts-iqc-no-plan">
            <span>
              {writeError === 'conflict'
                ? tr.conflict
                : writeError === 'locked'
                  ? tr.lockedWrite
                  : tr.deleteFailed}
            </span>
            <Button
              variant="outlined"
              size="sm"
              onClick={() => {
                setWriteError(null);
                void refresh();
              }}
            >
              {tr.reload}
            </Button>
          </span>
        </AlertBanner>
      )}

      <section className="parts-iqc-card" aria-label={t.lotsHeading(lots.length)}>
        <div className="parts-iqc-block-head">
          <h3>{t.lotsHeading(lots.length)}</h3>
          <span className="parts-iqc-muted">{t.lotsNote}</span>
        </div>
        <div className="wide-table iqc-inbound-table">
          <Table
            density="compact"
            columns={lotColumns}
            rows={lots}
            getRowId={(row) => String(row.lotId)}
            aria-label={t.lotsHeading(lots.length)}
          />
        </div>
        <p className="iqc-inspection-action-note" data-tone="info">
          <Icon name="lock" size={14} aria-hidden />
          {confirmed ? t.lockedConfirmed : t.lockedComposition}
        </p>
        <p className="field-note iqc-inbound-po">
          <strong>{t.poHeading}</strong>{' '}
          {allocations.length === 0 && unallocated === 0
            ? t.poEmpty
            : t.poJoin([
                ...allocations.map((row) =>
                  t.poLine(row.purchaseOrderNo, row.lineNo, formatQty(row.qty)),
                ),
                ...(unallocated > 0 ? [t.poNone(formatQty(unallocated))] : []),
              ])}
        </p>
      </section>

      <section className="parts-iqc-card" aria-label={tr.heading(results.length)}>
        <div className="parts-iqc-block-head">
          <h3>{tr.heading(results.length)}</h3>
          <span className="parts-iqc-footer-gap" />
          {confirmed ? (
            <span className="parts-iqc-muted">{tr.lockedHead}</span>
          ) : (
            <Button size="sm" onClick={() => setDrawer({ editing: null })}>
              {tr.add}
            </Button>
          )}
        </div>
        {results.length === 0 ? null : (
          <LotJudgmentList judgments={lotJudgmentsOf(inspection)} lots={lots} results={results} />
        )}
        <ResultList
          results={results}
          lots={lots}
          uomCode={uomCode}
          locked={confirmed}
          busy={busy}
          onEdit={(result) => setDrawer({ editing: result })}
          onDelete={(result) => {
            setWriteError(null);
            setDeleting(result);
          }}
        />
      </section>

      {drawer === null ? null : (
        <ResultDrawer
          inspection={inspection}
          uomCode={uomCode}
          editing={drawer.editing}
          seqNo={drawer.editing?.seqNo ?? nextSeq}
          renderForm={renderForm}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            const editing = drawer.editing;

            setDrawer(null);
            void (async () => {
              await refresh();
              /* 알림의 미리 보기는 저장 뒤 서버가 다시 매긴 것으로(불합격 > 보류 > 합격). */
              const fresh = await query.refetch();
              const added = (fresh.data?.results ?? []).reduce(
                (max, result) => Math.max(max, result.seqNo),
                0,
              );

              toast.show({
                variant: 'success',
                description:
                  editing === null
                    ? td.added(added, judgmentText(fresh.data?.previewJudgmentCode ?? null))
                    : td.updated(editing.seqNo),
              });
            })();
          }}
        />
      )}

      {deleting === null ? null : (
        <Dialog
          open
          size="sm"
          showCloseButton={false}
          closeOnBackdropClick={false}
          title={tr.deleteTitle(deleting.seqNo)}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="outlined" disabled={busy} onClick={() => setDeleting(null)}>
                {tr.deleteCancel}
              </Button>
              <Button loading={busy} onClick={() => void remove(deleting)}>
                {tr.deleteConfirm}
              </Button>
            </>
          }
        >
          <p className="dialog-text">{tr.deleteBody}</p>
        </Dialog>
      )}

      {splitOpen && (
        <SplitLotsDialog
          inspection={inspection}
          uomCode={uomCode}
          onClose={() => setSplitOpen(false)}
          onSplit={(result) => {
            setSplitOpen(false);
            toast.show({
              variant: 'success',
              description: ts.done(result.inboundLot.inboundLotNo, result.movedLotIds.length),
            });
          }}
        />
      )}

      {historyOpen && (
        <InboundHistory
          inspectionRequestId={inspectionRequestId}
          inboundLotNo={inboundLotNo}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
};
