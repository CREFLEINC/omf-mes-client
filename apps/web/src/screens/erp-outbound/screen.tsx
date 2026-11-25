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
import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { BoardTable } from '../../patterns/board-table';
import { useClientPage } from '../../patterns/client-page';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { hasChangedFilters } from '../../patterns/filter-more';
import {
  FIT_PLACEHOLDER_CLASS,
  useFitPlaceholderWidth,
} from '../../patterns/fit-placeholder-width';
import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { OneLine } from '../../patterns/po-board';
import { LoadErrorBanner } from '../../patterns/load-error-banner';
import { Select } from '../../patterns/select';
import { PAGE_SIZES, PageNav, type PageSize } from '../../patterns/page-nav';
import { documentNoOf } from '../integration-sync/message-labels';
import { formatDateTime } from '../integration-sync/message-status';
import { toPageView } from '../integration-sync/pagination';
import { toPeriodQuery, type PeriodInput } from '../integration-sync/period';
import { ERP_LINK_ORIENTATION_KEY } from '../integration-sync/erp-link-layout';
import type { IntegrationMessageRow } from '../integration-sync/types';
import { CreatedFilter } from './created-filter';
import { formatDate, readCreatedPeriod } from './created-period';
import { MESSAGE_STATUS, type OutboundItem } from './outbound-items';
import {
  PENDING_PAGE_SIZE,
  useOutboundCounts,
  useOutboundItems,
  usePendingMessages,
  type OutboundCounts,
} from './queries';
import { ErpSendChips } from './send-chips';
import './layout.css';

const t = messages.erpOutbound;
const ts = messages.integrationSync;

/** 송신 예정의 「전체」 기간 시작 — 서버가 기간을 꼭 받으므로 그보다 앞선 날짜로 둔다(#358). */
const PENDING_FROM = '2000-01-01';

const readPage = (raw: string | null): number => {
  const value = Number(raw);

  return Number.isInteger(value) && value > 1 ? value : 1;
};

/** 송신 예정 쪽 크기 — 주소의 `size`. 고른 적이 없으면 `null`(종전 20건 · `PENDING_PAGE_SIZE`). */
const readSize = (raw: string | null): PageSize | null =>
  PAGE_SIZES.find((option) => String(option) === raw) ?? null;

const countText = (count: number | undefined, hasInterface: boolean): string => {
  if (!hasInterface || count === undefined) return t.values.empty;

  return t.counts(count);
};

interface ItemTableProps {
  items: readonly OutboundItem[];
  counts: OutboundCounts;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  /** 고른 항목을 다시 누르면 고르기를 푼다. */
  onUnselect: () => void;
}

/** 조회 조건 — 상태 · 송신 항목 이름. 화면 안에서만 거른다(서버 요청은 그대로 · #358). */
interface OutboundFilters {
  state: '' | 'pending' | 'failed' | 'off';
  q: string;
}
const EMPTY_FILTERS: OutboundFilters = { state: '', q: '' };

/** 상태 — 송신 대기가 있는 · 송신 실패가 있는 · 송신이 꺼진 항목(#358). 이름은 앞뒤 빈칸 · 대소문자를 가리지 않는다. */
const matchesFilters = (item: OutboundItem, filters: OutboundFilters): boolean => {
  const linked = item.interfaceCode !== null;
  const stateOk =
    filters.state === ''
      ? true
      : filters.state === 'pending'
        ? linked && item.pendingCount > 0
        : filters.state === 'failed'
          ? linked && item.failedCount > 0
          : !item.enabled;

  return stateOk && item.outboundItemName.toLowerCase().includes(filters.q.trim().toLowerCase());
};

