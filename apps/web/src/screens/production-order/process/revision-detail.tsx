import { Link } from 'react-router';
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

const Properties = ({ values }: { values: [string, string][] }) => (
  <dl className="erp-wo-revision-properties">
    {values.map(([label, value]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd data-enabled={value === '예'}>{value}</dd>
      </div>
    ))}
  </dl>
);

export const BomContents = ({ id }: { id: number }) => {
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
                {['순서', '구성 자재', '소요량', '관리 속성'].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows.data.items]
                .sort((a, b) => a.sequenceNo - b.sequenceNo)
                .map((row) => {
                  const name = names.items.find((item) => item.itemId === row.componentItemId);
                  return (
                    <tr key={row.bomComponentId}>
                      <td data-label="순서">{row.sequenceNo}</td>
                      <td data-label="구성 자재" className="erp-wo-revision-material">
                        {name?.label ??
                          (name?.status === 'loading' ? '자재 조회 중' : '자재 정보 확인 필요')}
                      </td>
                      <td data-label="소요량" className="erp-wo-revision-quantity">
                        <strong>{row.requiredQty}</strong> {unit(row.uomId)}
                      </td>
                      <td data-label="관리 속성">
                        <Properties
                          values={[
                            ['로스율', `${Number((row.scrapRate * 100).toFixed(6))}%`],
                            ['필수 자재', flag(row.isMandatory)],
                            ['LOT 추적', flag(row.lotTraceRequired)],
                            ['자동 차감 허용', flag(row.backflushAllowed)],
                          ]}
                        />
                      </td>
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

export const RoutingContents = ({ id, label }: { id: number; label?: string }) => {
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
      {label !== '' && (
        <p>
          <strong>{label ?? '선택한 Routing'}</strong>
        </p>
      )}

      {!rows.data.items.length ? (
        <p>등록된 공정이 없습니다.</p>
      ) : (
        <div className="erp-wo-revision-table">
          <table>
            <caption>공정 순서 및 공정별 정보</caption>
            <thead>
              <tr>
                {['순서', '공정', '관리 및 필수 조건', '표준 정보'].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows.data.items]
                .sort((a, b) => a.operationSeq - b.operationSeq)
                .map((row) => (
                  <tr key={row.routingOperationId}>
                    <td data-label="순서">{row.operationSeq}</td>
                    <td data-label="공정">
                      <strong>{row.operationName}</strong>
                    </td>
                    <td data-label="관리 및 필수 조건">
                      <Properties
                        values={[
                          ['MES 관리', flag(row.mesManaged)],
                          ['자재 투입', flag(row.materialInputManaged)],
                          ['실적 관리', flag(row.productionResultManaged)],
                          ['검사 관리', flag(row.inspectionManaged)],
                          ['외주', flag(row.isOutsourced)],
                          ['산출 LOT 필수', flag(row.outputLotRequired)],
                          ['설비 필수', flag(row.equipmentRequired)],
                          ['금형 필수', flag(row.moldRequired)],
                        ]}
                      />
                    </td>
                    <td data-label="표준 정보">
                      <Properties
                        values={[
                          [
                            '사이클',
                            row.standardCycleTimeSec == null
                              ? '미설정'
                              : `${row.standardCycleTimeSec}초`,
                          ],
                          [
                            '수율',
                            row.standardYieldRate == null
                              ? '미설정'
                              : `${Number((row.standardYieldRate * 100).toFixed(6))}%`,
                          ],
                        ]}
                      />
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
  itemId,
}: {
  kind: 'BOM' | 'Routing';
  value: string;
  label?: string;
  itemId?: number;
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
              <>
                {kind === 'Routing' && itemId != null && itemId > 0 && (
                  <Link
                    to={`/master-data/routing?item=${itemId}&rev=${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="erp-wo-revision-master-link"
                    aria-label="Routing 관리 화면 열기 (새 탭)"
                  >
                    Routing 관리 화면 열기 ↗
                  </Link>
                )}
                <Button variant="outlined" onClick={() => setOpen(false)}>
                  닫기
                </Button>
              </>
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
