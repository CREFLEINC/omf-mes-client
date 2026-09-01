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

  /**
   * ⭐ **수량과 확정 시각이 한 줄로 이어 붙지 않는다.**
   *
   * 그냥 `<span>` 둘을 나란히 두면 인라인이라 「보류 5확정 2026-08-30 10:00」으로 읽히고,
   * 수량 칸이라 **「5확정」이 값처럼 보인다.**
   *
   * ⚠ **부분 일치(`toHaveTextContent`)로는 못 잡는다** — 붙어 있어도 통과한다. jsdom 에는
   * 배치가 없어 「두 줄로 보이는가」를 잴 수 없으므로, **그 갈라짐을 만드는 구조**를 본다.
   */
  it('수량과 확정 시각을 줄로 가른다 — 붙으면 「5확정」이 값처럼 읽힌다', () => {
    renderWithProviders(
      <RoundHistory
        rounds={[reinspectionRound, confirmedRound].map(toInspectionResultRound)}
        currentResultId={null}
      />,
    );

    const [first] = within(screen.getByRole('list')).getAllByRole('listitem');
    const stacked = first?.querySelector('.stacked-cell');

    expect(stacked).not.toBeNull();

    const lines = within(stacked as HTMLElement);

    /* 각 줄의 글자가 «정확히» 그 값이다 — 한 마디로 합쳐지면 둘 다 죽는다. */
    expect(lines.getByText('합격 480 · 불합격 15 · 보류 5')).toBeInTheDocument();
    expect(lines.getByText(t.confirmedAt('2026-08-30 10:00'))).toBeInTheDocument();
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

  /**
   * ⭐ **재검사 중에는 회차 하나여도 그린다.** 그때 폼에는 회차가 넘어가지 않으므로(「아직 없는
   * 새 회차」다), 이력까지 감추면 검사자가 **「앞에 무엇이 있었나」를 볼 자리가 화면 어디에도
   * 없는 채로** 되돌릴 수 없는 쓰기를 친다.
   */
  it('재검사 중에는 회차가 하나여도 앞 회차를 보인다', () => {
    renderWithProviders(
      <RoundHistory
        rounds={[toInspectionResultRound(confirmedRound)]}
        currentResultId={null}
        isReinspecting
      />,
    );

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('합격 480 · 불합격 15 · 보류 5')).toBeInTheDocument();
  });

  it('회차가 아예 없으면 재검사 중이라도 그리지 않는다 — 없는 것을 설명하지 않는다', () => {
    renderWithProviders(<RoundHistory rounds={[]} currentResultId={null} isReinspecting />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
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
