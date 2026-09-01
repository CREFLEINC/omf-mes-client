import { AlertBanner, Select, SkeletonText, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupResult } from './lookups';

type Warehouse = components['schemas']['Warehouse'];

const t = messages.shipmentProcessing.loadingInfo;

/**
 * ②상차 정보 — 6항목(차량번호·운전자명·봉인번호·운송장번호·상차담당·운송사) + 출하 창고.
 *
 * 창고는 계획서 미결 항목이다 — `ShipmentCreate.warehouseId`(필수)의 값 출처가 스펙에 없다.
 * `GET /mdm/warehouses?includeInactive=false`로 활성 창고를 받아 **정확히 1개면 자동 채움**,
 * **2개 이상이면 임시 필수 Select를 노출**한다(스펙 이탈 — `AlertBanner`로 밝힌다).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface LoadingInfoDraft {
  vehicleNo: string;
  driverName: string;
  sealNo: string;
  transportDocumentNo: string;
  loadingWorkerId: string;
  carrierId: string;
  /** 활성 창고가 여럿일 때만 쓰는 임시 선택값 — 하나뿐이면 무시된다. */
  warehouseId: string;
}

export const EMPTY_LOADING_INFO_DRAFT: LoadingInfoDraft = {
  vehicleNo: '',
  driverName: '',
  sealNo: '',
  transportDocumentNo: '',
  loadingWorkerId: '',
  carrierId: '',
  warehouseId: '',
};

export interface WarehouseOption {
  warehouseId: number;
  label: string;
}

export const toWarehouseOptions = (items: readonly Warehouse[]): WarehouseOption[] =>
  items.map((item) => ({
    warehouseId: item.warehouseId,
    label: `${item.warehouseCode} · ${item.warehouseName}`,
  }));

export type WarehouseResolution =
  | { kind: 'PENDING' }
  | { kind: 'ERROR' }
  | { kind: 'NONE' }
  | { kind: 'AUTO'; warehouseId: number; label: string }
  | { kind: 'AMBIGUOUS'; options: WarehouseOption[] };

export const resolveWarehouse = (
  options: WarehouseOption[] | undefined,
  isPending: boolean,
  isError: boolean,
): WarehouseResolution => {
  if (isPending) return { kind: 'PENDING' };
  if (isError || options === undefined) return { kind: 'ERROR' };
  if (options.length === 0) return { kind: 'NONE' };
  if (options.length === 1) {
    const only = options[0];
    if (only === undefined) return { kind: 'NONE' };
    return { kind: 'AUTO', warehouseId: only.warehouseId, label: only.label };
  }
  return { kind: 'AMBIGUOUS', options };
};

/** 이 화면이 결국 어느 창고로 제출할지 — 자동이면 그 값, 모호하면 사용자가 고른 값. */
export const resolvedWarehouseId = (
  resolution: WarehouseResolution,
  chosenValue: string,
): number | null => {
  if (resolution.kind === 'AUTO') return resolution.warehouseId;
  if (resolution.kind === 'AMBIGUOUS') {
    const chosen = Number(chosenValue);
    return chosenValue !== '' && Number.isInteger(chosen) ? chosen : null;
  }
  return null;
};

const warehouseKeys = {
  activeWarehouses: ['shipment-processing-lookups', 'active-warehouses'] as const,
};

export const useActiveWarehouses = (): UseQueryResult<{ items: Warehouse[] }> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: warehouseKeys.activeWarehouses,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/warehouses', {
          params: { query: { includeInactive: false, page: 1, size: 200 } },
        }),
      ),
  });
};

export interface LoadingInfoPaneProps {
  draft: LoadingInfoDraft;
  onChange: (patch: Partial<LoadingInfoDraft>) => void;
  workerLookup: LookupResult;
  carrierLookup: LookupResult;
  warehouseResolution: WarehouseResolution;
}

