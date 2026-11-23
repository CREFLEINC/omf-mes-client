import { SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { ItemPickerDialog, type ItemRow } from '../../patterns/item-picker';
import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { SaveErrorBanner } from '../../patterns/master';
import { useSession } from '../../patterns/session';
import { AssignmentFormPane } from './assignment-form-pane';
import { EmptyFormPlaceholder } from './empty-form-placeholder';
import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  readTarget,
  targetModeOf,
  toSearchParams,
  toSourceFilterQuery,
  type FilterChip,
  type SourceFilters,
} from './filters';
import {
  appendItemLines,
  clearWarehousesOutside,
  emptyLineDraft,
  lineDraftsFromSalesOrder,
  patchLineDraft,
  removeLineDraft,
  setLineWarehouse,
  splitLineDraft,
} from './line-draft';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useAvailableQty,
  useBusinessUnitOptions,
  useCustomerOptions,
  useItemNames,
  useShipToPartnerOptions,
  useUomOptions,
  useWarehouseOptions,
  type DataScope,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { useSalesOrderDetail, useSalesOrderList } from './source-queries';
import { SourceFilterBar } from './source-filter-bar';
import { SourceListTable } from './source-list-table';
import { toShipmentRequestCreateBody } from './shipment-request-create-body';
import { useShipmentRequestCreateMutation } from './mutations';
import type {
  CreatedShipmentRequestView,
  SalesOrderView,
  SelectOption,
  ShipmentRequestLineDraft,
} from './types';
import {
  hasAllocatableLine,
  linesMissingWarehouse,
  splitGroupsOf,
  validateHeader,
  validateLines,
} from './validation';
import './layout.css';

const t = messages.shipmentRequestCreate;

/**
 * 품목 선택 팝업이 처음 세우는 유형 — **제품**.
 *
 * ⛔ **값 «목록»이 아니라 업무 결정 하나다.** 선택지는 코드 그룹(`ITEM_TYPE`)에서 받고(공유계약
 *    G-32), 화면이 아는 것은 「기본으로 무엇을 보일까」 하나다. 근거는 도메인 04 의 이름
 *    「제품출하」와 설계 `W-04-01` §5-5(가용 = 완제품 창고의 가용 잔액).
 * ⚠ 이 코드가 그 환경의 코드 그룹에 없으면 팝업은 「전체」로 떨어진다 — 길을 막지 않는다.
 */
const SHIPPABLE_ITEM_TYPE_CODE = 'FINISHED';

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: SalesOrderView[] = [];
const NO_SCOPES: readonly DataScope[] = [];

const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({ value: entry.value, label: entry.label }));

interface HeaderDraft {
  businessUnitId: string;
  customerId: string;
  shipToPartnerId: string;
  requestedShipDate: string;
}

const EMPTY_HEADER_DRAFT: HeaderDraft = {
  businessUnitId: '',
  customerId: '',
  shipToPartnerId: '',
  requestedShipDate: '',
};

/**
 * 방금 나간 편성이 겨눈 대상 — **어느 대상을 위한 시도인가**와 **그것이 만들어졌는가**를 함께
 * 든다. 지시서 경유는 지시서 번호로, 단독 생성은 그 자체로 하나의 대상이다.
 */
type TargetSignature = `order:${string}` | 'standalone' | 'none';

interface CreatedBinding {
  targetSignature: TargetSignature;
  result: CreatedShipmentRequestView;
}

