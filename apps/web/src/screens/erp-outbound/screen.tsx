import {
  Button,
  Chip,
  EmptyState,
  Icon,
  SearchInput,
  SkeletonText,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { BoardTable } from '../../patterns/board-table';
import { useClientPage } from '../../patterns/client-page';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { hasChangedFilters } from '../../patterns/filter-more';
import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { OneLine } from '../../patterns/po-board';
import { LoadErrorBanner } from '../../patterns/load-error-banner';
import { PageNav } from '../../patterns/page-nav';
import { documentNoOf, messageTitleOf } from '../integration-sync/message-labels';
import { formatDateTime } from '../integration-sync/message-status';
import { toPageView } from '../integration-sync/pagination';
import { toPeriodQuery, type PeriodInput } from '../integration-sync/period';
import { ERP_LINK_ORIENTATION_KEY } from '../integration-sync/erp-link-layout';
import type { IntegrationMessageRow } from '../integration-sync/types';
import { CreatedFilter } from './created-filter';
import { readCreatedPeriod } from './created-period';
import { MESSAGE_STATUS, type OutboundItem } from './outbound-items';
import {
  useOutboundCounts,
  useOutboundItems,
  usePendingMessages,
  type OutboundCounts,
} from './queries';
import { ErpSendChips } from './send-chips';

const t = messages.erpOutbound;
const ts = messages.integrationSync;

/** 연동 현황·이력 — 송신 예정 건의 메시지 키가 그 탭의 상세를 연다. */
const INTEGRATION_SYNC_PATH = '/master-data/integration-sync';

const readPage = (raw: string | null): number => {
  const value = Number(raw);

  return Number.isInteger(value) && value > 1 ? value : 1;
};

const countText = (count: number | undefined, hasInterface: boolean): string => {
  if (!hasInterface || count === undefined) return t.values.empty;

  return count.toLocaleString();
};

interface ItemTableProps {
  items: readonly OutboundItem[];
  counts: OutboundCounts;
  selectedCode: string | null;
  onSelect: (code: string) => void;
}

/** 송신 항목 이름 검색 — 화면 안에서만 거른다(서버 요청은 그대로 · #358). 앞뒤 빈칸 · 대소문자는 가리지 않는다. */
const matchesName = (item: OutboundItem, query: string): boolean =>
  item.outboundItemName.toLowerCase().includes(query.trim().toLowerCase());

/** 왼쪽 — 송신 항목 다섯. 줄 어디를 눌러도 고른다(입고 관리의 발주 목록과 같다). */
const ItemTable = ({ items, counts, selectedCode, onSelect }: ItemTableProps) => {
  const columns: Column<OutboundItem>[] = [
    {
      key: 'outboundItemName',
      header: t.table.item,
      /* 고르는 단추 자리(`BoardTable` 의 `pick`). */
      render: (item) => item.outboundItemName,
    },
    {
      key: 'enabled',
      header: t.table.send,
      width: '80px',
      render: (item) => (
        <Chip variant="status" size="sm" status={item.enabled ? 'success' : 'idle'}>
          {item.locked ? t.send.required : item.enabled ? t.send.on : t.send.off}
        </Chip>
      ),
    },
    {
      key: 'pending',
      header: t.table.pending,
      width: '72px',
      align: 'end',
      render: (item) =>
        countText(
          item.interfaceCode === null
            ? undefined
            : counts.of(item.interfaceCode, MESSAGE_STATUS.pending),
          item.interfaceCode !== null,
        ),
    },
    {
      key: 'failed',
      header: t.table.failed,
      width: '72px',
      align: 'end',
      render: (item) =>
        countText(
          item.interfaceCode === null
            ? undefined
            : counts.of(item.interfaceCode, MESSAGE_STATUS.failed),
          item.interfaceCode !== null,
        ),
    },
  ];
  /* 열 순서는 머리칸 손잡이로 바꾸고 브라우저에 남는다(단말 관리와 같다 · #358). 폭은 `BoardTable` 이 맡는다. */
  const ordered = useColumnOrder('omf-mes:erp-outbound:columns:items:order', columns);

  return (
    <BoardTable
      label={t.panes.items}
      widthKey="omf-mes:erp-outbound:columns:items"
      minWidth="22rem"
      columns={ordered}
      rows={[...items]}
      getRowId={(item) => item.outboundItemCode}
      empty={<EmptyState size="sm" live title={t.empty.noMatch} />}
      pick={{
        columnKey: 'outboundItemName',
        label: (item) => t.pickRow(item.outboundItemName),
        currentId: selectedCode,
        onPick: (item) => {
          onSelect(item.outboundItemCode);
        },
      }}
    />
  );
};

/** 오른쪽 — 고른 항목의 송신 예정(송신기가 아직 보내지 않은 건). */
const PendingTable = ({ rows }: { rows: IntegrationMessageRow[] }) => {
  const columns: Column<IntegrationMessageRow>[] = [
    {
      key: 'messageKey',
      header: t.table.messageKey,
      width: '184px',
      render: (row) => (
        <Link
          className="link-cell"
          to={`${INTEGRATION_SYNC_PATH}?sel=${String(row.integrationMessageId)}`}
          aria-label={t.openMessage(messageTitleOf(row))}
        >
          <OneLine text={documentNoOf(row)} />
        </Link>
      ),
    },
    {
      key: 'createdAt',
      header: t.table.createdAt,
      width: '148px',
      render: (row) => formatDateTime(row.createdAt) ?? t.values.empty,
    },
    {
      key: 'availableAt',
      header: t.table.availableAt,
      width: '148px',
      render: (row) => formatDateTime(row.availableAt) ?? t.values.empty,
    },
    {
      key: 'retryCount',
      header: t.table.retryCount,
      width: '56px',
      align: 'end',
      render: (row) => String(row.retryCount),
    },
    {
      key: 'lastErrorMessage',
      header: t.table.lastErrorMessage,
      render: (row) => <OneLine text={row.lastErrorMessage ?? t.values.empty} />,
    },
  ];

  return (
    <BoardTable
      label={t.panes.pending}
      widthKey="omf-mes:erp-outbound:columns:pending"
      minWidth="44rem"
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.integrationMessageId)}
    />
  );
};

