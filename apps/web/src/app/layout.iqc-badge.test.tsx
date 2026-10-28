import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../patterns/session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';
import { SYNTHETIC_SESSION } from '../test/session-harness';
import { IQC_PENDING_INTERVAL_MS } from './iqc-pending';
import { AppLayout } from './layout';

const t = messages.shellNav;
const INSPECTION_ROW = '검사 조회·판정';
const QUALITY_GROUP = '품질 관리';

const Go = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(to)}>
      옮기기
    </button>
  );
};

interface Setup {
  total?: number | 'fail';
  permissions?: string[];
  route?: string;
}

const setup = (options: Setup = {}) => {
  const counted: URL[] = [];
  renderWithProviders(
    <SessionProvider>
      <Go to="/logistics/iqc-inspection" />
      <AppLayout>본문</AppLayout>
    </SessionProvider>,
    {
      session: {
        ...SYNTHETIC_SESSION,
        permissions: options.permissions ?? ['W-01-01', 'W-CO-09'],
      },
      route: options.route ?? '/approval/inbox',
      fetch: createStubFetch([
        {
          match: (request) => new URL(request.url).pathname === '/quality/inspection-requests',
          respond: (request) => {
            counted.push(new URL(request.url));
            return options.total === 'fail'
              ? jsonResponse({ message: '' }, { status: 503 })
              : jsonResponse({
                  items: [],
                  page: { page: 1, size: 1, total: options.total ?? 4 },
                });
          },
        },
      ]),
    },
  );
  return { counted };
};

const sidebar = () => screen.getByRole('navigation', { name: '주 메뉴' });
const groupToggle = (label: string): HTMLElement => {
  const found = within(sidebar())
    .getAllByRole('button')
    .find((button) => (button.getAttribute('aria-label') ?? '').startsWith(`${label} (`));
  if (found === undefined) throw new Error(`「${label}」 묶음의 손잡이가 없습니다`);
  return found;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('관리웹 IQC 대기 배지(피처 002)', () => {
  it('US4-1 수 = IQC 목록과 같은 조건(IQC·대기만·size 1)의 page.total, 「검사 조회·판정」 줄에 보인다', async () => {
    const user = userEvent.setup();
    const { counted } = setup();

    await waitFor(() => expect(counted.length).toBeGreaterThan(0));
    const query = counted[0] as URL;
    expect(query.searchParams.get('inspectionTypeCode')).toBe('IQC');
    expect(query.searchParams.get('pendingOnly')).toBe('true');
    expect(query.searchParams.get('size')).toBe('1');

    await user.click(groupToggle(QUALITY_GROUP));
    const row = within(sidebar()).getByRole('link', { name: new RegExp(`^${INSPECTION_ROW}`) });
    expect(await within(row).findByLabelText(t.iqcPending(4))).toHaveTextContent('4');
  });

  it('US4-1 IQC 탭에도 같은 수가 붙는다', async () => {
    setup({ route: '/logistics/iqc-inspection', permissions: ['W-01-01', 'W-03-11', 'W-04-03'] });

    const tabs = await screen.findByRole('navigation', { name: INSPECTION_ROW });
    const iqcTab = within(tabs).getByRole('link', { name: /^IQC/ });
    expect(await within(iqcTab).findByLabelText(t.iqcPending(4))).toHaveTextContent('4');
  });

  it('US4-2 닫힌 「품질 관리」 묶음 손잡이에 점, 열면 점 대신 줄의 수', async () => {
    const user = userEvent.setup();
    setup();

    const toggle = groupToggle(QUALITY_GROUP);
    expect(await within(toggle).findByRole('img', { name: t.group.hasWork })).toBeInTheDocument();
    await user.click(toggle);
    expect(
      within(groupToggle(QUALITY_GROUP)).queryByRole('img', { name: t.group.hasWork }),
    ).toBeNull();
  });

  it('10건 이상이면 「9+」, 접근 이름은 실제 수다', async () => {
    const user = userEvent.setup();
    setup({ total: 23 });

    await user.click(groupToggle(QUALITY_GROUP));
    const row = within(sidebar()).getByRole('link', { name: new RegExp(`^${INSPECTION_ROW}`) });
    expect(await within(row).findByLabelText(t.iqcPending(23))).toHaveTextContent('9+');
  });

  it('0건이면 수도 점도 없다', async () => {
    const user = userEvent.setup();
    const { counted } = setup({ total: 0 });

    await waitFor(() => expect(counted.length).toBeGreaterThan(0));
    expect(
      within(groupToggle(QUALITY_GROUP)).queryByRole('img', { name: t.group.hasWork }),
    ).toBeNull();
    await user.click(groupToggle(QUALITY_GROUP));
    expect(within(sidebar()).queryByLabelText(/^IQC 대기/)).toBeNull();
  });

  it('FR-018 조회가 실패하면 수·점을 그리지 않고 메뉴는 그대로다', async () => {
    const user = userEvent.setup();
    const { counted } = setup({ total: 'fail' });

    await waitFor(() => expect(counted.length).toBeGreaterThan(0));
    expect(
      within(groupToggle(QUALITY_GROUP)).queryByRole('img', { name: t.group.hasWork }),
    ).toBeNull();
    await user.click(groupToggle(QUALITY_GROUP));
    expect(within(sidebar()).getByRole('link', { name: INSPECTION_ROW })).toBeInTheDocument();
  });

  it('US4-3 IQC 화면 권한이 없으면 묻지도 보이지도 않는다', async () => {
    setup({ permissions: ['W-CO-09'] });

    await screen.findByRole('navigation', { name: '주 메뉴' });
    expect(
      within(sidebar()).queryByRole('link', { name: new RegExp(`^${INSPECTION_ROW}`) }),
    ).toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByRole('img', { name: t.group.hasWork })).toBeNull();
  });

  it('US4-3 권한이 없으면 조회 요청이 하나도 나가지 않는다', async () => {
    const { counted } = setup({ permissions: ['W-CO-09'] });

    await screen.findByRole('navigation', { name: '주 메뉴' });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(counted).toHaveLength(0);
  });

  it('US4-4 SC-002 60초마다, 화면을 옮길 때 다시 센다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const { counted } = setup();

    await waitFor(() => expect(counted.length).toBeGreaterThan(0));
    const before = counted.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IQC_PENDING_INTERVAL_MS);
    });
    await waitFor(() => expect(counted.length).toBeGreaterThan(before));

    const afterTick = counted.length;
    await user.click(screen.getByRole('button', { name: '옮기기' }));
    await waitFor(() => expect(counted.length).toBeGreaterThan(afterTick));
  });
});
