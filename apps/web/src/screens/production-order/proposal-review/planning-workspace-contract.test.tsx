import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { ProductionPlanDraft } from '../../production-plan/editor-model';
import { renderWithProviders, jsonResponse } from '../../../test/api-harness';
import { planningDaysResponse } from '../../../test/planning-day-fixture';
import { ProposalReview } from './review';
import { previewProposals, previewResourceSource } from './preview';
import { ProposalPlanningWorkspace } from './planning-workspace';
import { proposalBody } from './proposal-api';

vi.mock('../process/master-details', () => ({
  MasterDetails: ({ onRoutingChange }: { onRoutingChange: (id: string) => void }) => (
    <button onClick={() => onRoutingChange('102')}>시험 Routing 적용</button>
  ),
}));
vi.mock('../process/plan-step', () => ({
  PlanStep: ({
    onSplit,
    onAppend,
    rows,
  }: {
    onSplit: (
      row: { key: string },
      parts: Pick<ProductionPlanDraft, 'plannedQty' | 'planDate' | 'planDateSourceCode'>[],
    ) => void;
    onAppend: (drafts: ProductionPlanDraft[]) => void;
    rows: { key: string }[];
  }) => (
    <>
      <button
        onClick={() =>
          onSplit(rows[0]!, [
            { plannedQty: '50', planDate: '2026-11-18', planDateSourceCode: 'SYSTEM' },
            { plannedQty: '50', planDate: '2026-11-19', planDateSourceCode: 'SYSTEM' },
          ])
        }
      >
        시험 순차 분할
      </button>
      <button
        onClick={() =>
          onAppend([
            {
              plannedQty: '10',
              planDate: '2026-11-19',
              planDateSourceCode: 'SYSTEM',
              plannedLineId: '1',
              bomId: '1',
              routingId: '101',
              remarks: '',
            },
          ])
        }
      >
        시험 자동 분배
      </button>
    </>
  ),
}));
const row = () => {
  const value = structuredClone(previewProposals[0]!);
  value.itemId = 1;
  value.plantId = 1;
  value.live = true;
  value.validated = true;
  value.basis = {
    productionOrder: '1',
    plans: '1',
    bom: '1',
    routing: '1',
    resources: '1',
    calendar: '1',
  };
  value.plans[0]!.bomId = 1;
  value.plans[0]!.routingId = 101;
  value.plans[0]!.routingOptions = undefined;
  value.plans[0]!.operations.forEach((op, i) => (op.routingOperationId = i + 10));
  return value;
};
describe('proposal workspace contract boundaries', () => {
  it('human split/distribution dates use USER in proposal bodies, independently of the shared manual calendar source', async () => {
    const value = row();
    const changed = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ProposalPlanningWorkspace
        row={value}
        pending={false}
        onPlansChange={changed}
        source={previewResourceSource}
        edit={vi.fn()}
        pick={vi.fn()}
      />,
      { fetch: async () => jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } }) },
    );
    await user.click(screen.getByRole('button', { name: '시험 순차 분할' }));
    const plans = changed.mock.calls[0]![0];
    expect(proposalBody({ ...value, plans }).plans.map((plan) => plan.planDateSourceCode)).toEqual([
      'USER',
      'USER',
    ]);
    await user.click(screen.getByRole('button', { name: '시험 자동 분배' }));
    const distributed = changed.mock.calls[1]![0];
    expect(proposalBody({ ...value, plans: distributed }).plans.at(-1)?.planDateSourceCode).toBe(
      'USER',
    );
  });
  it('starting a Routing load invalidates selection and blocks confirmation before the response arrives', async () => {
    const value = row();
    const user = userEvent.setup();
    let finish!: (response: Response) => void;
    renderWithProviders(
      <ProposalReview
        initialProposals={[value]}
        resourceSource={previewResourceSource}
        onClose={() => {}}
        onConfirmRow={vi.fn()}
        onRevalidate={vi.fn()}
      />,
      {
        fetch: async (input) => {
          const request = input as Request;
          const url = new URL(request.url);
          if (url.pathname.endsWith('working-days:resolve')) return planningDaysResponse(request);
          if (url.pathname === '/planning/routings')
            return jsonResponse({
              items: [
                {
                  routingId: 102,
                  itemId: 1,
                  routingCode: 'NEW-RT',
                  routingVersion: 1,
                  statusCode: 'CONFIRMED',
                  isDefault: false,
                },
              ],
            });
          if (url.pathname === '/planning/routings/102/operations')
            return new Promise<Response>((resolve) => {
              finish = resolve;
            });
          return jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } });
        },
      },
    );
    await user.click(screen.getByRole('checkbox', { name: `${value.number} 확정 선택` }));
    expect(screen.getByRole('button', { name: '선택 제안 확정' })).toBeEnabled();
    await user.click(screen.getByRole('tab', { name: 'BOM 및 Routing' }));
    await user.click(screen.getByRole('button', { name: '시험 Routing 적용' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '선택 제안 확정' })).toBeDisabled(),
    );
    expect(screen.getByRole('checkbox', { name: `${value.number} 확정 선택` })).not.toBeChecked();
    expect(screen.getByRole('button', { name: '제안 재검증' })).toBeDisabled();
    finish(jsonResponse({ items: [] }));
    await waitFor(() => expect(screen.getByRole('button', { name: '제안 재검증' })).toBeEnabled());
    expect(screen.getByRole('checkbox', { name: `${value.number} 확정 선택` })).toBeDisabled();
  });
});
