import { AlertBanner, Button, EmptyState, SkeletonText } from '@crefle/web-ui';
import { useMemo } from 'react';
import { createProposalReadClient, type PlanProposal } from '@omf-mes/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createProposalSession } from './proposal-review/proposal-api';
import { useNavigate, useSearchParams } from 'react-router';
import { useSession } from '../../patterns/session';
import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import { toWebAccess } from '../../patterns/web-access';
import { ForbiddenNotice } from './forbidden-notice';
import { useWorklistBulk } from './bulk-actions';
import { worklistPath } from './worklist-filters';
import { apiErrorText } from './release-runner';
import { ProposalReview } from './proposal-review/review';
import { loadCatalog, toLiveProposal, liveResourceSource } from './proposal-review/live-data';

export const AUTO_PLAN_RESULT_PATH = '/production/production-orders/auto-plan-results';
export const AutoPlanResultPage = ({
  permissionMenuPath = null,
}: {
  permissionMenuPath?: string | null;
}) => {
  const bulk = useWorklistBulk();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { session } = useSession();
  const api = useApiClient();
  const reader = useMemo(() => createProposalReadClient(api.baseUrl), [api.baseUrl]);
  const supplied =
    search
      .get('ids')
      ?.split(',')
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0) ?? [];
  const ids = supplied.length
    ? [...new Set(supplied)]
    : bulk.run?.kind === 'autoPlan'
      ? bulk.run.outcomes
          .map((row) => Number(row.id))
          .filter((id) => Number.isSafeInteger(id) && id > 0)
      : [];
  const allowed = toWebAccess(session?.permissions).allows('/production/production-orders');
  const query = useQuery({
    queryKey: ['production-order-proposal-review', ids.join(',') || 'action-required'],
    enabled: allowed,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const targets = ids.length
        ? ids
        : (
            await runRequest(() =>
              api.client.GET('/planning/production-orders', {
                params: { query: { worklistState: 'ACTION_REQUIRED', size: 20 } },
              }),
            )
          ).items.map((row) => row.productionOrderId);
      const proposals: PlanProposal[] = [];
      const warnings: string[] = [];
      for (let offset = 0; offset < targets.length; offset += 100) {
        try {
          const data = await runRequest(() =>
            reader.GET('/planning/production-orders:plan-proposals', {
              params: { query: { productionOrderIds: targets.slice(offset, offset + 100) } },
            }),
          );
          proposals.push(...data.items);
          if (data.notFoundProductionOrderIds.length)
            warnings.push(
              `조회할 수 없는 대상 ${data.notFoundProductionOrderIds.length}건이 있습니다.`,
            );
        } catch (error) {
          warnings.push(`제안 조회 실패: ${apiErrorText(toApiError(error))}`);
        }
      }
      if (!proposals.length) return { rows: [], catalog: null, warnings };
      const catalog = await loadCatalog(api.client, proposals);
      return { rows: proposals.map((row) => toLiveProposal(row, catalog)), catalog, warnings };
    },
  });
  const transport = useMemo(
    () => (query.data?.catalog ? createProposalSession(reader, query.data.catalog) : null),
    [reader, query.data?.catalog],
  );
  if (!allowed) return <ForbiddenNotice menuPath={permissionMenuPath} />;
  const back = () => void navigate(worklistPath());
  if (query.isPending)
    return (
      <section aria-label="생산계획 제안 조회 중">
        <SkeletonText lines={5} />
        <Button variant="outlined" onClick={back}>
          작업계획 목록으로
        </Button>
      </section>
    );
  if (query.isError)
    return (
      <AlertBanner
        variant="error"
        title="제안 조회 실패"
        action={<Button onClick={() => void query.refetch()}>다시 조회</Button>}
      >
        {apiErrorText(toApiError(query.error))}
        <Button variant="outlined" onClick={back}>
          작업계획 목록으로
        </Button>
      </AlertBanner>
    );
  const data = query.data;
  return (
    <div className="erp-wo-result-page">
      {data.warnings.map((message) => (
        <AlertBanner key={message} variant="warning" title={message} />
      ))}
      {!ids.length && (
        <p className="field-note">
          조회 대상: 조치 필요 ERP W/O 최근 20건. 다른 대상은 작업계획 목록에서 선택할 수 있습니다.
        </p>
      )}
      {data.rows.length && data.catalog ? (
        <ProposalReview
          key={query.dataUpdatedAt}
          initialProposals={data.rows}
          onClose={back}
          resourceSource={(row, operation, field) =>
            liveResourceSource(api.client, data.catalog!, row, field, operation)
          }
          onRevalidate={transport?.revalidate}
          onChooseDrafts={transport?.chooseDrafts}
          onReload={transport?.reload}
          errorText={transport?.error}
          onConfirmRow={
            transport
              ? async (row) => {
                  const result = await transport.confirm(row);
                  await queryClient.invalidateQueries({
                    queryKey: ['production-order-proposal-audit', row.id],
                  });
                  await queryClient.invalidateQueries({
                    predicate: (query) =>
                      ['production-orders', 'production-plans', 'work-orders'].includes(
                        String(query.queryKey[0]),
                      ),
                  });
                  return result;
                }
              : undefined
          }
        />
      ) : (
        <EmptyState
          title="조회된 생산계획 제안이 없습니다"
          action={<Button onClick={back}>작업계획 목록으로</Button>}
        />
      )}
    </div>
  );
};
