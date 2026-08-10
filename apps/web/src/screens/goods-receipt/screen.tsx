import { Breadcrumb, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedIrId,
  readSelectedLineId,
  SELECTION_KEYS,
  toFilterQuery,
  toSearchParams,
  type ChipFilterKey,
  type IrFilters,
} from './filters';
import { IrFilterBar } from './ir-filter-bar';
import { IrLineTable } from './ir-line-table';
import { IrTable } from './ir-table';
import { findSelectedLine, nextSelectedLineId } from './line-select';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemOptions,
  useLotOptions,
  usePlantOptions,
  useSupplierOptions,
  useUomOptions,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { useInboundReceiptLines, useInboundReceipts } from './queries';
import type { IrLineView, IrView, SelectOption } from './types';

const t = messages.goodsReceipt;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: IrView[] = [];
const EMPTY_LINES: IrLineView[] = [];

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 입하의 이름을 풀기 위해서인데, 그 입하들을 **조건으로 찾으려면**
 * 선택지에도 있어야 한다.
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-10 컨테이너 — **PR ①은 대상을 고르는 데까지다.**
 *
 * 배치는 상하로 쌓는다 — 위: 조건 줄과 대상 입하 전표 목록 / 아래: 고른 전표의 제목줄·라인 표·
 * 고른 줄의 제목줄. 조회 조건과 고른 전표·라인은 전부 주소가 소유한다 —
 * 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **이 PR에는 쓰기가 하나도 없다.** 입고 처리는 되돌릴 수 없고 한 번의 확정으로 다섯 가지가
 * 함께 움직이므로(입고 전표 생성·전기 · 자재 LOT 상태 전이 · 수불 원장 · 잔액 · ERP 송신 적재),
 * 결과를 보여 줄 구획과 **함께** 나가야 한다(계획 §5.0). 그래서 확정 입력·결과·실패 표시는
 * PR ②가 통째로 가져간다.
 *
 * **라우트와 사이드바에 등록하지 않는다**(정책 §5.2 · 계획 §13-2). 입고 처리를 못 하는
 * 「정상품 입하 처리」 화면이 노출되면 미완성 기능을 사용자에게 내보이는 것이다.
 * 접근 불가능한 경계로 격리하고 PR ②에서 함께 연다.
 *
 * **참조 → 보이는 자리 → 복구 표**(계획 결정 17)는 `lookups.ts`의 머리에 있다.
 * 이름이 실제로 실패로 보이는 자리에 복구 버튼이 있어야 사용자가 무엇을 되살리는지 안다.
 *
 * **한 번의 확정으로 함께 움직이는 다섯 가지**(계획 결정 13)는 PR ②의 결과 구획이 가른다 —
 * ①~④는 한 트랜잭션이라 부분 실패가 없고, ⑤(ERP 송신 **적재**)만 트랜잭션 밖이라
 * 세 갈래로 갈린다. 「적재」는 「전송」이 아니다.
 */
