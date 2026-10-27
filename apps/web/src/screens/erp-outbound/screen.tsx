import { Chip, EmptyState, SkeletonText, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link, useSearchParams } from 'react-router';

import { BoardTable } from '../../patterns/board-table';
import { OneLine, PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { LoadErrorBanner } from '../integration-sync/load-error-banner';
import { formatDateTime } from '../integration-sync/message-status';
import { PageNav } from '../integration-sync/page-nav';
import { toPageView } from '../integration-sync/pagination';
import type { IntegrationMessageRow } from '../integration-sync/types';
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
      width: '72px',
      render: (item) => (
        <Chip variant="status" size="sm" status={item.enabled ? 'success' : 'idle'}>
          {item.locked ? t.send.required : item.enabled ? t.send.on : t.send.off}
        </Chip>
      ),
    },
    {
      key: 'pending',
      header: t.table.pending,
      width: '64px',
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
      width: '64px',
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

  return (
    <BoardTable
      label={t.panes.items}
      widthKey="omf-mes:erp-outbound:columns:items"
      minWidth="22rem"
      columns={columns}
      rows={[...items]}
      getRowId={(item) => item.outboundItemCode}
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
      width: '240px',
      render: (row) => (
        <Link
          className="link-cell"
          to={`${INTEGRATION_SYNC_PATH}?sel=${String(row.integrationMessageId)}`}
          aria-label={t.openMessage(row.messageKey)}
        >
          <OneLine text={row.messageKey} />
        </Link>
      ),
    },
    {
      key: 'target',
      header: t.table.target,
      width: '200px',
      render: (row) => ts.detail.targetValue(row.targetTypeCode, row.targetId),
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
      minWidth="52rem"
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
  const { splitRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:erp-outbound:split', 0.35);

  const items = useOutboundItems();
  const counts = useOutboundCounts();
  const itemRows = items.data ?? [];
  const requestedCode = searchParams.get('item');
  const selected =
    itemRows.find((item) => item.outboundItemCode === requestedCode) ?? itemRows[0] ?? null;
  const page = readPage(searchParams.get('page'));

  const pending = usePendingMessages(selected?.interfaceCode ?? null, page);
  const pendingRows = pending.data?.items ?? [];
  const pageView = toPageView(
    pending.data?.page ?? { page, size: 0, total: 0 },
    pendingRows.length,
  );

  const select = (code: string): void => {
    setSearchParams(new URLSearchParams({ item: code }));
  };
  const changePage = (nextPage: number): void => {
    const next = new URLSearchParams(searchParams);
    if (selected !== null) next.set('item', selected.outboundItemCode);
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    setSearchParams(next);
  };

  const pendingSlot = () => {
    if (selected === null) return <EmptyState size="sm" title={t.empty.pickItem} />;
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
    if (pendingRows.length === 0) {
      return (
        <EmptyState
          size="sm"
          live
          title={pageView.isBeyondLast ? t.empty.beyondLast : t.empty.noPending}
        />
      );
    }

    return (
      <>
        <PendingTable rows={pendingRows} />
        <PageNav view={pageView} onChange={changePage} />
      </>
    );
  };

  const pendingCount = pending.data?.page.total;

  return (
    <>
      <ErpSendChips />

      <div
        ref={splitRef}
        className="po-board-split"
        style={split.style}
        data-left-collapsed={split.collapsed ? 'true' : undefined}
      >
        <section className="pane po-board-pane" aria-label={t.panes.items}>
          {items.isError ? (
            <LoadErrorBanner error={items.error} onRetry={() => void items.refetch()} />
          ) : items.isPending ? (
            <div role="status" aria-label={t.loading.items}>
              <SkeletonText lines={5} />
            </div>
          ) : (
            <ItemTable
              items={itemRows}
              counts={counts}
              selectedCode={selected?.outboundItemCode ?? null}
              onSelect={select}
            />
          )}
        </section>

        <PaneSplitter
          label={t.splitter}
          ratio={split.ratio}
          onChange={split.commit}
          collapse={{
            collapsed: split.collapsed,
            onToggle: split.toggleCollapsed,
            collapseLabel: t.listCollapse,
            expandLabel: t.listExpand,
          }}
        />

        <section className="pane po-board-pane" aria-label={t.panes.pending}>
          {selected !== null && (
            <h2 className="pane-title">
              {selected.interfaceCode !== null && pendingCount !== undefined
                ? t.pendingTitle(selected.outboundItemName, pendingCount)
                : selected.outboundItemName}
            </h2>
          )}
          {pendingSlot()}
        </section>
      </div>
    </>
  );
};