/** 왼쪽 — 송신 항목 다섯. 줄 어디를 눌러도 고른다(입고 관리의 발주 목록과 같다). */
const ItemTable = ({ items, counts, selectedCode, onSelect, onUnselect }: ItemTableProps) => {
  const columns: Column<OutboundItem>[] = [
    {
      key: 'outboundItemName',
      header: t.table.item,
      align: 'center',
      /* 폭 — 항목 이름은 짧고 송신 시점 글이 길어 남는 폭을 송신 시점에 준다(사용자 지시 2026-11-24). */
      width: '96px',
      /* 고르는 단추 자리(`BoardTable` 의 `pick`). */
      render: (item) => item.outboundItemName,
    },
    /* 언제 보내는가 — 상세와 같은 서버 글을 목록에서도 본다(사용자 지시 2026-11-24). 길면 한 줄로 줄이고 올리면 전문. */
    {
      key: 'sendTiming',
      header: t.table.sendTiming,
      align: 'center',
      render: (item) => <OneLine text={item.sendTimingNote ?? t.values.empty} />,
    },
    {
      key: 'enabled',
      header: t.table.send,
      align: 'center',
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
      width: '80px',
      align: 'center',
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
      width: '80px',
      align: 'center',
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
        onUnpick: onUnselect,
      }}
    />
  );
};