export const LoadingInfoPane = ({
  draft,
  onChange,
  workerLookup,
  carrierLookup,
  warehouseResolution,
}: LoadingInfoPaneProps) => (
  <section className="pane pane-stack" aria-label={messages.shipmentProcessing.panes.loadingInfo}>
    <div className="form-grid">
      <div className="field-cell">
        <TextField
          label={t.fields.vehicleNo}
          value={draft.vehicleNo}
          onChange={(event) => {
            onChange({ vehicleNo: event.target.value });
          }}
        />
      </div>
      <div className="field-cell">
        <TextField
          label={t.fields.driverName}
          value={draft.driverName}
          onChange={(event) => {
            onChange({ driverName: event.target.value });
          }}
        />
      </div>
      <div className="field-cell">
        <TextField
          label={t.fields.sealNo}
          value={draft.sealNo}
          onChange={(event) => {
            onChange({ sealNo: event.target.value });
          }}
        />
      </div>
      <div className="field-cell">
        <TextField
          label={t.fields.transportDocumentNo}
          value={draft.transportDocumentNo}
          onChange={(event) => {
            onChange({ transportDocumentNo: event.target.value });
          }}
        />
      </div>
      <div className="field-cell">
        <span className="field-label">
          <label htmlFor="shipment-processing-loading-worker">{t.fields.loadingWorker}</label>
        </span>
        <Select
          id="shipment-processing-loading-worker"
          disabled={workerLookup.isError}
          options={[{ value: '', label: t.unselected }, ...workerLookup.entries]}
          value={draft.loadingWorkerId === '' ? null : draft.loadingWorkerId}
          onChange={(value) => {
            onChange({ loadingWorkerId: value });
          }}
        />
        {workerLookup.isError ? <p className="field-note">{t.lookupFailed.workers}</p> : null}
      </div>
      <div className="field-cell">
        <span className="field-label">
          <label htmlFor="shipment-processing-carrier">{t.fields.carrier}</label>
        </span>
        <Select
          id="shipment-processing-carrier"
          disabled={carrierLookup.isError}
          options={[{ value: '', label: t.unselected }, ...carrierLookup.entries]}
          value={draft.carrierId === '' ? null : draft.carrierId}
          onChange={(value) => {
            onChange({ carrierId: value });
          }}
        />
        {carrierLookup.isError ? <p className="field-note">{t.lookupFailed.carriers}</p> : null}
      </div>
    </div>

    {warehouseResolution.kind === 'PENDING' ? (
      <div role="status" aria-label={t.warehouse.loading}>
        <SkeletonText lines={1} />
      </div>
    ) : null}
    {warehouseResolution.kind === 'ERROR' ? (
      <div className="banner-slot">
        <AlertBanner variant="error">{t.warehouse.loadFailed}</AlertBanner>
      </div>
    ) : null}
    {warehouseResolution.kind === 'NONE' ? (
      <div className="banner-slot">
        <AlertBanner variant="error">{t.warehouse.none}</AlertBanner>
      </div>
    ) : null}
    {warehouseResolution.kind === 'AUTO' ? (
      <p className="field-note">
        {t.fields.warehouse}: {t.warehouse.resolved(warehouseResolution.label)}
      </p>
    ) : null}
    {warehouseResolution.kind === 'AMBIGUOUS' ? (
      <>
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.warehouse.ambiguous}</AlertBanner>
        </div>
        <div className="field-cell">
          <span className="field-label">
            <label htmlFor="shipment-processing-warehouse">{t.fields.warehouse}</label>
          </span>
          <Select
            id="shipment-processing-warehouse"
            aria-required
            options={warehouseResolution.options.map((option) => ({
              value: String(option.warehouseId),
              label: option.label,
            }))}
            value={draft.warehouseId === '' ? null : draft.warehouseId}
            onChange={(value) => {
              onChange({ warehouseId: value });
            }}
          />
        </div>
      </>
    ) : null}
  </section>
);
