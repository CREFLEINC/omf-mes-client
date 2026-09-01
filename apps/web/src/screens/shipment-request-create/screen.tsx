import { Breadcrumb, Button, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
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
  addLineDraft,
  emptyLineDraft,
  lineDraftsFromSalesOrder,
  patchLineDraft,
  removeLineDraft,
} from './line-draft';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useAvailableQty,
  useCustomerOptions,
  useItemOptions,
  useShipToPartnerOptions,
  useUomOptions,
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
import { hasAllocatableLine, validateHeader, validateLines } from './validation';

const t = messages.shipmentRequestCreate;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: SalesOrderView[] = [];

const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({ value: entry.value, label: entry.label }));

interface HeaderDraft {
  customerId: string;
  shipToPartnerId: string;
  requestedShipDate: string;
}

const EMPTY_HEADER_DRAFT: HeaderDraft = {
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
 * W-04-01 컨테이너 — **출하지시서를 Import해 출하작업지시로 편성하거나, 지시서 없이 단독으로
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
  const shipToPartners = useShipToPartnerOptions();
  const items = useItemOptions();
  const uoms = useUomOptions();

  const [header, setHeader] = useState<HeaderDraft>(EMPTY_HEADER_DRAFT);
  const [lines, setLines] = useState<ShipmentRequestLineDraft[]>([]);

  const lineItemIds = lines.map((line) => (line.itemId === '' ? null : Number(line.itemId)));
  const availableQty = useAvailableQty(lineItemIds);

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
      customerId: String(detail.data.customerId),
      shipToPartnerId: String(detail.data.shipToPartnerId),
      requestedShipDate: '',
    });
    setLines(lineDraftsFromSalesOrder(detail.data.lines));
    resetIfIdle(create);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSalesOrderId, detail.data]);

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

  const submitBlockReason = (): string | null => {
    if (boundCreated !== null) return t.actionReasons.alreadySubmitted;
    if (isSaving) return t.actionReasons.saving;
    if (target.kind === 'none') return t.actionReasons.noTarget;
    if (target.kind === 'order' && (detail.data === undefined || detail.isError)) {
      return t.actionReasons.noTarget;
    }
    if (!hasAllocatableLine(lines)) return t.actionReasons.noAllocatedLine;
    if (Object.keys(lineValidation.errors).length > 0) return t.actionReasons.lineInvalid;
    if (Object.keys(headerLocalErrors).length > 0) return t.actionReasons.headerIncomplete;

    return null;
  };

  const changeHeader = (patch: Partial<HeaderDraft>): void => {
    setHeader((prev) => ({ ...prev, ...patch }));

    for (const field of Object.keys(patch)) create.clearFieldError(field);
  };

  const patchLine = (key: string, patch: Partial<Omit<ShipmentRequestLineDraft, 'key'>>): void => {
    setLines((prev) => patchLineDraft(prev, key, patch));
  };

  const removeLine = (key: string): void => {
    setLines((prev) => removeLineDraft(prev, key));
  };

  const addLine = (): void => {
    setLines((prev) => addLineDraft(prev));
  };

  /** 확인 창 없이 곧바로 보낸다 — 전송 중 잠금과 성공 후 잠금 두 겹이 연타를 막는다(계획서). */
  const submit = (): void => {
    if (mode === null) return;

    const body = toShipmentRequestCreateBody({
      mode,
      salesOrderId: target.kind === 'order' ? target.salesOrderId : null,
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

  const importReasonId = useId();

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
        shipToPartnerId={header.shipToPartnerId}
        requestedShipDate={header.requestedShipDate}
        customerOptions={toSelectOptions(customers)}
        shipToPartnerOptions={toSelectOptions(shipToPartners)}
        customerLookup={customers}
        shipToPartnerLookup={shipToPartners}
        customerNote={lookupNote(customers)}
        shipToPartnerNote={lookupNote(shipToPartners)}
        headerErrors={headerErrors}
        onChangeHeader={changeHeader}
        lines={lines}
        lineErrors={lineValidation.errors}
        itemLookup={items}
        uomLookup={uoms}
        itemOptions={toSelectOptions(items)}
        uomOptions={toSelectOptions(uoms)}
        availableQty={availableQty}
        onPatchLine={patchLine}
        onRemoveLine={removeLine}
        onAddLine={addLine}
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
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <div className="field-cell">
            {/*
             * 지시서 파일 업로드 형식이 아직 확정되지 않았다(계획서 미결 항목 · 배치 규범 4).
             * 사유를 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다.
             */}
            <Button variant="outlined" disabled aria-describedby={importReasonId}>
              {t.actions.importOrderFile}
            </Button>
            <span id={importReasonId} className="field-note">
              {t.actionReasons.importFileNotSupported}
            </span>
          </div>
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

      <div className="two-pane">
        <section className="pane" aria-label={t.panes.source}>
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

          {!list.isError && (
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
          )}
        </section>

        <div className="pane-stack">{rightColumn()}</div>
      </div>
    </>
  );
};
