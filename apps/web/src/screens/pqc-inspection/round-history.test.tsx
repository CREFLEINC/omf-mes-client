import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { confirmedRound, draftRound } from './fixtures';
import { RoundHistory } from './round-history';
import { formatDateTime, toInspectionResultRound } from './types';

const t = messages.pqcInspection.history;

describe('RoundHistory', () => {
  /*
   * ⭐ 재검사가 없는 의뢰가 대다수다. 「이전 회차 없음」을 내면 그 대다수에서 화면이 없는
   * 것을 설명하느라 길어진다 — 이력은 쌓였을 때만 볼 것이다.
   */
  it('이전 회차가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<RoundHistory rounds={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('회차와 판정을 읽기 값으로 보인다', () => {
    render(<RoundHistory rounds={[toInspectionResultRound(confirmedRound)]} />);

    expect(screen.getByText(t.heading)).toBeInTheDocument();
    expect(screen.getByText(confirmedRound.overallJudgmentCode)).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime(confirmedRound.confirmedAt as string)),
    ).toBeInTheDocument();
  });

  /*
   * ⛔ **정정하는 자리가 아니다.** 누를 것이 하나라도 있으면 「여기서 고칠 수 있다」로 읽힌다 —
   * 앞 회차는 고치지 않고 새 회차를 쌓는다(§5-3).
   */
  it('누를 것을 두지 않는다 — 읽기 전용이다', () => {
    render(<RoundHistory rounds={[toInspectionResultRound(confirmedRound)]} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  /* 확정되지 않은 채 넘어간 회차도 이력에 남는다 — 빈칸으로 두면 못 불러온 것과 같아 보인다. */
  it('확정되지 않은 회차의 시각을 빈칸으로 두지 않는다', () => {
    render(<RoundHistory rounds={[toInspectionResultRound(draftRound)]} />);

    expect(screen.getByText(t.notConfirmed)).toBeInTheDocument();
  });
});