export const GoodsReceiptScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표**(계획 결정 6).
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 구획이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * | # | 조작 | 조건 5종 | `page` | `ir` | `line` | 초안 | 결과 구획 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **비운다** | **비운다** | 비운다 |
   * | 2 | 초기화 | **비운다** | 첫 쪽 | 비운다 | 비운다 | 비운다 | 비운다 |
   * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **비운다** | **비운다** | 비운다 |
   * | 4 | 전표 고르기·해제 | 유지 | **유지** | 넣고 뺀다 | **비운다** | **비운다** | 비운다 |
   * | 5 | 라인 고르기·해제 | 유지 | 유지 | 유지 | 넣고 뺀다 | **비운다** | 비운다 |
   * | 6 | 결과에 고른 전표·라인 없음 | 유지 | 유지 | **비운다** | **비운다** | 비운다 | 비운다 |
   * | 7 | **확정 입력**(창고·위치·코드·일시·비고) | 유지 | 유지 | 유지 | 유지 | 바뀐다 | **유지** |
   * | 8 | **창고 바꾸기** | 유지 | 유지 | 유지 | 유지 | **위치만 비운다** | 유지 |
   * | 9 | 목록·참조·라인 응답 도착 | 유지 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 |
   * | 10 | **입고 처리 성공** | 유지 | 유지 | **유지** | **유지** | **비운다** | **채운다** |
   * | 11 | 입고 처리 실패 | 유지 | 유지 | 유지 | 유지 | **유지**(입력을 잃지 않는다) | 비운다 |
   * | 12 | 취소 | 유지 | 유지 | 유지 | **비운다** | **비운다** | 비운다 |
   *
   * **이 PR이 구현하는 것은 1~6·9행이다.** 초안 열과 7·8·10~12행은 초안이 생기는 PR ②에서
   * 채워진다 — 표를 그때 새로 세우지 않고 이 표에 이어 붙인다. 열세째 조작이 생기면
   * 표에 행을 먼저 더한다.
   *
   * **왜 이렇게 정했는가**
   *
   * - **1·3·4·5행이 초안을 비우는 이유**: 초안의 위치·수량 맥락은 고른 라인에 묶여 있다.
   *   대상이 바뀌면 뜻을 잃는다.
   * - **4행이 쪽을 유지하는 이유**: 보이는 행이 그대로다. 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다.
   * - **6행이 클릭 핸들러가 아니라 고른 식별자에 묶이는 이유**: 뒤로가기·앞으로가기·주소 직접
   *   편집은 핸들러를 거치지 않고 `ir`·`line`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   * - **9행이 이 화면의 #43 자리다**: 목록 재조회·참조 도착·부모 리렌더가 고른 것을 되돌리면
   *   「고르던 것이 사라진다」가 재현된다. 이 PR에서 고른 것은 주소가 들고 있어 응답에 반응하지
   *   않으며, 조건 줄의 편집 중인 값은 `IrFilterBar`가 **값으로** 판정해 되돌린다.
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   * `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const filters = useMemo<IrFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedIrId = readSelectedIrId(searchParams);
  const selectedLineId = readSelectedLineId(searchParams);

  /*
   * **조건이 하나도 없어도 조회한다.** 들어오자마자 받아들일 수 있는 입하가 보여야
   * 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
   *
   * **기본 기간을 심지 않는다** — 첫 요청에 날짜 조건이 실리지 않는다(계획 결정 6).
   */
  const listQuery = { ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = useInboundReceipts(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const suppliers = useSupplierOptions();
  /* 공장만 미리 받는다 — 제목줄은 목록 응답만으로 곧바로 그려진다(`lookups.ts`의 표). */
  const plants = usePlantOptions();

  const lines = useInboundReceiptLines(selectedIrId);
  const lineData = lines.data;
  const lineRows = lineData ?? EMPTY_LINES;

  /*
   * 품목·단위·자재 LOT은 **라인 표가 그려질 때** 쓴다 — 그 표는 라인 응답을 기다리므로
   * 미리 받아 둘 이득이 없고, 고르기 전에 부르면 첫 진입의 요청 수만 이유 없이 는다.
   */
  const items = useItemOptions(selectedIrId !== null);
  const uoms = useUomOptions(selectedIrId !== null);

  /*
   * 자재 LOT은 **라인이 가리키는 품목마다** 받는다 — 번호 여러 개로 한 번에 조회하는 수단이
   * 계약에 없다. 라인이 오기 전에는 품목이 없어 요청도 없다.
   */
  const lots = useLotOptions(
    lineRows.map((line) => line.itemId),
    selectedIrId !== null,
  );

  /**
   * 고른 입하 전표. **목록 응답에서 찾는다** — 제목줄에 필요한 값이 그 행에 이미 들어 있어
   * 상세 경로를 부를 이유가 없다.
   */
  const selectedRow = rows.find((row) => row.inboundReceiptId === selectedIrId) ?? null;

  /**
   * 고른 라인. **판정은 `line-select.ts` 한 곳이 한다** — 표에는 고를 수 있다고 나오는데
   * 여기서는 아니거나 그 반대인 어긋남을 만들지 않는다.
   */
  const selectedLine = findSelectedLine(lineRows, selectedLineId);

  /*
   * 갱신된 결과에 고른 전표가 없으면 `ir`과 `line`을 주소에서 함께 뗀다(수명 표 6행).
   * 남겨 두면 아래 구획이 화면에 없는 전표를 가리킨 채 주소만 남는다.
   *
   * **정리를 클릭 핸들러가 아니라 고른 식별자에 묶는다.** 뒤로가기·앞으로가기·주소 직접 편집은
   * 핸들러를 거치지 않고 `ir`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * **받은 결과가 있을 때만 판정한다.** 조회를 기다리는 동안에는 행이 비어 있어,
   * 가드가 없으면 「고른 전표가 사라졌다」로 읽혀 아래 구획이 깜빡 닫힌다.
   *
   * replace로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다.
   */
  useEffect(() => {
    if (selectedIrId === null) return;
    if (list.data === undefined) return;
    if (list.data.items.some((row) => row.inboundReceiptId === selectedIrId)) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SELECTION_KEYS.inboundReceipt);
        next.delete(SELECTION_KEYS.line);

        return next;
      },
      { replace: true },
    );
  }, [selectedIrId, list.data, setSearchParams]);

  /*
   * 라인 쪽도 같은 형태다 — 갱신된 라인에 고른 줄이 없거나 **고를 수 없게 됐으면** 정리한다.
   * 주소를 손으로 고쳐 LOT 없는 줄을 가리키는 경우가 이 자리다.
   *
   * **라인 응답이 있을 때만 판정한다.** 기다리는 동안 정리하면 새로고침 직후 고른 줄이
   * 주소에서 사라져 새로고침·공유가 같은 결과를 내지 못한다.
   */
  useEffect(() => {
    if (selectedLineId === null) return;
    if (lineData === undefined) return;
    if (findSelectedLine(lineData, selectedLineId) !== null) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SELECTION_KEYS.line);

        return next;
      },
      { replace: true },
    );
  }, [selectedLineId, lineData, setSearchParams]);

  /**
   * 조건·쪽을 바꾼다. **주소를 한 번만 갱신한다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이
   * 두 칸 늘어 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   *
   * `toSearchParams`가 `ir`·`line`을 만들지 않으므로 조건·쪽이 바뀌면 고른 전표와 라인이
   * 함께 풀린다(수명 표 1~3행).
   */
  const applyQuery = (nextFilters: IrFilters, nextPage = 1): void => {
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  /**
   * 전표를 고르고 푼다. **보이는 행을 바꾸지 않는다**(수명 표 4행) — 조건과 쪽을 그대로 두고
   * `ir`만 넣고 뺀다. 고른 라인은 함께 풀린다 — 다른 전표의 줄을 가리킬 수 없기 때문이다.
   */
  const toggleSelectIr = (inboundReceiptId: number): void => {
    const next = toSearchParams(filters, page);

    if (inboundReceiptId !== selectedIrId) {
      next.set(SELECTION_KEYS.inboundReceipt, String(inboundReceiptId));
    }

    setSearchParams(next);
  };

  /**
   * 라인을 고르고 푼다(수명 표 5행). **지금 주소에서 시작한다** — 조건·쪽·고른 전표를 그대로 두고
   * `line`만 바꾼다.
   *
   * **한 줄만 고른다** — 다른 줄을 고르면 앞 선택이 풀린다(`line-select.ts`).
   */
  const toggleSelectLine = (inboundReceiptLineId: number): void => {
    const nextLineId = nextSelectedLineId(selectedLineId, inboundReceiptLineId);

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);

      if (nextLineId === null) next.delete(SELECTION_KEYS.line);
      else next.set(SELECTION_KEYS.line, String(nextLineId));

      return next;
    });
  };

  const supplierReference = toReference(
    suppliers,
    filters.supplier === '' ? null : Number(filters.supplier),
  );

  /**
   * 참조 실패의 복구 경로 — **이름이 보이는 자리마다 하나씩** 둔다(계획 결정 17).
   * 안내 문구가 적은 대상과 다시 부르는 대상이 어긋나면, 눌러도 한쪽은 실패인 채로 남는데
   * 문구는 둘 다 고쳐질 것처럼 말한다.
   */
  const retryTopReferences = (): void => {
    suppliers.refetch();
  };

  const retryLineReferences = (): void => {
    items.refetch();
    uoms.refetch();
    lots.refetch();
    plants.refetch();
  };

  /** 아래 구획. 넷 중 하나만 낸다 — 사용자가 할 조치가 서로 다르다. */
  const linePane = (): ReactNode => {
    if (selectedIrId === null) {
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
     * 말하는데 기다려서 풀리지 않는다.**
     *
     * 라인 값을 받아도 구획을 열 수 없다 — **제목줄이 쓰는 전표의 값이 목록 응답에만 있다.**
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
      <>
        <IrLineTable
          inboundReceipt={selectedRow}
          supplierName={describeReference(toReference(suppliers, selectedRow.supplierId))}
          rows={lineRows}
          isLoading={lines.isPending}
          /*
           * 공장·품목·단위·LOT은 **이름이 아니라 참조 자체**를 넘긴다 — 이 구획이 실패 안내와
           * 다시 시도를 소유하므로 실패 여부를 함께 알아야 한다. 공급사는 위 구획이 소유해
           * 이름만 넘긴다.
           */
          plantLookup={plants}
          itemLookup={items}
          uomLookup={uoms}
          lotLookup={lots}
          selectedLineId={selectedLineId}
          selectedLine={selectedLine}
          onToggleSelect={toggleSelectLine}
          onRetryReferences={retryLineReferences}
        />

        {/*
         * **아직 없는 것을 밝힌다.** 이 PR은 대상을 고르는 데까지이고 입고 처리 입력은
         * PR ②에서 이 아래에 붙는다 — 밝히지 않으면 비어 있는 아래쪽이 고장으로 읽힌다.
         */}
        {selectedLine !== null && <p className="field-note">{t.notes.postPending}</p>}
      </>
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
        <IrFilterBar
          appliedFilters={filters}
          supplierOptions={toSelectOptions(suppliers)}
          chipNames={{ supplier: describeReference(supplierReference) }}
          supplierNote={lookupNote(suppliers)}
          onSearch={(nextFilters) => {
            applyQuery(nextFilters);
          }}
          onRemoveFilter={(key: ChipFilterKey) => {
            applyQuery(clearFilter(filters, key));
          }}
          onReset={() => {
            applyQuery(DEFAULT_FILTERS);
          }}
        />

        {!list.isError && (
          <>
            <IrTable
              rows={rows}
              isLoading={list.isPending}
              isBeyondLast={pageView.isBeyondLast}
              selectedIrId={selectedIrId}
              supplierLookup={suppliers}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              onToggleSelect={toggleSelectIr}
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