/**
 * W-04-01 컨테이너 — **ERP S/O 로 출하작업지시를 편성하거나, ERP S/O 없이 직접
 * 만드는 화면**이다.
 *
 * 좌측은 출하지시서(SalesOrder) 목록(필터+페이지이동), 우측은 편성 폼이다. **두 모드가
 * `POST /logistics/shipment-requests` 하나를 공유한다** — `salesOrderId`를 비우면 단독
 * 생성이다(계약 설명).
 *
 * 조회 조건·쪽은 주소가 소유한다. **편성 대상(`so`·`mode`)도 주소가 소유하되 조건과는 독립
 * 이다** — 조건을 바꿔도 편성 중인 대상은 사라지지 않는다(`filters.ts`의 `TARGET_KEYS` 설명).
 *
 * **되돌릴 수 없는 쓰기를 두 겹으로 막는다.** ① 전송 중 잠금 ② 성공 뒤 폼 잠금. 이 화면에는
 * 확인 창이 없다 — 계획서의 작업 슬라이스 목록에 그 부품이 없고, 검증 수준도 「보통」으로
 * 낙관적 잠금이 걸리는 상태 전이가 아닌 단순 생성이라 판정됐다.
 *
 * **되먹임은 대상 매임을 지난다**(`boundCreated`). 나가는 중에 사용자가 다른 지시서로
 * 옮겨 간 뒤 늦게 도착한 성공이 새 대상 위에 「편성했습니다」로 서지 않게 한다.
 */
