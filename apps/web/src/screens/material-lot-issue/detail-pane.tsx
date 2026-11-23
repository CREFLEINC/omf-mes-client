import {
  AlertBanner,
  Button,
  Checkbox,
  Chip,
  Dialog,
  EmptyState,
  SkeletonText,
  Tabs,
} from '@crefle/web-ui';
import type { MaterialLotTab, MaterialLotVoidResult } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { useItemStorageUnit, type UomOption } from '../../patterns/material-lot-batch';
import {
  TAB_ORDER,
  creatableRemainingOf,
  materialLotKeys,
  useMaterialLots,
} from '../../patterns/material-lot-precreate';
import { formatBaseQty, formatPackage } from '../../patterns/package-qty';
import { PageNav } from '../../patterns/page-nav';
import { ApiRequestError } from '../../patterns/request';
import { PairDefaultsText, storageText } from './defaults-text';
import { useVoidLots } from './mutations';
import { PoLines } from './po-lines';
import { ReviseDialog } from './revise-dialog';
import { formatAt, type Group, type Lot, type Pair } from './types';

const t = messages.materialLotIssue;
const td = t.detail;
const tp = t.precreate;

/** 상세 표 한 쪽 줄 수(시안 W0114 「쪽 크기: 상세 표 높이에 맞춘 줄 수」 — 관리웹은 고정 10줄). */
export const DETAIL_PAGE_SIZE = 10;

const STATUS_CHIP = { WAITING: 'warning', VOIDED: 'error', ACTIVE: 'success' } as const;

export interface DetailPaneProps {
  plantId: number;
  group: Group;
  /** 왼쪽 줄(품목 기본값 · 칩) — 아직 받지 못했으면 null. */
  pair: Pair | null;
  uoms: readonly UomOption[] | undefined;
  onIssue: () => void;
  onVoided: (result: MaterialLotVoidResult) => void;
  /** [수정] 저장 · 거절을 알린다(토스트는 화면이). */
  onRevised: (message: string, tone: 'success' | 'warning') => void;
}

/** 이 탭에서 폐기할 수 있는가 — 미출력 · 출력됨(입하 전)은 대기라 폐기한다. 입하된 · 폐기 LOT 은 아니다. */
const voidableTab = (tab: MaterialLotTab): boolean => tab === 'UNPRINTED' || tab === 'PRINTED';

/**
 * 고른 공급사·품목 — **입고 관리 짜임의 오른쪽 구획**(피처 014 · 시안 W0114 W2 · W3).
 * 머리(공급사 · 품목 + 사실 칸) → 미입고 P/O(그대로) → 탭 넷(미출력은 P/O 몫을 만들면서 받는다) · 폐기 · 발행 · [수정].
 * ⛔ 라벨 단추 · 일괄 출력은 없다 — 라벨은 POP 에서만 찍는다.
 */
