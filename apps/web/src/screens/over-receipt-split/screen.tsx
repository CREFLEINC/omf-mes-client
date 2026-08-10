import { Breadcrumb, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedPoId,
  toFilterQuery,
  toSearchParams,
  type PoFilters,
} from './filters';
import { createDrafts, setDraftQty, type LineDrafts } from './line-draft';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemOptions,
  usePlantOptions,
  useSupplierOptions,
  useUomOptions,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { PoFilterBar } from './po-filter-bar';
import { PoTable } from './po-table';
import { usePurchaseOrderLines, usePurchaseOrders } from './queries';
import { toSplitLines } from './split-calc';
import { SplitLineTable } from './split-line-table';
import type { PoLineView, PoView, SelectOption } from './types';

const t = messages.overReceiptSplit;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: PoView[] = [];
const EMPTY_LINES: PoLineView[] = [];
const EMPTY_DRAFTS: LineDrafts = {};

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 발주의 이름을 풀기 위해서인데, 그 발주들을 **조건으로 찾으려면**
 * 선택지에도 있어야 한다.
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-03 컨테이너 — **자재창고 도메인의 첫 쓰기 화면**이다.
 *
 * 배치는 상하 2단이다 — 위: 조건 줄과 대상 발주 목록 / 아래: 고른 발주의 라인과 도착 수량 입력.
 * 조회 조건과 고른 발주는 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **PR ①은 라우트에 붙지 않는다.** 등록을 못 하는 「초과 입하 분리」 화면을 사용자에게
 * 내보이지 않기 위한 접근 불가능한 경계다. 세 모드 등록·결과·실패 표시와 함께 PR ②에서 열린다.
 * 그래서 이 화면은 지금 **어떤 쓰기 요청도 보내지 않는다.**
 */
