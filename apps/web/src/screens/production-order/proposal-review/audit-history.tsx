import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { createProposalReadClient } from '@omf-mes/api-client';
import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';
import { formatPlantDateTime } from '../../../patterns/plant-time';
import { PageNav } from '../../../patterns/page-nav';
import { AdjustableNativeTable } from '../process/adjustable-table';
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const eventLabels: Record<string, string> = {
  PLAN_DRAFT_REPLACED: '작성중 계획 대체',
  PLAN_DATE_USER_ON_HOLIDAY: '휴일 계획일 지정',
  FG_WAREHOUSE_OVERRIDDEN: '생산품 입고 창고 변경',
};
export const ProposalAuditHistory = ({ id, number }: { id: string; number: string }) => {
  const { baseUrl } = useApiClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['production-order-proposal-audit', id, page],
    enabled: open,
    retry: false,
    queryFn: () =>
      runRequest(() =>
        createProposalReadClient(baseUrl).GET(
          '/planning/production-orders/{productionOrderId}/audit-events',
          { params: { path: { productionOrderId: Number(id) }, query: { page, size: 20 } } },
        ),
      ),
  });
  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        변경 이력
      </Button>
      {open && (
        <Dialog
          open
          title={`${number} 변경 이력`}
          onClose={() => setOpen(false)}
          footer={
            <Button variant="outlined" onClick={() => setOpen(false)}>
              닫기
            </Button>
          }
        >
          {query.isPending ? (
            <p>변경 이력 조회 중</p>
          ) : query.isError ? (
            <AlertBanner
              variant="error"
              title="변경 이력을 조회하지 못했습니다."
              action={<Button onClick={() => void query.refetch()}>다시 조회</Button>}
            />
          ) : (
            <>
              <AdjustableNativeTable
                storageKey="proposal-audit-history"
                labels={['처리 일시', '변경 내용', '계획번호', '처리자 ID']}
                widths={[180, 200, 180, 100]}
              >
                <tbody>
                  {query.data.items.map((event) => {
                    const after = object(event.afterValue);
                    const detail = object(after.detail);
                    return (
                      <tr key={event.auditEventId}>
                        <td>{formatPlantDateTime(event.occurredAt) ?? event.occurredAt}</td>
                        <td>{eventLabels[String(after.eventCode)] ?? '계획 변경'}</td>
                        <td>{typeof detail.planNo === 'string' ? detail.planNo : '—'}</td>
                        <td>{event.performedBy ?? '시스템'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </AdjustableNativeTable>
              {!query.data.items.length && <p>변경 이력이 없습니다.</p>}
              <PageNav meta={query.data.page} onChangePage={setPage} />
            </>
          )}
        </Dialog>
      )}
    </>
  );
};
