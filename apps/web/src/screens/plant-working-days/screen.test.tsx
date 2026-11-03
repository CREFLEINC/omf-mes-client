import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { SessionProvider } from '../../patterns/session';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { PlantWorkingDaysScreen } from './screen';
import { todayIn } from './working-days';

type OperationPolicy = components['schemas']['OperationPolicy'];

const t = messages.plantWorkingDays;
/** 생성 타입의 응답 정책 코드에는 아직 이 값이 없다 — 계약 §4(forward-contract 는 요청 쪽만 넓힌다). */
const WEEKLY = 'WEEKLY_WORKING_DAYS' as OperationPolicy['policyCode'];

/** 공장 · 정책 값은 모두 합성 값이다. 시간대는 IANA 이름이 아니라 브라우저 날짜를 쓴다. */
const PLANTS = [
  { plantId: 8401, plantCode: 'G1', plantName: '합성 1공장' },
  { plantId: 8402, plantCode: 'G2', plantName: '합성 2공장' },
  { plantId: 8403, plantCode: 'G3', plantName: '합성 3공장', isActive: false },
].map((plant) => ({
  businessUnitId: 8301,
  legalEntityId: 8201,
  timezoneCode: 'SYN-TZ',
  isActive: true,
  ...plant,
}));

const TODAY = todayIn('SYN-TZ');

interface SetupOptions {
  policies?: OperationPolicy[];
  /** 쓰기(POST · PUT) 응답을 바꾼다. */
  respondWrite?: () => Response;
}

const setup = (options: SetupOptions = {}) => {
  const writes: { method: string; path: string; body: unknown; headers: Headers }[] = [];
  let policies = options.policies ?? [];
  const pathOf = (request: Request) => new URL(request.url).pathname;

  const routes: StubRoute[] = [
    {
      match: (request) => pathOf(request) === '/mdm/plants',
      respond: () => jsonResponse({ items: PLANTS, page: { page: 1, size: 100, total: 3 } }),
    },
    {
      match: (request) => request.method === 'GET' && pathOf(request) === '/app/operation-policies',
      respond: () =>
        jsonResponse({ items: policies, page: { page: 1, size: 200, total: policies.length } }),
    },
    {
      match: (request) =>
        request.method === 'GET' && pathOf(request).startsWith('/app/operation-policies/'),
      respond: (request) =>
        jsonResponse(
          policies.find(
            (row) => `/app/operation-policies/${String(row.operationPolicyId)}` === pathOf(request),
          ),
          { headers: { ETag: '"7"' } },
        ),
    },
    {
      match: (request) =>
        request.method !== 'GET' && pathOf(request).startsWith('/app/operation-policies'),
      respond: async (request) => {
        const body = JSON.parse(await request.clone().text()) as OperationPolicy;
        writes.push({
          method: request.method,
          path: pathOf(request),
          body,
          headers: request.headers,
        });
        if (options.respondWrite !== undefined) return options.respondWrite();
        const saved = { ...body, operationPolicyId: 9000 + writes.length } as OperationPolicy;
        policies = [...policies, saved];
        return jsonResponse(saved, { status: request.method === 'POST' ? 201 : 200 });
      },
    },
  ];

  const view = renderWithProviders(
    <SessionProvider>
      <PlantWorkingDaysScreen />
    </SessionProvider>,
    {
      fetch: createStubFetch(routes),
      route: '/system/plant-working-days',
      dataRouter: true,
      session: {
        ...SYNTHETIC_SESSION,
        scopes: [{ businessUnitId: 8301 }],
        permissions: ['W-CO-15'],
      },
    },
  );
  return { user: userEvent.setup(), writes, router: view.router };
};

const table = async () => within(await screen.findByRole('table', { name: t.tableLabel }));
const rowOf = async (plantName: string) => {
  const found = (await table()).getByText(plantName).closest('tr');
  if (found === null) throw new Error(`${plantName} 줄이 없다`);
  return within(found);
};

