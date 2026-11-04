import { useQueries, useQuery } from '@tanstack/react-query';
import { AlertBanner, Button, SkeletonText } from '@crefle/web-ui';
import { useApiClient } from '../../../patterns/api-context';
import { fetchAllPages } from '../../../patterns/fetch-all-pages';
import { runRequest } from '../../../patterns/request';
import { useWorkOrderEquipment } from '../../work-order/resource-queries';
import type { OrderWorkOrder } from './queries';

export const TerminalConnections = ({
  plantId,
  workOrder,
}: {
  plantId: number;
  workOrder: OrderWorkOrder;
}) => {
  const { client } = useApiClient();
  const equipment = useWorkOrderEquipment(workOrder.plannedEquipmentId ?? null);
  const terminals = useQuery({
    queryKey: ['release-terminal-connections', plantId],
    queryFn: () =>
      fetchAllPages(async (page, size) =>
        runRequest(() =>
          client.GET('/mdm/terminals', {
            params: { query: { plantId, includeInactive: true, page, size } },
          }),
        ),
      ),
  });
  const candidates = (terminals.data?.items ?? []).filter((row) => row.plantId === plantId);
  const configs = useQueries({
    queries: candidates.map((terminal) => ({
      queryKey: ['release-terminal-processes', terminal.terminalId],
      queryFn: () =>
        runRequest(() =>
          client.GET('/mdm/terminals/{terminalId}/processes', {
            params: { path: { terminalId: terminal.terminalId } },
          }),
        ),
    })),
  });
  const refresh = () => {
    void terminals.refetch();
    if (workOrder.plannedEquipmentId != null) void equipment.refetch();
    configs.forEach((query) => void query.refetch());
  };
  const loading = terminals.isPending || configs.some((query) => query.isPending);
  const incomplete =
    terminals.isError || configs.some((query) => query.isError) || terminals.data?.truncated;
  const links = candidates.flatMap((terminal, index) => {
    const process = configs[index]?.data?.items.find(
      (row) => row.processId === workOrder.processId,
    );
    const sameEquipment =
      workOrder.plannedEquipmentId != null && terminal.equipmentId === workOrder.plannedEquipmentId;
    return sameEquipment || process ? [{ terminal, process, sameEquipment }] : [];
  });
  return (
    <section className="erp-wo-terminal-connections" aria-label="연결 단말기">
      <div className="section-heading-row">
        <h3 className="section-title">연결 단말기</h3>
        <Button size="sm" variant="outlined" onClick={refresh}>
          단말기 다시 조회
        </Button>
      </div>
      <dl className="erp-wo-terminal-target">
        <div>
          <dt>공정</dt>
          <dd>{workOrder.operationName || '공정 정보 확인 필요'}</dd>
        </div>
        <div>
          <dt>배정 설비</dt>
          <dd>
            {workOrder.plannedEquipmentId == null
              ? '미배정'
              : equipment.data
                ? `${equipment.data.equipmentName} (${equipment.data.equipmentCode})`
                : equipment.isError
                  ? '설비 조회 실패'
                  : '설비 조회 중'}
          </dd>
        </div>
      </dl>
      {workOrder.processId == null && <p className="field-note">공정 연결 정보 확인 필요</p>}
      {loading ? (
        <SkeletonText lines={2} />
      ) : (
        <>
          {incomplete && (
            <AlertBanner variant="warning">
              단말기 또는 공정 구성을 모두 조회하지 못했습니다. 조회 권한과 연결 상태를 확인하세요.
            </AlertBanner>
          )}
          {links.length > 0 ? (
            <div className="erp-wo-terminal-table">
              <table>
                <caption>설비 및 공정 연결 현황</caption>
                <thead>
                  <tr>
                    {['단말기', '유형', '연결 설비', '공정 설정', '연결 기준', '상태'].map(
                      (title) => (
                        <th key={title}>{title}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {links.map(({ terminal, process, sameEquipment }) => (
                    <tr key={terminal.terminalId}>
                      <td>{terminal.terminalCode}</td>
                      <td>
                        {terminal.terminalTypeCode === 'POP'
                          ? '고정 단말 (POP)'
                          : terminal.terminalTypeCode === 'MOBILE'
                            ? '모바일'
                            : terminal.terminalTypeCode}
                      </td>
                      <td>
                        {terminal.equipmentId == null
                          ? '미지정'
                          : terminal.equipmentName
                            ? `${terminal.equipmentName} (${terminal.equipmentCode ?? '코드 미확인'})`
                            : '설비 정보 확인 필요'}
                      </td>
                      <td>
                        {process ? (
                          <>
                            <span>{process.processName || workOrder.operationName}</span>
                            <small>
                              {[
                                process.canStartWork && '작업 시작',
                                process.canCompleteWork && '작업 완료',
                                process.canInputMaterial && '자재 투입',
                                process.canInputResult && '실적 입력',
                                process.canInputInspection && '검사 입력',
                              ]
                                .filter(Boolean)
                                .join(', ') || '실행 권한 미설정'}
                            </small>
                          </>
                        ) : workOrder.processId == null ? (
                          '확인 필요'
                        ) : configs[
                            candidates.findIndex((row) => row.terminalId === terminal.terminalId)
                          ]?.isError ? (
                          '조회 실패'
                        ) : (
                          '미연결'
                        )}
                      </td>
                      <td>
                        {[sameEquipment && '설비 일치', process && '공정 연결']
                          .filter(Boolean)
                          .join(', ')}
                      </td>
                      <td>
                        {terminal.isActive ? '사용' : '사용 중지'} /{' '}
                        {terminal.statusCode === 'RUNNING'
                          ? '가동 중'
                          : terminal.statusCode === 'STOPPED'
                            ? '정지'
                            : terminal.statusCode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !incomplete &&
            workOrder.processId != null && (
              <p className="empty-line">설비 또는 공정에 연결된 단말기가 없습니다.</p>
            )
          )}
        </>
      )}
    </section>
  );
};
