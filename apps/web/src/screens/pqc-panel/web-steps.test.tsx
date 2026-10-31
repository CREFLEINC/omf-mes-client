import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { DispositionState } from '../pqc-inspection/disposition';
import { EMPTY_QUANTITY_DRAFT, type QuantityDraft } from '../pqc-inspection/quantity-draft';

import { autoJudgmentOf, PqcWebSteps } from './web-steps';

const t = messages.pqcInspectionRegister.web;

const Harness = ({ initialJudgment = '' }: { initialJudgment?: string }) => {
  const [draft, setDraft] = useState<QuantityDraft>(EMPTY_QUANTITY_DRAFT);
  const [judgment, setJudgment] = useState(initialJudgment);
  const [disposition, setDisposition] = useState<DispositionState>(null);
  return (
    <>
      <output aria-label="판정 값">{judgment}</output>
      <PqcWebSteps
        rows={[]}
        drafts={{}}
        onValueChange={() => undefined}
        onItemJudgmentChange={() => undefined}
        itemJudgmentOptions={[]}
        uomCodeOf={() => null}
        itemsLoading={false}
        inspectionPlanVersionId={null}
        inspectedQty={10}
        inspectionRound={null}
        uomCode="EA"
        draft={draft}
        onChange={setDraft}
        fieldErrors={{}}
        showErrors={false}
        judgmentOptions={[
          { value: 'ACCEPTED', label: '합격' },
          { value: 'REJECTED', label: '불합격' },
        ]}
        judgment={judgment}
        onJudgmentChange={setJudgment}
        disposition={disposition}
        onDispositionChange={setDisposition}
        isLocked={false}
      />
    </>
  );
};

const judgmentValue = () => screen.getByLabelText('판정 값');

/** PQC 관리웹 단계의 자동 판정(#197) — 근거가 생기면 채우고, 사라지면 비우고, 사람이 고른 값은 둔다. */
describe('PqcWebSteps 자동 판정', () => {
  it('수량으로 판정을 채우고, 근거가 사라지면 비운다', async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText(t.quantity.accepted), '10');
    expect(judgmentValue()).toHaveTextContent('ACCEPTED');

    await userEvent.type(screen.getByLabelText(t.quantity.rejected), '1');
    expect(judgmentValue()).toHaveTextContent('REJECTED');

    await userEvent.clear(screen.getByLabelText(t.quantity.rejected));
    await userEvent.clear(screen.getByLabelText(t.quantity.accepted));
    expect(judgmentValue()).toHaveTextContent(/^$/);
  });

  it('저장돼 되살린 판정은 수량을 고쳐도 바꾸지 않는다', async () => {
    render(<Harness initialJudgment="ACCEPTED" />);

    await userEvent.type(screen.getByLabelText(t.quantity.rejected), '1');
    expect(judgmentValue()).toHaveTextContent('ACCEPTED');
  });
});

const draft = (accepted: string, rejected: string, held: string) => ({ accepted, rejected, held });

/** PQC [확정] 때 채우는 최종 판정(사용자 지시 2026-10-29 · #197) — IQC 와 같은 규칙. */
describe('autoJudgmentOf (PQC)', () => {
  it.each([
    [draft('100', '', ''), 'ACCEPTED'],
    [draft('100', '0', '0'), 'ACCEPTED'],
    [draft('99', '1', '0'), 'REJECTED'],
    [draft('50', '1', '0'), 'REJECTED'],
    [draft('99', '0', '1'), null],
    [draft('99', '', ''), null],
    [draft('x', '', ''), null],
  ])('검사 수량 100 · %o → %s', (quantities, expected) => {
    expect(autoJudgmentOf(quantities, 100)).toBe(expected);
  });
});
