import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { InfoTable } from '../../patterns/info-facts';
import { runRequest } from '../../patterns/request';

type Lot = components['schemas']['Lot'];
type MaterialConsumption = components['schemas']['MaterialConsumption'];

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
}

/**
 * 4M 변경 자재 투입(omf-all-around#63 2단계 · 서버 선행 P-86) — 한 작업지시에 투입된 자재 중 IQC 에서
 * 4M 변경 자재로 적힌 LOT 을 보인다. 작업지시 진행 상세가 쓴다 — 생산 LOT 은 계보 기준 「투입 자재」를 본다(#166).
 *
 * ⛔ 읽기 전용이다. 투입을 막거나 상태를 바꾸지 않는다.
 */
/**
 * 이 W/O 에 투입된 4M 변경 자재. 구획(`FourMInputsPanel`)과, 「기록이 하나도 없는가」를 묻는 부르는 쪽이 **같은 조회**를
 * 함께 쓴다 — 열쇠가 같아 요청은 한 번만 나간다.
 */
export const useFourMInputs = (workOrderId: number) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: fourMInputsKeys.ofWorkOrder(workOrderId),
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/material-consumptions', {
          params: { query: { workOrderId, size: PAGE_SIZE } },
        }),
      ).then((page) =>
        (page.items as MaterialConsumption[]).filter((row) => row.fourMChange !== undefined),
      ),
  });
};

export const FourMInputsPanel = ({ workOrderId }: FourMInputsPanelProps) => {
  const { client } = useApiClient();
  const inputs = useFourMInputs(workOrderId);
  const changeTypeLabel = useFourMChangeTypeLabel();
  /* 같은 LOT 을 여러 번 투입했을 수 있다 — 번호는 LOT 마다 한 번 부른다. */
  const lotIds = [...new Set((inputs.data ?? []).map((row) => row.lotId))];
  const lots = useQueries({
    queries: lotIds.map((lotId) => ({
      queryKey: fourMInputsKeys.lot(lotId),
      queryFn: () =>
        runRequest(() => client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } })).then(
          (detail) => (detail.lot as Lot).lotNo,
        ),
    })),
  });
  const lotNoOf = (lotId: number): string => lots[lotIds.indexOf(lotId)]?.data ?? String(lotId);

  /* 조회가 끝나 0건이면 보조 글 한 줄만 — 제목 · 빈 표 없이(#360). 받는 중 · 실패는 제목 + 종전 안내. */
  if (inputs.isSuccess && inputs.data.length === 0) {
    return (
      <section aria-label={t.heading} className="four-m-inputs">
        <p className="field-note">{t.none}</p>
      </section>
    );
  }

  return (
    <section aria-label={t.heading} className="four-m-inputs">
      {inputs.isPending ? (
        <>
          <h3>{t.heading}</h3>
          <p className="field-note">{t.loading}</p>
        </>
      ) : inputs.isError ? (
        <>
          <h3>{t.heading}</h3>
          <p className="field-error">{t.loadFailed}</p>
        </>
      ) : (
        /* 다른 팝업 표처럼 제목 + 건수, 그 아래 공용 표. */
        <InfoTable
          title={t.heading}
          storageKey="omf-mes:work-order-progress:columns:four-m-inputs"
          rows={inputs.data}
          getRowId={(row) => String(row.materialConsumptionId)}
          emptyTitle={t.none}
          columns={[
            {
              key: 'lot',
              header: t.columns.lot,
              /* 긴 LOT 번호도 끝까지 보이게 칸 안에서 줄을 바꾼다. */
              render: (row) => <span className="four-m-inputs-lot">{lotNoOf(row.lotId)}</span>,
            },
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
