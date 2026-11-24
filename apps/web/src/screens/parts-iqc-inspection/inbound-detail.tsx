import {
  AlertBanner,
  Button,
  Chip,
  Dialog,
  Icon,
  Table,
  Tabs,
  useToast,
  type Column,
} from '@crefle/web-ui';
import type { InspectionLotForward, InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
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
import { InboundAttachDialog, InboundAttachmentTable } from './inbound-attachments';
import { InboundHistory } from './inbound-history';
import { LotNo } from './lot-match-field';
import { ResultDrawer, type ResultDrawerProps } from './result-drawer';
import { SupersededNotes } from './lot-judgment-list';
import { lotJudgmentsOf } from './lot-judgment';
import { ResultList, judgmentStatus, judgmentText } from './result-list';
import { SplitLotsDialog } from './split-lots-dialog';
import { ConfirmActions, ConfirmPermissionNote } from './confirm-bar';

const t = messages.iqcInboundLot.detail;
const tr = messages.iqcInboundLot.results;
const td = messages.iqcInboundLot.drawer;
const th = messages.iqcInboundLot.history;
const ts = messages.iqcInboundLot.split;
const ta = messages.iqcInboundLot.attachments;

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
  /** 검사 조건 칸 오른쪽 [기준 조회] 단추(사용자 지시 2026-11-19 · omf-all-around#296). */
  planAction?: ReactNode;
  uomCode: string;
  /** 결과 드로어의 양식 — 지금 IQC 양식 그대로(드로어 모드). */
  renderForm: ResultDrawerProps['renderForm'];
  /** 머리 오른쪽 단추 자리 — [판정 확정] · [확정 취소](C4)와 [자재 관리 LOT 분리]. */
  headActions?: (inspection: InboundInspection) => ReactNode;
  /** 머리 아래 줄(권한 안내 등 · C4). */
  headNote?: (inspection: InboundInspection) => ReactNode;
  /**
   * 자재 관리 LOT 을 스캔해 연 경우 — 그 LOT 을 고른 채로 결과 추가 창을 바로 연다(사용자 지시 2026-11-16 · omf-all-around#274).
   * `key` 는 스캔마다 바뀐다(같은 LOT 을 다시 스캔해도 다시 연다). 판정 확정된 의뢰면 열지 않는다.
   */
  scanOpen?: { lotId: number; key: number } | null;
  /** 판정 확정이 끝난 뒤 — OA 가 결과 창에서 골라 둔 검사 수준을 이때 저장한다(확정해야 저장 · omf-all-around#290). */
  onConfirmed?: () => void;
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
  planAction,
  uomCode,
  renderForm,
  headActions,
  headNote,
  scanOpen = null,
  onConfirmed,
}: InboundDetailProps) => {
  const { client } = useApiClient();
  const toast = useToast();
  const refresh = useInboundRefresh();
  const query = useInboundInspection(inspectionRequestId);
  const [drawer, setDrawer] = useState<{
    editing: InspectionResultSummaryForward | null;
    preselectedLotIds?: readonly number[];
  } | null>(null);
  const loaded = query.data;
  const [openedScan, setOpenedScan] = useState<number | null>(null);
  useEffect(() => {
    if (scanOpen === null || loaded === undefined || openedScan === scanOpen.key) return;
    setOpenedScan(scanOpen.key);
    if (isConfirmed(loaded) || drawer !== null) return;
    if (!(loaded.lots ?? []).some((lot) => lot.lotId === scanOpen.lotId)) return;
    setTab('detail');
    setDrawer({ editing: null, preselectedLotIds: [scanOpen.lotId] });
  }, [scanOpen, loaded, openedScan, drawer]);
  const [deleting, setDeleting] = useState<InspectionResultSummaryForward | null>(null);
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState<'conflict' | 'locked' | 'failed' | null>(null);
  /* 상세 내용 · 변경 이력 탭(사용자 지시 2026-11-16 · omf-all-around#274). */
  const [tab, setTab] = useState<'detail' | 'history'>('detail');
  const [splitOpen, setSplitOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
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

  const lotJudgments = lotJudgmentsOf(inspection);
  const lotJudgmentOf = (lotId: number) =>
    lotJudgments.find((each) => each.lotId === lotId && each.resultSeqNo !== null) ?? null;

  const lotColumns: Column<InspectionLotForward>[] = [
    /* 시안(사용자 지시 2026-11-16 · #274) — 품질 상태는 글자만(자물쇠 없음). 패키징은 있을 때만. */
    {
      key: 'lotNo',
      align: 'center',
      header: t.columns.lotNo,
      render: (row) => <LotNo lotNo={row.lotNo} />,
    },
    {
      key: 'qty',
      align: 'center',
      header: t.columns.qty,
      render: (row) => {
        const pack = formatPackage(row.package);
        return (
          <span>
            {qty(row.lotQty)}
            {pack === null ? null : <span className="parts-iqc-muted">{` / ${pack}`}</span>}
          </span>
        );
      },
    },
    {
      key: 'status',
      align: 'center',
      header: t.columns.status,
      render: (row) => (
        /* 품질 상태도 라벨(칩)로 — 자물쇠 아이콘은 없이(사용자 지시 2026-11-16 · #274). */
        <span className="iqc-inbound-chips">
          <Chip size="sm" status={lotStatusTone(row.statusCode)}>
            {(t.lotStatus as Record<string, string | undefined>)[row.statusCode] ?? row.statusCode}
          </Chip>
          {row.goodsReceived ? <Chip size="sm">{t.goodsReceived}</Chip> : null}
        </span>
      ),
    },
    /* 판정 · 적용 검사 — LOT 마다 적용된(최신) 검사 회차와 그 판정(사용자 시안 2026-11-16 · #274). 확정 전에도 「판정」(#296). */
    {
      key: 'judgment',
      align: 'center',
      header: t.columns.judgment,
      render: (row) => {
        const judgment = lotJudgmentOf(row.lotId);

        return judgment === null ? (
          <Chip size="sm">{t.noJudgment}</Chip>
        ) : (
          <Chip size="sm" status={judgmentStatus(judgment.judgmentCode)}>
            {judgmentText(judgment.judgmentCode)}
          </Chip>
        );
      },
    },
    {
      key: 'applied',
      align: 'center',
      header: t.columns.applied,
      render: (row) => {
        const judgment = lotJudgmentOf(row.lotId);

        return judgment?.resultSeqNo == null ? t.appliedNone : t.appliedSeq(judgment.resultSeqNo);
      },
    },
  ];

  const banner = (() => {
    /* 확정 전 예상 종합 판정 안내는 보이지 않는다(사용자 지시 2026-11-16 · #274). */
    if (!confirmed) return null;
    const code = inspection.overallJudgmentCode ?? null;

    if (code === 'REJECTED') {
      return (
        /*
         * 불합격 확정 안내(사용자 시안 2026-11-16 · #274) — 굵은 제목 · 한 문장, 부적합 처분 화면으로 가는 링크는 단추 모양으로
         * 오른쪽에(번호 글자 링크는 이동인 줄 알기 어려웠다).
         */
        <AlertBanner variant="error" className="iqc-inbound-nc-banner">
          <span className="iqc-inbound-banner-row">
            <span>
              <strong>{t.banner.rejectedTitle}</strong>
              {' · ' /* ui-check-ignore: C-13 사용자 지시 표기(굵은 제목 · 문장 · #274) */}
              {t.banner.rejected(lots.length, inspection.nonconformanceNo ?? null)}
            </span>
            {inspection.nonconformanceNo == null ? null : (
              <Link
                className="iqc-inbound-nc-link"
                to={`${DISPOSITION_PATH}${
                  inspection.nonconformanceId == null
                    ? ''
                    : `?nonconformanceId=${String(inspection.nonconformanceId)}`
                }`}
              >
                {t.banner.ncOpen}
                <Icon name="open_in_new" size={18} aria-hidden />
              </Link>
            )}
          </span>
        </AlertBanner>
      );
    }

    return (
      /* 합격 · 보류 확정 안내도 불합격과 같은 모양 — 굵은 제목 · 한 문장(사용자 지시 2026-11-16 · #274). */
      <AlertBanner
        variant={code === 'HELD' ? 'warning' : 'success'}
        className="iqc-inbound-nc-banner"
      >
        <span>
          <strong>{code === 'HELD' ? t.banner.heldTitle : t.banner.acceptedTitle}</strong>
          {' · ' /* ui-check-ignore: C-13 사용자 지시 표기(굵은 제목 · 문장 · #274) */}
          {code === 'HELD' ? t.banner.held : t.banner.accepted(lots.length)}
        </span>
      </AlertBanner>
    );
  })();

  const splitLock = confirmed ? ts.lockedConfirmed : lots.length < 2 ? ts.lockedSingle : null;
  const allocations = inspection.poAllocations ?? [];
  const unallocated = inspection.unallocatedQty ?? 0;

  return (
    <div className="parts-iqc-detail-body iqc-inbound-detail">
      <Tabs
        className="parts-iqc-detail-tabs"
        size="md"
        aria-label={inboundLotNo}
        value={tab}
        onChange={(next) => setTab(next === 'history' ? 'history' : 'detail')}
        items={[
          {
            value: 'detail',
            label: th.detailTab,
            content:
              tab === 'detail' ? (
                <div className="parts-iqc-detail-body iqc-inbound-detail">
                  {/*
                   * 요약 상자(사용자 시안 2026-11-16 · #274) — 입하 LOT(+상태) · 종합 판정 · 품목 · 공급사 뒤에
                   * 검사 의뢰 · 의뢰 일시 · 검사 수량 · 입하 · 검사 조건은 종전 칸 모양 그대로(아이콘 줄은 원복 · 사용자 지시).
                   */}
                  <dl className="parts-iqc-facts iqc-inbound-facts">
                    <div className="parts-iqc-fact">
                      <dt className="field-label">{t.facts.inboundLot}</dt>
                      <dd className="iqc-inbound-lot-key">
                        <span className="parts-iqc-fact-key">{inboundLotNo}</span>
                        <Chip
                          size="sm"
                          status={
                            confirmed ? 'success' : statusKey === 'IN_PROGRESS' ? 'info' : 'idle'
                          }
                          aria-label={`${t.facts.status} ${t.status[statusKey]}`}
                        >
                          {t.status[statusKey]}
                        </Chip>
                      </dd>
                    </div>
                    <div className="parts-iqc-fact">
                      {/* 종합 판정 — 확정된 것만 라벨, 확정 전은 「-」(사용자 지시 2026-11-16 · #274). */}
                      <dt className="field-label">{t.facts.judgment}</dt>
                      <dd>
                        {confirmed ? (
                          <Chip
                            size="sm"
                            status={judgmentStatus(inspection.overallJudgmentCode ?? null)}
                          >
                            {judgmentText(inspection.overallJudgmentCode ?? null)}
                          </Chip>
                        ) : (
                          '-'
                        )}
                      </dd>
                    </div>
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
                      <dd className="parts-iqc-fact-key">{inspection.supplierName ?? '-'}</dd>
                    </div>
                    <div className="parts-iqc-fact">
                      <dt className="field-label">{t.facts.request}</dt>
                      <dd>{inspection.inspectionRequestNo}</dd>
                    </div>
                    <div className="parts-iqc-fact">
                      <dt className="field-label">{t.facts.requestedAt}</dt>
                      <dd>{formatPlantDateTime(inspection.requestedAt) ?? '-'}</dd>
                    </div>
                    <div className="parts-iqc-fact">
                      <dt className="field-label">{t.facts.inspectedQty}</dt>
                      <dd>{qty(inspection.targetQty)}</dd>
                    </div>
                    <div className="parts-iqc-fact">
                      <dt className="field-label">{t.facts.received}</dt>
                      {/* 입하 일시만 — 입하 경로(WEB · PDA)는 보이지 않는다(사용자 지시 2026-11-19 · omf-all-around#296). */}
                      <dd>{formatPlantDateTime(inspection.receivedAt ?? null) ?? '-'}</dd>
                    </div>
                    <div className="parts-iqc-fact">
                      <dt className="field-label">{t.facts.plan}</dt>
                      <dd className="parts-iqc-plan-cell">
                        {planText}
                        {planAction}
                      </dd>
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
                      <h3>
                        {t.lotsTitle}{' '}
                        <span className="parts-iqc-muted">{t.lotsCount(lots.length)}</span>
                      </h3>
                      <span className="parts-iqc-footer-gap" />
                      <span className="parts-iqc-muted">
                        {t.lotsTotal(qty(inspection.targetQty))}
                      </span>
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
                    {/* 재검으로 판정이 바뀐 LOT 은 표 아래 한 줄씩(「LOT 0001: 1회차 불합격 → 2회차 합격(사유)」). */}
                    <SupersededNotes judgments={lotJudgments} results={results} />
                    <p className="field-note iqc-inbound-po">
                      {/* 「발주 정보」는 회색 라벨(사용자 지시 2026-11-16 · #274). */}
                      <Chip size="sm" className="iqc-inbound-po-label">
                        {t.poHeading}
                      </Chip>
                      {allocations.length === 0 && unallocated === 0
                        ? t.poEmpty
                        : t.poJoin([
                            ...allocations.map((row) =>
                              t.poLine(row.purchaseOrderNo, row.lineNo, qty(row.qty)),
                            ),
                            ...(unallocated > 0 ? [t.poNone(formatQty(unallocated))] : []),
                          ])}
                    </p>
                  </section>

                  <section className="parts-iqc-card" aria-label={tr.heading(results.length)}>
                    <div className="parts-iqc-block-head">
                      <h3>
                        {tr.title}{' '}
                        <span className="parts-iqc-muted">{tr.count(results.length)}</span>
                      </h3>
                      <span className="parts-iqc-footer-gap" />
                      {/* 확정 뒤에는 단추만 감춘다 — 확정은 위 배너가 알린다(omf-all-around#286). */}
                      {confirmed ? null : (
                        <Button
                          size="md"
                          leadingIcon={<Icon name="add" size={18} aria-hidden />}
                          onClick={() => setDrawer({ editing: null })}
                        >
                          {tr.add}
                        </Button>
                      )}
                    </div>
                    <ResultList
                      results={results}
                      lots={lots}
                      uomCode={uomCode}
                      locked={confirmed}
                      confirmedAt={inspection.confirmedAt ?? null}
                      busy={busy}
                      onEdit={(result) => setDrawer({ editing: result })}
                      onDelete={(result) => {
                        setWriteError(null);
                        setDeleting(result);
                      }}
                    />
                    <InboundAttachmentTable
                      inspectionRequestId={inspectionRequestId}
                      lots={lots}
                      confirmedAt={inspection.confirmedAt ?? null}
                      uomCode={uomCode}
                      canLink={!confirmed}
                      action={
                        /* 파일 첨부 — 첨부 파일 표 위 오른쪽. 대기 · 진행 중에만, 판정 확정(완료) 뒤에는 감춘다(사용자 지시 2026-11-19 · omf-all-around#296). */
                        confirmed ? null : (
                          <Button
                            size="md"
                            disabled={
                              lots.length === 0 // ui-check-ignore: C-4 붙일 LOT 이 없으면 바로 위 「자재 관리 LOT (0건)」이 사유다
                            }
                            leadingIcon={<Icon name="attach_file" size={18} aria-hidden />}
                            onClick={() => setAttachOpen(true)}
                          >
                            {ta.open}
                          </Button>
                        )
                      }
                    />
                  </section>

                  {/* 분리 · 판정 확정 단추는 상세 내용 맨 아래(사용자 지시 2026-11-16 · #274). */}
                  <div className="parts-iqc-detail-head iqc-inbound-foot">
                    {/*
                     * 단추는 한 묶음 — 좁거나 글이 길면(베트남어 · 1024) 묶음째 다음 줄로 내려간다. 단추 이름은 한 줄(L14-2).
                     * 전에는 단추마다 낱말 사이에서 세 줄로 꺾이고 머리가 칸 밖으로 밀렸다.
                     */}
                    <div className="iqc-inbound-head-actions">
                      {/* 분리는 확정 전 · 자재 관리 LOT 2개 이상(US7-1 · screens/W-01-01.md 「자재 관리 LOT 분리 창」). */}
                      {/* 잠긴 까닭은 단추에 마우스를 올리면 보인다 — 잠긴 단추는 마우스 이벤트를 받지 않아 감싼 칸에 단다(#274). */}
                      <span title={splitLock ?? undefined}>
                        <Button
                          variant="outlined"
                          size="md"
                          disabled={splitLock !== null}
                          aria-describedby={splitLock === null ? undefined : splitLockId}
                          onClick={() => setSplitOpen(true)}
                        >
                          {ts.open}
                        </Button>
                      </span>
                      {/* 판정 확정 · 확정 취소 — W-01-15 가 있을 때만(US4-7, C4). */}
                      <ConfirmActions
                        inspection={inspection}
                        confirmed={confirmed}
                        onConfirmed={onConfirmed}
                      />
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

                  {drawer === null ? null : (
                    <ResultDrawer
                      inspection={inspection}
                      uomCode={uomCode}
                      editing={drawer.editing}
                      seqNo={drawer.editing?.seqNo ?? nextSeq}
                      {...(drawer.preselectedLotIds === undefined
                        ? {}
                        : { preselectedLotIds: drawer.preselectedLotIds })}
                      renderForm={renderForm}
                      onClose={() => setDrawer(null)}
                      onSaved={() => {
                        const editing = drawer.editing;

                        setDrawer(null);
                        void (async () => {
                          await refresh();
                          await query.refetch();
                          /* 추가 알림은 한 문장만 — 종합 판정 미리 보기는 싣지 않는다(omf-all-around#356). */
                          toast.show({
                            variant: 'success',
                            description: editing === null ? td.added : td.updated(editing.seqNo),
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
                          <Button
                            variant="outlined"
                            disabled={busy}
                            onClick={() => setDeleting(null)}
                          >
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

                  {attachOpen && (
                    <InboundAttachDialog
                      inspectionRequestId={inspectionRequestId}
                      lots={lots}
                      uomCode={uomCode}
                      scannedLotId={scanOpen?.lotId ?? null}
                      onClose={() => setAttachOpen(false)}
                    />
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
                          description: ts.done(
                            result.inboundLot.inboundLotNo,
                            result.movedLotIds.length,
                          ),
                        });
                      }}
                    />
                  )}
                </div>
              ) : null,
          },
          {
            value: 'history',
            label: th.open,
            content:
              tab === 'history' ? (
                <InboundHistory
                  inspectionRequestId={inspectionRequestId}
                  inboundLotNo={inboundLotNo}
                />
              ) : null,
          },
        ]}
      />
    </div>
  );
};
