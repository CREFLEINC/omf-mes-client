import { AlertBanner, Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import type {
  AffectedProductionLots,
  InputMaterials,
  TraceBasis,
  UsedSerials,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav } from '../../patterns/page-nav';
import { LOT_PAGE_SIZES, type LotPageSize } from './filters';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { runRequest } from '../../patterns/request';
import { useFourMChangeTypeLabel } from '../four-m-inputs/panel';

const t = messages.lotGenealogy;
const shared = messages.lotStatusHistory;
type AffectedLot = AffectedProductionLots['items'][number];
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
  /* 투입 이력 표는 화면에서 쪽을 나눈다 — 서버가 한 번에 다 준다(LOT 목록과 같은 쪽 이동 · 사용자 2026-10-30). */
  const [lotPage, setLotPage] = useState(1);
  const [lotPageSize, setLotPageSize] = useState<LotPageSize>(20);
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

  /* 열 너비 끌기 · 열 순서 바꾸기 — LOT 목록 표와 같다(사용자 2026-10-30). */
  const lotColumns: Column<AffectedLot>[] = [
    {
      key: 'lotNo',
      header: t.usage.lotColumns.lotNo,
      align: 'center',
      render: (row) => row.lotNo,
    },
    {
      key: 'workOrderNo',
      header: t.usage.lotColumns.workOrderNo,
      align: 'center',
      render: (row) => row.workOrderNo,
    },
  ];
  const ordered = useColumnOrder('omf-mes:lot-status:columns:usage:order', lotColumns);
  const resizable = useColumnWidths('omf-mes:lot-status:columns:usage', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  /*
   * LOT 변경 이력 · 보류 이력과 같은 짜임 — 제목 줄에 총 건수, 기록이 없어도 표를 세우고 표 안에 없다고 적는다
   * (사용자 2026-10-30).
   */
  return (
    /* LOT 상세의 탭 하나 — 제목·접기는 탭이 대신한다(사용자 2026-10-30). */
    <section aria-label={t.usage.heading}>
      <div>
        {lots.isPending && (
          <div role="status" aria-label={t.usage.loading}>
            <SkeletonText lines={3} />
          </div>
        )}
        {lots.isError && (
          <AlertBanner
            className="lot-detail-failure-banner"
            variant="error"
            title={t.usage.loadFailed}
            action={
              <Button
                variant="outlined"
                size="sm"
                aria-label={shared.detail.retryLabel(t.usage.heading)}
                onClick={() => void lots.refetch()}
              >
                {shared.detail.retry}
              </Button>
            }
          />
        )}
        {lots.data !== undefined && (
          <>
            <div
              ref={fit.ref}
              className="wide-table lot-status-table lot-detail-table"
              style={resizable.style}
            >
              <Table
                density="comfortable"
                caption={t.usage.lotsCaption}
                rows={lots.data.items.slice((lotPage - 1) * lotPageSize, lotPage * lotPageSize)}
                getRowId={(row) => String(row.lotId)}
                columns={fit.columns}
                empty={<EmptyState size="sm" title={t.usage.none} />}
              />
            </div>
            <PageNav
              sizes={LOT_PAGE_SIZES}
              controlSize="sm"
              buttonSize="md"
              meta={{ page: lotPage, size: lotPageSize, total: lots.data.items.length }}
              onChangePage={setLotPage}
              onChangeSize={(size) => {
                setLotPageSize(size);
                setLotPage(1);
              }}
            />
            {serials.isError ? (
              <p className="field-error">{t.usage.loadFailed}</p>
            ) : serials.data !== undefined && serials.data.items.length > 0 ? (
              <>
                <div className="lot-genealogy-table">
                  <Table
                    density="comfortable"
                    caption={t.usage.serialsCaption}
                    rows={serials.data.items}
                    getRowId={(row) => String(row.serialNumberId)}
                    columns={[
                      {
                        key: 'serialNo',
                        header: t.usage.serialColumns.serialNo,
                        align: 'center',
                        render: (row) => row.serialNo,
                      },
                      {
                        key: 'lotNo',
                        header: t.usage.serialColumns.lotNo,
                        align: 'center',
                        render: (row) => row.lotNo,
                      },
                      {
                        key: 'producedAt',
                        header: t.usage.serialColumns.producedAt,
                        align: 'center',
                        render: (row) =>
                          row.producedAt === undefined
                            ? t.empty
                            : (formatPlantDateTime(row.producedAt) ?? row.producedAt),
                      },
                    ]}
                  />
                </div>
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
      </div>
    </section>
  );
};
