import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  Skeleton,
  TextField,
  useToast,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { BoardFrame } from '../../patterns/board-frame';
import { BoardTable } from '../../patterns/board-table';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { useUomOptions } from '../../patterns/material-lot-batch';
import { Select } from '../../patterns/select';
import { useSession } from '../../patterns/session';
import { DefaultsText } from './defaults-text';
import { DetailPane } from './detail-pane';
import { IssueDialog } from './issue-dialog';
import { usePlantDefaults, usePlants, useWaitingGroups } from './queries';
import { defaultsIndex, formatAt, groupKey, parseGroupKey, type Group } from './types';

const t = messages.materialLotIssue;
const tl = t.list;

/** 열린 발행 창 — 목록 위 단추(고르기)거나 상세 창의 조합(고정). */
type IssueOpen = { fixed: Group | null } | null;

const NO_GROUPS: Group[] = [];
const NO_SCOPES: never[] = [];

/**
 * W-01-14 자재 관리 LOT 발행(005 · omf-all-around#254 · screens/W-01-14.md). 「구매 / 자재 관리 › 입고 관리」 탭 묶음의
 * 한 탭이다(머리 · 탭은 셸이 세운다). 공급사·품목을 골라 자재 관리 LOT 를 대기 상태로 만들고, 대기 LOT 를 보고
 * 폐기한다 — POP P-01-01 과 같은 결과(US1-8).
 *
 * ⛔ **라벨은 여기서 찍지 않는다** — POP 「자재 관리 LOT 라벨」에서만(배너가 말한다).
 * 주소: 공장(`plant`) · 공급사(`supplier`) · 품목 찾기(`q`) · 대기 있는 것만(`waiting`) · 연 공급사·품목(`open`).
 */
