import { AlertBanner, Button, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { NewProductionPlanDefaults } from './editor-state';
import { ProductionPlanEditorPane, type ProductionPlanEditorOption } from './editor-pane';
import { useProductionPlanEditorSession } from './editor-session';
import { ProductionPlanRowActions } from './row-actions';

const t = messages.productionPlan.editor;

interface ProductionPlanEditorSectionProps {
  productionOrderId: number;
  orderQty: number;
  uomId: number;
  uomLabel: string;
  defaults: NewProductionPlanDefaults;
  bomOptions: ProductionPlanEditorOption[];
  routingOptions: ProductionPlanEditorOption[];
  lineOptions: ProductionPlanEditorOption[];
  addDisabled?: boolean;
  onShowResults?: (productionPlanId: number) => void;
}

export const ProductionPlanEditorSection = ({
  productionOrderId,
  orderQty,
  uomId,
  uomLabel,
  defaults,
  bomOptions,
  routingOptions,
  lineOptions,
  addDisabled = false,
  onShowResults,
}: ProductionPlanEditorSectionProps) => {
  const editor = useProductionPlanEditorSession(productionOrderId);

  if (!editor.isHydrated) {
    if (editor.plans.isError) {
      return (
        <AlertBanner
          variant="error"
          title={t.loadFailed}
          action={
            <Button size="sm" variant="outlined" onClick={() => void editor.plans.refetch()}>
              {t.retry}
            </Button>
          }
        />
      );
    }
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={3} />
      </div>
    );
  }
  const rowsByKey = new Map(editor.rows.map((row) => [row.key, row]));

  return (
    <>
      {editor.plans.isError && (
        <AlertBanner
          variant="error"
          title={t.staleTitle}
          action={
            <Button size="sm" variant="outlined" onClick={() => void editor.plans.refetch()}>
              {t.retry}
            </Button>
          }
        >
          {t.staleDescription}
        </AlertBanner>
      )}
      <ProductionPlanEditorPane
        rows={editor.rows}
        orderQty={orderQty}
        uomLabel={uomLabel}
        bomOptions={bomOptions}
        routingOptions={routingOptions}
        lineOptions={lineOptions}
        addDisabled={addDisabled || editor.plans.isError}
        onAdd={() => editor.add(defaults)}
        onChange={editor.change}
        onRemove={editor.remove}
        renderActions={(displayRow) => {
          const row = rowsByKey.get(displayRow.key);
          return row === undefined ? null : (
            <ProductionPlanRowActions
              row={row}
              context={{ productionOrderId, uomId }}
              onPending={editor.markPending}
              onErrors={editor.setErrors}
              onSettle={editor.settle}
              onRemove={editor.remove}
              onShowResults={onShowResults}
            />
          );
        }}
      />
    </>
  );
};
