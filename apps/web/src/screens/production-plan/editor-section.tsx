import { AlertBanner, Button, SkeletonText } from '@crefle/web-ui';

import type { NewProductionPlanDefaults } from './editor-state';
import { ProductionPlanEditorPane, type ProductionPlanEditorOption } from './editor-pane';
import { useProductionPlanEditorSession } from './editor-session';
import { ProductionPlanRowActions } from './row-actions';

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
          title="생산계획을 불러오지 못했습니다."
          action={
            <Button size="sm" variant="outlined" onClick={() => void editor.plans.refetch()}>
              다시 시도
            </Button>
          }
        />
      );
    }
    return (
      <div role="status" aria-label="생산계획을 불러오는 중">
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
          title="최신 생산계획을 확인하지 못했습니다."
          action={
            <Button size="sm" variant="outlined" onClick={() => void editor.plans.refetch()}>
              다시 시도
            </Button>
          }
        >
          현재 편집 내용은 유지됩니다. 다시 조회한 뒤 신규 계획을 추가하세요.
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
