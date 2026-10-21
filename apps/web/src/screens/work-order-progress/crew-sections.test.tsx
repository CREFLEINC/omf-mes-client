import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CrewSections } from './crew-sections';
import type { WorkOrderCrew } from './queries';

const t = messages.workOrderProgress.detail;

const crew = (overrides: Partial<WorkOrderCrew> = {}): WorkOrderCrew => ({
  sessions: [
    {
      workSessionId: 1,
      sessionNo: 1,
      startedAt: '2026-10-20T08:00:00+09:00',
      endedAt: null,
      participants: [
        {
          workSessionWorkerId: 11,
          workerId: 101,
          workerNo: 'W101',
          workerName: '홍길동',
          role: 'MAIN',
          joinedAt: '2026-10-20T08:00:00+09:00',
          leftAt: null,
          participatedMinutes: 30.256,
        },
      ],
    },
  ],
  workerResults: [
    {
      workerId: 101,
      workerNo: 'W101',
      workerName: '홍길동',
      role: 'MAIN',
      goodQty: 60,
      defectQty: 1,
      holdQty: 0,
      scrapQty: 0,
      reworkQty: 0,
    },
  ],
  sessionsTruncated: false,
  resultsTruncated: false,
  ...overrides,
});

describe('CrewSections', () => {
  it('세션마다 시작·종료와 참여자 표를 둔다', () => {
    render(<CrewSections crew={crew()} isLoading={false} isError={false} />);

    const block = screen.getByRole('region', { name: t.sessions.session(1) });
    expect(within(block).getByText(t.sessions.ongoing)).toBeInTheDocument();
    const table = within(block).getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      t.sessions.columns.worker,
      t.sessions.columns.role,
      t.sessions.columns.joinedAt,
      t.sessions.columns.leftAt,
      t.sessions.columns.minutes,
    ]);
    expect(within(table).getByText(t.workerLabel('홍길동', 'W101'))).toBeInTheDocument();
    expect(within(table).getByText(t.roles.MAIN)).toBeInTheDocument();
    expect(within(table).getByText('30.26')).toBeInTheDocument();
  });

  it('작업자별 실적은 양품·불량만 두고, 다른 수량은 0 이 아닐 때만 연다', () => {
    const { rerender } = render(<CrewSections crew={crew()} isLoading={false} isError={false} />);
    const headers = () =>
      within(screen.getByRole('region', { name: t.workerResults.heading }))
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent);

    expect(headers()).toEqual([
      t.workerResults.columns.worker,
      t.workerResults.columns.role,
      t.workerResults.columns.goodQty,
      t.workerResults.columns.defectQty,
    ]);

    const [first] = crew().workerResults;
    if (first === undefined) throw new Error('행 없음');
    rerender(
      <CrewSections
        crew={crew({ workerResults: [{ ...first, scrapQty: 2 }] })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(headers()).toContain(t.workerResults.columns.scrapQty);
    expect(headers()).not.toContain(t.workerResults.columns.holdQty);
  });

  it('이름·사번을 모르면 내부 번호 대신 「알 수 없음」이다', () => {
    const [first] = crew().workerResults;
    if (first === undefined) throw new Error('행 없음');
    render(
      <CrewSections
        crew={crew({ workerResults: [{ ...first, workerNo: null, workerName: null }] })}
        isLoading={false}
        isError={false}
      />,
    );

    const table = within(screen.getByRole('region', { name: t.workerResults.heading }));
    expect(table.getByText(t.unknownWorker)).toBeInTheDocument();
    expect(table.queryByText(/#101/)).toBeNull();
  });

  it('무엇을 다 받지 못했는지 갈라 말한다', () => {
    const { rerender } = render(
      <CrewSections crew={crew({ sessionsTruncated: true })} isLoading={false} isError={false} />,
    );
    expect(screen.getByText(t.sessionsTruncated)).toBeInTheDocument();
    expect(screen.queryByText(t.resultsTruncated)).toBeNull();

    rerender(
      <CrewSections crew={crew({ resultsTruncated: true })} isLoading={false} isError={false} />,
    );
    expect(screen.getByText(t.resultsTruncated)).toBeInTheDocument();
  });

  it('세션이 없으면 그 사실을 적고, 실패하면 오류 띠를 낸다', () => {
    const { rerender } = render(
      <CrewSections crew={crew({ sessions: [] })} isLoading={false} isError={false} />,
    );
    expect(screen.getByText(t.sessions.empty)).toBeInTheDocument();

    rerender(<CrewSections crew={undefined} isLoading={false} isError />);
    expect(screen.getByText(t.crewLoadError)).toBeInTheDocument();
  });
});
