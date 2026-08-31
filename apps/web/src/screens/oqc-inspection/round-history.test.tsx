import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { confirmedRound, draftRound, reinspectionRound } from './fixtures';
import { RoundHistory } from './round-history';
import { toInspectionResultRound } from './types';

const t = messages.oqcInspection.history;

describe('RoundHistory', () => {
  it('회차가 하나뿐이면 아무것도 그리지 않는다 — 없는 것을 설명하느라 화면이 길어진다', () => {
    renderWithProviders(
      <RoundHistory rounds={[toInspectionResultRound(confirmedRound)]} currentResultId={null} />,
    );

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText(t.heading)).not.toBeInTheDocument();
  });

  it('회차를 오름차순으로 세우고 판정 코드를 그대로 보인다', () => {
    renderWithProviders(
      <RoundHistory
        rounds={[reinspectionRound, confirmedRound].map(toInspectionResultRound)}
        currentResultId={null}
      />,
    );

    const steps = within(screen.getByRole('list')).getAllByRole('listitem');

    expect(steps).toHaveLength(2);
    /* ⛔ 표시명으로 옮기지 않는다 — 코드 그대로가 오히려 정확하다. */
    expect(steps[0]).toHaveTextContent(confirmedRound.overallJudgmentCode);
    expect(steps[1]).toHaveTextContent(reinspectionRound.overallJudgmentCode);
    expect(steps[0]).toHaveTextContent('합격 480 · 불합격 15 · 보류 5');
  });

  it('읽기 전용이다 — 앞 회차를 고치는 자리가 아니므로 누를 것을 두지 않는다', () => {
    renderWithProviders(
      <RoundHistory
        rounds={[reinspectionRound, confirmedRound].map(toInspectionResultRound)}
        currentResultId={null}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('확정되지 않은 회차의 확정 시각을 빈칸으로 두지 않는다', () => {
    renderWithProviders(
      <RoundHistory
        rounds={[draftRound, confirmedRound].map(toInspectionResultRound)}
        currentResultId={draftRound.inspectionResultId}
      />,
    );

    expect(screen.getByText(t.notConfirmed)).toBeInTheDocument();
  });
});