export const OverReceiptSplitScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표.**
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 구획이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * 이 화면은 **입력 형**이라 표에 초안 열이 하나 더 있다. 조회 화면에서는 「무엇이 보이는가」만
   * 달라지지만, 여기서는 사용자가 친 값이 사라지는 것으로 나타난다.
   *
   * | # | 조작 | 조건 | `page` | `po` | 초안 | 결과 구획 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **비운다** | 비운다 |
   * | 2 | 초기화 | **기본으로** | 첫 쪽 | 비운다 | 비운다 | 비운다 |
   * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **비운다** | 비운다 |
   * | 4 | 발주 고르기·해제 | 유지 | **유지** | 넣고 뺀다 | **라인 응답으로 새로 만든다** | 비운다 |
   * | 5 | 결과에 고른 발주 없음 | 유지 | 유지 | **비운다** | 비운다 | 비운다 |
   * | 6 | **수량 입력** | 유지 | 유지 | 유지 | 바뀐다 | **유지** |
   * | 7 | 목록·참조 응답 도착 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 |
   * | 8 | 등록 성공 | 유지 | 유지 | **유지** | **비운다** | **채운다** |
   * | 9 | 등록 실패 | 유지 | 유지 | 유지 | **유지**(입력을 잃지 않는다) | 비운다 |
   * | 10 | 취소 | 유지 | 유지 | **비운다** | **비운다** | 비운다 |
   *
   * **8~10행과 「결과 구획」 열은 PR ②의 것이다.** 지금은 등록 경로가 없어 그 조작이 일어나지 않는다.
   * 표를 통째로 남기는 이유는, PR ②가 행을 새로 발명하지 않고 이 표를 이어받게 하기 위해서다.
   * 열한째 조작이 생기면 표에 행을 먼저 더한다.
   *
   * **왜 이렇게 정했는가**
   *
   * - **1·3행이 초안을 비우는 이유**: 초안은 특정 발주의 라인에 묶여 있다. 대상이 바뀌면
   *   그 수량은 뜻을 잃는다. (초안이 있을 때 확인을 받는 것은 PR ②의 확인 창이 맡는다.)
   * - **4행이 쪽을 유지하는 이유**: 보이는 행이 그대로다. 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다.
   * - **6·7행이 이 화면의 #43 자리다**: 초안 되돌림은 **`po`와 라인 응답에만 반응하는 effect
   *   한 곳**이 한다. 목록 재조회·참조 도착·부모 리렌더에 반응하면 「치던 수량이 사라진다」가
   *   그대로 재현된다.
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   * `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const filters = useMemo<PoFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedPoId = readSelectedPoId(searchParams);

  /*
   * **조건이 하나도 없어도 조회한다.** 들어오자마자 「받을 것이 남은 발주」가 보여야
   * 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
   * 기본 조건(미완료만)은 `toFilterQuery`가 채운다.
   */
  const listQuery = { ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = usePurchaseOrders(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const suppliers = useSupplierOptions();
  const plants = usePlantOptions();
  const items = useItemOptions();
  /* 단위는 아래 구획만 쓴다 — 고르기 전에 부르면 첫 진입의 요청 수가 이유 없이 는다. */
  const uoms = useUomOptions(selectedPoId !== null);

  const lines = usePurchaseOrderLines(selectedPoId);

  /**
   * 라인별 도착 수량 초안. **주소에 싣지 않는다** — 글자마다 뒤로가기 기록이 쌓이고,
   * 화면이 조회 조건과 입력을 같은 통로로 다루게 된다.
   */
  const [drafts, setDrafts] = useState<LineDrafts>(EMPTY_DRAFTS);

  /*
   * **#43을 재생산하지 않는 자리다**(수명 표 6·7행).
   *
   * 의존성은 **고른 발주와 라인 응답 둘뿐이다.** 목록 재조회·참조 도착·부모 리렌더는
   * 이 effect를 깨우지 않는다 — 깨우면 사용자가 수량을 치는 도중에 값이 사라진다.
   *
   * `useMemo`로 만든 파생 객체(예: 아래 `splitLines`)를 의존성에 넣지 않는 것도 같은 이유다.
   * 파생값은 렌더마다 새 참조라 그것을 의존성으로 삼으면 매 렌더 초안이 되돌아간다.
   */
  const lineData = lines.data;

  useEffect(() => {
    setDrafts(createDrafts(lineData ?? EMPTY_LINES));
  }, [selectedPoId, lineData]);

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **주소 갱신은 한 번이다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   * 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   *
   * **조건이 바뀌면 쪽을 첫 쪽으로 되돌린다**(수명 표 1행). `toSearchParams`가 `po`를
   * 만들지 않으므로 고른 발주도 함께 풀리고, 그 결과 초안 되돌림 effect가 초안을 비운다.
   */
  const applyQuery = (nextFilters: PoFilters, nextPage = 1): void => {
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  /**
   * 고른 발주. **목록 응답에서 찾는다** — 제목줄에 필요한 값이 그 행에 이미 들어 있어
   * 상세 경로를 부를 이유가 없다.
   */
  const selectedRow = rows.find((row) => row.purchaseOrderId === selectedPoId) ?? null;

  /*
   * 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(수명 표 4행) — 쪽·조건을 건드리지 않는다.
   */
  const toggleSelect = (purchaseOrderId: number): void => {
    const next = toSearchParams(filters, page);

    if (purchaseOrderId !== selectedPoId) next.set('po', String(purchaseOrderId));

    setSearchParams(next);
  };

  /*
   * 갱신된 결과에 고른 발주가 없으면 `po`를 주소에서 뗀다(수명 표 5행).
   * 남겨 두면 아래 구획이 화면에 없는 발주를 가리킨 채 주소만 남는다.
   *
   * **정리를 클릭 핸들러가 아니라 고른 식별자에 묶는다.** 뒤로가기·앞으로가기·주소 직접 편집은
   * 핸들러를 거치지 않고 `po`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * **받은 결과가 있을 때만 판정한다.** 조회를 기다리는 동안에는 행이 비어 있어,
   * 가드가 없으면 「고른 발주가 사라졌다」로 읽혀 아래 구획이 깜빡 닫힌다.
   *
   * replace로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다.
   */
  useEffect(() => {
    if (selectedPoId === null) return;
    if (list.data === undefined) return;
    if (list.data.items.some((row) => row.purchaseOrderId === selectedPoId)) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('po');

        return next;
      },
      { replace: true },
    );
  }, [selectedPoId, list.data, setSearchParams]);

  /**
   * **읽는 자리에서 파생한다.** 잔량·정량 한도·정량/초과는 `split-calc.ts`가 한 번만 만들고
   * 표는 그 결과를 그리기만 한다 — 뒤따르는 PR의 요청 조립도 같은 결과를 받는다.
   */
  const splitLines = toSplitLines(lineData ?? EMPTY_LINES, drafts);

  /*
   * 수량 입력은 **주소를 바꾸지 않는다**(수명 표 6행). 주소에 실으면 글자마다 뒤로가기 기록이 쌓인다.
   */
  const changeQty = (purchaseOrderLineId: number, text: string): void => {
    setDrafts((prev) => setDraftQty(prev, purchaseOrderLineId, text));
  };

  const supplierReference = toReference(
    suppliers,
    filters.supplier === '' ? null : Number(filters.supplier),
  );

  /**
   * 참조 실패의 복구 경로 — **이름이 보이는 자리마다 하나씩** 둔다(계획 결정 15).
   * 안내 문구가 적은 대상과 다시 부르는 대상이 어긋나면, 눌러도 한쪽은 실패인 채로 남는데
   * 문구는 둘 다 고쳐질 것처럼 말한다.
   */
  const retryTopReferences = (): void => {
    suppliers.refetch();
  };

  const retryLineReferences = (): void => {
    items.refetch();
    uoms.refetch();
    plants.refetch();
  };

  /** 아래 구획. 넷 중 하나만 낸다 — 사용자가 할 조치가 서로 다르다. */
  const linePane = (): ReactNode => {
    if (selectedPoId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noSelectionTitle}
          description={t.empty.noSelectionDescription}
        />
      );
    }

    /*
     * 고른 번호는 있는데 그 행이 없다. 두 갈래이고 **사용자가 할 조치가 다르다.**
     *
     * **잣대는 「목록 조회가 성립했는가」다**(W-01-07이 세운 형태). 목록이 실패하면 행 목록이
     * 빈 채로 남고 정리 effect도 결과를 못 받아 물러나므로, 여기서 골격을 내면 **기다리라고
     * 말하는데 기다려서 풀리지 않는다.** 라인 조회는 실제로 나가는데 그 실패까지 로딩이 덮는다 —
     * 이 슬라이스가 `load-error-banner.tsx`에 적은 「실패를 빈 상태로 보이지 않는다」와 어긋난다.
     *
     * 라인 값을 받아도 구획을 열 수 없다 — **제목줄이 쓰는 발주의 값이 목록 응답에만 있다.**
     * 그래서 라인 실패 갈래로 넘기지 않고 목록을 되살리라고 말한다(복구 수단은 위 배너에 있다).
     */
    if (selectedRow === null) {
      if (list.isError) {
        return (
          <EmptyState
            size="sm"
            live
            title={t.empty.listFailedTitle}
            description={t.empty.listFailedDescription}
          />
        );
      }

      /* 목록을 기다리는 중이다. 정리 effect가 결과를 보고 판정할 때까지 되돌리지 않는다. */
      return (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    if (lines.isError) {
      return (
        <LoadErrorBanner
          error={lines.error}
          onRetry={() => {
            void lines.refetch();
          }}
        />
      );
    }

    return (
      <SplitLineTable
        purchaseOrder={selectedRow}
        supplierName={describeReference(toReference(suppliers, selectedRow.supplierId))}
        rows={splitLines}
        isLoading={lines.isPending}
        /*
         * 공장은 **이름이 아니라 참조 자체**를 넘긴다 — 이 구획이 실패 안내와 다시 시도를
         * 소유하므로 실패 여부를 함께 알아야 한다. 공급사는 위 구획이 소유해 이름만 넘긴다.
         */
        plantLookup={plants}
        itemLookup={items}
        uomLookup={uoms}
        onChangeQty={changeQty}
        onRetryReferences={retryLineReferences}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/* 조회 실패는 빈 상태로 오인시키지 않는다 — 「없습니다」로 내면 자료가 없는 줄 안다. */}
      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.list}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <PoFilterBar
          appliedFilters={filters}
          supplierOptions={toSelectOptions(suppliers)}
          chipNames={{ supplier: describeReference(supplierReference) }}
          supplierNote={lookupNote(suppliers)}
          onSearch={(nextFilters) => {
            applyQuery(nextFilters);
          }}
          onRemoveFilter={(key) => {
            applyQuery({ ...filters, [key]: '' });
          }}
          onReset={() => {
            applyQuery(DEFAULT_FILTERS);
          }}
        />

        {!list.isError && (
          <>
            <PoTable
              rows={rows}
              isLoading={list.isPending}
              isBeyondLast={pageView.isBeyondLast}
              selectedPoId={selectedPoId}
              supplierLookup={suppliers}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              onToggleSelect={toggleSelect}
              onRetryReferences={retryTopReferences}
            />
            {!list.isPending && (
              <PageNav
                view={pageView}
                onChange={(nextPage) => {
                  applyQuery(filters, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>

      <section className="pane" aria-label={t.panes.lines}>
        {linePane()}
      </section>
    </>
  );
};
