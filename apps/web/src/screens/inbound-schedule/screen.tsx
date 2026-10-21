import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { plantToday } from '../../patterns/plant-time';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { useSession } from '../../patterns/session';
import { ReceiptRegisterPanel } from '../over-receipt-split/register-panel';
import {
  readExcessEntry,
  withExcessEntry,
  withoutExcessEntry,
  type ExcessEntry,
} from './excess-entry';
import { excessesByLine } from './excess-match';
import { ExcessPanel } from './excess-panel';
import {
  EXCESS_PAGE_SIZE,
  excessKeys,
  isExcessUnavailable,
  useInboundExcesses,
} from './excess-queries';
import type { InboundExcess } from './excess-types';
import { ScheduleFilterBar } from './filter-bar';
import {
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  toFilterQuery,
  toSearchParams,
  type ScheduleFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemNames,
  usePlantOptions,
  useStorageLocationNames,
  useSupplierOptions,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { QuickLookupBar, type QuickLookupHandle } from './quick-lookup-bar';
import { toPageView } from './pagination';
import {
  defaultPeriod,
  readPeriod,
  toPeriodQuery,
  validatePeriod,
  type PeriodInput,
} from './period';
import { LineTable } from './line-table';
import { OrderTable } from './order-table';
import { scheduleKeys, usePurchaseOrderLines, usePurchaseOrderSummaries } from './queries';
import { readRegisterEntry, withoutRegisterEntry, withRegisterEntry } from './register-entry';
import type {
  InboundScheduleLine,
  PurchaseOrderSummary,
  PurchaseOrderSummaryQuery,
  SelectOption,
} from './types';

const t = messages.inboundSchedule;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: PurchaseOrderSummary[] = [];
const EMPTY_LINES: InboundScheduleLine[] = [];
const NO_ITEM_IDS: readonly number[] = [];
const NO_EXCESSES: InboundExcess[] = [];

/** 왼쪽 표 한 쪽 20줄(사용자 지시 2026-10-20). 서버 기본(50)보다 작게 실어 보낸다 — 상한은 200. */
export const LIST_PAGE_SIZE = 20;

/**
 * 「입하 등록」의 권한 — 화면 코드 W-01-03(옛 「초과 입하 분리」)이다. 서버의 `:split` 경로가 이 코드로 막는다.
 * 세션이 권한 목록을 주지 않았으면(모름) 단추를 세운다 — 막는 것은 서버다(`patterns/web-access.ts` 와 같은 잣대).
 */
const REGISTER_PERMISSION = 'W-01-03';

/** 등록 뒤 함께 다시 읽을 것 — 이 화면의 두 표(받은 수량·진행)와 초과분 목록(새 초과분). */
const REGISTER_REFRESH_KEYS = [scheduleKeys.all, excessKeys.all] as const;

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 발주의 이름을 풀기 위해서인데, 그 발주들을 **조건으로 찾으려면**
 * 선택지에도 있어야 한다. 표식은 저장소 관례를 따른다(W-CO-02의 「(미사용)」).
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-09 컨테이너 — 「입고 관리」 허브의 첫 탭이다. **제목·경로 표시를 두지 않는다** — 탭 이름과 겹친다
 * (사용자 지시 2026-10-21).
 *
 * **입하 예정 = 아직 다 들어오지 않은 P/O 다**(omf-mes-server#741 · #762). 고객사가 ASN 을 쓰지 않는다.
 *
 * **두 표다**(사용자 결정 2026-10-20) — 왼쪽은 P/O 묶음(발주·공급사·납기·진행·남은 라인), 오른쪽은
 * 고른 P/O 의 라인(품목·수량). 발주 하나에 라인이 수십 줄이라 한 표에 두면 같은 발주번호·공급사가
 * 줄마다 되풀이돼 「어느 업체의 어떤 발주가 들어오나」가 읽히지 않았다.
 *
 * 고른 발주는 주소(`po`)에 둔다. 결과가 하나뿐이면 저절로 고른다 — 품목코드 스캔이 발주 하나로 좁혀지면
 * 곧바로 라인이 보인다.
 *
 * 조회 조건과 쪽은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다. 조건이 바뀌면 쪽은
 * 첫 쪽으로 돌아간다(`applyQuery`).
 *
 * **입하·입고 일을 이 화면으로 모은다**(사용자 지시 2026-10-21). 일마다 오른쪽 창이 열리고, 창은 주소가 연다.
 *
 * - **입하 등록**(`register=1` · W-01-03) — 고른 발주 머리의 「입하 등록」. 도착 수량·LOT 을 받아 전표를 만든다.
 *   옛 「초과 입하 분리」 탭이 이 창이 됐다.
 * - **초과분 발주 연결**(`excess=1` · 서버 장부 P-100) — 탭 줄 끝의 「초과분 연결」과, 고른 발주의 라인에 맞는
 *   초과분이 있을 때만 서는 「초과분」 칸이 연다. 입하 등록 결과의 「초과분 발주 연결」도 이 창으로 온다.
 *   권한이 없거나(403) 서버가 그 경로를 모르면(404) 두 길 모두 서지 않는다.
 */
export const InboundScheduleScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { splitRef, aboveRef } = useFitToViewport();
  const { session } = useSession();
  const canRegister =
    session?.permissions === undefined || session.permissions.includes(REGISTER_PERMISSION);
  const split = usePaneSplit('omf-mes:inbound-schedule:split', 0.4);
  const quickRef = useRef<QuickLookupHandle>(null);

  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   */
  const today = plantToday();
  const fallbackPeriod = useMemo<PeriodInput>(() => defaultPeriod(today), [today]);
  const period = useMemo<PeriodInput>(
    () => readPeriod(searchParams, fallbackPeriod),
    [searchParams, fallbackPeriod],
  );
  const filters = useMemo<ScheduleFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  /*
   * **조건이 하나도 없어도 조회한다.** 조회를 멈추는 것은 보내면 반드시 400 `INVALID`가 되는
   * 기간뿐이다(없는 날짜·뒤집힌 기간) — 그런 값은 서버로 보내지 않는다.
   */
  const periodReason = filters.overdueOnly ? null : validatePeriod(period);
  const listQuery: PurchaseOrderSummaryQuery | null =
    periodReason === null
      ? {
          /* 지연은 납기 기간과 상관없이 늦은 발주 전부다(사용자 지시 2026-10-21) — 기간을 싣지 않는다. */
          ...(filters.overdueOnly ? {} : toPeriodQuery(period)),
          ...toFilterQuery(filters),
          ...(page > 1 ? { page } : {}),
          size: LIST_PAGE_SIZE,
        }
      : null;

  const list = usePurchaseOrderSummaries(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /*
   * 고른 발주. 주소의 `po` 가 이 쪽 결과에 있으면 그것, 없고 결과가 하나뿐이면 그것이다.
   * 주소의 발주가 결과에 없으면(조건을 바꿔 빠졌다) 오른쪽을 비운다 — 보이지 않는 발주의 라인을 내면
   * 왼쪽과 어긋난다.
   */
  const poParam = Number(searchParams.get('po') ?? '');
  const selectedOrder =
    rows.find((row) => row.purchaseOrderId === poParam) ??
    (rows.length === 1 ? (rows[0] ?? null) : null);
  const lines = usePurchaseOrderLines(selectedOrder?.purchaseOrderId ?? null);

  const suppliers = useSupplierOptions();
  const plants = usePlantOptions();
  const storageLocationNameOf = useStorageLocationNames();

  /* 품목 이름은 **걸린 품목 조건만** 번호로 묻는다 — 표의 이름은 라인 응답에 함께 온다(#762). */
  const appliedItemId = filters.item === '' ? null : Number(filters.item);
  const itemNames = useItemNames(appliedItemId === null ? NO_ITEM_IDS : [appliedItemId]);

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **주소 갱신은 한 번이다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 는다.
   * **조건이 바뀌면 쪽을 첫 쪽으로 되돌린다** — 3쪽을 보다가 조건을 좁히면 결과가 3쪽에 못 미쳐
   * 「조건을 좁혔더니 아무것도 없다」로 보인다.
   */
  const applyQuery = (
    nextPeriod: PeriodInput,
    nextFilters: ScheduleFilters,
    nextPage = 1,
  ): void => {
    setSearchParams(toSearchParams(nextPeriod, nextFilters, nextPage, fallbackPeriod));
  };

  /*
   * 초과분 — 미연결 전부(진입 단추의 수 · 라인 칸)와, 고른 발주 공급사의 연결된 것(라인 칸의 「연결됨」).
   * 둘 다 연결 창과 같은 캐시 키라 창을 열어도 다시 부르지 않는다.
   */
  const unlinkedExcesses = useInboundExcesses({ linked: false, size: EXCESS_PAGE_SIZE });
  const excessAvailable =
    unlinkedExcesses.isSuccess && !isExcessUnavailable(unlinkedExcesses.error);
  const linkedExcesses = useInboundExcesses(
    { linked: true, supplierId: selectedOrder?.supplierId ?? 0, size: EXCESS_PAGE_SIZE },
    excessAvailable && selectedOrder !== null,
  );
  const lineRows = lines.data?.items ?? EMPTY_LINES;
  const lineExcesses = useMemo(
    () =>
      excessesByLine(
        lineRows,
        excessAvailable ? (unlinkedExcesses.data?.items ?? NO_EXCESSES) : NO_EXCESSES,
        linkedExcesses.data?.items ?? NO_EXCESSES,
      ),
    [lineRows, excessAvailable, unlinkedExcesses.data, linkedExcesses.data],
  );
  const unlinkedCount = unlinkedExcesses.data?.page.total ?? 0;

  /* 창은 한 번에 하나다 — 하나를 열면 다른 하나의 키를 걷는다. */
  const excessEntry = readExcessEntry(searchParams);
  const openExcess = (entry: Partial<ExcessEntry> = {}): void => {
    setSearchParams(withExcessEntry(withoutRegisterEntry(searchParams), entry));
  };
  const closeExcess = (): void => {
    setSearchParams(withoutExcessEntry(searchParams));
  };

  const registerPoId = canRegister ? readRegisterEntry(searchParams) : null;
  const openRegister = (purchaseOrderId: number): void => {
    setSearchParams(withRegisterEntry(searchParams, purchaseOrderId));
  };
  const closeRegister = (): void => {
    setSearchParams(withoutRegisterEntry(searchParams));
  };

  /*
   * 「초과분 연결」 진입 단추 — **탭 막대 오른쪽**(셸의 일 단추 자리)에 둔다. 조건 줄은 이미 꽉 차 있어 거기 두면
   * 한 줄이 더 생긴다. 셸 밖에서 화면만 그리면(시험) 자리가 없어 조건 줄 끝에 둔다.
   */
  const hubActionsTarget = useHubActionsTarget();
  const excessEntryButton = excessAvailable ? (
    <Button
      variant={unlinkedCount > 0 ? 'outlined' : 'text'}
      size="sm"
      aria-label={
        unlinkedCount > 0
          ? `${t.excess.entry} — ${t.excess.entryCount(unlinkedCount)}`
          : t.excess.entry
      }
      onClick={() => {
        openExcess();
      }}
    >
      {t.excess.entry}
      {unlinkedCount > 0 && (
        <span className="po-board-tool-count" aria-hidden="true">
          {unlinkedCount}
        </span>
      )}
    </Button>
  ) : null;

  /** 발주를 고른다 — 조건·쪽은 그대로 두고 `po` 만 바꾼다. */
  const selectOrder = (purchaseOrderId: number): void => {
    const next = toSearchParams(period, filters, page, fallbackPeriod);
    next.set('po', String(purchaseOrderId));
    setSearchParams(next);
  };

  return (
    <>
      {/* 조회 실패는 빈 상태로 오인시키지 않는다 — 「없습니다」로 내면 자료가 없는 줄 안다. */}
      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      {/*
       * 조건과 목록을 다른 구획에 둔다 — 한 상자에 있으면 조건 줄의 끝과 표의 시작이 갈리지 않는다.
       * 결과가 없어도 조건 구획은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다.
       */}
      <section ref={aboveRef} className="pane po-board-filter" aria-label={t.panes.filter}>
        <ScheduleFilterBar
          appliedPeriod={period}
          appliedFilters={filters}
          fallbackPeriod={fallbackPeriod}
          plantOptions={toSelectOptions(plants)}
          chipNames={{
            supplier: describeReference(
              toReference(suppliers, filters.supplier === '' ? null : Number(filters.supplier)),
            ),
            plant: describeReference(
              toReference(plants, filters.plant === '' ? null : Number(filters.plant)),
            ),
            item: appliedItemId === null ? '' : describeReference(itemNames.of(appliedItemId)),
          }}
          plantNote={lookupNote(plants)}
          onSearch={(nextPeriod, nextFilters) => {
            /* 품목코드 칸에 친 값이 남아 있으면 「조회」도 Enter 와 같이 그 품목을 찾는다(2026-10-21 보고). */
            if (quickRef.current?.submit(nextPeriod, nextFilters) === true) return;
            applyQuery(nextPeriod, nextFilters);
          }}
          onRemoveFilter={(key) => {
            applyQuery(period, { ...filters, [key]: '' });
          }}
          onReset={() => {
            applyQuery(fallbackPeriod, DEFAULT_FILTERS);
          }}
          tools={hubActionsTarget === null ? excessEntryButton : undefined}
          quick={
            <QuickLookupBar
              ref={quickRef}
              appliedPeriod={period}
              appliedFilters={filters}
              today={today}
              fallbackPeriod={fallbackPeriod}
              supplierOptions={toSelectOptions(suppliers)}
              supplierNote={lookupNote(suppliers)}
              onApply={(nextPeriod, nextFilters) => {
                applyQuery(nextPeriod, nextFilters);
              }}
            />
          }
        />
      </section>

      <div ref={splitRef} className="po-board-split" style={split.style}>
        <section className="pane po-board-pane" aria-label={t.panes.orders}>
          {!list.isError && (
            <>
              <OrderTable
                rows={rows}
                isLoading={list.isPending && listQuery !== null}
                hasQuery={listQuery !== null}
                isBeyondLast={pageView.isBeyondLast}
                today={today}
                selectedId={selectedOrder?.purchaseOrderId ?? null}
                onSelect={selectOrder}
                onFirstPage={() => {
                  applyQuery(period, filters);
                }}
              />
              {listQuery !== null && !list.isPending && (
                <PageNav
                  view={pageView}
                  onChange={(nextPage) => {
                    applyQuery(period, filters, nextPage);
                  }}
                />
              )}
            </>
          )}
        </section>

        <PaneSplitter label={t.splitter} ratio={split.ratio} onChange={split.commit} />

        <section className="pane po-board-pane" aria-label={t.panes.lines}>
          {lines.isError ? (
            <LoadErrorBanner
              error={lines.error}
              onRetry={() => {
                void lines.refetch();
              }}
            />
          ) : (
            <LineTable
              order={selectedOrder}
              rows={lineRows}
              isLoading={lines.isPending}
              storageLocationNameOf={storageLocationNameOf}
              matchedItemId={appliedItemId}
              lineExcesses={lineExcesses}
              onOpenExcess={openExcess}
              onRegister={canRegister ? openRegister : undefined}
            />
          )}
        </section>
      </div>

      {hubActionsTarget !== null && excessEntryButton !== null && (
        <HubActions target={hubActionsTarget}>{excessEntryButton}</HubActions>
      )}

      {registerPoId !== null && (
        <ReceiptRegisterPanel
          /* 다른 발주를 열면 창을 새로 세운다 — 앞 발주의 초안이 남지 않는다. */
          key={registerPoId}
          purchaseOrderId={registerPoId}
          refreshKeys={REGISTER_REFRESH_KEYS}
          onOpenExcess={(receiptNo) => {
            openExcess({ receiptNo });
          }}
          onClose={closeRegister}
        />
      )}

      {excessEntry !== null && (
        <ExcessPanel
          entry={excessEntry}
          currentOrderId={selectedOrder?.purchaseOrderId ?? null}
          onClose={closeExcess}
        />
      )}
    </>
  );
};
