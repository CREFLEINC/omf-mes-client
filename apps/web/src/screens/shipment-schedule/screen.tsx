import {
  Breadcrumb,
  Button,
  Dialog,
  PageHeader,
  Select,
  useToast,
  type SortState,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useCustomerOptions,
  useFulfillmentPlantOptions,
  useShipToPartnerOptions,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { readPeriod, toPeriodQuery, validatePeriod, type PeriodInput } from './period';
import {
  useFulfillmentPlantUpdate,
  useShipmentRequestDetail,
  useShipmentScheduleList,
} from './queries';
import { SaveErrorBanner } from '../../patterns/master';
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
  const fulfillmentPlants = useFulfillmentPlantOptions();
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [fulfillmentPlantId, setFulfillmentPlantId] = useState('');
  const selectedDetail = useShipmentRequestDetail(selectedRequestId);
  const toast = useToast();
  /* 저장이 끝나면 창을 닫고 다른 화면과 같은 자리에 알린다(사용자 지시 2026-09-22). */
  /*
   * 창을 닫으면 고른 값도 비운다 — 남겨 두면 다음 줄을 열었을 때 앞 줄의 공장이 이미 골라진
   * 것처럼 보이고, 상세가 아직 안 왔는데 저장이 눌린다.
   */
  const closePlantDialog = (): void => {
    setSelectedRequestId(null);
    setFulfillmentPlantId('');
    filledForRequestId.current = null;
  };

  const updatePlant = useFulfillmentPlantUpdate(selectedRequestId, () => {
    closePlantDialog();
    toast.show({ variant: 'success', description: messages.common.saved });
  });

  /*
   * ⭐ **대상이 바뀔 때만** 서버 값으로 채운다. 데이터 자체를 의존성에 두면 다른 쓰기의 무효화나
   * 초점 복귀로 상세가 다시 오는 순간 사용자가 고르던 공장이 서버 값으로 되돌아간다 —
   * 창으로 옮기며 머무는 시간이 길어져 더 잘 걸린다.
   */
  const filledForRequestId = useRef<number | null>(null);

  useEffect(() => {
    if (selectedDetail.data === undefined) return;
    if (filledForRequestId.current === selectedRequestId) return;

    filledForRequestId.current = selectedRequestId;
    setFulfillmentPlantId(
      selectedDetail.data.fulfillmentPlantId == null
        ? ''
        : String(selectedDetail.data.fulfillmentPlantId),
    );
  }, [selectedDetail.data, selectedRequestId]);

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
            applyQuery({ from: '', to: '' }, EMPTY_FILTERS, null);
          }}
        />

        {!list.isError && (
          <>
            <ShipmentTable
              rows={rows}
              isLoading={list.isPending && listQuery !== null}
              hasQuery={listQuery !== null}
              isBeyondLast={pageView.isBeyondLast}
              sortKey={sortKey}
              onSortChange={changeSort}
              customerLookup={customers}
              shipToPartnerLookup={shipToPartners}
              fulfillmentPlantLookup={fulfillmentPlants}
              onFirstPage={() => {
                applyQuery(period, filters, sortKey);
              }}
              onRetryReferences={retryReferences}
              onAssignPlant={(shipmentRequestId) => {
                setSelectedRequestId(shipmentRequestId);
                updatePlant.reset();
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
        공장 지정은 목록 아래 구획이 아니라 **창**으로 연다(사용자 지시 2026-09-22) — 고른 줄과
        입력 자리가 멀어 어느 건을 고치는지 흐려졌다. 여는 조건과 저장 동작은 그대로다.
      */}
      {selectedRequestId !== null && (
        <Dialog
          open
          size="sm"
          /* 아래 「취소」가 같은 일을 한다 — 우상단 × 는 두지 않는다(사용자 지시 2026-09-22). */
          showCloseButton={false}
          title={t.panes.fulfillmentPlant}
          onClose={closePlantDialog}
          footer={
            <>
              <Button variant="outlined" disabled={updatePlant.isSaving} onClick={closePlantDialog}>
                {messages.common.cancel}
              </Button>
              <Button
                /* 상세를 받기 전에는 잠근다 — 최신본 표가 없으면 요청이 나가지도 않는다. */
                disabled={
                  selectedDetail.data === undefined ||
                  selectedDetail.isFetching ||
                  fulfillmentPlantId === '' ||
                  updatePlant.isSaving
                }
                onClick={() => {
                  updatePlant.write({ fulfillmentPlantId: Number(fulfillmentPlantId) });
                }}
              >
                {t.actions.savePlant}
              </Button>
            </>
          }
        >
          <div className="shipment-schedule-plant-body">
            {selectedDetail.isPending && <p>{t.loading.detail}</p>}
            {selectedDetail.isError && (
              <LoadErrorBanner
                error={selectedDetail.error}
                onRetry={() => {
                  void selectedDetail.refetch();
                }}
              />
            )}
            {selectedDetail.data !== undefined && (
              <div className="form-grid shipment-schedule-plant-form">
                <div className="field-cell wide-select">
                  <label className="field-label" htmlFor="shipment-fulfillment-plant">
                    {t.fields.fulfillmentPlant}
                  </label>
                  <Select
                    id="shipment-fulfillment-plant"
                    options={toSelectOptions(fulfillmentPlants)}
                    value={fulfillmentPlantId === '' ? null : fulfillmentPlantId}
                    disabled={updatePlant.isSaving}
                    invalid={updatePlant.fieldErrors.fulfillmentPlantId !== undefined}
                    onChange={(value) => {
                      setFulfillmentPlantId(value);
                      updatePlant.clearFieldError('fulfillmentPlantId');
                    }}
                  />
                  {updatePlant.fieldErrors.fulfillmentPlantId !== undefined && (
                    <span className="field-error">
                      {updatePlant.fieldErrors.fulfillmentPlantId}
                    </span>
                  )}
                </div>
              </div>
            )}
            <SaveErrorBanner error={updatePlant.error} />
          </div>
        </Dialog>
      )}
    </>
  );
};
