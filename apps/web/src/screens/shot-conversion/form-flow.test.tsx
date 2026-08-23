import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  businessUnitsResponse,
  enabledListResponse,
  itemsResponse,
  makeRatio,
  plantsResponse,
  policyCodeOf,
  processesResponse,
  ratioItems,
  ratioListResponse,
} from './fixtures';
import { ShotConversionScreen } from './screen';
import type { OperationPolicy } from './types';

const t = messages.shotConversion;

const isPath = (request: Request, path: string): boolean => new URL(request.url).pathname === path;

interface Options {
  writes?: Request[];
  policies?: OperationPolicy[];
  writeStatus?: number;
  writeBody?: unknown;
}

const routes = (options: Options): StubRoute[] => [
  {
    match: (request) => request.method === 'POST' && isPath(request, '/app/operation-policies'),
    respond: (request) => {
      options.writes?.push(request);

      return options.writeStatus === undefined
        ? jsonResponse(makeRatio(9100, 1), { status: 201 })
        : jsonResponse(options.writeBody ?? { errors: [] }, { status: options.writeStatus });
    },
  },
  {
    match: (request) => isPath(request, '/app/operation-policies/9003'),
    respond: (request) => {
      options.writes?.push(request);

      return options.writeStatus === undefined
        ? jsonResponse(makeRatio(9003, 0.5))
        : jsonResponse(options.writeBody ?? { errors: [] }, { status: options.writeStatus });
    },
  },
  {
    match: (request) =>
      isPath(request, '/app/operation-policies') &&
      policyCodeOf(request) === 'SHOT_CONVERSION_ENABLED',
    respond: () => jsonResponse(enabledListResponse()),
  },
  {
    match: (request) => isPath(request, '/app/operation-policies'),
    respond: () => jsonResponse(ratioListResponse(options.policies ?? ratioItems)),
  },
  {
    match: (request) => isPath(request, '/mdm/items'),
    respond: () => jsonResponse(itemsResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/processes'),
    respond: () => jsonResponse(processesResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/plants'),
    respond: () => jsonResponse(plantsResponse()),
  },
  {
    match: (request) => isPath(request, '/mdm/business-units'),
    respond: () => jsonResponse(businessUnitsResponse()),
  },
];

const renderScreen = (options: Options = {}) =>
  renderWithProviders(<ShotConversionScreen />, { fetch: createStubFetch(routes(options)) });

const pane = (): HTMLElement => screen.getByRole('region', { name: t.ratioList.paneTitle });
const dialog = () => within(screen.getByRole('dialog'));

const openCreate = async (): Promise<void> => {
  const user = userEvent.setup();

  await within(pane()).findByText(t.scope.all);
  await user.click(within(pane()).getByRole('button', { name: t.actions.addPolicy }));
  await screen.findByRole('dialog');
};

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.clone().json()) as Record<string, unknown>;

const onlyWrite = (writes: readonly Request[]): Request => {
  const [first] = writes;

  if (first === undefined) throw new Error('나간 쓰기가 없습니다.');

  return first;
};

describe('W-05-01 ② — 정책을 더한다', () => {
  it('정책 추가를 누르면 등록 창이 열린다', async () => {
    renderScreen();
    await openCreate();

    expect(screen.getByRole('dialog', { name: t.form.createTitle })).toBeInTheDocument();
  });

  /** ⛔ 「정책 코드」 입력란이 없다 — 화면이 붙인다(스펙 §5-1). */
  it('정책 코드를 묻지 않는다', async () => {
    renderScreen();
    await openCreate();

    expect(dialog().queryByLabelText(/정책 코드/)).not.toBeInTheDocument();
  });

  /** ⭐ 비운 축이 「전체」다 — 고르지 않은 것이 아니라 값이다. */
  it('범위 넷을 고를 수 있고 비우면 전체라고 말한다', async () => {
    renderScreen();
    await openCreate();

    for (const label of [
      t.scope.itemId,
      t.scope.processId,
      t.scope.plantId,
      t.scope.businessUnitId,
    ]) {
      expect(dialog().getByRole('combobox', { name: label })).toBeInTheDocument();
    }
    expect(dialog().getByText(t.form.scopeNote)).toBeInTheDocument();
  });

  it('비율 없이 저장하면 막고 그 칸에 표시한다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openCreate();
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    expect(dialog().getByRole('textbox', { name: /비율/ })).toBeInvalid();
    expect(writes).toHaveLength(0);
  });

  /** ⛔ 0이면 타발수가 늘 0이라 예방보전이 영영 오지 않는다 — 그 결과까지 말한다. */
  it('비율 0 을 그 결과와 함께 막는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    expect(dialog().getByText(t.validation.ratioPositive)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  /** ⚠ 막지 않고 말한다 — 한 번에 여러 번 타발하는 공정이 있을 수 있다. */
  it('비율이 1 을 넘으면 경고하되 막지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '4');
    expect(dialog().getByText(t.validation.ratioOverOne)).toBeInTheDocument();

    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
  });

  it('종료일이 시작일보다 앞이면 막는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-06-01');
    await user.type(dialog().getByLabelText(t.form.effectiveTo), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    expect(dialog().getByText(t.validation.periodOrder)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('고른 범위와 비율이 등록 요청에 실린다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openCreate();

    await user.click(dialog().getByRole('combobox', { name: t.scope.itemId }));
    await user.click(await screen.findByRole('option', { name: 'ITM-201 · 가상 하우징' }));
    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const body = await bodyOf(onlyWrite(writes));

    expect(body).toEqual({
      policyCode: 'SHOT_CONVERSION_RATIO',
      valueNumeric: 0.25,
      itemId: 21,
      processId: null,
      plantId: null,
      businessUnitId: null,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
    });
  });

  it('저장에 성공하면 창이 닫힌다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('멱등 키가 실린다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(onlyWrite(writes).headers.get('Idempotency-Key')).not.toBeNull();
  });

  /** ⛔ 이 자원에는 잠금이 없다 — 없는 헤더를 지어내 보내지 않는다(설계 질의). */
  it('잠금 토큰을 싣지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(onlyWrite(writes).headers.get('If-Match')).toBeNull();
  });
});

