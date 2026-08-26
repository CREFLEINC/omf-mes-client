import { AlertBanner, Breadcrumb, Button, EmptyState, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import {
  describeReference,
  resolveReference,
  useUomReferenceLookup,
} from '../production-order/reference-lookups';
import { useRoutingOperations } from '../routing/queries';
import { validateWorkOrderAssignmentDraft, workOrderAssignmentDraftFrom } from './assignment-model';
import { toWorkOrderPageView } from './pagination';
import { useWorkOrderList, useWorkOrderValidation, type WorkOrderFact } from './queries';
import { useWorkOrderScreenContext } from './screen-context';
import {
  readWorkOrderProductionPlanId,
  toWorkOrderScreenRow,
  workOrderFieldErrorMessage,
} from './screen-model';
import { WorkOrderAssignmentEditor } from './work-order-assignment-editor';
import { WorkOrderListPane } from './work-order-list-pane';

const t = messages.workOrder.screen.view;
const emptyPage = { page: 1, size: 1, total: 0 };
const breadcrumb = <Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />;

const priorityError = (fact: WorkOrderFact, priorityText: string): string | undefined => {
  const error = validateWorkOrderAssignmentDraft({
    ...workOrderAssignmentDraftFrom(fact),
    priorityNo: priorityText,
  }).fieldErrors.priorityNo;
  return error === undefined ? undefined : workOrderFieldErrorMessage(error);
};

export const WorkOrderAssignmentWorkspace = ({
  productionPlanId,
}: {
  productionPlanId: number;
}) => {
  const [page, setPage] = useState(1);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<number | null>(null);
  const [priorities, setPriorities] = useState<Record<number, string>>({});
  const context = useWorkOrderScreenContext(productionPlanId);
  const workOrders = useWorkOrderList(productionPlanId, page);
  const exactPlan =
    context.productionPlanQuery.data?.productionPlanId === productionPlanId
      ? context.productionPlanQuery.data
      : undefined;
  const exactOrder =
    exactPlan !== undefined &&
    context.productionOrderQuery.data?.productionOrderId === exactPlan.productionOrderId
      ? context.productionOrderQuery.data
      : undefined;
  const operations = useRoutingOperations(exactPlan?.routingId ?? null);
  const uoms = useUomReferenceLookup();
  const listOwnerMismatch =
    workOrders.data?.items.some((item) => item.productionPlanId !== productionPlanId) ?? false;
  const listPageMismatch =
    workOrders.data !== undefined &&
    (workOrders.data.page.page !== page ||
      !Number.isSafeInteger(workOrders.data.page.size) ||
      workOrders.data.page.size < 1 ||
      !Number.isSafeInteger(workOrders.data.page.total) ||
      workOrders.data.page.total < workOrders.data.items.length ||
      workOrders.data.items.length > workOrders.data.page.size ||
      (workOrders.data.items.length > 0 &&
        (page - 1) * workOrders.data.page.size + workOrders.data.items.length >
          workOrders.data.page.total));
  const ownerMismatch =
    (context.productionPlanQuery.data !== undefined && exactPlan === undefined) ||
    (exactPlan !== undefined &&
      context.productionOrderQuery.data !== undefined &&
      exactOrder === undefined) ||
    listOwnerMismatch ||
    (exactPlan !== undefined &&
      (operations.data?.items.some((item) => item.routingId !== exactPlan.routingId) ?? false));
  const sourceError =
    context.productionPlanQuery.isError ||
    context.productionOrderQuery.isError ||
    workOrders.isError ||
    operations.isError ||
    uoms.isError;
  const ready =
    !ownerMismatch &&
    !listPageMismatch &&
    exactPlan !== undefined &&
    exactOrder !== undefined &&
    workOrders.data !== undefined &&
    operations.data !== undefined &&
    !uoms.isLoading;
  const selected = ready
    ? workOrders.data.items.find((item) => item.workOrderId === selectedWorkOrderId)
    : undefined;
  const validation = useWorkOrderValidation(selected?.workOrderId ?? null);
  const stale = ready && (sourceError || validation.isError);
  const failed = ownerMismatch || listPageMismatch || (!ready && sourceError);
  const operationLabels = new Map(
    operations.data?.items.map((operation, index) => [
      operation.routingOperationId,
      `${String(index + 1)}. ${operation.operationName}`,
    ]) ?? [],
  );
  const rows = ready
    ? workOrders.data.items.map((fact) => {
        const priorityText = priorities[fact.workOrderId] ?? String(fact.priorityNo);
        return toWorkOrderScreenRow(fact, {
          operationLabel: operationLabels.get(fact.routingOperationId),
          uomLabel: describeReference(resolveReference(uoms, fact.uomId)),
          priorityText,
          priorityError: priorityError(fact, priorityText),
          validationFailed: fact.workOrderId === selected?.workOrderId && validation.isError,
          ...(fact.workOrderId === selected?.workOrderId && validation.data !== undefined
            ? { validationReport: validation.data }
            : {}),
        });
      })
    : [];
  const retry = (
    <Button
      size="sm"
      variant="outlined"
      onClick={() => {
        void context.productionPlanQuery.refetch();
        if (exactPlan !== undefined) void context.productionOrderQuery.refetch();
        void workOrders.refetch();
        if (exactPlan !== undefined) void operations.refetch();
        if (selected !== undefined) void validation.refetch();
        uoms.refetch();
      }}
    >
      {t.retry}
    </Button>
  );
  const loadError = failed ? (
    <AlertBanner
      variant="error"
      title={ownerMismatch ? t.ownerMismatch : t.failed}
      action={retry}
    />
  ) : null;

  return (
    <>
      {ready && (
        <section className="pane" aria-label={t.contextPane}>
          <h2>{exactPlan.planNo}</h2>
          <p>{t.context(exactOrder.productionOrderNo, workOrders.data.page.total)}</p>
        </section>
      )}
      {stale && (
        <AlertBanner variant="error" title={t.stale} action={retry}>
          {t.staleDescription}
        </AlertBanner>
      )}
      <WorkOrderListPane
        rows={rows}
        selectedWorkOrderId={selected?.workOrderId ?? null}
        isLoading={!failed && !ready}
        loadError={loadError}
        priorityDisabledReason={stale ? t.staleBlocked : null}
        page={toWorkOrderPageView(workOrders.data?.page ?? emptyPage, rows.length)}
        onSelect={setSelectedWorkOrderId}
        onPriorityChange={(workOrderId, value) => {
          setSelectedWorkOrderId(workOrderId);
          setPriorities((current) => ({ ...current, [workOrderId]: value }));
        }}
        onChangePage={(nextPage) => {
          setPage(nextPage);
          setSelectedWorkOrderId(null);
        }}
      />
      {ready &&
        (selected === undefined ? (
          <section className="pane" aria-label={t.editorPane}>
            <EmptyState
              size="sm"
              live
              title={t.selectWorkOrder}
              description={t.selectDescription}
            />
          </section>
        ) : (
          <WorkOrderAssignmentEditor
            workOrderId={selected.workOrderId}
            plantId={exactOrder.plantId}
            priorityText={priorities[selected.workOrderId] ?? String(selected.priorityNo)}
            blockedReason={stale ? t.staleBlocked : null}
            onPriorityChange={(value) =>
              setPriorities((current) => ({ ...current, [selected.workOrderId]: value }))
            }
          />
        ))}
    </>
  );
};

export const WorkOrderAssignmentScreen = () => {
  const [searchParams] = useSearchParams();
  const productionPlanId = readWorkOrderProductionPlanId(searchParams);

  return (
    <>
      <PageHeader title={t.title} breadcrumb={breadcrumb} />
      {productionPlanId === null ? (
        <AlertBanner variant="warning" title={t.selectPlan}>
          <Link to="/production/production-plans">{t.selectPlanLink}</Link>
        </AlertBanner>
      ) : (
        <WorkOrderAssignmentWorkspace key={productionPlanId} productionPlanId={productionPlanId} />
      )}
    </>
  );
};
