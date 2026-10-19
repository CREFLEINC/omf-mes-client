/**
 * W-01-10 정상품 입하 처리
 * 유형: T-W-C 처리형 (작업함: GoodsReceiptWorklist, 처리 화면: GoodsReceiptProcess)
 * 이탈:
 * - T-W-C 작업함 페이지 머리 「처리 대기 N건」, 조회 조건 「처리 대기만」 기본 켬, 목록 「처리 대기 수」 열:
 *   두지 않았다. 입하 목록 계약에 처리 대기 건수·조건·라인 수가 없다(C-4 — 늘 쓸 수 없는 기능은 두지 않는다).
 * - 설계 스펙 §3(좌우 2단)과 다르다. 규범 1장이 처리 부분을 처리 화면으로 분리하게 한다.
 *   설계 요청서를 남겼다(구성안 COMPOSITION.md).
 */
import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { LoadErrorBanner } from '../../patterns/load-error-banner';
import { PageNav, toPageView } from '../../patterns/page-nav';
import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  toFilterQuery,
  toSearchParams,
  type ChipFilterKey,
  type IrFilters,
} from './filters';
import { IrFilterBar } from './ir-filter-bar';
import { IrTable } from './ir-table';
import { describeReference, toReference, useSupplierOptions, type LookupResult } from './lookups';
import { useInboundReceipts } from './queries';
import type { IrView, SelectOption } from './types';

const t = messages.goodsReceipt;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: IrView[] = [];

/** 작업함 경로. 처리 화면은 그 아래(`/:inboundReceiptNo`)에 선다(T-W-C). */
export const WORKLIST_PATH = '/logistics/goods-receipt';

/** 처리 화면 경로. 대상 번호(입하번호)가 주소에 남아 새로고침·공유가 같은 전표를 연다. */
export const processPath = (inboundReceiptNo: string): string =>
  `${WORKLIST_PATH}/${encodeURIComponent(inboundReceiptNo)}`;

/**
 * 처리 화면으로 넘기는 이동 상태. 작업함에서 왔다는 표식이 있으면 [← 작업함]이 브라우저 뒤로가기와
 * 같은 결과(조건·쪽이 그대로인 작업함)를 낸다.
 */
export interface FromWorklistState {
  fromWorklist: true;
}

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
 * W-01-10 작업함 — 처리할 입하 전표를 고르는 목록.
 *
 * 페이지 머리 → 조회 조건 한 줄 → 목록(행 전체 클릭으로 처리 화면 이동) → 쪽 이동.
 * 조회 조건과 쪽은 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **조건이 하나도 없어도 조회한다.** 들어오자마자 받아들일 수 있는 입하가 보여야 무엇을 고를 수
 * 있는지 안다. **기본 기간을 심지 않는다** — 첫 요청에 날짜 조건이 실리지 않는다(계획 결정 6).
 */
export const GoodsReceiptWorklist = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   */
  const filters = useMemo<IrFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const listQuery = { ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = useInboundReceipts(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 });

  const suppliers = useSupplierOptions();
  const supplierReference = toReference(
    suppliers,
    filters.supplier === '' ? null : Number(filters.supplier),
  );

  /** 조건과 쪽을 **한 번에** 주소로 옮긴다 — 따로 바꾸면 뒤로가기 기록이 두 칸 는다. */
  const applyQuery = (nextFilters: IrFilters, nextPage = 1): void => {
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  const open = (row: IrView): void => {
    const state: FromWorklistState = { fromWorklist: true };

    void navigate(processPath(row.inboundReceiptNo), { state });
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
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
              supplierLookup={suppliers}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              onOpen={open}
              onRetryReferences={() => {
                suppliers.refetch();
              }}
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
    </>
  );
};
