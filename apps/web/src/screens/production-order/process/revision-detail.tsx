import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertBanner, Button, Dialog, SkeletonText } from '@crefle/web-ui';
import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';
import { useProductionOrderItemNames } from '../item-lookups';
import { useUomReferenceLookup } from '../reference-lookups';
import { useRoutingOperations } from '../../routing/queries';

const flag = (value: boolean | undefined) => (value ? '예' : '아니요');

const BomContents = ({ id }: { id: number }) => {
  const { client } = useApiClient();
  const header = useQuery({
    queryKey: ['plan-revision-detail', 'bom', id],
    queryFn: () =>
      runRequest(() => client.GET('/planning/boms/{bomId}', { params: { path: { bomId: id } } })),
  });
  const rows = useQuery({
    queryKey: ['plan-revision-detail', 'components', id],
    queryFn: () =>
      runRequest(() =>
        client.GET('/planning/boms/{bomId}/components', { params: { path: { bomId: id } } }),
      ),
  });
  const names = useProductionOrderItemNames(
    (rows.data?.items ?? []).map((row) => row.componentItemId),
  );
  const uoms = useUomReferenceLookup();
  const unit = (id: number) =>
    uoms.entries.find((entry) => entry.value === String(id))?.label ??
    (uoms.isLoading ? '단위 조회 중' : '단위 확인 필요');
  if (header.isError || rows.isError)
    return (
      <AlertBanner
        variant="error"
        action={
          <Button
            onClick={() => {
              void header.refetch();
              void rows.refetch();
            }}
          >
            다시 조회
          </Button>
        }
      >
        BOM 상세를 불러오지 못했습니다.
      </AlertBanner>
    );
  if (!header.data || !rows.data) return <SkeletonText lines={4} />;
  const bom = header.data.bom;
  return (
    <>
      <p>
        <strong>
          {bom.bomCode} (Rev {bom.bomVersion})
        </strong>
      </p>
      <dl className="erp-wo-revision-base">
        <dt>기준 수량</dt>
        <dd>
          {bom.baseQty} {unit(bom.baseUomId)}
        </dd>
      </dl>
      {!rows.data.items.length ? (
        <p>등록된 구성 자재가 없습니다.</p>
      ) : (
        <div className="erp-wo-revision-table">
          <table>
            <caption>구성 자재 및 기준 소요량</caption>
            <thead>
              <tr>
                {[
                  '순서',
                  '구성 자재',
                  '소요량',
                  '단위',
                  '로스율',
                  '필수 자재',
                  'LOT 추적',
                  '자동 차감 허용',
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows.data.items]
                .sort((a, b) => a.sequenceNo - b.sequenceNo)
                .map((row, index) => {
                  const name = names.items.find((item) => item.itemId === row.componentItemId);
                  return (
                    <tr key={row.bomComponentId}>
                      <td>{index + 1}</td>
                      <td>
                        {name?.label ??
                          (name?.status === 'loading' ? '자재 조회 중' : '자재 정보 확인 필요')}
                      </td>
                      <td>{row.requiredQty}</td>
                      <td>{unit(row.uomId)}</td>
                      <td>{Number((row.scrapRate * 100).toFixed(6))}%</td>
                      <td>{flag(row.isMandatory)}</td>
                      <td>{flag(row.lotTraceRequired)}</td>
                      <td>{flag(row.backflushAllowed)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

const RoutingContents = ({ id, label }: { id: number; label?: string }) => {
  const rows = useRoutingOperations(id);
  if (rows.isError)
    return (
      <AlertBanner
        variant="error"
        action={<Button onClick={() => void rows.refetch()}>다시 조회</Button>}
      >
        Routing 상세를 불러오지 못했습니다.
      </AlertBanner>
    );
  if (!rows.data) return <SkeletonText lines={4} />;
  return (
    <>
      <p>
        <strong>{label ?? '선택한 Routing'}</strong>
      </p>

      {!rows.data.items.length ? (
        <p>등록된 공정이 없습니다.</p>
      ) : (
        <div className="erp-wo-revision-table">
          <table>
            <caption>공정 순서 및 공정별 정보</caption>
            <thead>
              <tr>
                {[
                  '순서',
                  '공정',
                  'MES 관리',
                  '자재 투입',
                  '실적 관리',
                  '검사 관리',
                  '외주',
                  '산출 LOT 필수',
                  '설비 필수',
                  '금형 필수',
                  '표준 사이클(초)',
                  '표준 수율',
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows.data.items]
                .sort((a, b) => a.operationSeq - b.operationSeq)
                .map((row, index) => (
                  <tr key={row.routingOperationId}>
                    <td>{index + 1}</td>
                    <td>{row.operationName}</td>
                    <td>{flag(row.mesManaged)}</td>
                    <td>{flag(row.materialInputManaged)}</td>
                    <td>{flag(row.productionResultManaged)}</td>
                    <td>{flag(row.inspectionManaged)}</td>
                    <td>{flag(row.isOutsourced)}</td>
                    <td>{flag(row.outputLotRequired)}</td>
                    <td>{flag(row.equipmentRequired)}</td>
                    <td>{flag(row.moldRequired)}</td>
                    <td>{row.standardCycleTimeSec ?? '—'}</td>
                    <td>
                      {row.standardYieldRate == null
                        ? '—'
                        : `${Number((row.standardYieldRate * 100).toFixed(6))}%`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export const RevisionDetailButton = ({
  kind,
  value,
  label,
}: {
  kind: 'BOM' | 'Routing';
  value: string;
  label?: string;
}) => {
  const [open, setOpen] = useState(false);
  const id = Number(value);
  return (
    <>
      <Button
        size="sm"
        variant="text"
        disabled={!Number.isSafeInteger(id) || id <= 0}
        className="erp-wo-revision-detail-trigger"
        aria-label={`${kind} 상세 보기`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {kind} 상세 보기
      </Button>
      {open &&
        createPortal(
          <Dialog
            open
            size="lg"
            title={`${kind} 상세`}
            onClose={() => setOpen(false)}
            footer={
              <Button variant="outlined" onClick={() => setOpen(false)}>
                닫기
              </Button>
            }
          >
            <div className="erp-wo-revision-detail">
              {kind === 'BOM' ? <BomContents id={id} /> : <RoutingContents id={id} label={label} />}
            </div>
          </Dialog>,
          document.body,
        )}
    </>
  );
};
