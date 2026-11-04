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
/** 운영 정책 코드 — 계약 §4 의 `WEEKLY_WORKING_DAYS`. */
const WEEKLY: OperationPolicy['policyCode'] = 'WEEKLY_WORKING_DAYS';

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
  /* 서버처럼 행마다 판 번호를 둔다 — 수정은 If-Match 가 맞아야 하고, 맞으면 판이 오른다. */
  const versions = new Map<number, number>(policies.map((row) => [row.operationPolicyId, 7]));
  const etagOf = (id: number) => `"${String(versions.get(id) ?? 7)}"`;
  const pathOf = (request: Request) => new URL(request.url).pathname;
  const idOf = (request: Request) => Number(pathOf(request).split('/').at(-1));

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
          policies.find((row) => row.operationPolicyId === idOf(request)),
          { headers: { ETag: etagOf(idOf(request)) } },
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
        if (request.method === 'PUT') {
          const id = idOf(request);
          if (request.headers.get('If-Match') !== etagOf(id)) {
            return jsonResponse(
              { conflictCause: 'user', code: 'VERSION_CONFLICT', message: '버전이 맞지 않습니다' },
              { status: 409 },
            );
          }
          versions.set(id, (versions.get(id) ?? 7) + 1);
          policies = policies.map((row) =>
            row.operationPolicyId === id ? { ...row, ...body } : row,
          );
          return jsonResponse(policies.find((row) => row.operationPolicyId === id));
        }
        /* 같은 공장 · 같은 시작일은 유일 인덱스 — 둘째 등록은 400(서버 S3 #947). */
        if (
          policies.some(
            (row) => row.plantId === body.plantId && row.effectiveFrom === body.effectiveFrom,
          )
        ) {
          return jsonResponse(
            { errors: [{ scope: 'screen', code: 'DUPLICATE', message: '이미 있습니다' }] },
            { status: 400 },
          );
        }
        const saved = { ...body, operationPolicyId: 9000 + writes.length } as OperationPolicy;
        policies = [...policies, saved];
        versions.set(saved.operationPolicyId, 7);
        return jsonResponse(saved, { status: 201 });
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
  /** 화면을 연 뒤 다른 사람이 한 일. */
  const other = {
    edit: (id: number) => versions.set(id, (versions.get(id) ?? 7) + 1),
    add: (row: OperationPolicy) => {
      policies = [...policies, row];
      versions.set(row.operationPolicyId, 7);
    },
  };
  return { user: userEvent.setup(), writes, router: view.router, other };
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

  it('US7-3 화면을 연 뒤 남이 같은 행을 고쳤으면 불러올 때의 판 번호로 보내 409 충돌을 보인다', async () => {
    const { user, writes, other } = setup({
      policies: [
        {
          operationPolicyId: 61,
          policyCode: WEEKLY,
          plantId: 8401,
          valueNumeric: 5,
          effectiveFrom: TODAY,
        },
      ],
    });
    const row = await rowOf('합성 1공장');
    other.edit(61);

    await user.click(row.getByRole('radio', { name: t.options.six }));
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.state.conflict)).toBeInTheDocument();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.headers.get('If-Match')).toBe('"7"');

    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await waitFor(() => expect(screen.queryByText(t.state.conflict)).not.toBeInTheDocument());
    const again = await rowOf('합성 1공장');
    await user.click(again.getByRole('radio', { name: t.options.six }));
    await user.click(screen.getByRole('button', { name: t.actions.save }));
    expect(await screen.findByText(t.state.saved)).toBeInTheDocument();
    expect(writes[1]?.headers.get('If-Match')).toBe('"8"');
  });

  it('US7-3 화면을 연 뒤 남이 오늘 행을 먼저 만들었으면 등록 400 을 충돌로 보이고 다시 불러오게 한다', async () => {
    const { user, writes, other } = setup();
    const row = await rowOf('합성 1공장');
    other.add({
      operationPolicyId: 71,
      policyCode: WEEKLY,
      plantId: 8401,
      valueNumeric: 6,
      effectiveFrom: TODAY,
    });

    await user.click(row.getByRole('radio', { name: t.options.six }));
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.state.conflict)).toBeInTheDocument();
    expect(writes.map((write) => write.method)).toEqual(['POST']);
    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    const after = await rowOf('합성 1공장');
    await waitFor(() => expect(after.getByRole('radio', { name: t.options.six })).toBeChecked());
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