export const ShipmentRequestCreateScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = readFilters(searchParams);
  const page = readPage(searchParams);
  const target = readTarget(searchParams);
  const mode = targetModeOf(target);

  const targetSignature: TargetSignature =
    target.kind === 'order' ? `order:${String(target.salesOrderId)}` : target.kind;

  const listQuery = { ...toSourceFilterQuery(filters), ...(page > 1 ? { page } : {}) };
  const list = useSalesOrderList(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const targetSalesOrderId = target.kind === 'order' ? target.salesOrderId : null;
  const detail = useSalesOrderDetail(targetSalesOrderId);

  const customers = useCustomerOptions();
  /*
   * ⭐ 사업부·출고 창고 선택지는 계정 데이터 범위 안이다(피처 012 FR-002·003) — 서버도 범위 밖을 403 으로 막는다.
   */
  const { session } = useSession();
  const scopes = session?.scopes ?? NO_SCOPES;
  const businessUnits = useBusinessUnitOptions(scopes);
  const warehouses = useWarehouseOptions(scopes);
  const shipToPartners = useShipToPartnerOptions();
  const uoms = useUomOptions();

  const [header, setHeader] = useState<HeaderDraft>(EMPTY_HEADER_DRAFT);
  const [lines, setLines] = useState<ShipmentRequestLineDraft[]>([]);
  /**
   * 품목 선택 팝업이 열려 있는가 — **여는 자리가 둘이다.**
   *
   * - `{ kind: 'add' }` 「라인 추가」에서 열었다. 고른 품목마다 줄이 붙는다(여러 개).
   * - `{ kind: 'replace', key }` 그 줄의 품목 셀에서 열었다. 하나만 고르고 그 줄을 바꾼다.
   *
   * ⛔ **줄 초안에 넣지 않는다.** 서버로 나가는 값이 아니라 「지금 무엇을 고르는 중인가」다.
   */
  const [picker, setPicker] = useState<{ kind: 'add' } | { kind: 'replace'; key: string } | null>(
    null,
  );

  const items = useItemNames(
    lines.map((line) => (line.itemId === '' ? null : Number(line.itemId))),
  );

  /* 고른 창고 기준 가용(피처 012 FR-006a) — 품목 × 창고. */
  const availableQty = useAvailableQty(
    lines.map((line) => ({
      itemId: line.itemId === '' ? null : Number(line.itemId),
      warehouseId: line.warehouseId === '' ? null : Number(line.warehouseId),
    })),
  );

  /**
   * **나가는 중인 쓰기는 건드리지 않는다.** 공통 훅의 `reset()`은 진행 중 mutation에서
   * 옵저버를 떼어 낸다 — 응답이 이미 서버에 갔는데 화면만 없던 일로 치면 안 된다.
   */
  const resetIfIdle = (write: { isSaving: boolean; reset: () => void }): void => {
    if (write.isSaving) return;

    write.reset();
  };

  const [createdBinding, setCreatedBinding] = useState<CreatedBinding | null>(null);
  const submittingTargetRef = useRef<TargetSignature | null>(null);

  const create = useShipmentRequestCreateMutation({
    onSuccess: (result) => {
      const boundSignature = submittingTargetRef.current;

      setCreatedBinding(
        boundSignature === null ? null : { targetSignature: boundSignature, result },
      );
    },
  });

  /** 지시서 경유 — 상세가 도착하면 고객·납품처·잔여 라인을 승계한다(완료 조건 C2). */
  useEffect(() => {
    if (targetSalesOrderId === null) return;
    if (detail.data === undefined) return;

    setHeader({
      businessUnitId: '',
      customerId: String(detail.data.customerId),
      shipToPartnerId: String(detail.data.shipToPartnerId),
      requestedShipDate: '',
    });
    setLines(lineDraftsFromSalesOrder(detail.data.lines));
    resetIfIdle(create);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSalesOrderId, detail.data]);

  /**
   * ⭐ 계정 범위의 사업부가 하나면 채워서 연다(피처 012 FR-002 · US1-1). 사람이 고른 값은 덮지 않는다 —
   *    비어 있을 때만 채운다. 대상을 바꿔 머리가 비면 다시 채운다.
   */
  const onlyBusinessUnit =
    businessUnits.entries.length === 1 ? (businessUnits.entries[0]?.value ?? '') : '';
  const businessUnitAutoFilled =
    onlyBusinessUnit !== '' && header.businessUnitId === onlyBusinessUnit;

  useEffect(() => {
    if (onlyBusinessUnit === '' || header.businessUnitId !== '') return;

    setHeader((prev) => (prev.businessUnitId === '' ? { ...prev, businessUnitId: onlyBusinessUnit } : prev));
  }, [onlyBusinessUnit, header.businessUnitId, targetSignature]);

  const isStandalone = target.kind === 'standalone';

  /** 단독 생성 — 처음 시작할 때만 빈 초안을 세운다(완료 조건 C3). */
  useEffect(() => {
    if (!isStandalone) return;

    setHeader(EMPTY_HEADER_DRAFT);
    setLines([emptyLineDraft()]);
    resetIfIdle(create);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStandalone]);

  /**
   * **지금 이 대상에 대해 말할 편성이 있는가.** 대상을 바꾼 뒤 도착하는 응답이 실재하므로,
   * 이 문을 지나지 않으면 시도한 적 없는 대상 위에 「편성했습니다」가 선다.
   */
  const boundCreated =
    createdBinding !== null && createdBinding.targetSignature === targetSignature
      ? createdBinding.result
      : null;

  const isSaving = create.isSaving;
  const isLocked = isSaving || boundCreated !== null;

  const headerLocalErrors = mode === null ? {} : validateHeader(mode, header);
  const lineValidation = validateLines(lines);
  /* 빈 칸에서는 로컬 판정이 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다. */
  const headerErrors = { ...create.fieldErrors, ...headerLocalErrors };

  const salesOrderNo = target.kind === 'order' ? (detail.data?.salesOrderNo ?? null) : null;
  const splitGroups = splitGroupsOf(lines);
  const missingWarehouse = linesMissingWarehouse(lines);

  /** 막는 사유에 적을 라인 번호 — 나눈 줄은 「n(나눈 줄)」(시안 W0401-After). */
  const rowTagsOf = (keys: readonly string[]): string =>
    lines
      .flatMap((line, index) =>
        keys.includes(line.key)
          ? [line.splitOf === null ? String(index + 1) : t.actionReasons.splitRowTag(index + 1)]
          : [],
      )
      .join(', ');

  const submitBlockReason = (): string | null => {
    if (boundCreated !== null) return t.actionReasons.alreadySubmitted;
    if (isSaving) return t.actionReasons.saving;
    if (target.kind === 'none') return t.actionReasons.noTarget;
    if (target.kind === 'order' && (detail.data === undefined || detail.isError)) {
      return t.actionReasons.noTarget;
    }
    /* 피처 012 — 사업부 → S/O 잔여 초과 → 창고 빈 줄 차례(시안 W0401-After). */
    if (header.businessUnitId === '') return t.actionReasons.businessUnitMissing;
    if (!hasAllocatableLine(lines)) return t.actionReasons.noAllocatedLine;
    if (Object.keys(lineValidation.errors).some((key) => !key.endsWith('.warehouseId'))) {
      return t.actionReasons.lineInvalid;
    }
    const overGroups = splitGroups.filter((group) => group.isOver);
    if (overGroups.length > 0) {
      return t.actionReasons.splitOverRemaining(
        overGroups
          .map((group) =>
            salesOrderNo === null || group.salesOrderLineNo === null
              ? t.values.empty
              : t.lineTable.salesOrderLineRef(salesOrderNo, group.salesOrderLineNo),
          )
          .join(', '),
      );
    }
    if (missingWarehouse.length > 0) {
      return t.actionReasons.warehouseMissing(rowTagsOf(missingWarehouse.map((line) => line.key)));
    }
    /*
     * ⛔ **아직 안 채운 칸도 편성을 막는다** — 막는 것과 «줄마다 붉게 적는 것»은 다른 일이다
     *    (사용자 지시 2026-09-18). 여기서 말하지 않으면 단추가 열린 채 눌리고, 본문 조립이
     *    `null` 을 내어 **아무 일도 일어나지 않는다.**
     */
    if (lineValidation.isIncomplete) return t.actionReasons.lineIncomplete;
    if (Object.keys(headerLocalErrors).length > 0) return t.actionReasons.headerIncomplete;

    return null;
  };

  const changeHeader = (patch: Partial<HeaderDraft>): void => {
    setHeader((prev) => ({ ...prev, ...patch }));

    /*
     * ⭐ 사업부를 바꾸면 그 사업부 밖 창고를 고른 줄의 창고를 비운다(피처 012 FR-004 · US1-7).
     */
    if (patch.businessUnitId !== undefined && patch.businessUnitId !== header.businessUnitId) {
      const allowed = new Set(
        warehouses.selectable(patch.businessUnitId).map((entry) => entry.value),
      );

      setLines((prev) => clearWarehousesOutside(prev, allowed));
    }

    for (const field of Object.keys(patch)) create.clearFieldError(field);
  };

  const changeWarehouse = (key: string, warehouseId: string): void => {
    setLines((prev) => setLineWarehouse(prev, key, warehouseId));
  };

  const splitLine = (key: string): void => {
    setLines((prev) => splitLineDraft(prev, key));
  };

  const patchLine = (key: string, patch: Partial<Omit<ShipmentRequestLineDraft, 'key'>>): void => {
    setLines((prev) => patchLineDraft(prev, key, patch));
  };

  const removeLine = (key: string): void => {
    setLines((prev) => removeLineDraft(prev, key));
  };

  /*
   * ⭐ **「라인 추가」가 팝업을 연다**(사용자 결정 2026-09-18). 빈 줄을 먼저 만들고 그 안에서
   *    품목을 고르던 종전 방식은, 품목 마스터 9,269건을 표 안 선택칸에 담을 수 없어 무너졌다.
   */
  const addLine = (): void => {
    setPicker({ kind: 'add' });
  };

  /** 고른 품목들을 줄로 만든다 — 여는 자리에 따라 붙이거나 바꾼다. */
  const applyPickedItems = (chosen: readonly ItemRow[]): void => {
    const target = picker;

    setPicker(null);
    if (target === null || chosen.length === 0) return;

    if (target.kind === 'add') {
      /* 새 줄의 창고는 첫 줄 창고다(피처 012 FR-004). */
      setLines((prev) => appendItemLines(prev, chosen));

      return;
    }

    /*
     * ⚠ **바꿀 때 단위도 함께 바꾼다.** 품목이 달라지면 앞 품목의 기준 단위가 남을 이유가 없다 —
     *   남기면 담당이 고치지 않는 한 엉뚱한 단위로 나간다.
     */
    const [first] = chosen;

    if (first === undefined) return;

    setLines((prev) =>
      patchLineDraft(prev, target.key, {
        itemId: String(first.itemId),
        uomId: String(first.baseUomId),
      }),
    );
  };

  /** 확인 창 없이 곧바로 보낸다 — 전송 중 잠금과 성공 후 잠금 두 겹이 연타를 막는다(계획서). */
  const submit = (): void => {
    if (mode === null) return;

    const body = toShipmentRequestCreateBody({
      mode,
      salesOrderId: target.kind === 'order' ? target.salesOrderId : null,
      businessUnitId: header.businessUnitId,
      customerId: header.customerId,
      shipToPartnerId: header.shipToPartnerId,
      requestedShipDate: header.requestedShipDate,
      lines,
    });

    if (body === null) return;

    submittingTargetRef.current = targetSignature;
    create.write(body);
  };

  const applyFilters = (nextFilters: SourceFilters): void => {
    setSearchParams(toSearchParams(nextFilters, 1, target));
  };

  const changePage = (nextPage: number): void => {
    setSearchParams(toSearchParams(filters, nextPage, target));
  };

  const removeFilter = (key: FilterChip['key']): void => {
    const next: SourceFilters =
      key === 'customer'
        ? { ...filters, customer: '' }
        : key === 'period'
          ? { ...filters, orderDateFrom: '', orderDateTo: '' }
          : { ...filters, unassignedOnly: false };

    setSearchParams(toSearchParams(next, 1, target));
  };

  const selectSalesOrder = (salesOrderId: number): void => {
    setSearchParams(
      toSearchParams(filters, page, { kind: 'order', salesOrderId, mode: 'fromOrder' }),
    );
  };

  const startStandalone = (): void => {
    setSearchParams(toSearchParams(filters, page, { kind: 'standalone', mode: 'standalone' }));
  };

  const businessUnitName = describeReference(
    toReference(businessUnits, header.businessUnitId === '' ? null : Number(header.businessUnitId)),
  );
  const selectableWarehouses = warehouses.selectable(header.businessUnitId);
  /* 선택지는 사업부 하나로 묶어 그 이름을 제목으로 단다(시안 「사업부 X 활성 창고(불량창고 제외)」). */
  const warehouseOptions =
    selectableWarehouses.length === 0
      ? []
      : [
          {
            label: t.lineTable.warehouseGroup(businessUnitName),
            options: selectableWarehouses.map((entry) => ({ value: entry.value, label: entry.label })),
          },
        ];

  const rightColumn = (): ReactNode => {
    if (target.kind === 'none') {
      return (
        <section className="pane">
          <EmptyFormPlaceholder onStartStandalone={startStandalone} />
        </section>
      );
    }

    if (target.kind === 'order') {
      if (detail.isError) {
        return (
          <section className="pane" aria-label={t.panes.header}>
            <LoadErrorBanner
              error={detail.error}
              onRetry={() => {
                void detail.refetch();
              }}
            />
          </section>
        );
      }

      if (detail.data === undefined) {
        return (
          <section className="pane" aria-label={t.panes.header}>
            <div role="status" aria-label={t.loading.sourceDetail}>
              <SkeletonText lines={4} />
            </div>
          </section>
        );
      }
    }

    return (
      <AssignmentFormPane
        mode={mode ?? 'standalone'}
        customerId={header.customerId}
        businessUnitId={header.businessUnitId}
        shipToPartnerId={header.shipToPartnerId}
        requestedShipDate={header.requestedShipDate}
        customerOptions={toSelectOptions(customers)}
        businessUnitOptions={toSelectOptions(businessUnits)}
        businessUnitAutoFilled={businessUnitAutoFilled}
        shipToPartnerOptions={toSelectOptions(shipToPartners)}
        customerLookup={customers}
        businessUnitNote={lookupNote(businessUnits)}
        shipToPartnerLookup={shipToPartners}
        customerNote={lookupNote(customers)}
        shipToPartnerNote={lookupNote(shipToPartners)}
        headerErrors={headerErrors}
        onChangeHeader={changeHeader}
        lines={lines}
        lineErrors={lineValidation.errors}
        itemNames={items}
        onPickItem={(key) => {
          setPicker({ kind: 'replace', key });
        }}
        uomLookup={uoms}
        uomOptions={toSelectOptions(uoms)}
        availableQty={availableQty}
        onPatchLine={patchLine}
        onRemoveLine={removeLine}
        onAddLine={addLine}
        warehouseOptions={warehouseOptions}
        onChangeWarehouse={changeWarehouse}
        onSplit={splitLine}
        salesOrderNo={salesOrderNo}
        splitGroups={splitGroups}
        warehouseNameOf={warehouses.nameOf}
        clearedWarehouseCount={lines.filter((line) => line.warehouseCleared).length}
        businessUnitName={businessUnitName}
        isLocked={isLocked}
        submitBlockReason={submitBlockReason()}
        banner={<SaveErrorBanner error={create.error} />}
        created={boundCreated}
        onSubmit={submit}
      />
    );
  };

  return (
    <>
      {/* 통일 배치(#350) — 제목 줄 없이 조회 조건 상자 · ERP S/O 목록 | 편성 상세 · 「⋯」 배치 · 목록 접기. */}
      <ListDetailWorkspace
        storageKey="omf-mes:shipment-request-create"
        filter={{
          label: messages.common.paneList.filter,
          content: (
            <SourceFilterBar
              appliedFilters={filters}
              customerOptions={toSelectOptions(customers)}
              customerName={describeReference(
                toReference(customers, filters.customer === '' ? null : Number(filters.customer)),
              )}
              customerNote={lookupNote(customers)}
              onSearch={applyFilters}
              onRemoveFilter={removeFilter}
              onReset={() => {
                applyFilters(EMPTY_FILTERS);
              }}
            />
          ),
        }}
        list={{
          label: t.panes.source,
          title: t.panes.source,
          count: list.data?.page.total,
          className: 'sr-create-source-list',
          content: list.isError ? (
            <LoadErrorBanner
              error={list.error}
              onRetry={() => {
                void list.refetch();
              }}
            />
          ) : (
            <>
              <SourceListTable
                rows={rows}
                isLoading={list.isPending}
                isBeyondLast={pageView.isBeyondLast}
                selectedSalesOrderId={targetSalesOrderId}
                customerLookup={customers}
                onSelect={selectSalesOrder}
                onFirstPage={() => {
                  changePage(1);
                }}
              />
              {!list.isPending && <PageNav view={pageView} onChange={changePage} />}
            </>
          ),
        }}
        detail={{
          label: t.title,
          bare: true,
          className: 'sr-create-detail',
          content: rightColumn(),
        }}
      />

      {/*
       * ⭐ **품목 선택은 팝업이다**(사용자 결정 2026-09-18). 품목 마스터가 9,269건이라 표 안
       *    선택칸으로 감당할 수 없다 — 같은 문제를 만난 `W-06-05` 도 대화상자 안 검색으로 풀었다.
       * ⭐ **기본 유형이 「제품」이다.** 도메인 04 의 이름이 「제품출하」이고 설계 `W-04-01` §5-5 가
       *    가용 수량을 「완제품 창고의 가용 잔액」·「`W-04-08` 완제품 재고 조회와 같은 원천」으로
       *    적었다. 자재는 출하가 아니라 출고로 나간다.
       * ⛔ **서버는 품목 유형을 제한하지 않는다** — 화면이 유일한 관문이다. 기본을 좁히지 않으면
       *    원자재·부자재가 결과에 섞인다. 「전체」와 다른 유형은 유상사급처럼 자재가 나가는
       *    예외를 위해 열어 둔다.
       */}
      {picker !== null && (
        <ItemPickerDialog
          multiple={picker.kind === 'add'}
          defaultItemTypeCode={SHIPPABLE_ITEM_TYPE_CODE}
          addedItemIds={lines.flatMap((line) => (line.itemId === '' ? [] : [Number(line.itemId)]))}
          onClose={() => {
            setPicker(null);
          }}
          onConfirm={applyPickedItems}
        />
      )}
    </>
  );
};
