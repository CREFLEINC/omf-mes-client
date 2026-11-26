import { Chip, type Column, EmptyState, Skeleton, TextField, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { BoardFrame } from '../../patterns/board-frame';
import { BoardTable } from '../../patterns/board-table';
import { ListEmpty } from '../../patterns/list-empty';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { useUomOptions } from '../../patterns/material-lot-batch';
import { useMaterialLotPairs } from '../../patterns/material-lot-precreate';
import { PageNav } from '../../patterns/page-nav';
import { Select } from '../../patterns/select';
import { useSession } from '../../patterns/session';
import { PairDefaultsText } from './defaults-text';
import { DetailPane } from './detail-pane';
import { IssueDialog } from './issue-dialog';
import { usePlants } from './queries';
import {
  formatAt,
  groupKey,
  groupOf,
  pairKey,
  parseGroupKey,
  type Group,
  type Pair,
} from './types';

const t = messages.materialLotIssue;
const tl = t.list;
const tp = t.precreate;

/** 왼쪽 목록 한 쪽 줄 수(시안 W0114 「1–50 / 132」). */
const LIST_PAGE_SIZE = 50;

const NO_PAIRS: Pair[] = [];
const NO_SCOPES: never[] = [];

/**
 * W-01-14 자재 관리 LOT 발행(005 · 피처 014 · omf-all-around#349 · screens/W-01-14.md · 시안 W0114). 「구매 / 자재 관리 ›
 * 입고 관리」 탭 묶음의 한 탭이다(머리 · 탭은 셸이 세운다).
 *
 * ⭐ 왼쪽 공급사·품목은 `GET /logistics/material-lot-pairs` 를 찾기 · 쪽 단위로 받는다 — 발행 여부와 상관없이 조건에
 *    맞는 모든 조합, 할 일 있는 조합이 위(서버 정렬). 공급사 고르기 · 「대기 있는 것만」은 없앴다(시안 확인 거리 3).
 * ⭐ 오른쪽 상세는 POP P-01-01 과 같은 규칙으로 탭 넷을 받는다 — 미출력 탭은 P/O 몫을 만들면서(`DetailPane`).
 * ⛔ **라벨은 여기서 찍지 않는다** — POP 「자재 관리 LOT 라벨」에서만. 일괄 출력도 없다.
 * 주소: 공장(`plant`) · 찾기(`q`) · 쪽(`page`) · 연 공급사·품목(`open`).
 */
export const MaterialLotIssueScreen = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const plantParam = searchParams.get('plant') ?? '';
  const query = searchParams.get('q') ?? '';
  const pageParam = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const openKey = searchParams.get('open');

  const [issueOpen, setIssueOpen] = useState<Group | null>(null);
  /** 연 줄 — 쪽을 넘겨 목록에서 사라져도 상세는 그대로 둔다. */
  const [openedPair, setOpenedPair] = useState<Pair | null>(null);

  const { session } = useSession();
  const plants = usePlants(session?.scopes ?? NO_SCOPES);
  const plantFieldId = useId();
  const searchFieldId = useId();
  const plant =
    plants.data?.find((row) => String(row.plantId) === plantParam) ?? plants.data?.[0] ?? null;
  const plantId = plant?.plantId ?? null;
  const pairs = useMaterialLotPairs(
    plantId === null ? null : { plantId, q: query, page: pageParam, size: LIST_PAGE_SIZE },
  );
  const uoms = useUomOptions();

  const update = (patch: Record<string, string | null>): void => {
    const next = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(name);
      else next.set(name, value);
    }
    setSearchParams(next, { replace: true });
  };

  const rows = pairs.data?.items ?? NO_PAIRS;
  const total = pairs.data?.total ?? 0;
  const openPair = parseGroupKey(openKey);
  const opened: Pair | null =
    openPair === null
      ? null
      : (rows.find(
          (row) =>
            row.supplier.supplierId === openPair.supplierId && row.item.itemId === openPair.itemId,
        ) ?? (openedPair !== null && pairKey(openedPair) === openKey ? openedPair : null));

  /* 조건은 공장 · 찾기 하나(시안 W0114 W2 — 공급사 고르기 · 「대기 있는 것만」을 뺐다). */
  const filters = (
    <div className="filter-bar">
      {(plants.data?.length ?? 0) > 1 && (
        <div className="field-cell">
          <label className="field-label" htmlFor={plantFieldId}>
            {t.filters.plant}
          </label>
          <Select
            id={plantFieldId}
            value={plantId === null ? null : String(plantId)}
            options={(plants.data ?? []).map((row) => ({
              value: String(row.plantId),
              label: row.plantName,
            }))}
            onChange={(value) => update({ plant: value, page: null, open: null })}
          />
        </div>
      )}
      <div className="field-cell">
        <label className="field-label" htmlFor={searchFieldId}>
          {tp.search}
        </label>
        <TextField
          id={searchFieldId}
          placeholder={tp.searchPlaceholder}
          type="search"
          value={query}
          onChange={(event) => update({ q: event.target.value, page: null })}
        />
      </div>
    </div>
  );

  /* 입고 관리 표와 같은 열 짜임 — 공급사 칸이 고르는 단추다. 최근 발행은 조합 목록 `lastIssuedAt`(T051 · 계약 §1). */
  const columns: Column<Pair>[] = [
    {
      key: 'supplier',
      header: tl.columns.supplier,
      width: '160px',
      render: (pair) => (
        <>
          {pair.supplier.name} <span className="mlot-issue-code">{pair.supplier.code}</span>
        </>
      ),
    },
    {
      key: 'itemCode',
      header: tl.columns.itemCode,
      width: '120px',
      render: (pair) => <span className="mlot-issue-code">{pair.item.code}</span>,
    },
    { key: 'itemName', header: tl.columns.item, width: '176px', render: (pair) => pair.item.name },
    {
      key: 'uomCode',
      header: tl.columns.baseUom,
      width: '96px',
      render: (pair) => pair.item.baseUomCode,
    },
    {
      key: 'defaults',
      header: tl.columns.defaults,
      render: (pair) => <PairDefaultsText pair={pair} />,
    },
    {
      key: 'unprinted',
      header: tp.columns.unprinted,
      width: '80px',
      align: 'end',
      render: (pair) =>
        pair.unprintedCount > 0 ? (
          <Chip size="sm" status="info">
            {String(pair.unprintedCount)}
          </Chip>
        ) : (
          <span className="field-note">0</span>
        ),
    },
    {
      key: 'creatable',
      header: tp.columns.creatable,
      width: '96px',
      align: 'end',
      render: (pair) =>
        pair.defaultsStatus !== 'OK' ? (
          <span className="field-note">—</span>
        ) : pair.creatableCount > 0 ? (
          <Chip size="sm" status="idle">
            {String(pair.creatableCount)}
          </Chip>
        ) : (
          <span className="field-note">0</span>
        ),
    },
    {
      key: 'lastIssued',
      header: tl.columns.lastIssued,
      width: '104px',
      render: (pair) => formatAt(pair.lastIssuedAt) ?? '—',
    },
  ];

  const table = (): ReactNode => {
    if (plants.isError || pairs.isError) {
      const error = plants.error ?? pairs.error;
      return (
        <LoadErrorAlert
          error={error}
          onRetry={() => void (plants.isError ? plants.refetch() : pairs.refetch())}
        />
      );
    }
    if (plants.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (plantId === null) return <EmptyState size="sm" title={t.noPlant} />;
    if (pairs.isPending) return <Skeleton variant="rect" height="16rem" />;

    return (
      <>
        <BoardTable
          label={tl.label}
          widthKey="omf-mes:material-lot-issue:columns:pairs"
          minWidth="56rem"
          columns={columns}
          rows={rows}
          getRowId={pairKey}
          empty={<ListEmpty title={tl.empty} />}
          pick={{
            columnKey: 'supplier',
            label: (pair) => tl.open(pair.supplier.name, `${pair.item.code} ${pair.item.name}`),
            currentId: openKey,
            onPick: (pair) => {
              setOpenedPair(pair);
              update({ open: pairKey(pair) });
            },
            /* 고른 줄을 다시 누르면 고르기를 푼다(#358). */
            onUnpick: () => update({ open: null }),
          }}
        />
        {rows.length === 0 ? null : (
          <PageNav
            meta={{ page: pageParam, size: LIST_PAGE_SIZE, total }}
            onChangePage={(next) => update({ page: next === 1 ? null : String(next) })}
          />
        )}
      </>
    );
  };

  /* 고른 공급사·품목 — 오른쪽 구획. 고르기 전에는 고르라고 말한다(입고 관리와 같다). */
  const detail = (): ReactNode => {
    if (opened === null || plantId === null) {
      return <EmptyState size="sm" title={t.detail.choose} />;
    }
    const group = groupOf(opened);

    return (
      <DetailPane
        /* 고른 줄이 바뀌면 폐기 선택 · 탭을 비운다 — 앞 공급사·품목의 LOT 이 남지 않게. */
        key={groupKey(group)}
        plantId={plantId}
        group={group}
        pair={opened}
        uoms={uoms.data}
        onIssue={() => setIssueOpen(group)}
        onVoided={(result) => {
          const done = result.items.filter((item) => item.voided).length;
          const failed = result.items.length - done;
          toast.show({
            variant: failed > 0 ? 'warning' : 'success',
            description: failed > 0 ? t.toast.voidedPartly(done, failed) : t.toast.voided(done),
          });
        }}
        onRevised={(message, tone) => toast.show({ variant: tone, description: message })}
      />
    );
  };

  /*
   * **입고 관리 짜임**(사용자 지시 2026-11-19) — 위 조회 조건, 왼쪽 공급사·품목 목록(서버 쪽), 오른쪽 고른 공급사·품목의
   * 미입고 P/O 와 탭 넷. 상세는 덮개 창이 아니라 오른쪽 구획에 늘 나온다(`BoardFrame`).
   */
  return (
    <div className="mlot-issue">
      <BoardFrame
        splitKey="omf-mes:material-lot-issue:split"
        initialRatio={0.55}
        splitter={{ label: t.splitter, collapseLabel: t.listCollapse, expandLabel: t.listExpand }}
        above={{
          label: t.filters.label,
          content: <div className="pane po-board-filter">{filters}</div>,
        }}
        list={{
          label: tl.label,
          count: plantId === null || pairs.isPending || pairs.isError ? undefined : total,
          content: table(),
        }}
        detail={{ label: t.detail.label, content: detail() }}
      />

      {issueOpen !== null && plantId !== null && (
        <IssueDialog
          plantId={plantId}
          groups={[issueOpen]}
          fixed={issueOpen}
          onClose={() => setIssueOpen(null)}
          onIssued={(created, group) => {
            setIssueOpen(null);
            update({ open: groupKey(group) });
            toast.show({ variant: 'success', description: t.toast.issued(created.lots.length) });
          }}
        />
      )}
    </div>
  );
};