/**
 * W-06-12 ERP 송신 — 「ERP 연동 현황·이력」 묶음의 탭(사용자 지시 2026-10-27). 입고 관리와 같은 짜임이다: 탭 막대
 * 오른쪽에 송신 상태 칩, 왼쪽에 송신 항목 다섯, 오른쪽에 고른 항목의 송신 예정 목록. 두 구획은 창 바닥에서 멈추고
 * 넘치는 줄은 구획 안에서 스크롤한다.
 *
 * 고른 항목(`item`)과 쪽(`page`)은 주소가 갖는다. 고르지 않았으면 첫 항목을 연다 — 비어 있는 오른쪽보다 낫다.
 */
export const ErpOutboundScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const items = useOutboundItems();
  const counts = useOutboundCounts();
  const itemRows = items.data ?? [];
  /* 이름 검색 — 치는 값(`search`)과 [조회]로 건 값(`query`). 주소에 두지 않는다(화면 안 거르기 · #358). */
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const shownItems = itemRows.filter((item) => matchesName(item, query));
  /* 송신 항목은 다 받는 작은 목록이라 화면에서 쪽을 나눈다(#358). */
  const itemPage = useClientPage(shownItems);
  const requestedCode = searchParams.get('item');
  const selected =
    itemRows.find((item) => item.outboundItemCode === requestedCode) ?? itemRows[0] ?? null;
  const page = readPage(searchParams.get('page'));
  /* 생성일 조건 — 주소의 `from` · `to`(날짜). 없으면 전체다. */
  const created = readCreatedPeriod(searchParams);
  /*
   * 「오늘」은 그릴 때마다 다시 잰다 — 목록이 15초마다 다시 그려지므로, 자정을 넘겨 켜 둔 화면에서도 「최근 1주일」이
   * 오늘까지로 걸린다(한 번만 재면 어제에 머문다).
   */
  const today = new Date();
  const offsetMinutes = -today.getTimezoneOffset();

  const pending = usePendingMessages(
    selected?.interfaceCode ?? null,
    page,
    created === null ? null : toPeriodQuery(created, offsetMinutes),
  );
  const pendingRows = pending.data?.items ?? [];
  const pageView = toPageView(
    pending.data?.page ?? { page, size: 0, total: 0 },
    pendingRows.length,
  );

  /** 항목을 바꿔도 생성일 조건은 남긴다 — 같은 기간으로 다른 항목을 본다. 쪽은 처음으로. */
  const select = (code: string): void => {
    const next = new URLSearchParams({ item: code });
    if (created !== null) {
      next.set('from', created.from);
      next.set('to', created.to);
    }
    setSearchParams(next);
  };
  /** 생성일 조건을 바꾸면 쪽은 처음으로. */
  const applyCreated = (period: PeriodInput | null): void => {
    const next = new URLSearchParams(searchParams);
    if (selected !== null) next.set('item', selected.outboundItemCode);
    next.delete('page');
    if (period === null) {
      next.delete('from');
      next.delete('to');
    } else {
      next.set('from', period.from);
      next.set('to', period.to);
    }
    setSearchParams(next);
  };
  const changePage = (nextPage: number): void => {
    const next = new URLSearchParams(searchParams);
    if (selected !== null) next.set('item', selected.outboundItemCode);
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    setSearchParams(next);
  };

  const pendingSlot = () => {
    if (selected === null) return null;
    if (selected.interfaceCode === null) {
      return <EmptyState size="sm" title={t.empty.noInterface} />;
    }
    if (pending.isError) {
      return <LoadErrorBanner error={pending.error} onRetry={() => void pending.refetch()} />;
    }
    if (pending.isPending) {
      return (
        <div role="status" aria-label={t.loading.pending}>
          <SkeletonText lines={4} />
        </div>
      );
    }
    /*
     * 끝 쪽을 넘었다 — 송신기가 대기를 계속 비우고 목록은 15초마다 다시 읽으므로 2쪽을 보던 사람이 곧 여기 닿는다.
     * 빠져나갈 길(첫 쪽으로)을 함께 둔다.
     */
    if (pageView.isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLast}
          action={
            <Button
              variant="outlined"
              onClick={() => {
                changePage(1);
              }}
            >
              {ts.actions.goFirstPage}
            </Button>
          }
        />
      );
    }
    if (pendingRows.length === 0) return <EmptyState size="sm" live title={t.empty.noPending} />;

    return (
      <>
        <PendingTable rows={pendingRows} />
        {/* 공용 쪽 넘김(#358) — 쪽은 서버에 그대로 넘긴다. 쪽 크기는 요청 인자를 바꾸지 않게 두지 않는다. */}
        {pending.data !== undefined && (
          <PageNav meta={pending.data.page} buttonSize="md" onChangePage={changePage} />
        )}
      </>
    );
  };

  const pendingCount = pending.data?.page.total;

  return (
    <ListDetailWorkspace
      storageKey="omf-mes:erp-outbound"
      orientationKey={ERP_LINK_ORIENTATION_KEY}
      /* 목록 아래 공용 쪽 넘김(처음 ~ 마지막)이 한 줄에 들어가는 폭(#358 — 종전 0.35). */
      initialRatio={0.42}
      toolbar={<ErpSendChips />}
      filter={{
        label: t.filters.label,
        content: (
          /* 조건이 없던 화면 — 송신 항목 이름 검색 하나 + [조회][초기화](단말 관리와 같다 · #358).
             초기화는 검색어가 처음 값(빈칸)과 다를 때만 보인다. */
          <div className="filter-bar erp-link-filter">
            <SearchInput
              containerClassName="erp-link-search-input"
              label={t.filters.search}
              value={search}
              placeholder={t.filters.searchPlaceholder}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              onSearch={(value) => {
                setQuery(value);
              }}
              clearLabel={messages.common.clear}
            />
            <div className="filter-actions field-cell-unlabeled">
              <Button
                onClick={() => {
                  setQuery(search);
                }}
              >
                {messages.common.search}
              </Button>
              {hasChangedFilters({ q: '' }, { q: search }, { q: query }) && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSearch('');
                    setQuery('');
                  }}
                >
                  {messages.common.reset}
                </Button>
              )}
            </div>
          </div>
        ),
      }}
      list={{
        label: t.panes.items,
        title: t.panes.list,
        count: items.data === undefined ? undefined : shownItems.length,
        content: items.isError ? (
          <LoadErrorBanner error={items.error} onRetry={() => void items.refetch()} />
        ) : items.isPending ? (
          <div role="status" aria-label={t.loading.items}>
            <SkeletonText lines={5} />
          </div>
        ) : (
          <>
            <div className="erp-link-list-body">
              <ItemTable
                items={itemPage.rows}
                counts={counts}
                selectedCode={selected?.outboundItemCode ?? null}
                onSelect={select}
              />
            </div>
            <PageNav {...itemPage.nav} buttonSize="md" />
          </>
        ),
      }}
      detail={{
        label: t.panes.pending,
        content:
          selected === null ? (
            /* 고른 항목이 없을 때 — 단말 관리와 같은 빈 상태(#358). */
            <EmptyState
              size="sm"
              className="users-roles-pick-empty"
              icon={
                <span className="inspection-standard-empty-icon">
                  <Icon name="upload" size={20} />
                </span>
              }
              title={t.empty.pickItem}
              description={t.empty.pickItemDescription}
            />
          ) : (
            <>
              <h2 className="pane-title">
                {selected.interfaceCode !== null && pendingCount !== undefined
                  ? t.pendingTitle(selected.outboundItemName, pendingCount)
                  : selected.outboundItemName}
              </h2>
              {selected.interfaceCode !== null && (
                <div className="po-board-filter">
                  <CreatedFilter applied={created} today={today} onApply={applyCreated} />
                </div>
              )}
              {pendingSlot()}
            </>
          ),
      }}
    />
  );
};
