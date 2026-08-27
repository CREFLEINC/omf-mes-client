import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { dispositionStub, requestedPaths, requestsSent } from './fixtures';
import { DispositionDecisionScreen } from './screen';

const t = messages.dispositionDecision;
const TODAY = new Date(2026, 7, 12);
const KST = 540;

const renderScreen = (
  options: Parameters<typeof dispositionStub>[0] & { route?: string } = {},
): { user: ReturnType<typeof userEvent.setup> } => {
  renderWithProviders(<DispositionDecisionScreen today={TODAY} offsetMinutes={KST} />, {
    fetch: dispositionStub(options),
    route: options.route ?? '/quality/dispositions',
  });

  return { user: userEvent.setup() };
};

const selectRow = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(
    await screen.findByRole('button', { name: t.actions.selectRow('NC-TEST-0041') }),
  );
};

describe('DispositionDecisionScreen 조회', () => {
  it('기간을 반열림으로 실어 조회한다 — 조건 없는 조회를 만들지 않는다', async () => {
    renderScreen();

    await waitFor(() => {
      const url = requestedPaths().find((path) => path.startsWith('/quality/nonconformances?'));
      expect(url).toBeDefined();
      const params = new URLSearchParams(url?.split('?')[1] ?? '');
      expect(params.get('openedFrom')).toBe('2026-07-14T00:00:00+09:00');
      expect(params.get('openedTo')).toBe('2026-08-13T00:00:00+09:00');
    });
  });

  it('행을 고르면 상세와 대상 LOT을 보인다', async () => {
    const { user } = renderScreen();
    await selectRow(user);

    expect(await screen.findByText('도장 표면 박리')).toBeInTheDocument();
    expect(await screen.findByText('LOT-TEST-0088')).toBeInTheDocument();
  });

  it('⭐ 진입 키로 들어오면 그 부적합이 자동으로 골라진다', async () => {
    renderScreen({ route: '/quality/dispositions?nonconformanceId=41' });

    expect(await screen.findByText('도장 표면 박리')).toBeInTheDocument();
  });

  it('남은 수량을 참고값으로 보이고 그 사실을 함께 적는다', async () => {
    const { user } = renderScreen({ decidedQty: 200 });
    await selectRow(user);

    expect(await screen.findByText('120')).toBeInTheDocument();
    expect(screen.getByText(t.remaining.note)).toBeInTheDocument();
  });

  it('물러난 두 항목의 사실을 목록 머리에 적는다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('NC-TEST-0041') });

    const banner = screen
      .getAllByRole('status')
      .find((element) => element.textContent?.includes(t.withdrawn.decisionProgress) === true);

    expect(banner).toBeDefined();
    expect(banner?.textContent).toContain(t.withdrawn.sourceFilter);
  });

  it('⛔ 승인·반려 컨트롤이 화면에 없다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('NC-TEST-0041') });

    expect(screen.queryByRole('button', { name: '승인' })).toBeNull();
    expect(screen.queryByRole('button', { name: '반려' })).toBeNull();
  });

  it('목록 조회가 실패하면 다시 시도를 낸다', async () => {
    renderScreen({ listStatus: 500 });

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  it('⛔ 이 슬라이스는 쓰기를 만들지 않는다 — 판정 칸은 아직 붙지 않았다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await screen.findByText('LOT-TEST-0088');

    expect(requestsSent().every((request) => request.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: t.actions.save })).toBeNull();
  });
});
