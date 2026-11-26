import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { useState, useId } from 'react';
import { useApiClient } from '../../../patterns/api-context';
import {
  ReferenceField,
  type ReferenceRow,
  type ReferenceSource,
} from '../../../patterns/reference-picker';
import { runRequest } from '../../../patterns/request';
import { useWarehouseArrival } from '../process/arrival-location';
import type { ReviewPlan, ReviewProposal } from './model';

export const ProposalWarehouseField = ({
  row,
  plan,
  disabled,
  onChange,
}: {
  row: ReviewProposal;
  plan: ReviewPlan;
  disabled: boolean;
  onChange: (plan: ReviewPlan) => void;
}) => {
  const { client } = useApiClient();
  const reasonId = useId();
  const [candidate, setCandidate] = useState<ReferenceRow | null>(null);
  const [manualLocation, setManualLocation] = useState<ReferenceRow | null>(null);
  const arrival = useWarehouseArrival(candidate?.id);
  const storage = row.erpStorage;
  const applied = plan.appliedWarehouse ?? storage?.warehouse;
  const allowed = !!storage?.erpStorageLocationCode && !!storage.warehouse && !storage.reasonCode;
  const source: ReferenceSource = {
    title: '생산품 입고 창고 선택',
    key: ['proposal-warehouses', row.plantId],
    columns: { code: '창고 코드', name: '창고명' },
    search: async (q, page) => {
      const response = await runRequest(() =>
        client.GET('/mdm/warehouses', {
          params: { query: { plantId: row.plantId, q, page, size: 50 } },
        }),
      );
      return {
        items: response.items
          .filter(
            (item) =>
              item.isActive &&
              item.plantId === row.plantId &&
              item.warehouseTypeCode !== 'MATERIAL' &&
              !item.isDefect &&
              !item.isExternal,
          )
          .map((item) => ({
            id: item.warehouseId,
            code: item.warehouseCode,
            name: item.warehouseName,
          })),
        total: response.page.total,
      };
    },
  };
  const location =
    manualLocation ??
    (arrival.data?.location
      ? {
          id: arrival.data.location.locationId,
          code: arrival.data.location.locationCode,
          name: arrival.data.location.locationName,
          parentId: candidate?.id,
        }
      : null);
  return (
    <section aria-label="생산품 입고 창고">
      {allowed ? (
        <ReferenceField
          label="생산품 입고 창고"
          clearable={false}
          wrapValue
          valueLabel={applied ? `${applied.name} (${applied.code})` : '미지정'}
          disabled={disabled}
          source={source}
          onPick={(value) => {
            if (value.id !== applied?.id) {
              setCandidate(value);
              setManualLocation(null);
            }
          }}
          onClear={() => {}}
        />
      ) : (
        <dl className="erp-wo-final-facts">
          <div>
            <dt>생산품 입고 창고</dt>
            <dd>{storage?.warehouse?.name ?? storage?.erpStorageLocationCode ?? 'ERP 미지정'}</dd>
          </div>
        </dl>
      )}
      {plan.fgWarehouseOverride && (
        <p>
          ERP 입고 창고와 다름: {storage?.warehouse?.name} ({storage?.erpStorageLocationCode})
        </p>
      )}
      {candidate && (
        <Dialog
          open
          title="생산품 입고 창고 변경"
          onClose={() => setCandidate(null)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setCandidate(null)}>
                취소
              </Button>
              <Button
                disabled={!location || arrival.isFetching || arrival.isError}
                aria-describedby={reasonId}
                onClick={() => {
                  const original = candidate.id === storage?.warehouse?.id;
                  onChange({
                    ...plan,
                    appliedWarehouse: candidate,
                    fgWarehouseOverride: original
                      ? undefined
                      : { warehouseId: candidate.id, erpMismatchAcknowledged: true },
                    operations: plan.operations.map((op) => ({
                      ...op,
                      resources: { ...op.resources, defaultFgLocationId: location },
                    })),
                    recalculationRequired: true,
                  });
                  setCandidate(null);
                }}
              >
                변경 적용
              </Button>
            </>
          }
        >
          <p id={reasonId}>
            ERP에서 지정한 창고는 {storage?.warehouse?.name}입니다. {candidate.name}으로 변경하면
            MES와 ERP의 재고 위치가 달라집니다. 변경하시겠습니까?
          </p>
          {arrival.isPending ? (
            <p>입고 위치 조회 중</p>
          ) : arrival.isError ? (
            <AlertBanner
              variant="error"
              title="입고 위치를 조회하지 못했습니다."
              action={<Button onClick={() => void arrival.refetch()}>다시 조회</Button>}
            />
          ) : location ? (
            <p>
              입고 위치: {location.name} ({location.code})
            </p>
          ) : (
            <ReferenceField
              label="입고 위치"
              required
              valueLabel={manualLocation?.name ?? ''}
              source={{
                title: '입고 위치 선택',
                key: ['proposal-arrival', candidate.id],
                columns: { code: '위치 코드', name: '위치명' },
                search: async (q, page) => {
                  const values = (arrival.data?.items ?? []).filter(
                    (item) =>
                      item.isActive && `${item.locationCode} ${item.locationName}`.includes(q),
                  );
                  return {
                    items: values.slice((page - 1) * 50, page * 50).map((item) => ({
                      id: item.locationId,
                      code: item.locationCode,
                      name: item.locationName,
                      parentId: item.warehouseId,
                    })),
                    total: values.length,
                  };
                },
              }}
              onPick={setManualLocation}
              onClear={() => setManualLocation(null)}
            />
          )}
        </Dialog>
      )}
    </section>
  );
};