export const DetailPane = ({
  plantId,
  group,
  pair,
  uoms,
  onIssue,
  onVoided,
  onRevised,
}: DetailPaneProps) => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MaterialLotTab>('UNPRINTED');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [revising, setRevising] = useState<Lot | null>(null);
  const storage = useItemStorageUnit(group.itemId);
  const lots = useMaterialLots(
    { plantId, supplierId: group.supplierId, itemId: group.itemId },
    tab,
    page,
    DETAIL_PAGE_SIZE,
  );
  const rows = lots.data?.items ?? [];
  const generation = tab === 'UNPRINTED' ? (lots.data?.generation ?? null) : null;
  /* 고른 것 중 이 쪽에 아직 대기로 선 것만 — 다시 불러온 뒤 폐기된 LOT 이 남지 않게. */
  const picked = rows.filter(
    (lot) => selected.has(lot.lotId) && lot.lifecycleStatusCode === 'WAITING',
  );
  const printedCount = picked.filter((lot) => lot.lastLabelIssue !== null).length;
  const uomId = uoms?.find((row) => row.uomCode === group.uomCode)?.uomId ?? null;

  const voidLots = useVoidLots((result) => {
    setConfirming(false);
    setSelected(new Set());
    onVoided(result);
  });

  const toggle = (lotId: number): void => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  };

  const chooseTab = (next: string): void => {
    setTab(next as MaterialLotTab);
    setPage(1);
    setSelected(new Set());
  };

  const storageLabel = storageText(storage.data, uoms, group.uomCode);
  const poText = (lot: Lot): string =>
    lot.purchaseOrderLine === null
      ? '—'
      : tp.poLine(lot.purchaseOrderLine.purchaseOrderNo, lot.purchaseOrderLine.lineNo);
  const modeChip = (lot: Lot) => (
    <Chip size="sm" status={lot.creationModeCode === 'AUTO' ? 'info' : 'idle'}>
      {tp.mode[lot.creationModeCode]}
    </Chip>
  );
  const labelCell = (lot: Lot): string =>
    lot.lastLabelIssue === null ? td.unprinted : td.printed(lot.lastLabelIssue.issueSeq);
  const statusChip = (lot: Lot) => (
    <Chip size="sm" status={STATUS_CHIP[lot.lifecycleStatusCode]}>
      {td.status[lot.lifecycleStatusCode]}
    </Chip>
  );

  const unprintedTotal =
    tab === 'UNPRINTED' && lots.data !== undefined
      ? lots.data.total
      : pair === null
        ? null
        : pair.unprintedCount + (pair.defaultsStatus === 'OK' ? pair.creatableCount : 0);

  const notice = (): ReactNode => {
    if (lots.isError) {
      const isConflict = lots.error instanceof ApiRequestError && lots.error.httpStatus === 409;
      return (
        <AlertBanner
          variant="error"
          action={
            <Button
              size="sm"
              variant="outlined"
              onClick={() => void queryClient.invalidateQueries({ queryKey: materialLotKeys.all })}
            >
              {tp.retry}
            </Button>
          }
        >
          {isConflict ? tp.notes.conflict : tp.loadFailed}
        </AlertBanner>
      );
    }
    if (generation === null) return null;
    if (generation.status === 'NO_DEFAULT') {
      return (
        <AlertBanner variant="warning">
          <strong>{tp.notes.NO_DEFAULT}</strong> {tp.notes.noDefaultHint}
        </AlertBanner>
      );
    }
    if (generation.status === 'NO_CONVERSION') {
      return <AlertBanner variant="error">{tp.notes.NO_CONVERSION}</AlertBanner>;
    }
    if (generation.status === 'NO_OPEN_PO' && rows.length === 0) {
      return <AlertBanner variant="warning">{tp.notes.NO_OPEN_PO}</AlertBanner>;
    }
    return null;
  };

  const table = (): ReactNode => {
    if (lots.isPending) {
      return (
        <>
          <AlertBanner variant="info">
            {tab === 'UNPRINTED' ? tp.loading : tp.loadingOther}
          </AlertBanner>
          <SkeletonText lines={3} />
        </>
      );
    }
    if (rows.length === 0) {
      return generation !== null && generation.status !== 'OK' ? null : (
        <EmptyState size="sm" title={tp.empty[tab]} />
      );
    }
    const hasCheck = voidableTab(tab);

    return (
      <div className="mlot-issue-table-scroll">
        <table className="mlot-issue-table" aria-label={tp.tabs[tab]}>
          <thead>
            <tr>
              {hasCheck && <th scope="col" aria-label={td.columns.lotNo} />}
              {tab === 'UNPRINTED' && <th scope="col">{tp.columns2.seq}</th>}
              <th scope="col">{td.columns.lotNo}</th>
              <th scope="col" className="is-number">
                {td.columns.qty}
              </th>
              <th scope="col">{td.columns.package}</th>
              <th scope="col">{tp.columns2.po}</th>
              {tab === 'RECEIVED' ? (
                <>
                  <th scope="col">{td.columns.supplierLot}</th>
                  <th scope="col">{td.columns.status}</th>
                  <th scope="col">{tp.columns2.receivedAt}</th>
                  <th scope="col">{tp.columns2.label}</th>
                </>
              ) : (
                <th scope="col">{tp.columns2.mode}</th>
              )}
              {tab === 'PRINTED' && (
                <>
                  <th scope="col">{tp.columns2.label}</th>
                  <th scope="col">{tp.columns2.lastPrinted}</th>
                </>
              )}
              {tab === 'VOIDED' && (
                <>
                  <th scope="col">{td.columns.status}</th>
                  <th scope="col">{tp.columns2.voidedAt}</th>
                  <th scope="col">{tp.columns2.label}</th>
                </>
              )}
              {tab === 'UNPRINTED' && <th scope="col" aria-label={tp.columns2.action} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((lot) => (
              <tr
                key={lot.lotId}
                className={lot.lifecycleStatusCode === 'VOIDED' ? 'is-void' : undefined}
                aria-selected={selected.has(lot.lotId) ? true : undefined}
              >
                {hasCheck && (
                  <td>
                    {lot.lifecycleStatusCode === 'WAITING' && (
                      <Checkbox
                        aria-label={td.pick(lot.lotNo)}
                        checked={selected.has(lot.lotId)}
                        onChange={() => toggle(lot.lotId)}
                      />
                    )}
                  </td>
                )}
                {tab === 'UNPRINTED' && <td>{lot.seq}</td>}
                <td className="mlot-issue-lot-no">{lot.lotNo}</td>
                <td className="is-number">{formatBaseQty(lot.lotQty, lot.uomCode)}</td>
                <td>{formatPackage(lot.package) ?? '—'}</td>
                <td>{poText(lot)}</td>
                {tab === 'RECEIVED' ? (
                  <>
                    <td>{lot.supplierLotNo ?? '—'}</td>
                    <td>{statusChip(lot)}</td>
                    <td>{formatAt(lot.receivedAt) ?? '—'}</td>
                    <td>{labelCell(lot)}</td>
                  </>
                ) : (
                  <td>{modeChip(lot)}</td>
                )}
                {tab === 'PRINTED' && (
                  <>
                    <td>{labelCell(lot)}</td>
                    <td>{formatAt(lot.lastLabelIssue?.issuedAt) ?? '—'}</td>
                  </>
                )}
                {tab === 'VOIDED' && (
                  <>
                    <td>{statusChip(lot)}</td>
                    <td>{formatAt(lot.voidedAt) ?? '—'}</td>
                    <td>{labelCell(lot)}</td>
                  </>
                )}
                {tab === 'UNPRINTED' && (
                  <td>
                    {lot.lifecycleStatusCode === 'WAITING' && lot.lastLabelIssue === null && (
                      <Button
                        size="sm"
                        variant="outlined"
                        aria-label={tp.revise.actionName(lot.lotNo)}
                        onClick={() => setRevising(lot)}
                      >
                        {tp.revise.action}
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const remaining = creatableRemainingOf(generation);
  const total = lots.data?.total ?? 0;

  return (
    <>
      <header className="po-board-order-head" role="group" aria-label={td.label}>
        <div className="po-board-order-title">
          <span className="po-board-order-eyebrow">{`${group.supplierName} ${group.supplierCode}`}</span>
          <span className="po-board-order-no">{`${group.itemCode} ${group.itemName}`}</span>
        </div>
        <dl className="po-board-order-facts">
          <div>
            <dt>{td.baseUom}</dt>
            <dd>{group.uomCode}</dd>
          </div>
          <div>
            <dt>{td.storageUom}</dt>
            <dd>{storageLabel ?? td.storageNone}</dd>
          </div>
          <div>
            <dt>{td.defaults}</dt>
            <dd>{pair === null ? '—' : <PairDefaultsText pair={pair} withPackageQty />}</dd>
          </div>
        </dl>
      </header>

      <PoLines plantId={plantId} group={group} uomId={uomId} />

      <div className="mlot-issue-section-head">
        <span className="mlot-issue-actions">
          <Button
            variant="outlined"
            disabled={!voidableTab(tab) || picked.length === 0}
            onClick={() => {
              voidLots.reset();
              setConfirming(true);
            }}
          >
            {td.void(picked.length)}
          </Button>
          <Button onClick={onIssue}>{td.issue}</Button>
        </span>
      </div>

      <Tabs
        aria-label={tp.tabsLabel}
        size="sm"
        value={tab}
        onChange={chooseTab}
        items={TAB_ORDER.map((each) => ({
          value: each,
          label: tp.tabs[each],
          badge:
            each === 'UNPRINTED' && unprintedTotal !== null ? (
              <span className="mlot-issue-count">{String(unprintedTotal)}</span>
            ) : undefined,
          content:
            each === tab ? (
              <div className="mlot-issue-tab">
                {notice()}
                {table()}
                {total > 0 && (
                  <div className="mlot-issue-foot">
                    {tab === 'UNPRINTED' && remaining > 0 ? (
                      <span className="field-note">{tp.notCreatedYet(remaining)}</span>
                    ) : null}
                    {/* 총 건수는 쪽 넘김(C-8)이 말한다 — 미출력은 그 안에 아직 만들지 않은 몫이 든다. */}
                    <PageNav
                      meta={{ page, size: DETAIL_PAGE_SIZE, total }}
                      onChangePage={setPage}
                    />
                  </div>
                )}
              </div>
            ) : null,
        }))}
      />

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t.void.title(picked.length)}
        size="sm"
        footer={
          <>
            <Button variant="outlined" onClick={() => setConfirming(false)}>
              {t.void.cancel}
            </Button>
            <Button
              loading={voidLots.isSaving}
              onClick={() => voidLots.write(picked.map((lot) => lot.lotId))}
            >
              {t.void.confirm(picked.length)}
            </Button>
          </>
        }
      >
        <ul className="mlot-issue-void-list">
          {picked.map((lot) => (
            <li key={lot.lotId}>{lot.lotNo}</li>
          ))}
        </ul>
        <p className="dialog-text">{t.void.body}</p>
        {printedCount > 0 && (
          <p className="dialog-text mlot-issue-bad">{t.void.printed(printedCount)}</p>
        )}
        {voidLots.error !== null && <SaveErrorBanner error={voidLots.error} />}
      </Dialog>

      {revising !== null && (
        <ReviseDialog
          group={group}
          lot={revising}
          uoms={uoms}
          onClose={() => setRevising(null)}
          onSaved={(lotNo) => {
            setRevising(null);
            onRevised(tp.revise.saved(lotNo), 'success');
          }}
          onRejected={(message) => {
            setRevising(null);
            onRevised(message, 'warning');
          }}
        />
      )}
    </>
  );
};
