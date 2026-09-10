import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IssueOutcome } from './issue-outcome';
import type { IssueRunResult } from './mutations';

const printed = (lotNo: string | null, issueSeq = 1): IssueRunResult => ({
  lineId: 1,
  isPrinted: true,
  failedAt: null,
  hasCreatedLot: true,
  hasPrintedLabel: true,
  issue: { documentIssueLogId: 44001, issueSeq, lotNo, printOutcome: 'SUCCEEDED' },
  error: null,
});

describe('IssueOutcome — 인쇄 결과 띠', () => {
  /**
   * ⭐ 「LOT」만 쓰면 뒤에 붙는 값이 무엇인지 읽히지 않는다. 채번 대상 칸과 같은 말로 「LOT 번호」다.
   */
  it('무엇이 붙는 값인지 말한다 — LOT 번호', () => {
    render(<IssueOutcome result={printed('ML053671799')} />);

    expect(screen.getByText(/LOT 번호/u)).toBeInTheDocument();
  });

  /** 번호를 못 받았으면 빈 이름표를 세우지 않는다 — 회차만 말한다. */
  it('번호가 없으면 이름표도 세우지 않는다', () => {
    render(<IssueOutcome result={printed(null)} />);

    expect(screen.getByText('인쇄했습니다. 1회차')).toBeInTheDocument();
  });

  /**
   * ⛔ **닫는 조작을 두지 않는다.** 스펙 §3·§5 에 이 띠를 닫는 단추가 없고, 닫히면 결과가
   * 지워져 화면의 차단까지 함께 풀린다(§5-2). 다른 자재를 고르면 자연히 사라진다.
   */
  it('닫기 단추를 주지 않는다', () => {
    render(<IssueOutcome result={printed('ML053671799')} />);

    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
  });
});
