import { Button, Table } from '@crefle/web-ui';
import type { InputMaterials, TraceBasis, UsedSerials } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { runRequest } from '../../patterns/request';
import { useFourMChangeTypeLabel } from '../four-m-inputs/panel';

const t = messages.lotGenealogy;
/** 시리얼은 수천 건일 수 있다 — 쪽으로 나눠 받는다. */
const SERIAL_PAGE = 50;

export const lotGenealogyKeys = {
  inputs: (lotId: number) => ['lot-genealogy', 'inputs', lotId] as const,
  lots: (lotId: number) => ['lot-genealogy', 'lots', lotId] as const,
  serials: (lotId: number, page: number) => ['lot-genealogy', 'serials', lotId, page] as const,
};

const BasisNote = ({ basis }: { basis: TraceBasis }) => (
  <p className="field-note">{t.basis[basis]}</p>
);

/**
 * 생산 LOT 의 투입 자재(omf-all-around#166 · 서버 선행 P-107) — 전 자재를 보이고 4M 변경품은 변경 종류를 단다.
 * ⛔ 읽기 전용이다.
 */
export const ProductionLotInputs = ({ lotId }: { lotId: number }) => {
  const { client } = useApiClient();
  const changeTypeLabel = useFourMChangeTypeLabel();
  const inputs = useQuery({
    queryKey: lotGenealogyKeys.inputs(lotId),
    queryFn: (): Promise<InputMaterials> =>
      runRequest(() =>
        client.GET('/trace/lots/{lotId}/input-materials', { params: { path: { lotId } } }),
      ),
  });

  return (
    <section aria-label={t.inputs.heading} className="four-m-inputs">
      <h3>{t.inputs.heading}</h3>
      {inputs.isPending ? (
        <p className="field-note">{t.inputs.loading}</p>
      ) : inputs.isError ? (
        <p className="field-error">{t.inputs.loadFailed}</p>
      ) : (
        <>
          <BasisNote basis={inputs.data.basis} />
          {inputs.data.items.length === 0 ? (
            <p className="field-note">{t.inputs.none}</p>
          ) : (
            <Table
              caption={<span className="four-m-inputs-caption">{t.inputs.heading}</span>}
              density="compact"
              zebra={false}
              rows={inputs.data.items}
              getRowId={(row) => String(row.lotId)}
              columns={[
                {
                  key: 'item',
                  header: t.inputs.columns.item,
                  render: (row) => `${row.itemName} (${row.itemCode})`,
                },
                { key: 'lot', header: t.inputs.columns.lot, render: (row) => row.lotNo },
                {
                  key: 'fourM',
                  header: t.inputs.columns.fourM,
                  render: (row) =>
                    row.fourMChange === undefined
                      ? t.empty
                      : [
                          /* 변경 종류는 선택이다(#133) — 없으면 비고만. */
                          row.fourMChange.changeTypeCode === undefined
                            ? undefined
                            : changeTypeLabel(row.fourMChange.changeTypeCode),
                          row.fourMChange.remarks,
                        ]
                          .filter((part) => part !== undefined)
                          .join(', '),
                },
              ]}
            />
          )}
        </>
      )}
    </section>
  );
};

/** 자재 LOT 이 들어간 생산 LOT·시리얼(omf-all-around#166 · 서버 선행 P-107). ⛔ 읽기 전용이다. */
export const MaterialLotUsage = ({ lotId }: { lotId: number }) => {
  const { client } = useApiClient();
  const [page, setPage] = useState(1);
  const lots = useQuery({
    queryKey: lotGenealogyKeys.lots(lotId),
    queryFn: () =>
      runRequest(() =>
        client.GET('/trace/lots/{lotId}/affected-production-lots', { params: { path: { lotId } } }),
      ),
  });
  const serials = useQuery({
    queryKey: lotGenealogyKeys.serials(lotId, page),
    placeholderData: keepPreviousData,
    queryFn: (): Promise<UsedSerials> =>
      runRequest(() =>
        client.GET('/trace/lots/{lotId}/used-serials', {
          params: { path: { lotId }, query: { page, size: SERIAL_PAGE } },
        }),
      ),
  });

  return (
    <section aria-label={t.usage.heading} className="four-m-inputs">
      <h3>{t.usage.heading}</h3>
      {lots.isPending ? (
        <p className="field-note">{t.usage.loading}</p>
      ) : lots.isError ? (
        <p className="field-error">{t.usage.loadFailed}</p>
      ) : lots.data.workOrders.length === 0 ? (
        <p className="field-note">{t.usage.none}</p>
      ) : (
        <>
          <BasisNote basis={lots.data.basis} />
          <Table
            caption={<span className="four-m-inputs-caption">{t.usage.lotsCaption}</span>}
            density="compact"
            zebra={false}
            rows={lots.data.items}
            getRowId={(row) => String(row.lotId)}
            columns={[
              { key: 'lotNo', header: t.usage.lotColumns.lotNo, render: (row) => row.lotNo },
              {
                key: 'workOrderNo',
                header: t.usage.lotColumns.workOrderNo,
                render: (row) => row.workOrderNo,
              },
            ]}
          />
          {serials.isError ? (
            <p className="field-error">{t.usage.loadFailed}</p>
          ) : serials.data !== undefined && serials.data.items.length > 0 ? (
            <>
              <Table
                caption={<span className="four-m-inputs-caption">{t.usage.serialsCaption}</span>}
                density="compact"
                zebra={false}
                rows={serials.data.items}
                getRowId={(row) => String(row.serialNumberId)}
                columns={[
                  {
                    key: 'serialNo',
                    header: t.usage.serialColumns.serialNo,
                    render: (row) => row.serialNo,
                  },
                  { key: 'lotNo', header: t.usage.serialColumns.lotNo, render: (row) => row.lotNo },
                  {
                    key: 'producedAt',
                    header: t.usage.serialColumns.producedAt,
                    render: (row) =>
                      row.producedAt === undefined
                        ? t.empty
                        : (formatPlantDateTime(row.producedAt) ?? row.producedAt),
                  },
                ]}
              />
              <div className="lot-genealogy-pager">
                <span className="field-note">
                  {t.usage.serialRange(
                    (page - 1) * SERIAL_PAGE + 1,
                    (page - 1) * SERIAL_PAGE + serials.data.items.length,
                    serials.data.page.total,
                  )}
                </span>
                <Button
                  variant="outlined"
                  size="sm"
                  disabled={page === 1 || serials.isFetching}
                  onClick={() => setPage((current) => current - 1)}
                >
                  {t.usage.prev}
                </Button>
                <Button
                  variant="outlined"
                  size="sm"
                  disabled={page * SERIAL_PAGE >= serials.data.page.total || serials.isFetching}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {t.usage.next}
                </Button>
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
};