export const MaterialLotIssueScreen = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const plantParam = searchParams.get('plant') ?? '';
  const supplierParam = searchParams.get('supplier') ?? '';
  const query = searchParams.get('q') ?? '';
  const waitingOnly = searchParams.get('waiting') === '1';
  const openKey = searchParams.get('open');

  const [issueOpen, setIssueOpen] = useState<IssueOpen>(null);

  const { session } = useSession();
  const plants = usePlants(session?.scopes ?? NO_SCOPES);
  const plantFieldId = useId();
  const supplierFieldId = useId();
  const itemFieldId = useId();
  const viewLabelId = useId();
  const plant =
    plants.data?.find((row) => String(row.plantId) === plantParam) ?? plants.data?.[0] ?? null;
  const plantId = plant?.plantId ?? null;
  const groups = useWaitingGroups(plantId);
  const defaults = usePlantDefaults(plantId);
  const uoms = useUomOptions();
  const byPair = defaultsIndex(defaults.data ?? []);

  const update = (patch: Record<string, string | null>): void => {
    const next = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(name);
      else next.set(name, value);
    }
    setSearchParams(next, { replace: true });
  };

  const all = groups.data ?? NO_GROUPS;
  const needle = query.trim().toLocaleLowerCase('ko-KR');
  const rows = all.filter(
    (group) =>
      (supplierParam === '' || String(group.supplierId) === supplierParam) &&
      (needle === '' ||
        `${group.itemCode} ${group.itemName}`.toLocaleLowerCase('ko-KR').includes(needle)) &&
      (!waitingOnly || group.waitingCount > 0),
  );
  const suppliers = [
    ...new Map(all.map((group) => [group.supplierId, group] as const)).values(),
  ].sort((left, right) => left.supplierName.localeCompare(right.supplierName, 'ko'));

  const openPair = parseGroupKey(openKey);
  const opened =
    openPair === null
      ? null
      : (all.find(
          (group) => group.supplierId === openPair.supplierId && group.itemId === openPair.itemId,
        ) ?? null);

  /* 칸마다 이름을 위에 단다 — 시안 「공장 · 공급사 · 품목 · 보기」(G2 L21). */
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
            onChange={(value) => update({ plant: value, supplier: null, open: null })}
          />
        </div>
      )}
      <div className="field-cell">
        <label className="field-label" htmlFor={supplierFieldId}>
          {t.filters.supplier}
        </label>
        <Select
          id={supplierFieldId}
          value={supplierParam === '' ? '' : supplierParam}
          options={[
            { value: '', label: t.filters.supplierAll },
            ...suppliers.map((group) => ({
              value: String(group.supplierId),
              label: `${group.supplierName} ${group.supplierCode}`,
            })),
          ]}
          onChange={(value) => update({ supplier: value })}
        />
      </div>
      <div className="field-cell">
        <label className="field-label" htmlFor={itemFieldId}>
          {t.filters.item}
        </label>
        <TextField
          id={itemFieldId}
          placeholder={t.filters.itemPlaceholder}
          type="search"
          value={query}
          onChange={(event) => update({ q: event.target.value })}
        />
      </div>
      <div className="field-cell" role="group" aria-labelledby={viewLabelId}>
        <span className="field-label" id={viewLabelId}>
          {t.filters.view}
        </span>
        <Checkbox
          checked={waitingOnly}
          onChange={(event) => update({ waiting: event.target.checked ? '1' : null })}
        >
          {t.filters.waitingOnly}
        </Checkbox>
      </div>
      {/* 발행은 조건 줄 끝 — 특정 공급사·품목을 고르지 않고도 연다(발행 창에서 고른다). */}
      <div className="field-cell field-cell-unlabeled">
        <Button
          disabled={plantId === null}
          loading={groups.isPending}
          onClick={() => setIssueOpen({ fixed: null })}
        >
          {tl.issue}
        </Button>
      </div>
    </div>
  );

  /* 입고 관리 표와 같은 열 짜임 — 공급사 칸이 고르는 단추다. */
  const columns: Column<Group>[] = [
    {
      key: 'supplier',
      header: tl.columns.supplier,
      width: '160px',
      render: (group) => (
        <>
          {group.supplierName} <span className="mlot-issue-code">{group.supplierCode}</span>
        </>
      ),
    },
    {
      key: 'itemCode',
      header: tl.columns.itemCode,
      width: '120px',
      render: (group) => <span className="mlot-issue-code">{group.itemCode}</span>,
    },
    { key: 'itemName', header: tl.columns.item, width: '176px' },
    { key: 'uomCode', header: tl.columns.baseUom, width: '96px' },
    {
      key: 'defaults',
      header: tl.columns.defaults,
      render: (group) => (
        <DefaultsText group={group} defaults={byPair.get(groupKey(group))} uoms={uoms.data} />
      ),
    },
    {
      key: 'waiting',
      header: tl.columns.waiting,
      width: '64px',
      align: 'end',
      render: (group) =>
        group.waitingCount > 0 ? (
          <Chip size="sm" status="warning">
            {String(group.waitingCount)}
          </Chip>
        ) : (
          <span className="field-note">0</span>
        ),
    },
    {
      key: 'unprinted',
      header: tl.columns.unprinted,
      width: '96px',
      align: 'end',
      render: (group) =>
        group.unprintedCount > 0 ? (
          <Chip size="sm" status="info">
            {String(group.unprintedCount)}
          </Chip>
        ) : (
          <span className="field-note">0</span>
        ),
    },
    {
      key: 'lastIssued',
      header: tl.columns.lastIssued,
      width: '104px',
      render: (group) => formatAt(group.lastIssuedAt) ?? '—',
    },
  ];

  const table = (): ReactNode => {
    if (plants.isError || groups.isError) {
      const error = plants.error ?? groups.error;
      return (
        <LoadErrorAlert
          error={error}
          onRetry={() => void (plants.isError ? plants.refetch() : groups.refetch())}
        />
      );
    }
    if (plants.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (plantId === null) return <EmptyState size="sm" title={t.noPlant} />;
    if (groups.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (rows.length === 0) return <EmptyState size="sm" title={tl.empty} />;

    return (
      <>
        <BoardTable
          label={tl.label}
          widthKey="omf-mes:material-lot-issue:columns:groups"
          minWidth="56rem"
          columns={columns}
          rows={rows}
          getRowId={groupKey}
          pick={{
            columnKey: 'supplier',
            label: (group) => tl.open(group.supplierName, `${group.itemCode} ${group.itemName}`),
            currentId: openKey,
            onPick: (group) => update({ open: groupKey(group) }),
          }}
        />
      </>
    );
  };

  /* 고른 공급사·품목 — 오른쪽 구획. 고르기 전에는 고르라고 말한다(입고 관리와 같다). */
  const detail = (): ReactNode =>
    opened === null || plantId === null ? (
      <EmptyState size="sm" title={t.detail.choose} />
    ) : (
      <DetailPane
        /* 고른 줄이 바뀌면 폐기 선택을 비운다 — 앞 공급사·품목의 LOT 이 남지 않게. */
        key={groupKey(opened)}
        plantId={plantId}
        group={opened}
        defaults={byPair.get(groupKey(opened))}
        uoms={uoms.data}
        onIssue={() => setIssueOpen({ fixed: opened })}
        onVoided={(result) => {
          const done = result.items.filter((item) => item.voided).length;
          const failed = result.items.length - done;
          toast.show({
            variant: failed > 0 ? 'warning' : 'success',
            description: failed > 0 ? t.toast.voidedPartly(done, failed) : t.toast.voided(done),
          });
        }}
      />
    );

  /*
   * **입고 관리 짜임**(사용자 지시 2026-11-19) — 위 조회 조건, 왼쪽 공급사·품목 목록, 오른쪽 고른 공급사·품목의
   * 대기 자재 관리 LOT. 상세는 덮개 창이 아니라 오른쪽 구획에 늘 나온다(`BoardFrame`).
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
          count: plantId === null || groups.isPending || groups.isError ? undefined : rows.length,
          content: table(),
        }}
        detail={{ label: t.detail.label, content: detail() }}
      />

      {issueOpen !== null && plantId !== null && (
        <IssueDialog
          plantId={plantId}
          groups={all}
          fixed={issueOpen.fixed}
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
