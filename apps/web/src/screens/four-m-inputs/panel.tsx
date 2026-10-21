import { Table } from '@crefle/web-ui';
import type { LotForward, MaterialConsumptionForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

const t = messages.fourMInputs;

/** 한 W/O 의 투입은 수십 건이다 — 한 쪽에 다 받는다(러닝 체인지의 투입 목록과 같은 크기). */
const PAGE_SIZE = 200;
const FOUR_M_CHANGE_TYPE = 'FOUR_M_CHANGE_TYPE';

export const fourMInputsKeys = {
  all: ['four-m-inputs'] as const,
  ofWorkOrder: (workOrderId: number) => ['four-m-inputs', 'work-order', workOrderId] as const,
  lot: (lotId: number) => ['four-m-inputs', 'lot', lotId] as const,
  changeTypes: ['four-m-inputs', 'change-types'] as const,
};

/** 4M 변경 종류 표시명 — 모르면 원문 코드(값 목록은 기준정보에서 바뀐다). */
export const useFourMChangeTypeLabel = (): ((code: string) => string) => {
  const { client } = useApiClient();
  const changeTypes = useQuery({
    queryKey: fourMInputsKeys.changeTypes,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: FOUR_M_CHANGE_TYPE, includeInactive: true } },
        }),
      ).then((page) => new Map(page.items.map((item) => [item.code, item.codeName]))),
  });
  return (code) => changeTypes.data?.get(code) ?? code;
};

export interface FourMInputsPanelProps {
  workOrderId: number;
  /** 생산 LOT 에서 부르면 참 — 자재와 생산 LOT 을 1:1 로 잇는 기록이 없어 W/O 단위 추정임을 밝힌다. */
  estimate?: boolean;
}

/**
 * 4M 변경 자재 투입(omf-all-around#63 2단계 · 서버 선행 P-86) — 한 작업지시에 투입된 자재 중 IQC 에서
 * 4M 변경품으로 적힌 LOT 을 보인다. 작업지시 진행 상세와 LOT 상태 상세(생산 LOT)가 함께 쓴다.
 *
 * ⛔ 읽기 전용이다. 투입을 막거나 상태를 바꾸지 않는다.
 * ⚠ 생산 LOT 과의 연결은 W/O 단위 추정이다 — 자재 LOT → 생산 LOT 기록은 1차 범위 밖(설계 문의 052).
 */
export const FourMInputsPanel = ({ workOrderId, estimate = false }: FourMInputsPanelProps) => {
  const { client } = useApiClient();
  const inputs = useQuery({
    queryKey: fourMInputsKeys.ofWorkOrder(workOrderId),
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/material-consumptions', {
          params: { query: { workOrderId, size: PAGE_SIZE } },
        }),
      ).then((page) =>
        (page.items as MaterialConsumptionForward[]).filter((row) => row.fourMChange !== undefined),
      ),
  });
  const changeTypeLabel = useFourMChangeTypeLabel();
  /* 같은 LOT 을 여러 번 투입했을 수 있다 — 번호는 LOT 마다 한 번 부른다. */
  const lotIds = [...new Set((inputs.data ?? []).map((row) => row.lotId))];
  const lots = useQueries({
    queries: lotIds.map((lotId) => ({
      queryKey: fourMInputsKeys.lot(lotId),
      queryFn: () =>
        runRequest(() => client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } })).then(
          (detail) => (detail.lot as LotForward).lotNo,
        ),
    })),
  });
  const lotNoOf = (lotId: number): string => lots[lotIds.indexOf(lotId)]?.data ?? String(lotId);

  return (
    <section aria-label={t.heading} className="four-m-inputs">
      <h3>{t.heading}</h3>
      {estimate && <p className="field-note">{t.estimate}</p>}
      {inputs.isPending ? (
        <p className="field-note">{t.loading}</p>
      ) : inputs.isError ? (
        <p className="field-error">{t.loadFailed}</p>
      ) : inputs.data.length === 0 ? (
        <p className="field-note">{t.none}</p>
      ) : (
        <Table
          caption={t.heading}
          density="compact"
          zebra={false}
          rows={inputs.data}
          getRowId={(row) => String(row.materialConsumptionId)}
          columns={[
            { key: 'lot', header: t.columns.lot, render: (row) => lotNoOf(row.lotId) },
            {
              key: 'changeType',
              header: t.columns.changeType,
              render: (row) => changeTypeLabel(row.fourMChange?.changeTypeCode ?? ''),
            },
            {
              key: 'remarks',
              header: t.columns.remarks,
              render: (row) => row.fourMChange?.remarks ?? t.empty,
            },
            {
              key: 'inputQty',
              header: t.columns.inputQty,
              align: 'end',
              render: (row) => String(row.inputQty),
            },
          ]}
        />
      )}
    </section>
  );
};
