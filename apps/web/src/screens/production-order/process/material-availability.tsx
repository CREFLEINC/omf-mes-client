import { AlertBanner, Button, Chip, type ChipStatus } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { useQueries } from '@tanstack/react-query';
import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';

/**
 * BOM 구성 자재의 가용 수량·부족 판정(omf-all-around#320). 처리 화면 BOM 단계·제안 검토·배포 확인이 같은
 * 서버 결과를 보인다. 부족해도 경고만 하고 확정·배포는 막지 않는다.
 */
export type AvailabilityLine =
  components['schemas']['PlanningMaterialAvailabilityResult']['items'][number];
export interface AvailabilityRequest {
  plantId: number;
  bomComponentId: number;
  quantity: number;
}

/** 서버 한 번에 200줄까지(계약 maxItems). */
const BATCH = 200;
const keyOf = (request: AvailabilityRequest) =>
  `${request.plantId}:${request.bomComponentId}:${request.quantity}`;

export const useMaterialAvailability = (requests: readonly AvailabilityRequest[]) => {
  const { client } = useApiClient();
  const unique = [
    ...new Map(
      requests
        .filter((request) => request.quantity > 0)
        .map((request) => [keyOf(request), request]),
    ).values(),
  ];
  const batches: { plantId: number; lines: AvailabilityRequest[] }[] = [];
  for (const plantId of [...new Set(unique.map((request) => request.plantId))]) {
    const lines = unique.filter((request) => request.plantId === plantId);
    for (let i = 0; i < lines.length; i += BATCH)
      batches.push({ plantId, lines: lines.slice(i, i + BATCH) });
  }
  const queries = useQueries({
    queries: batches.map((batch) => ({
      queryKey: [
        'planning',
        'material-availability',
        batch.plantId,
        batch.lines.map((line) => [line.bomComponentId, line.quantity]),
      ],
      retry: false,
      queryFn: () =>
        runRequest(() =>
          client.POST('/planning/boms:material-availability', {
            body: {
              plantId: batch.plantId,
              lines: batch.lines.map(({ bomComponentId, quantity }) => ({
                bomComponentId,
                quantity,
              })),
            },
          }),
        ),
    })),
  });
  const result = new Map<string, AvailabilityLine>();
  const failed = new Set<string>();
  batches.forEach((batch, index) => {
    const query = queries[index];
    batch.lines.forEach((line, row) => {
      const item = query?.data?.items?.[row];
      if (item) result.set(keyOf(line), item);
      else if (query?.isError) failed.add(keyOf(line));
    });
  });
  return {
    lineOf: (request: AvailabilityRequest) => result.get(keyOf(request)),
    failedOf: (request: AvailabilityRequest) => failed.has(keyOf(request)),
    isError: queries.some((query) => query.isError),
    isFetching: queries.some((query) => query.isFetching),
    refetch: () => queries.forEach((query) => void query.refetch()),
  };
};
export type MaterialAvailability = ReturnType<typeof useMaterialAvailability>;

const STATUS: Record<AvailabilityLine['statusCode'], { text: string; chip: ChipStatus }> = {
  ENOUGH: { text: '충분', chip: 'success' },
  SHORT: { text: '부족', chip: 'warning' },
  NOT_COMPARABLE: { text: '재고 정보 확인 불가', chip: 'idle' },
};
const quantityText = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 6 });

/** 필요 수량 — 재고 단위가 다르면 바꾼 값을 함께 보인다(환산이 없으면 BOM 단위만). */
export const requiredText = (line: AvailabilityLine) =>
  line.stockUomCode === line.bomUomCode || line.requiredStockQty === null
    ? `${quantityText(line.requiredQty)} ${line.bomUomCode}`
    : `${quantityText(line.requiredQty)} ${line.bomUomCode} (${quantityText(line.requiredStockQty)} ${line.stockUomCode})`;

export const RequiredCell = ({
  availability,
  request,
}: {
  availability: MaterialAvailability;
  request: AvailabilityRequest | null;
}) => {
  if (request === null) return <>—</>;
  const line = availability.lineOf(request);
  if (line) return <>{requiredText(line)}</>;
  return <>{availability.failedOf(request) ? '조회 실패' : '조회 중'}</>;
};

/** 가용 수량 칸 — 조회 실패를 0 으로 보이지 않는다. */
export const AvailableCell = ({
  availability,
  request,
}: {
  availability: MaterialAvailability;
  request: AvailabilityRequest | null;
}) => {
  if (request === null) return <>—</>;
  const line = availability.lineOf(request);
  if (line) return <>{`${quantityText(line.availableQty)} ${line.stockUomCode}`}</>;
  return <>{availability.failedOf(request) ? '조회 실패' : '조회 중'}</>;
};

/** 재고 상태 칸 — 부족은 경고 색. 재고 정보 확인 불가는 재고 단위 환산이 없을 때다. */
export const AvailabilityStatusCell = ({
  availability,
  request,
}: {
  availability: MaterialAvailability;
  request: AvailabilityRequest | null;
}) => {
  if (request === null) return <>—</>;
  const line = availability.lineOf(request);
  if (!line) return <>{availability.failedOf(request) ? '조회 실패' : '—'}</>;
  const status = STATUS[line.statusCode];
  return (
    <Chip variant="status" status={status.chip} size="sm">
      {status.text}
    </Chip>
  );
};

/** 조회 실패 안내 — 표 위 한 줄과 [다시 조회]. */
export const AvailabilityError = ({ availability }: { availability: MaterialAvailability }) =>
  availability.isError ? (
    <AlertBanner
      variant="error"
      action={
        <Button disabled={availability.isFetching} onClick={availability.refetch}>
          다시 조회
        </Button>
      }
    >
      가용 수량을 조회하지 못했습니다.
    </AlertBanner>
  ) : null;