describe('W-CO-15 공장 근무일 설정', () => {
  it('US7-1 데이터 범위 안 사용 중인 공장을 모두 보이고, 설정 없는 공장은 주 5일제 + 「기본값」', async () => {
    setup();

    const rows = (await table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const first = await rowOf('합성 1공장');
    expect(first.getByRole('radio', { name: t.options.five })).toBeChecked();
    expect(first.getByText(t.tags.default)).toBeInTheDocument();
    expect(first.getByText('토, 일')).toBeInTheDocument();
    expect(screen.queryByText('합성 3공장')).not.toBeInTheDocument();
    expect(screen.getByText(t.intro)).toBeInTheDocument();
  });

  it('US7-3 6 으로 바꾸면 바뀐 줄 표시 · 예시를 다시 세고, 저장하면 오늘부터 적용 행을 더한 뒤 다시 열어도 6', async () => {
    const { user, writes } = setup();
    const row = await rowOf('합성 2공장');

    await user.click(row.getByRole('radio', { name: t.options.six }));

    expect(row.getByText(t.tags.changed)).toBeInTheDocument();
    expect(row.getByText('일')).toBeInTheDocument();
    expect(row.getByText(/— 일을 건너뜀$/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      method: 'POST',
      path: '/app/operation-policies',
      body: {
        policyCode: 'WEEKLY_WORKING_DAYS',
        plantId: 8402,
        valueNumeric: 6,
        effectiveFrom: TODAY,
      },
    });
    expect(await screen.findByText(t.state.saved)).toBeInTheDocument();

    const after = await rowOf('합성 2공장');
    await waitFor(() => expect(after.getByRole('radio', { name: t.options.six })).toBeChecked());
    expect(after.queryByText(t.tags.changed)).not.toBeInTheDocument();
    expect(after.getByText(t.values.lastChanged(TODAY.slice(5)))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled();
  });

  it('US7-3 같은 날 두 번 저장하면 둘째는 새 행이 아니라 오늘 시작한 그 행을 If-Match 로 고친다', async () => {
    const { user, writes } = setup();
    const row = await rowOf('합성 2공장');

    await user.click(row.getByRole('radio', { name: t.options.six }));
    await user.click(screen.getByRole('button', { name: t.actions.save }));
    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled(),
    );

    const again = await rowOf('합성 2공장');
    await waitFor(() => expect(again.getByRole('radio', { name: t.options.six })).toBeChecked());
    await user.click(again.getByRole('radio', { name: t.options.five }));
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes.map((write) => write.method)).toEqual(['POST', 'PUT']);
    expect(writes[1]).toMatchObject({
      path: '/app/operation-policies/9001',
      body: { valueNumeric: 5, effectiveFrom: TODAY },
    });
    expect(writes[1]?.headers.get('If-Match')).toBe('"7"');
  });

  it('US7-3 저장한 6 은 다시 열어도 6 이고 「기본값」이 아니다', async () => {
    setup({
      policies: [
        {
          operationPolicyId: 31,
          policyCode: WEEKLY,
          plantId: 8401,
          valueNumeric: 6,
          effectiveFrom: '2026-10-15',
        },
      ],
    });

    const row = await rowOf('합성 1공장');
    expect(row.getByRole('radio', { name: t.options.six })).toBeChecked();
    expect(row.queryByText(t.tags.default)).not.toBeInTheDocument();
    expect(row.getByText(t.values.lastChanged('10-15'))).toBeInTheDocument();
  });

  it('바뀐 공장만 저장하고, 오늘 시작한 행이 있으면 새 행 대신 그 행을 고친다', async () => {
    const { user, writes } = setup({
      policies: [
        {
          operationPolicyId: 41,
          policyCode: WEEKLY,
          plantId: 8401,
          valueNumeric: 6,
          effectiveFrom: TODAY,
        },
      ],
    });
    const row = await rowOf('합성 1공장');

    await user.click(row.getByRole('radio', { name: t.options.five }));
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      method: 'PUT',
      path: '/app/operation-policies/41',
      body: { valueNumeric: 5, effectiveFrom: TODAY },
    });
    expect(writes[0]?.headers.get('If-Match')).toBe('"7"');
  });

  it('되돌리기는 고친 값을 버린다', async () => {
    const { user, writes } = setup();
    const row = await rowOf('합성 1공장');

    await user.click(row.getByRole('radio', { name: t.options.six }));
    await user.click(screen.getByRole('button', { name: t.actions.revert }));

    expect(row.getByRole('radio', { name: t.options.five })).toBeChecked();
    expect(row.queryByText(t.tags.changed)).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('충돌(409)이면 「다른 사람이 먼저 저장했습니다」와 다시 불러오기를 보인다', async () => {
    /* 오늘 시작한 행을 남이 먼저 고쳤다 — If-Match 가 낡아 수정이 409 다. */
    const { user } = setup({
      policies: [
        {
          operationPolicyId: 51,
          policyCode: WEEKLY,
          plantId: 8401,
          valueNumeric: 5,
          effectiveFrom: TODAY,
        },
      ],
      respondWrite: () =>
        jsonResponse(
          { conflictCause: 'user', code: 'VERSION_CONFLICT', message: '버전이 맞지 않습니다' },
          { status: 409 },
        ),
    });
    const row = await rowOf('합성 1공장');

    await user.click(row.getByRole('radio', { name: t.options.six }));
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.state.conflict)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await waitFor(() => expect(screen.queryByText(t.state.conflict)).not.toBeInTheDocument());
    expect(row.getByRole('radio', { name: t.options.five })).toBeChecked();
  });

  it('저장하지 않은 변경을 두고 화면을 떠나면 먼저 묻는다', async () => {
    const { user, router } = setup();
    const row = await rowOf('합성 1공장');
    await user.click(row.getByRole('radio', { name: t.options.six }));

    await act(async () => {
      await router?.navigate('/notification/handover-settings');
    });

    expect(await screen.findByRole('dialog', { name: t.discard.title })).toBeInTheDocument();
  });
});
