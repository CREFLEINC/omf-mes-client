import { AlertBanner, Breadcrumb, PageHeader, type SortState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useBusinessUnitOptions,
  useCustomerOptions,
  useShipToPartnerOptions,
  type DataScope,
  type LookupResult,
} from './lookups';
import { ErpChips } from './erp-chips';
import { ShipmentSection } from './shipment-section';
import { useLinkedRequest } from './shipment-queries';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import {
  EMPTY_PERIOD,
  readPeriod,
  toPeriodQuery,
  validatePeriod,
  type PeriodInput,
} from './period';
import { PrintPreviewDialog } from './print-preview';
import {
  useItemLabels,
  useShipmentRequestDetail,
  useShipmentScheduleList,
} from './queries';
import { RequestDetailDialog } from './request-detail-dialog';
import { sessionKeys, type Session } from '../../patterns/session';
import { ShipmentFilterBar } from './shipment-filter-bar';
import { ShipmentTable } from './shipment-table';
import { nextSortKey, readSortKey, toSortQuery } from './sort';
import { SHIPMENT_PROGRESS_CODES } from './status-options';
import type { SelectOption, ShipmentRequestView } from './types';
import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  toFilterQuery,
  toSearchParams,
  type ShipmentFilters,
} from './filters';

const t = messages.shipmentSchedule;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: ShipmentRequestView[] = [];
const NO_SCOPES: readonly DataScope[] = [];
const NO_COUNTS: Readonly<Record<string, number>> = {};

const POSITIVE_INTEGER = /^\d+$/;

/** 주소의 번호 — 양의 정수만 받는다(결재함 [열기] · 옛 주소 `/shipment/shipment-confirm`). */
const readLinkId = (raw: string | null): number | null =>
  raw !== null && POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;

/**
 * 「출하 취소(송신 전)」(`W-04-12`) 권한 — 취소 요청 · 실행 · 미확정 확정을 이 화면이 맡는다(피처 012 R-6 · FR-024).
 * 세션이 권한 목록을 주지 않았으면(모름) 막지 않는다 — 서버가 403 으로 막는다(`web-access.ts` 와 같은 규율).
 */
const CANCEL_PERMISSION = 'W-04-12';

const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.label,
  }));

/**
 * W-04-02 컨테이너 — **출하(도메인 04)의 첫 화면**이다.
 *
 * 조회 전용이라 편집 폼이 없고, 행 클릭으로 다른 화면(편성·출하 확정)으로 이동하는 액션도
 * 없다 — 그 화면들(`W-04-01`·`W-04-04`)이 이 저장소에 아직 없다(계획서 미결).
 *
 * 조회 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
 *
 * | # | 조작 | `page` | 왜 |
 * | :-: | --- | --- | --- |
 * | 1 | 조건·기간·정렬 변경 · 초기화 | **첫 쪽으로** | 결과가 통째로 달라진다 |
 * | 2 | 쪽 이동 | 옮긴 쪽 | 다른 행이 온다 |
 *
 * 이 화면은 선택(행 고르기) 개념이 없어 W-01-09의 수명 표 3·4행이 성립하지 않는다.
 */
