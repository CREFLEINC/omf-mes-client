import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { stepViewFixtures } from './fixtures';
import { STEP_COLUMN_WIDTH, StepPane, type StepPaneProps } from './step-pane';

const t = messages.approvalRoute;

/** 우 칸의 폭 예산. 1280px 창에서 약 560px이다. */
const RIGHT_PANE_BUDGET = 560;

const renderPane = (overrides: Partial<StepPaneProps> = {}) =>
  render(<StepPane steps={stepViewFixtures} isLoading={false} loadError={null} {...overrides} />);

const rowOf = (text: string): HTMLElement =>
  screen.getAllByRole('row').find((row) => within(row).queryByText(text) !== null) as HTMLElement;

describe('StepPane — 단계 표', () => {
  it('단계마다 한 줄을 낸다', () => {
    renderPane();

    expect(screen.getAllByRole('row')).toHaveLength(stepViewFixtures.length + 1);
  });

  it('순서를 응답 값 그대로 낸다', () => {
    renderPane();

    const cells = screen.getAllByRole('cell').filter((cell) => cell.textContent === '1');

    expect(cells.length).toBeGreaterThan(0);
  });

  it('승인자 이름과 부서를 응답 값 그대로 쓴다', () => {
    renderPane();

    expect(screen.getByText('합성 승인자1 · 합성부서 가')).toBeInTheDocument();
  });

  it('이름이 오지 않은 승인자는 번호가 아니라 사유로 적는다', () => {
    renderPane();

    // 선행 단언 — 이름이 있는 줄은 이름이 나와야 「번호가 없다」가 뜻을 갖는다.
    expect(screen.getByText('합성 승인자1 · 합성부서 가')).toBeInTheDocument();
    expect(screen.getByText(t.values.approverUnknown)).toBeInTheDocument();
    expect(screen.getByRole('table').textContent).not.toContain('9303');
    expect(screen.getByRole('table').textContent).not.toContain('9203');
  });

  it('사용 중지된 승인자에 글자 표식과 사유가 함께 선다', () => {
    renderPane();

    const row = rowOf('합성 승인자2 · 합성부서 나');

    expect(within(row).getByText(t.values.approverInactive)).toBeInTheDocument();
    expect(within(row).getByText(t.notes.approverInactiveWarning)).toBeInTheDocument();
  });

  it('사용 중인 승인자에는 경고를 붙이지 않는다', () => {
    renderPane();

    const row = rowOf('합성 승인자1 · 합성부서 가');

    expect(within(row).getByText(t.values.approverActive)).toBeInTheDocument();
    expect(within(row).queryByText(t.notes.approverInactiveWarning)).not.toBeInTheDocument();
  });
});

describe('StepPane — 상시 안내', () => {
  /**
   * 셋 다 결재선을 보는 내내 참인 사실이다. 성공 알림에 붙이면 알림과 함께 사라져,
   * 정작 결재선을 고치는 사람이 읽을 자리가 없다.
   */
  it('세 줄을 늘 낸다', () => {
    renderPane();

    expect(screen.getByText(t.notes.stepGuideApproverAbsent)).toBeInTheDocument();
    expect(screen.getByText(t.notes.stepGuideNotRetroactive)).toBeInTheDocument();
    expect(screen.getByText(t.notes.stepGuideRejectResubmit)).toBeInTheDocument();
  });

  it('단계가 하나도 없어도 세 줄이 남는다', () => {
    renderPane({ steps: [] });

    expect(screen.getByText(t.notes.stepGuideApproverAbsent)).toBeInTheDocument();
    expect(screen.getByText(t.notes.stepGuideNotRetroactive)).toBeInTheDocument();
    expect(screen.getByText(t.notes.stepGuideRejectResubmit)).toBeInTheDocument();
  });
});

describe('StepPane — 빈 상태와 실패', () => {
  it('단계가 0이면 표의 빈 자리가 안내를 맡는다', () => {
    renderPane({ steps: [] });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.empty.noStepsTitle)).toBeInTheDocument();
  });

  it('조회 실패는 빈 상태가 아니다', () => {
    renderPane({ steps: [], loadError: <p>단계 조회 실패 배너</p> });

    expect(screen.getByText('단계 조회 실패 배너')).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noStepsTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 자리 표시를 낸다', () => {
    renderPane({ steps: [], isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.steps })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noStepsTitle)).not.toBeInTheDocument();
  });
});

describe('StepPane — 이 회차의 경계', () => {
  it('읽기 전용이라 순서 이동도 삭제도 없다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: '위로 이동' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '아래로 이동' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('정렬 가능한 열을 두지 않는다', () => {
    // 행 순서가 곧 자료다 — 정렬을 켜면 순서 이동이 잠기고 표시와 자료가 어긋난다.
    renderPane();

    for (const header of screen.getAllByRole('columnheader')) {
      expect(within(header).queryByRole('button')).toBeNull();
    }
  });

  it('폭 없는 흡수 열이 하나뿐이고 지정 폭 합이 예산 안이다', () => {
    const { container } = renderPane();

    const widths = [...container.querySelectorAll('col')].map((col) => col.style.width);

    expect(widths.filter((width) => width === '')).toHaveLength(1);

    const sum = Object.values(STEP_COLUMN_WIDTH).reduce(
      (total, width) => total + Number.parseInt(width, 10),
      0,
    );

    expect(sum).toBeLessThan(RIGHT_PANE_BUDGET);
  });
});
