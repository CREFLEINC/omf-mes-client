import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
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

    expect(await screen.findByRole('heading', { name: t.panes.list })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.panes.detail })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.panes.decision })).toBeInTheDocument();

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

  /*
   * ⭐ 되살아난 원천 축이 **화면 끝에서 서버 요청까지** 닿는지 본다(#648). 필터 바만 보는
   * 시험은 「칸은 섰는데 조회 조건에는 안 실리는」 결함을 통과시킨다 — 눈으로 봐서 가장
   * 멀쩡해 보이는 실패 모양이라 여기서 한 번 끝까지 물어 둔다.
   */
  it('⭐ 원천을 고르면 목록 조회에 그 축이 실린다', async () => {
    const { user } = renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('NC-TEST-0041') });

    await user.click(screen.getByLabelText(t.fields.sourceCode));
    await user.click(screen.getByRole('option', { name: t.values.sourceCode.RETURN }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestedPaths().some((path) => path.includes('sourceCode=RETURN'))).toBe(true);
    });
  });

  /* 축이 되살아났으므로 「거를 수 없다」는 안내는 이제 거짓이다 — 남아 있으면 안 된다. */
  it('⭐ 원천을 못 거른다는 안내가 목록 머리에 남아 있지 않다', async () => {
    renderScreen();
    await screen.findByRole('button', { name: t.actions.selectRow('NC-TEST-0041') });

    expect(screen.queryByText(/원천으로 거르는/)).toBeNull();
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

  it('⛔ 고르고 보기만 해서는 쓰기가 나가지 않는다', async () => {
    const { user } = renderScreen();
    await selectRow(user);
    await screen.findByText('LOT-TEST-0088');

    expect(requestsSent().every((request) => request.method === 'GET')).toBe(true);
  });

  it('고정 OpenAPI의 처분 유형으로 판정을 입력할 수 있다', async () => {
    const { user } = renderScreen();
    await selectRow(user);

    const save = screen.getByRole('button', { name: t.actions.save });
    await waitFor(() => {
      expect(save).toBeEnabled();
    });
    const group = screen.getByRole('radiogroup', { name: t.fields.dispositionTypeCode });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).getByRole('radio', { name: '재작업' })).toBeEnabled();
    expect(screen.queryByText(t.dispositionPending)).toBeNull();
  });
});
