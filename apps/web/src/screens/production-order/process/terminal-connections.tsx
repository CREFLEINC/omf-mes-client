import { useQueries, useQuery } from '@tanstack/react-query';
import { AlertBanner, Button, SkeletonText } from '@crefle/web-ui';
import { useApiClient } from '../../../patterns/api-context';
import { fetchAllPages } from '../../../patterns/fetch-all-pages';
import { runRequest } from '../../../patterns/request';
import { UsageChip } from '../../../patterns/usage-chip';
import { useWorkOrderEquipment } from '../../work-order/resource-queries';
import { messages } from '@omf-mes/i18n';
import type { OrderWorkOrder } from './queries';
import type { SectionCheck } from './release-checks';

const c = messages.erpWorkOrderFlow.process.release.checks;

/** 작업지시 하나에 닿는 단말기 — 배정 설비가 같거나, 그 공정을 실행하도록 설정된 단말기. */
type TerminalDirectory = ReturnType<typeof useTerminalDirectory>;

/**
 * 공장의 단말기와 단말기마다의 공정 설정. 배포 확인의 목록(확인 칸)과 상세(연결 단말기 표)가 함께 쓴다 —
 * 조회 키가 같아 한 번만 받는다. 공장을 모르면 묻지 않는다.
 */
export const useTerminalDirectory = (plantId: number | null | undefined) => {
  const { client } = useApiClient();
  const known = plantId != null;
  const terminals = useQuery({
    queryKey: ['release-terminal-connections', plantId ?? 0],
    enabled: known,
    queryFn: () =>
      fetchAllPages(async (page, size) =>
        runRequest(() =>
          client.GET('/mdm/terminals', {
            params: { query: { plantId: plantId ?? 0, includeInactive: true, page, size } },
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
  return {
    known,
    loading: known && (terminals.isPending || configs.some((query) => query.isPending)),
    incomplete:
      terminals.isError ||
      configs.some((query) => query.isError) ||
      terminals.data?.truncated === true,
    configFailedOf: (terminalId: number): boolean =>
      configs[candidates.findIndex((row) => row.terminalId === terminalId)]?.isError === true,
    refresh: () => {
      void terminals.refetch();
      configs.forEach((query) => void query.refetch());
    },
    linksOf: (workOrder: OrderWorkOrder) =>
      candidates.flatMap((terminal, index) => {
        const process = configs[index]?.data?.items.find(
          (row) => row.processId === workOrder.processId,
        );
        const sameEquipment =
          workOrder.plannedEquipmentId != null &&
          terminal.equipmentId === workOrder.plannedEquipmentId;
        return sameEquipment || process ? [{ terminal, process, sameEquipment }] : [];
      }),
  };
};

const terminalStatusText = (statusCode: string): string =>
  statusCode === 'RUNNING' ? '가동 중' : statusCode === 'STOPPED' ? '정지' : statusCode;

/**
 * 작업지시의 연결 단말기 확인 결과. 연결이 하나도 없거나 다 받지 못했으면 「확인 필요」다.
 * 공정 정보가 없는 작업지시는 연결 없음으로 단정하지 않는다.
 */
export const terminalCheckOf = (
  directory: TerminalDirectory,
  workOrder: OrderWorkOrder,
): SectionCheck | undefined => {
  if (!directory.known) return undefined;
  if (directory.loading) return { state: 'pending', summary: [c.pending] };
  const links = directory.linksOf(workOrder);
  if (links.length > 0) {
    return {
      state: directory.incomplete ? 'warn' : 'ok',
      summary: [
        c.terminalCount(links.length),
        ...links.map(
          ({ terminal }) => `${terminal.terminalCode} ${terminalStatusText(terminal.statusCode)}`,
        ),
      ],
    };
  }
  if (directory.incomplete) return { state: 'warn', summary: [c.failed] };
  return {
    state: 'warn',
    summary: [workOrder.processId == null ? c.terminalUnknown : c.terminalNone],
  };
};

export const TerminalConnections = ({
  plantId,
  workOrder,
  plain = false,
}: {
  plantId: number;
  workOrder: OrderWorkOrder;
  /** 배포 확인의 「연결 단말기」 줄 안 — 제목과 공정 · 배정 설비 칸은 그 줄과 4M 배정 줄이 이미 보인다. */
  plain?: boolean;
}) => {
  const equipment = useWorkOrderEquipment(workOrder.plannedEquipmentId ?? null);
  const directory = useTerminalDirectory(plantId);
  const refresh = () => {
    directory.refresh();
    if (workOrder.plannedEquipmentId != null) void equipment.refetch();
  };
  const { loading, incomplete } = directory;
  const links = directory.linksOf(workOrder);
  return (
    <section
      className={`erp-wo-terminal-connections${plain ? ' is-plain' : ''}`}
      aria-label="연결 단말기"
    >
      <div className="section-heading-row">
        {!plain && <h3 className="section-title">연결 단말기</h3>}
        <Button size="sm" variant="outlined" onClick={refresh}>
          단말기 다시 조회
        </Button>
      </div>
      {!plain && (
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
      )}
      {!plain && workOrder.processId == null && (
        <p className="field-note">공정 연결 정보 확인 필요</p>
      )}
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
                    {['단말기', '유형', '연결 설비', '공정 설정', '상태'].map((title) => (
                      <th key={title}>{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {links.map(({ terminal, process }) => (
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
                        ) : directory.configFailedOf(terminal.terminalId) ? (
                          '조회 실패'
                        ) : (
                          '미연결'
                        )}
                      </td>
                      <td>
                        <UsageChip isActive={terminal.isActive} /> /{' '}
                        {terminalStatusText(terminal.statusCode)}
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
