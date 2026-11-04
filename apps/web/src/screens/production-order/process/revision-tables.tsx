import { AlertBanner, Button, SkeletonText } from '@crefle/web-ui';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';
import { Select } from '../../../patterns/select';
import { useItemCodeNames, useProductionOrderItemNames } from '../item-lookups';
import { useUomReferenceLookup } from '../reference-lookups';
import { useRoutingDetail, useRoutingOperations } from '../../routing/queries';
import {
  useProcessOptions,
  useRoutingOperationOptions,
  type LookupResult,
} from '../../item-extended-attrs/lookups';

const named = (source: LookupResult, id: number | null | undefined) =>
  id == null
    ? '미지정'
    : (source.entries.find((entry) => entry.value === String(id))?.label ??
      (source.isLoading ? '조회 중' : source.isError ? '조회 실패' : '연결 정보 확인 필요'));
const useDisplayPage = (total: number) => {
  const [requested, setRequested] = useState(1);
  const [size, setSize] = useState(10);
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(requested, pages);
  return {
    page,
    size,
    pages,
    start: (page - 1) * size,
    setPage: setRequested,
    setSize: (next: number) => {
      setSize(next);
      setRequested(1);
    },
  };
};
const PageControls = ({
  label,
  total,
  paging,
}: {
  label: string;
  total: number;
  paging: ReturnType<typeof useDisplayPage>;
}) => (
  <nav className="erp-wo-table-pagebar" aria-label={`${label} 페이지`}>
    <span className="field-note">
      {total ? paging.start + 1 : 0}–{Math.min(total, paging.start + paging.size)} / {total}건
    </span>
    <div className="erp-wo-table-page-actions">
      <span className="field-note">행 수</span>
      <Select
        aria-label={`${label} 표시 행 수`}
        size="sm"
        value={String(paging.size)}
        options={[10, 20, 50].map((value) => ({ value: String(value), label: String(value) }))}
        onChange={(value) => paging.setSize(Number(value))}
      />
      <Button
        size="sm"
        variant="outlined"
        disabled={paging.page === 1}
        onClick={() => paging.setPage(paging.page - 1)}
      >
        이전
      </Button>
      <span>
        {paging.page} / {paging.pages}
      </span>
      <Button
        size="sm"
        variant="outlined"
        disabled={paging.page === paging.pages}
        onClick={() => paging.setPage(paging.page + 1)}
      >
        다음
      </Button>
    </div>
  </nav>
);
const Grid = ({
  label,
  columns,
  widths,
  children,
  total,
  paging,
}: {
  label: string;
  columns: string[];
  widths: number[];
  children: ReactNode;
  total: number;
  paging: ReturnType<typeof useDisplayPage>;
}) => (
  <>
    <div className="erp-wo-dense-table-scroll" role="region" aria-label={`${label} 가로 스크롤 표`}>
      <table className="erp-wo-dense-table" style={{ width: widths.reduce((a, b) => a + b, 0) }}>
        <caption className="visually-hidden">{label}</caption>
        <colgroup>
          {widths.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={index === 0 ? 'fixed-code' : index === 1 ? 'fixed-name' : undefined}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
    <PageControls label={label} total={total} paging={paging} />
  </>
);
const mode = (value: boolean | undefined, yes = '사용', no = '미사용') =>
  value == null ? '미제공' : value ? yes : no;

export const BomTable = ({ id }: { id: number }) => {
  const { client } = useApiClient();
  const header = useQuery({
    queryKey: ['plan-revision-detail', 'bom', id],
    queryFn: () =>
      runRequest(() => client.GET('/planning/boms/{bomId}', { params: { path: { bomId: id } } })),
  });
  const components = useQuery({
    queryKey: ['plan-revision-detail', 'components', id],
    queryFn: () =>
      runRequest(() =>
        client.GET('/planning/boms/{bomId}/components', { params: { path: { bomId: id } } }),
      ),
  });
  const rows = [...(components.data?.items ?? [])].sort((a, b) => a.sequenceNo - b.sequenceNo);
  const paging = useDisplayPage(rows.length);
  const shown = rows.slice(paging.start, paging.start + paging.size);
  const items = useItemCodeNames(shown.map((row) => row.componentItemId));
  const names = useProductionOrderItemNames(shown.map((row) => row.componentItemId));
  const itemFallback = (id: number) => {
    const status = names.items.find((item) => item.itemId === id)?.status;
    return status === 'loading'
      ? '조회 중'
      : status === 'failed'
        ? '조회 실패'
        : '자재 정보 확인 필요';
  };
  const operations = useRoutingOperationOptions(
    header.data?.bom.parentItemId ?? null,
    shown.some((row) => row.routingOperationId != null),
  );
  const processes = useProcessOptions(shown.some((row) => row.actualUseProcessId != null));
  const units = useUomReferenceLookup();
  const unit = (id: number) =>
    units.entries.find((entry) => entry.value === String(id))?.label ??
    (units.isLoading ? '조회 중' : '단위 확인 필요');
  if (header.isError || components.isError)
    return (
      <AlertBanner
        variant="error"
        action={
          <Button
            onClick={() => {
              void header.refetch();
              void components.refetch();
            }}
          >
            다시 조회
          </Button>
        }
      >
        BOM 정보를 불러오지 못했습니다.
      </AlertBanner>
    );
  if (!header.data || !components.data) return <SkeletonText lines={4} />;
  const bom = header.data.bom;
  return (
    <>
      <div className="erp-wo-dense-metadata">
        <strong>
          {bom.bomCode} · 개정 {bom.bomVersion}
        </strong>
        <span>
          유효기간 {bom.effectiveFrom ?? '미설정'} ~ {bom.effectiveTo ?? '종료일 없음'}
        </span>
        <strong>
          기준 수량 {bom.baseQty} {unit(bom.baseUomId)}
        </strong>
        <span>자재 {rows.length}건</span>
      </div>
      {rows.length ? (
        <Grid
          label="BOM 구성"
          columns={[
            '자재 코드',
            '자재명',
            '기준 수량당 소요량',
            '단위',
            '로스율',
            '필수 여부',
            '관리 공정',
            '실제 사용 공정',
            'LOT 추적',
            '자동 차감',
          ]}
          widths={[104, 180, 105, 52, 65, 65, 135, 135, 70, 70]}
          total={rows.length}
          paging={paging}
        >
          {shown.map((row) => {
            const item = items.get(row.componentItemId);
            return (
              <tr key={row.bomComponentId}>
                <td className="fixed-code">
                  {item?.itemCode ?? itemFallback(row.componentItemId)}
                </td>
                <td className="fixed-name">
                  {item?.itemName ?? itemFallback(row.componentItemId)}
                </td>
                <td className="numeric">{row.requiredQty}</td>
                <td>{unit(row.uomId)}</td>
                <td className="numeric">{Number((row.scrapRate * 100).toFixed(6))}%</td>
                <td>{mode(row.isMandatory, '필수', '선택')}</td>
                <td>{named(operations, row.routingOperationId)}</td>
                <td>{named(processes, row.actualUseProcessId)}</td>
                <td>{mode(row.lotTraceRequired)}</td>
                <td>{mode(row.backflushAllowed)}</td>
              </tr>
            );
          })}
        </Grid>
      ) : (
        <p>등록된 구성 자재가 없습니다.</p>
      )}
    </>
  );
};

export const RoutingTable = ({ id }: { id: number }) => {
  const { client } = useApiClient();
  const header = useRoutingDetail(id);
  const operations = useRoutingOperations(id);
  const rows = [...(operations.data?.items ?? [])].sort((a, b) => a.operationSeq - b.operationSeq);
  const paging = useDisplayPage(rows.length);
  const shown = rows.slice(paging.start, paging.start + paging.size);
  const ids = [
    ...new Set(
      shown.map((row) => row.processId).filter((id) => Number.isSafeInteger(id) && id > 0),
    ),
  ];
  const lookups = useQueries({
    queries: ids.map((processId) => ({
      queryKey: ['plan-process-code', processId],
      queryFn: () =>
        runRequest(() =>
          client.GET('/mdm/processes/{processId}', { params: { path: { processId } } }),
        ),
    })),
  });
  const processCode = (id: number) => {
    const lookup = lookups[ids.indexOf(id)];
    return lookup?.data?.process.processCode ?? (lookup?.isPending ? '조회 중' : '코드 확인 필요');
  };
  if (operations.isError)
    return (
      <AlertBanner
        variant="error"
        action={<Button onClick={() => void operations.refetch()}>다시 조회</Button>}
      >
        Routing 공정을 불러오지 못했습니다.
      </AlertBanner>
    );
  if (!operations.data) return <SkeletonText lines={4} />;
  return (
    <>
      {header.isError && (
        <AlertBanner
          variant="error"
          action={<Button onClick={() => void header.refetch()}>다시 조회</Button>}
        >
          Routing 개정 정보를 불러오지 못했습니다.
        </AlertBanner>
      )}
      <div className="erp-wo-dense-metadata">
        {header.data?.routing && (
          <>
            <strong>
              {header.data.routing.routingCode} · 개정 {header.data.routing.routingVersion}
            </strong>
            <span>
              유효기간 {header.data.routing.effectiveFrom ?? '미설정'} ~{' '}
              {header.data.routing.effectiveTo ?? '종료일 없음'}
            </span>
          </>
        )}
        <span>MES Routing 기준정보 · 공정 {rows.length}건</span>
      </div>
      {rows.length ? (
        <Grid
          label="Routing 공정"
          columns={[
            '공정 코드',
            '공정명',
            '순서',
            '설비 필수',
            '금형 필수',
            '자재 투입',
            '실적 관리',
            '검사 관리',
            '외주',
            '산출 LOT',
            '표준 사이클',
            '표준 수율',
            'MES 관리',
          ]}
          widths={[104, 180, 48, 70, 70, 75, 75, 75, 58, 85, 105, 85, 80]}
          total={rows.length}
          paging={paging}
        >
          {shown.map((row, index) => (
            <tr key={row.routingOperationId}>
              <td className="fixed-code">{processCode(row.processId)}</td>
              <td className="fixed-name">{row.operationName}</td>
              <td className="numeric">{paging.start + index + 1}</td>
              <td>{mode(row.equipmentRequired, '필수', '선택')}</td>
              <td>{mode(row.moldRequired, '필수', '선택')}</td>
              <td>{mode(row.materialInputManaged)}</td>
              <td>{mode(row.productionResultManaged)}</td>
              <td>{mode(row.inspectionManaged)}</td>
              <td>{mode(row.isOutsourced, '예', '아니요')}</td>
              <td>{mode(row.outputLotRequired, '필수', '선택')}</td>
              <td className="numeric">
                {row.standardCycleTimeSec == null ? '미설정' : `${row.standardCycleTimeSec}초`}
              </td>
              <td className="numeric">
                {row.standardYieldRate == null
                  ? '미설정'
                  : `${Number((row.standardYieldRate * 100).toFixed(6))}%`}
              </td>
              <td>{mode(row.mesManaged)}</td>
            </tr>
          ))}
        </Grid>
      ) : (
        <p>등록된 공정이 없습니다.</p>
      )}
    </>
  );
};