/** 오른쪽 — 고른 항목의 송신 예정(송신기가 아직 보내지 않은 건). */
const PendingTable = ({ rows }: { rows: IntegrationMessageRow[] }) => {
  /* 줄 어디를 눌러도 그 줄을 고른다(사용자 지시 2026-11-24) — 문서 번호는 링크가 아니다. */
  const [pickedId, setPickedId] = useState<string | null>(null);
  const columns: Column<IntegrationMessageRow>[] = [
    {
      key: 'messageKey',
      header: t.table.messageKey,
      align: 'center',
      width: '184px',
      render: (row) => <OneLine text={documentNoOf(row)} />,
    },
    {
      key: 'createdAt',
      header: t.table.createdAt,
      align: 'center',
      width: '156px',
      render: (row) => formatDateTime(row.createdAt) ?? t.values.empty,
    },
    {
      key: 'availableAt',
      header: t.table.availableAt,
      align: 'center',
      width: '156px',
      render: (row) => formatDateTime(row.availableAt) ?? t.values.empty,
    },
    {
      key: 'retryCount',
      header: t.table.retryCount,
      width: '128px',
      align: 'center',
      render: (row) => t.times(row.retryCount),
    },
    {
      key: 'lastErrorMessage',
      header: t.table.lastErrorMessage,
      align: 'center',
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
      pick={{
        columnKey: 'messageKey',
        label: (row) => t.pickRow(documentNoOf(row)),
        currentId: pickedId,
        onPick: (row) => {
          setPickedId(String(row.integrationMessageId));
        },
        onUnpick: () => {
          setPickedId(null);
        },
      }}
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
  /* 조회 조건 — 고르는 값(`draft`)과 [조회]로 건 값(`applied`). 주소에 두지 않는다(화면 안 거르기 · #358). */
  const [draft, setDraft] = useState<OutboundFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<OutboundFilters>(EMPTY_FILTERS);
  const searchRef = useFitPlaceholderWidth(t.filters.searchPlaceholder);
  const fieldId = useId();
  const shownItems = itemRows.filter((item) => matchesFilters(item, applied));
  /* 송신 항목은 다 받는 작은 목록이라 화면에서 쪽을 나눈다(#358). */
  const itemPage = useClientPage(shownItems);
  const requestedCode = searchParams.get('item');
  /* 고른 항목을 다시 눌러 푼 상태는 빈 `item` 으로 둔다 — 그때는 첫 항목으로 되돌리지 않는다. */
  const selected =
    requestedCode === ''
      ? null
      : (itemRows.find((item) => item.outboundItemCode === requestedCode) ?? itemRows[0] ?? null);
  const page = readPage(searchParams.get('page'));
  const size = readSize(searchParams.get('size'));
  /*
   * 생성일 조건 — 주소의 `from` · `to`(날짜). 없으면 「전체」다(사용자 지시 2026-11-24 · 칸 되살림, 둘레 상자는 두지 않는다).
   * 서버는 기간 없는 조회를 받지 않으므로(계약 `createdFrom` · `createdTo` 필수) 「전체」는 「아주 오래전 ~ 오늘」로 실어
   * 보낸다 — 종전 「전체」에서 조회 오류가 나던 까닭이다. 「오늘」은 그릴 때마다 다시 잰다(15초마다 다시 그려져 자정을
   * 넘겨 켜 둔 화면에서도 오늘까지로 걸린다).
   */
  const created = readCreatedPeriod(searchParams);
  const today = new Date();
  const pendingPeriod = toPeriodQuery(
    created ?? { from: PENDING_FROM, to: formatDate(today) },
    -today.getTimezoneOffset(),
  );

  const pending = usePendingMessages(
    selected?.interfaceCode ?? null,
    page,
    pendingPeriod,
    size ?? PENDING_PAGE_SIZE,
  );
  const pendingRows = pending.data?.items ?? [];
  const pageView = toPageView(
    pending.data?.page ?? { page, size: 0, total: 0 },
    pendingRows.length,
  );

  /** 항목을 고르면 쪽은 처음으로. 생성일 조건 · 쪽 크기는 남긴다 — 같은 기간으로 다른 항목을 본다. */
  const select = (code: string): void => {
    const next = new URLSearchParams({ item: code });
    if (created !== null) {
      next.set('from', created.from);
      next.set('to', created.to);
    }
    if (size !== null) next.set('size', String(size));
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
  const unselect = (): void => {
    setSearchParams(new URLSearchParams({ item: '' }));
  };
  const changePage = (nextPage: number): void => {
    const next = new URLSearchParams(searchParams);
    if (selected !== null) next.set('item', selected.outboundItemCode);
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    setSearchParams(next);
  };
  /** 쪽 크기를 바꾸면 첫 쪽으로. */
  const changeSize = (nextSize: PageSize): void => {
    const next = new URLSearchParams(searchParams);
    if (selected !== null) next.set('item', selected.outboundItemCode);
    next.delete('page');
    next.set('size', String(nextSize));
    setSearchParams(next);
  };
  /*
   * 송신 예정 쪽 넘김 — 상세 상자 안의 다른 표와 같은 한 줄(총 N건 · 쪽 크기 · [처음]~[마지막] · 사용자 지시 2026-11-24).
   * 쪽 · 쪽 크기는 서버에 그대로 넘긴다(계약 `page` · `size`). 빈 결과 · 끝 쪽을 넘은 때에도 선다.
   */
  const pendingNav =
    pending.data === undefined ? null : (
      <PageNav
        meta={pending.data.page}
        buttonSize="md"
        onChangePage={changePage}
        onChangeSize={changeSize}
      />
    );

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
        <>
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
          {pendingNav}
        </>
      );
    }
    if (pendingRows.length === 0) {
      return (
        <>
          <EmptyState size="sm" live title={t.empty.noPending} />
          {pendingNav}
        </>
      );
    }

    return (
      <>
        <PendingTable rows={pendingRows} />
        {pendingNav}
      </>
    );
  };

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
          /* 상태 선택 · 송신 항목 검색 + [조회][초기화](ERP 수신과 같은 순서 · #358).
             초기화는 조건이 처음 값과 다를 때만 보인다. */
          <div className="filter-bar erp-link-filter">
            {/* 상태 — 선택지가 몇 개 안 돼 검색창 없이 펼친다. */}
            <div className="field-cell">
              <label className="field-label" htmlFor={`${fieldId}-state`}>
                {t.filters.state}
              </label>
              <Select
                id={`${fieldId}-state`}
                value={draft.state}
                options={[
                  { value: '', label: t.filters.all },
                  { value: 'pending', label: t.table.pending },
                  { value: 'failed', label: t.table.failed },
                  { value: 'off', label: t.filters.sendOff },
                ]}
                onChange={(value) => {
                  setDraft((prev) => ({ ...prev, state: value as OutboundFilters['state'] }));
                }}
              />
            </div>
            <SearchInput
              containerClassName={`erp-link-search-input ${FIT_PLACEHOLDER_CLASS}`}
              label={t.filters.search}
              value={draft.q}
              placeholder={t.filters.searchPlaceholder}
              ref={searchRef}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, q: event.target.value }));
              }}
              onSearch={(value) => {
                setApplied({ ...draft, q: value });
              }}
              clearLabel={messages.common.clear}
            />
            <div className="filter-actions field-cell-unlabeled">
              <Button
                onClick={() => {
                  setApplied(draft);
                }}
              >
                {messages.common.search}
              </Button>
              {hasChangedFilters(EMPTY_FILTERS, draft, applied) && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setDraft(EMPTY_FILTERS);
                    setApplied(EMPTY_FILTERS);
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
                onUnselect={unselect}
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
            <div className="integration-sync-detail erp-outbound-detail">
              {/*
               * 상자 제목 — 목록 상자의 「ERP 송신 목록」과 짝(#358). 끌 수 없는 항목(생산 실적)은 제목 오른쪽에 파란 안내
               * 한 줄을 둔다 — 서버 까닭 글에는 내부 근거가 섞여 있어 화면이 정한 문장을 쓴다(사용자 지시 2026-11-24).
               */}
              <div className="pane-heading-row erp-outbound-detail-head">
                <h2 className="pane-title">{t.panes.detail}</h2>
                {selected.locked && (
                  <p className="iqc-inspection-action-note" data-tone="info" role="note">
                    <Icon name="info" size={16} aria-hidden />
                    {t.lockedNote}
                  </p>
                )}
              </div>
              {/*
               * 정보 상자 하나 — 검사 조회·판정 · 연동 현황·이력 · ERP 수신과 같은 모양(첫 칸에 항목 이름 + 송신 여부 배지 · #358).
               */}
              <dl className="parts-iqc-facts iqc-inbound-facts integration-sync-facts erp-outbound-facts">
                <div className="parts-iqc-fact">
                  <dt className="field-label">{t.table.item}</dt>
                  <dd className="iqc-inbound-lot-key">
                    <h3 className="parts-iqc-fact-key">{selected.outboundItemName}</h3>
                    <Chip variant="status" size="sm" status={selected.enabled ? 'success' : 'idle'}>
                      {selected.locked
                        ? t.send.required
                        : selected.enabled
                          ? t.send.on
                          : t.send.off}
                    </Chip>
                  </dd>
                </div>
                <div className="parts-iqc-fact">
                  <dt className="field-label">{t.table.sendTiming}</dt>
                  <dd>{selected.sendTimingNote ?? t.values.empty}</dd>
                </div>
                <div className="parts-iqc-fact">
                  <dt className="field-label">{t.table.pending}</dt>
                  <dd>
                    {countText(
                      selected.interfaceCode === null
                        ? undefined
                        : counts.of(selected.interfaceCode, MESSAGE_STATUS.pending),
                      selected.interfaceCode !== null,
                    )}
                  </dd>
                </div>
                <div className="parts-iqc-fact">
                  <dt className="field-label">{t.table.failed}</dt>
                  <dd>
                    {countText(
                      selected.interfaceCode === null
                        ? undefined
                        : counts.of(selected.interfaceCode, MESSAGE_STATUS.failed),
                      selected.interfaceCode !== null,
                    )}
                  </dd>
                </div>
              </dl>
              {/* 송신 예정 — 건수는 표 아래 쪽 넘김 줄 「총 N건」이 보인다(제목에서 뺌 · 사용자 지시 2026-11-24). */}
              {/*
               * 등록일 조건 — 소제목 줄 오른쪽 끝의 범위 라벨 + 조회 상자로 감싼 날짜 한 줄(사용자 지시 2026-11-24 · 11-25).
               * 송신이 없는 항목은 소제목만 둔다.
               */}
              {selected.interfaceCode !== null ? (
                <CreatedFilter
                  title={t.panes.pending}
                  applied={created}
                  today={today}
                  onApply={applyCreated}
                />
              ) : (
                <h3 className="pane-title erp-outbound-pending-title">{t.panes.pending}</h3>
              )}
              {pendingSlot()}
            </div>
          ),
      }}
    />
  );
};