describe('W-05-01 ② — 정책을 고친다', () => {
  const openEdit = async (): Promise<void> => {
    const user = userEvent.setup();

    await within(pane()).findByText(t.scope.all);
    await user.click(
      within(pane()).getByRole('button', {
        name: t.scope.entry(t.scope.itemId, 'ITM-201 · 가상 하우징'),
      }),
    );
    await screen.findByRole('dialog');
  };

  it('범위를 누르면 수정 창이 그 값으로 열린다', async () => {
    renderScreen();
    await openEdit();

    expect(screen.getByRole('dialog', { name: t.form.editTitle })).toBeInTheDocument();
    expect(dialog().getByRole('textbox', { name: /비율/ })).toHaveValue('0.25');
  });

  /** ⛔ 계약의 수정 본문에 축이 없다 — 잠긴 선택칸이 아니라 값 표기 + 사유로 낸다. */
  it('수정 창에서 범위를 바꿀 수 없고 그 이유를 말한다', async () => {
    renderScreen();
    await openEdit();

    expect(dialog().queryByRole('combobox', { name: t.scope.itemId })).not.toBeInTheDocument();
    expect(dialog().getByText(t.form.scopeFixed)).toBeInTheDocument();
    expect(
      dialog().getByText(t.scope.entry(t.scope.itemId, 'ITM-201 · 가상 하우징')),
    ).toBeInTheDocument();
  });

  /**
   * ⭐ **쓰지 않는 값 칸을 비우도록 못박는다.** 수정은 이미 있는 행을 덮으므로, 다른 화면이
   * 실수로 채워 둔 칸이 남아 있으면 이 화면이 그것을 그대로 두게 된다.
   */
  it('쓰지 않는 값 칸을 비우도록 실어 보낸다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];

    renderScreen({ writes });
    await openEdit();

    await user.clear(dialog().getByRole('textbox', { name: /비율/ }));
    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.5');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    await waitFor(() => expect(writes).toHaveLength(1));

    const request = onlyWrite(writes);

    expect(request.method).toBe('PUT');
    expect(await bodyOf(request)).toEqual({
      valueNumeric: 0.5,
      valueText: null,
      valueBoolean: null,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
    });
  });
});

describe('W-05-01 ② — 저장이 실패하면', () => {
  /** 같은 범위·같은 시작일은 한 건만 둔다 — 유일 범위를 문구에 담아 서버가 되돌려 준다. */
  it('유일 위반이 그 칸에 붙는다', async () => {
    const user = userEvent.setup();

    renderScreen({
      writeStatus: 400,
      writeBody: {
        errors: [
          {
            scope: 'field',
            field: 'effectiveFrom',
            code: 'DUPLICATE',
            message: '같은 범위에 같은 시작일의 정책이 이미 있습니다.',
          },
        ],
      },
    });
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    expect(
      await dialog().findByText('같은 범위에 같은 시작일의 정책이 이미 있습니다.'),
    ).toBeInTheDocument();
  });

  /**
   * ⛔ **「최신 불러오기」를 두지 않는다.** 이 자원에는 잠금이 없어 다시 불러와도 풀리는
   * 것이 없다 — 두면 눌러도 아무 일도 일어나지 않는 컨트롤이 된다(공유계약 G-23).
   */
  it('다시 불러올 자리를 만들지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen({
      writeStatus: 409,
      writeBody: { conflictCause: 'user', message: '다른 사용자가 먼저 고쳤습니다.' },
    });
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    await waitFor(() =>
      expect(dialog().queryByRole('button', { name: messages.conflict.reloadAction })).toBeNull(),
    );
  });

  it('칸을 고치면 그 칸의 오류가 사라진다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await openCreate();
    await user.click(dialog().getByRole('button', { name: messages.common.save }));
    expect(dialog().getByRole('textbox', { name: /비율/ })).toBeInvalid();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');

    expect(dialog().getByRole('textbox', { name: /비율/ })).not.toBeInvalid();
  });

  /**
   * ⛔ **창을 닫으면 앞서 실패한 저장의 배너를 거둔다.** 거두지 않으면 다음에 창을 열자마자
   * 아직 아무것도 누르지 않았는데 「저장하지 못했습니다」가 서 있다.
   */
  it('앞서 실패한 저장의 배너가 다음 창에 남지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen({
      writeStatus: 400,
      writeBody: {
        errors: [{ scope: 'screen', code: 'INVALID', message: '지금은 저장할 수 없습니다.' }],
      },
    });
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));
    expect(await screen.findByText('지금은 저장할 수 없습니다.')).toBeInTheDocument();

    await user.click(dialog().getByRole('button', { name: messages.common.cancel }));
    await user.click(within(pane()).getByRole('button', { name: t.actions.addPolicy }));

    expect(screen.queryByText('지금은 저장할 수 없습니다.')).not.toBeInTheDocument();
  });

  it('창을 닫으면 앞서 친 값이 다음 창에 남지 않는다', async () => {
    const user = userEvent.setup();

    renderScreen();
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '9');
    await user.click(dialog().getByRole('button', { name: messages.common.cancel }));
    await user.click(within(pane()).getByRole('button', { name: t.actions.addPolicy }));

    expect(dialog().getByRole('textbox', { name: /비율/ })).toHaveValue('');
  });
});

