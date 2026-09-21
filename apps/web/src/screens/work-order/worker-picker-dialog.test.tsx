import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { WorkerPickerDialog } from './worker-picker-dialog';

const mocks = vi.hoisted(() => ({ workers: vi.fn() }));
vi.mock('./people-tool-queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./people-tool-queries')>()),
  useWorkOrderWorkers: mocks.workers,
}));

const worker = (workerId: number) => ({
  workerId,
  workerNo: `SYN-W-${String(workerId)}`,
  workerName: `Synthetic worker ${String(workerId)}`,
  isActive: true,
});

/** 한 쪽 20건 기준으로 `total` 을 만들어 다음 쪽 유무를 가른다. */
const result = (items: ReturnType<typeof worker>[], total = items.length) => ({
  data: { items, page: { page: 1, size: 20, total } },
  isError: false,
  isPending: false,
});

const renderDialog = (onConfirm = vi.fn(), onClose = vi.fn()) => {
  renderWithProviders(<WorkerPickerDialog plantId={501} onConfirm={onConfirm} onClose={onClose} />);
  return { onConfirm, onClose };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workers.mockReturnValue(result([worker(1), worker(2)]));
});

describe('WorkerPickerDialog', () => {
  it('검색어는 「찾기」나 엔터로만 조회에 나가고 쪽은 처음으로 돌아간다', async () => {
    const user = userEvent.setup();
    renderDialog();

    /* 한 쪽에 20건씩 — 화면이 정한 크기를 그대로 서버에 보낸다. */
    expect(mocks.workers).toHaveBeenCalledWith(501, 1, '', 20);

    await user.type(screen.getByRole('textbox', { name: '검색어' }), '김');
    /* 타이핑만으로는 조회하지 않는다 — 검색어는 아직 빈 문자열이다. */
    expect(mocks.workers).not.toHaveBeenCalledWith(501, expect.anything(), '김', 20);

    await user.click(screen.getByRole('button', { name: '찾기' }));
    expect(mocks.workers).toHaveBeenCalledWith(501, 1, '김', 20);

    await user.clear(screen.getByRole('textbox', { name: '검색어' }));
    await user.type(screen.getByRole('textbox', { name: '검색어' }), '박{Enter}');
    expect(mocks.workers).toHaveBeenCalledWith(501, 1, '박', 20);
  });

  it('다음 쪽은 남은 건수가 있을 때만 가고 이전 쪽은 첫 쪽에서 막힌다', async () => {
    const user = userEvent.setup();
    mocks.workers.mockReturnValue(result([worker(1)], 21));
    renderDialog();

    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(mocks.workers).toHaveBeenCalledWith(501, 2, '', 20);

    /* 21건은 두 쪽이 끝이다 — 더 갈 곳이 없으면 단추가 잠긴다. */
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이전' })).toBeEnabled();
  });

  it('고른 줄을 다시 누르면 선택이 풀리고 아무것도 고르지 않으면 확인할 수 없다', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();
    const pick = screen.getByRole('button', { name: '선택' });

    expect(pick).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'SYN-W-1' }));
    expect(pick).toBeEnabled();

    await user.click(screen.getByRole('checkbox', { name: 'SYN-W-1' }));
    expect(pick).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'SYN-W-2' }));
    await user.click(pick);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ workerId: 2 }));
  });

  it('조회에 실패하면 사유를 고정 문구로 알리고 서버 원문을 내지 않는다', () => {
    mocks.workers.mockReturnValue({ data: undefined, isError: true, isPending: false });
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: '담당 작업자 선택' });
    expect(within(dialog).getByText('작업자를 찾지 못했습니다.')).toBeVisible();
  });
});
