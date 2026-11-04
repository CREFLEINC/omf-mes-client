import { Link } from 'react-router';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertBanner, Button, Dialog, SkeletonText } from '@crefle/web-ui';
import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';
import { useProductionOrderItemNames } from '../item-lookups';
import { useUomReferenceLookup } from '../reference-lookups';
import { useRoutingOperations, useRoutingDetail } from '../../routing/queries';
import {
  useProcessOptions,
  useRoutingOperationOptions,
  type LookupResult,
} from '../../item-extended-attrs/lookups';

const flag = (value: boolean | undefined) => (value == null ? '미제공' : value ? '예' : '아니요');

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

const linkedName = (source: LookupResult, id: number | null | undefined) => {
  if (id == null) return '미지정';
  if (source.isError) return '조회 실패';
  const found = source.entries.find((entry) => entry.value === String(id));
  return found?.label ?? (source.isLoading ? '조회 중' : '연결 정보 확인 필요');
};
const statusLabel = (status: string) =>
  ({ CONFIRMED: '확정', DRAFT: '작성중', OBSOLETE: '폐기' })[status] ?? status;

export const BomContents = ({ id, plain = false }: { id: number; plain?: boolean }) => {
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
  const names = useProductionOrderItemNames([
    ...(rows.data?.items ?? []).map((row) => row.componentItemId),
    ...(header.data?.bom.parentItemId ? [header.data.bom.parentItemId] : []),
  ]);
  const operations = useRoutingOperationOptions(
    header.data?.bom.parentItemId ?? null,
    (rows.data?.items ?? []).some((row) => row.routingOperationId != null),
  );
  const processes = useProcessOptions(
    (rows.data?.items ?? []).some((row) => row.actualUseProcessId != null),
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
  if (plain)
    return (
      <>
        <div className="erp-wo-plain-revision">
          <strong>
            {bom.bomCode} · 개정 {bom.bomVersion}
          </strong>
          <span>
            사용 기간 {bom.effectiveFrom} ~ {bom.effectiveTo ?? '종료일 없음'}
          </span>
        </div>
        <div className="section-heading-row">
          <h3 className="section-title">자재별 필요 수량</h3>
          <strong>
            제품{' '}
            {unit(bom.baseUomId) === 'EA'
              ? `${bom.baseQty}개 (${bom.baseQty} EA)`
              : `${bom.baseQty} ${unit(bom.baseUomId)}`}{' '}
            기준
          </strong>
        </div>
        {rows.data.items.length ? (
          <div className="erp-wo-revision-table erp-wo-plain-materials">
            <table>
              <caption className="visually-hidden">자재별 필요 수량</caption>
              <thead>
                <tr>
                  <th>자재</th>
                  <th>필요 수량</th>
                  <th>필수 여부</th>
                </tr>
              </thead>
              <tbody>
                {[...rows.data.items]
                  .sort((a, b) => a.sequenceNo - b.sequenceNo)
                  .map((row) => (
                    <tr key={row.bomComponentId}>
                      <td data-label="자재">
                        {names.items.find((item) => item.itemId === row.componentItemId)?.label ??
                          '자재 정보 확인 중'}
                      </td>
                      <td data-label="필요 수량">
                        <strong>
                          {row.requiredQty} {unit(row.uomId)}
                        </strong>
                      </td>
                      <td data-label="필수 여부">{row.isMandatory ? '필수' : '선택'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>등록된 구성 자재가 없습니다.</p>
        )}
        <details className="erp-wo-plain-details">
          <summary>자재 투입 설정 확인</summary>
          <div className="erp-wo-plain-settings">
            {rows.data.items.map((row) => (
              <section key={row.bomComponentId}>
                <strong>
                  {names.items.find((item) => item.itemId === row.componentItemId)?.label ??
                    '자재 정보 확인 필요'}
                </strong>
                <Properties
                  values={[
                    ['자재를 관리하는 공정', linkedName(operations, row.routingOperationId)],
                    ['실제로 사용하는 공정', linkedName(processes, row.actualUseProcessId)],
                    ['투입할 때 LOT 확인', row.lotTraceRequired ? '필요' : '필요 없음'],
                    ['실적 등록 시 자동 차감', row.backflushAllowed ? '사용' : '사용 안 함'],
                    ['자재 손실률 (로스율)', `${Number((row.scrapRate * 100).toFixed(6))}%`],
                  ]}
                />
              </section>
            ))}
          </div>
        </details>
        <details className="erp-wo-plain-details">
          <summary>ERP에서 받은 정보와 적용 기준 확인</summary>
          <div className="erp-wo-plain-settings">
            <h3 className="section-title">ERP에서 받은 정보</h3>
            {rows.data.items.map((row) => (
              <div key={row.bomComponentId}>
                <strong>
                  {names.items.find((item) => item.itemId === row.componentItemId)?.label ??
                    '자재 정보 확인 필요'}
                </strong>
                <Properties
                  values={[
                    [
                      'ERP 자재 순번',
                      row.erpChildItemSeq == null ? '보관값 없음' : String(row.erpChildItemSeq),
                    ],
                    ['화면 표시 순서', String(row.sequenceNo)],
                  ]}
                />
              </div>
            ))}
            <div className="erp-wo-source-unavailable">
              <strong>ERP 원문 조회 미지원</strong>
              <p>원래 수량·기준 수량·단위 코드·공장·수신 이력은 현재 조회할 수 없습니다.</p>
            </div>
            <h3 className="section-title">MES에서 적용한 기준</h3>
            <Properties
              values={[
                [
                  '자재 수량의 표시 기준',
                  `제품 ${bom.baseQty} ${unit(bom.baseUomId)} 생산 기준으로 정리`,
                ],
                ['품목명과 단위', 'MES에 연결된 품목·단위로 표시'],
                ['BOM 상태', statusLabel(bom.statusCode)],
                ['기본 BOM', flag(bom.isDefault)],
              ]}
            />
          </div>
        </details>
      </>
    );
  return (
    <>
      <p>
        <strong>
          {bom.bomCode} (Rev {bom.bomVersion})
        </strong>
      </p>
      <section className="erp-wo-origin-summary" aria-label="MES 변환 및 개정 정보">
        <h3 className="section-title">MES 변환 및 개정 정보</h3>
        <Properties
          values={[
            [
              '모품목 · MES 품목 연결',
              names.items.find((item) => item.itemId === bom.parentItemId)?.label ??
                '품목 정보 확인 필요',
            ],
            ['공통 기준 수량', `${bom.baseQty} ${unit(bom.baseUomId)}`],
            ['개정 상태', statusLabel(bom.statusCode)],
            ['기본 개정', flag(bom.isDefault)],
            ['유효 시작일', bom.effectiveFrom ?? '미설정'],
            ['유효 종료일', bom.effectiveTo ?? '종료일 없음'],
          ]}
        />
      </section>
      {!rows.data.items.length ? (
        <p>등록된 구성 자재가 없습니다.</p>
      ) : (
        <div className="erp-wo-revision-table">
          <table>
            <caption>ERP 수신 정보와 MES 적용 정보</caption>
            <thead>
              <tr>
                {['ERP 수신 · 품목 연결', 'MES 환산 소요량', 'MES 추가 속성'].map((label) => (
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
                      <td data-label="ERP 수신 · 품목 연결" className="erp-wo-revision-material">
                        <p className="field-note">
                          ERP 자품목 순번:{' '}
                          {row.erpChildItemSeq == null ? '보관값 없음' : row.erpChildItemSeq}
                        </p>
                        {name?.label ??
                          (name?.status === 'loading' ? '자재 조회 중' : '자재 정보 확인 필요')}
                      </td>
                      <td data-label="MES 환산 소요량" className="erp-wo-revision-quantity">
                        <strong>{row.requiredQty}</strong> {unit(row.uomId)}
                        <p className="field-note">
                          공통 기준 {bom.baseQty} {unit(bom.baseUomId)}당
                        </p>
                        <p className="field-note">MES 표시 순서 {row.sequenceNo}</p>
                      </td>
                      <td data-label="MES 추가 속성">
                        <Properties
                          values={[
                            ['관리 공정', linkedName(operations, row.routingOperationId)],
                            ['실제 사용 공정', linkedName(processes, row.actualUseProcessId)],
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
      <div className="erp-wo-source-unavailable">
        <strong>ERP 원본 추가 정보 · 조회 미지원</strong>
        <p>
          공장 코드, 행별 원래 기준 수량·소요량·단위 코드, 수신 식별값·수신 시각은 현재 조회할 수
          없습니다.
        </p>
      </div>
    </>
  );
};

export const RoutingContents = ({
  id,
  label,
  showHeader = false,
  plain = false,
}: {
  id: number;
  label?: string;
  showHeader?: boolean;
  plain?: boolean;
}) => {
  const header = useRoutingDetail(showHeader ? id : null);
  const rows = useRoutingOperations(id);
  const processNames = useProcessOptions(
    (rows.data?.items ?? []).some((row) => row.processId != null),
  );
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
  if (plain)
    return (
      <>
        <div className="erp-wo-plain-revision">
          <strong>{label ?? '확인 중인 작업 순서'}</strong>
          {header.data?.routing && (
            <span>
              사용 기간 {header.data.routing.effectiveFrom ?? '미설정'} ~{' '}
              {header.data.routing.effectiveTo ?? '종료일 없음'}
            </span>
          )}
        </div>
        {header.isError && (
          <AlertBanner
            variant="error"
            action={<Button onClick={() => void header.refetch()}>다시 조회</Button>}
          >
            개정 정보를 불러오지 못했습니다.
          </AlertBanner>
        )}
        {[...rows.data.items]
          .sort((a, b) => a.operationSeq - b.operationSeq)
          .map((row, index) => (
            <section className="erp-wo-operation-card" key={row.routingOperationId}>
              <div className="erp-wo-operation-heading">
                <span>{index + 1}</span>
                <h3 className="section-title">{row.operationName}</h3>
              </div>
              <Properties
                values={[
                  ['설비 배정', row.equipmentRequired ? '필수' : '선택'],
                  ['금형 배정', row.moldRequired ? '필수' : '선택'],
                  [
                    '표준 작업시간 (1사이클)',
                    row.standardCycleTimeSec == null ? '미설정' : `${row.standardCycleTimeSec}초`,
                  ],
                  ['자재 투입 관리', row.materialInputManaged ? '사용' : '사용 안 함'],
                  ['공정 중 검사 관리', row.inspectionManaged ? '사용' : '사용 안 함'],
                ]}
              />
            </section>
          ))}
        {!rows.data.items.length && <p>등록된 공정이 없습니다.</p>}
        <details className="erp-wo-plain-details">
          <summary>공정 관리 설정과 정보 출처 확인</summary>
          <div className="erp-wo-plain-settings">
            {rows.data.items.map((row) => (
              <section key={row.routingOperationId}>
                <strong>{row.operationName}</strong>
                <Properties
                  values={[
                    ['공정 기준정보', linkedName(processNames, row.processId)],
                    ['등록된 공정 순번', String(row.operationSeq)],
                    ['MES 공정 관리', flag(row.mesManaged)],
                    ['실적 관리', flag(row.productionResultManaged)],
                    ['외주 공정', flag(row.isOutsourced)],
                    ['산출 LOT 기록 필수', flag(row.outputLotRequired)],
                    [
                      '표준 수율',
                      row.standardYieldRate == null
                        ? '미설정'
                        : `${Number((row.standardYieldRate * 100).toFixed(6))}%`,
                    ],
                    ['한국어 표시명', row.nameKo ?? '미설정'],
                    ['베트남어 표시명', row.nameVi ?? '미설정'],
                  ]}
                />
              </section>
            ))}
            <Properties
              values={[
                ['정보 출처', 'MES Routing 기준정보 · ERP 실시간 수신 자료 아님'],
                ...(header.data?.routing
                  ? ([
                      ['Routing 코드', header.data.routing.routingCode],
                      ['개정', String(header.data.routing.routingVersion)],
                      ['상태', statusLabel(header.data.routing.statusCode)],
                      ['기본 개정', flag(header.data.routing.isDefault)],
                    ] as [string, string][])
                  : []),
              ]}
            />
          </div>
        </details>
      </>
    );
  return (
    <>
      {label !== '' && (
        <p>
          <strong>{label ?? '선택한 Routing'}</strong>
        </p>
      )}

      <div className="erp-wo-source-label">MES Routing 기준정보 · ERP 실시간 수신 정보 아님</div>
      {showHeader && header.isError && (
        <AlertBanner
          variant="error"
          action={<Button onClick={() => void header.refetch()}>다시 조회</Button>}
        >
          Routing 개정 정보를 불러오지 못했습니다.
        </AlertBanner>
      )}
      {header.data?.routing && (
        <Properties
          values={[
            ['MES Routing 코드', header.data.routing.routingCode],
            ['개정', String(header.data.routing.routingVersion)],
            ['상태', statusLabel(header.data.routing.statusCode)],
            ['기본 개정', flag(header.data.routing.isDefault)],
            ['유효 시작일', header.data.routing.effectiveFrom ?? '미설정'],
            ['유효 종료일', header.data.routing.effectiveTo ?? '종료일 없음'],
          ]}
        />
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
                      <Properties
                        values={[
                          ['공정 기준정보 연결', linkedName(processNames, row.processId)],
                          ['한국어 표시명', row.nameKo ?? '미설정'],
                          ['베트남어 표시명', row.nameVi ?? '미설정'],
                        ]}
                      />
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