/**
 * ⛔ **저장한 뒤 목록을 다시 받는다.**
 *
 * 이 자원에는 잠금이 없어 **다시 받는 것이 「무엇이 실제로 저장됐는가」를 아는 유일한 길**이다
 * (설계 질의 `omf-mes#210`). 받지 않으면 방금 만든 정책이 목록에 없어, 사용자는 저장이
 * 안 된 줄 알고 한 번 더 만든다.
 */
describe('W-05-01 ② — 저장한 뒤', () => {
  it('목록을 다시 받아 방금 만든 정책을 보인다', async () => {
    const user = userEvent.setup();
    let created = false;
    const custom: StubRoute[] = [
      {
        match: (request) => request.method === 'POST' && isPath(request, '/app/operation-policies'),
        respond: () => {
          created = true;

          return jsonResponse(makeRatio(9100, 0.25, { businessUnitId: 1 }), { status: 201 });
        },
      },
      {
        match: (request) => isPath(request, '/app/operation-policies'),
        respond: () =>
          jsonResponse(
            ratioListResponse(
              created ? [makeRatio(9100, 0.25, { businessUnitId: 1 })] : ratioItems,
            ),
          ),
      },
      ...routes({}),
    ];

    renderWithProviders(<ShotConversionScreen />, { fetch: createStubFetch(custom) });
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));

    expect(
      await within(pane()).findByText(t.scope.entry(t.scope.businessUnitId, '가상 사업부')),
    ).toBeInTheDocument();
  });
});

/**
 * ⭐ **서버가 붙인 오류도 고치는 즉시 거둔다.** 화면 검증이 붙인 것만 거두면, 범위를 바꿔
 * 가며 유일 위반을 피하려는 동안 **「이미 있습니다」가 새 범위 옆에 계속 붙어 있다.**
 */
describe('W-05-01 ② — 서버가 붙인 오류', () => {
  const duplicateOn = (field: string): Options => ({
    writeStatus: 400,
    writeBody: {
      errors: [
        { scope: 'field', field, code: 'DUPLICATE', message: '같은 범위의 정책이 이미 있습니다.' },
      ],
    },
  });

  it('범위 칸을 바꾸면 그 칸의 서버 오류가 사라진다', async () => {
    const user = userEvent.setup();

    renderScreen(duplicateOn('itemId'));
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));
    expect(await dialog().findByText('같은 범위의 정책이 이미 있습니다.')).toBeInTheDocument();

    await user.click(dialog().getByRole('combobox', { name: t.scope.itemId }));
    await user.click(await screen.findByRole('option', { name: 'ITM-201 · 가상 하우징' }));

    expect(dialog().queryByText('같은 범위의 정책이 이미 있습니다.')).not.toBeInTheDocument();
  });

  it('비율 칸을 고치면 그 칸의 서버 오류가 사라진다', async () => {
    const user = userEvent.setup();

    renderScreen(duplicateOn('valueNumeric'));
    await openCreate();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '0.25');
    await user.type(dialog().getByLabelText(t.form.effectiveFrom), '2026-01-01');
    await user.click(dialog().getByRole('button', { name: messages.common.save }));
    expect(await dialog().findByText('같은 범위의 정책이 이미 있습니다.')).toBeInTheDocument();

    await user.type(dialog().getByRole('textbox', { name: /비율/ }), '5');

    expect(dialog().queryByText('같은 범위의 정책이 이미 있습니다.')).not.toBeInTheDocument();
  });
});