export const ShipmentScheduleScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  /*
   * 인쇄한 사람 — 로그인 세션의 사용자 이름(시안 Print-Preview). 세션 공급자 밖에서 그리는 시험도 있어
   * 던지는 `useSession` 대신 이미 받아 둔 세션 값을 읽는다(없으면 빈 값).
   */
  const session = useQueryClient().getQueryData<Session>(sessionKeys.current) ?? null;

  const period = useMemo<PeriodInput>(() => readPeriod(searchParams), [searchParams]);
  const filters = useMemo<ShipmentFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const sortKey = readSortKey(searchParams.get('sort'));

  /*
   * **출하일 시작이 없으면 조회하지 않는다**(L-3 필수) — W-01-09와 반대다. `periodReason`이
   * `null`이 아니면 그 사유를 조건 줄이 이미 밝히므로 여기서 되풀이하지 않는다.
   */
  const periodReason = validatePeriod(period);
  const listQuery =
    periodReason === null
      ? {
          ...toPeriodQuery(period),
          ...toFilterQuery(filters),
          ...toSortQuery(sortKey),
          ...(page > 1 ? { page } : {}),
        }
      : null;

  const list = useShipmentScheduleList(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const customers = useCustomerOptions();
  const shipToPartners = useShipToPartnerOptions();
  /* 피처 012 — 사업부 거르기 선택지(계정 범위) · 「출하」 칸 권한. */
  const scopes = session?.scopes ?? NO_SCOPES;
  const businessUnits = useBusinessUnitOptions(scopes);
  const canAct =
    session?.permissions === undefined || session.permissions.includes(CANCEL_PERMISSION);
  /* 피처 010 — 지시서 상세 창 · 인쇄 미리 보기. */
  const [detailRequestId, setDetailRequestId] = useState<number | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const requestDetail = useShipmentRequestDetail(detailRequestId);
  const itemLabel = useItemLabels((requestDetail.data?.lines ?? []).map((line) => line.itemId));

  /*
   * 피처 012 FR-021 · R-7 — 결재함 [열기](`?approvalRequestId=`)와 옛 주소(`?shipmentId=`)로 들어오면 그 출하의 지시서
   * 상세를 연다. 목록 기간과 무관하게 연다(빈 곳 ⑦).
   */
  const linkApprovalId = readLinkId(searchParams.get('approvalRequestId'));
  const linkShipmentId = readLinkId(searchParams.get('shipmentId'));
  const linked = useLinkedRequest({ approvalRequestId: linkApprovalId, shipmentId: linkShipmentId });
  const [openedFrom, setOpenedFrom] = useState<'approval' | 'shipment' | null>(null);

  useEffect(() => {
    if (linked.data === undefined || linked.data === null) return;

    setIsPrinting(false);
    setDetailRequestId(linked.data.shipmentRequestId);
    setOpenedFrom(linkApprovalId === null ? 'shipment' : 'approval');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked.data]);

  const linkMissing =
    (linkApprovalId !== null || linkShipmentId !== null) &&
    (linked.isError || (linked.isSuccess && linked.data === null));

  /* 열어 둔 지시서가 목록 기간 밖이면 목록 위에 띠로 알린다 — 목록에서 그 줄을 찾지 못해 헤매지 않게(빈 곳 ⑦). */
  const openedOutOfPeriod =
    openedFrom !== null &&
    requestDetail.data !== undefined &&
    requestDetail.data.shipmentRequestId === detailRequestId &&
    (requestDetail.data.requestedShipDate < period.from ||
      (period.to !== '' && requestDetail.data.requestedShipDate > period.to));
  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   * **조건·정렬이 바뀌면 쪽을 첫 쪽으로 되돌린다** — 3쪽을 보다가 조건을 좁히거나 정렬을
   * 바꾸면 결과가 3쪽에 못 미쳐 사용자에게는 「아무것도 없다」로 보인다.
   */
  const applyQuery = (
    nextPeriod: PeriodInput,
    nextFilters: ShipmentFilters,
    nextSort: ReturnType<typeof readSortKey>,
    nextPage = 1,
  ): void => {
    setSearchParams(toSearchParams(nextPeriod, nextFilters, nextSort, nextPage));
  };

  const changeSort = (next: SortState | null): void => {
    applyQuery(period, filters, nextSortKey(sortKey, next));
  };

  const customerReference = toReference(
    customers,
    filters.customer === '' ? null : Number(filters.customer),
  );
  const shipToPartnerReference = toReference(
    shipToPartners,
    filters.shipToPartner === '' ? null : Number(filters.shipToPartner),
  );

  const retryReferences = (): void => {
    customers.refetch();
    shipToPartners.refetch();
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

      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      <section className="pane shipment-schedule-pane" aria-label={t.panes.list}>
        <ShipmentFilterBar
          appliedPeriod={period}
          appliedFilters={filters}
          businessUnitOptions={toSelectOptions(businessUnits)}
          businessUnitNote={lookupNote(businessUnits)}
          customerOptions={toSelectOptions(customers)}
          shipToPartnerOptions={toSelectOptions(shipToPartners)}
          progressOptions={SHIPMENT_PROGRESS_CODES}
          chipNames={{
            customer: describeReference(customerReference),
            shipToPartner: describeReference(shipToPartnerReference),
          }}
          customerNote={lookupNote(customers)}
          shipToPartnerNote={lookupNote(shipToPartners)}
          onSearch={(nextPeriod, nextFilters) => {
            applyQuery(nextPeriod, nextFilters, sortKey);
          }}
          onRemoveFilter={(key) => {
            applyQuery(period, { ...filters, [key]: '' }, sortKey);
          }}
          onReset={() => {
            applyQuery(EMPTY_PERIOD, EMPTY_FILTERS, null);
          }}
        />

        {/* 피처 012 FR-018 — ERP 송신 칩(건수). 누르면 곧바로 거른다 — 조건 줄의 [조회]를 거치지 않는다. */}
        {listQuery !== null && (
          <ErpChips
            counts={list.data?.erpSendStatusCounts ?? NO_COUNTS}
            selected={filters.erp}
            onSelect={(erp) => {
              applyQuery(period, { ...filters, erp }, sortKey);
            }}
          />
        )}

        {linkMissing && <AlertBanner variant="warning" title={t.bu012.linkedNotFound} />}
        {openedOutOfPeriod && requestDetail.data !== undefined && (
          <AlertBanner
            variant="info"
            title={t.bu012.outOfPeriod(requestDetail.data.shipmentRequestNo)}
          />
        )}

        {!list.isError && (
          <>
            <ShipmentTable
              rows={rows}
              erpFiltered={filters.erp !== ''}
              isLoading={list.isPending && listQuery !== null}
              hasQuery={listQuery !== null}
              isBeyondLast={pageView.isBeyondLast}
              sortKey={sortKey}
              onSortChange={changeSort}
              customerLookup={customers}
              shipToPartnerLookup={shipToPartners}
              onFirstPage={() => {
                applyQuery(period, filters, sortKey);
              }}
              onRetryReferences={retryReferences}
              onOpenDetail={(shipmentRequestId) => {
                setIsPrinting(false);
                setDetailRequestId(shipmentRequestId);
              }}
            />
            {listQuery !== null && !list.isPending && (
              <PageNav
                view={pageView}
                onChange={(nextPage) => {
                  applyQuery(period, filters, sortKey, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>

      {/*
        ⛔ 「출하 담당 공장」 지정 창을 없앴다(피처 012 D-1 · FR-007) — 서버가 공장 지정 PUT 을 지웠다.
        지시서는 사업부에 속하고 줄마다 출고 창고를 W-04-01 에서 정한다.
      */}

      {detailRequestId !== null && !isPrinting && (
        <RequestDetailDialog
          detail={requestDetail.data}
          isLoading={requestDetail.isPending}
          error={requestDetail.isError ? requestDetail.error : null}
          onRetry={() => {
            void requestDetail.refetch();
          }}
          customerName={describeReference(
            toReference(customers, requestDetail.data?.customerId ?? null),
          )}
          shipToPartnerName={describeReference(
            toReference(shipToPartners, requestDetail.data?.shipToPartnerId ?? null),
          )}
          linkedBanner={
            openedFrom === 'approval' ? (
              <AlertBanner variant="info" title={t.bu012.fromApproval}>
                {t.bu012.fromApprovalNote}
              </AlertBanner>
            ) : null
          }
          shipmentSection={
            requestDetail.data === undefined ? null : (
              <ShipmentSection request={requestDetail.data} canAct={canAct} />
            )
          }
          itemLabel={itemLabel}
          onPrint={() => {
            setIsPrinting(true);
          }}
          onClose={() => {
            setDetailRequestId(null);
            setOpenedFrom(null);
          }}
        />
      )}

      {detailRequestId !== null && isPrinting && requestDetail.data !== undefined && (
        <PrintPreviewDialog
          detail={requestDetail.data}
          names={{
            customer: describeReference(toReference(customers, requestDetail.data.customerId)),
            shipToPartner: describeReference(
              toReference(shipToPartners, requestDetail.data.shipToPartnerId),
            ),
            businessUnit:
              requestDetail.data.businessUnit?.businessUnitName ?? t.bu012.noBusinessUnit,
            item: (itemId) => itemLabel(itemId) ?? String(itemId),
            printedBy: session?.userName ?? '',
          }}
          onClose={() => {
            setIsPrinting(false);
          }}
        />
      )}
    </>
  );
};
