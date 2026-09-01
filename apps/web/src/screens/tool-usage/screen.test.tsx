import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  TOOL_CODE,
  conversionOnPolicies,
  makeTool,
  moldListResponse,
  unresolvedPolicies,
} from './fixtures';
import { ToolUsageScreen } from './screen';
import type { Mold } from './types';

const t = messages.toolUsage;

/** 작업지시와 사번을 갖춘 정상 진입. 값은 지어낸 것이다. */
const ENTRY_ROUTE = '/pop/tool-usage?workOrderId=1001&workerNo=3391';

const pathOf = (request: Request): string => new URL(request.url).pathname;
const policyCodeOf = (request: Request): string =>
  new URL(request.url).searchParams.get('policyCode') ?? '';

interface Options {
  tools?: Mold[];
  /** 환산 정책이 서 있는가 */
  conversionReady?: boolean;
  /** 저장 요청을 담아 둔다 — 본문·헤더를 검사한다 */
  writes?: Request[];
  /** 저장 응답 상태. 기본 201 */
  saveStatus?: number;
  /** 저장 실패 응답의 본문 — 서버가 준 사유를 화면이 어떻게 다루는지 본다 */
  saveErrorBody?: unknown;
  /** 저장이 두 번째부터 성공한다 — 재시도의 멱등 키를 검사한다 */
  failFirstSave?: boolean;
}

const routes = (options: Options): StubRoute[] => {
  let saveCount = 0;

  return [
    {
      match: (request) => request.method === 'GET' && pathOf(request) === '/mdm/molds',
      respond: () => jsonResponse(moldListResponse(options.tools ?? [makeTool()])),
    },
    {
      match: (request) => pathOf(request) === '/app/operation-policies/effective',
      respond: (request) => {
        const policies =
          options.conversionReady === true ? conversionOnPolicies : unresolvedPolicies;

        return jsonResponse(
          policyCodeOf(request) === 'SHOT_CONVERSION_ENABLED' ? policies.enabled : policies.ratio,
        );
      },
    },
    {
      match: (request) =>
        request.method === 'POST' && pathOf(request) === '/maintenance/tool-usages',
      respond: (request) => {
        options.writes?.push(request.clone());
        saveCount += 1;

        if (options.failFirstSave === true && saveCount === 1) {
          return jsonResponse({ message: '일시적인 오류' }, { status: 500 });
        }

        if (options.saveStatus !== undefined && options.saveStatus !== 201) {
          return jsonResponse(options.saveErrorBody ?? { message: '거부' }, {
            status: options.saveStatus,
          });
        }

        return jsonResponse(
          {
            toolUsageId: 1,
            moldId: 1001,
            workOrderId: 1001,
            shotCount: 1250,
            collectionMethodCode: 'DIRECT',
            occurredAt: '2026-09-01T09:40:00+09:00',
            recordedByWorkerNo: '3391',
            cumulativeShotCount: 413550,
          },
          { status: 201 },
        );
      },
    },
  ];
};

/**
 * 연결 상태를 바꾼다. `navigator.onLine` 은 읽기 전용이라 정의를 갈아 끼운다 —
 * **되돌리지 않으면 뒤따르는 테스트가 오프라인 화면을 보게 된다.**
 */
const setOnline = (value: boolean): void => {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
};

afterEach(() => {
  setOnline(true);
});

const renderScreen = (options: Options = {}, route: string = ENTRY_ROUTE) =>
  renderWithProviders(<ToolUsageScreen />, { fetch: createStubFetch(routes(options)), route });

/**
 * 코드를 찍는다 — **스캐너가 값을 밀어 넣고 끝에 Enter 를 붙이는 것과 같은 경로다.**
 * 조회 버튼은 두지 않았다(스펙 §3): 장갑 낀 손이 스캔 뒤 한 번 더 누르게 하지 않는다.
 */
const scanTool = async (user: ReturnType<typeof userEvent.setup>, code = TOOL_CODE) => {
  await user.type(screen.getByLabelText(t.scan.inputLabel), `${code}{Enter}`);
};

describe('ToolUsageScreen — 툴 스캔', () => {
  it('찍은 코드의 툴 정보를 보인다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);

    expect(await screen.findByText(TOOL_CODE)).toBeInTheDocument();
    expect(screen.getByText(`${t.scan.cavity} 4`)).toBeInTheDocument();
  });

  it('코드가 «그대로» 같지 않으면 없는 것으로 다룬다 — 부분 일치로 남의 툴에 실적을 달지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ tools: [makeTool({ moldCode: `${TOOL_CODE}-A` })] });

    await scanTool(user);

    expect(await screen.findByText(t.scan.notFound)).toBeInTheDocument();
    expect(screen.queryByText(`${t.scan.cavity} 4`)).not.toBeInTheDocument();
  });

  it('같은 코드가 둘 이상 오면 고르지 않는다 — 어느 공장 것인지 가릴 근거가 없다', async () => {
    const user = userEvent.setup();
    renderScreen({ tools: [makeTool(), makeTool({ moldId: 1002, plantId: 2 })] });

    await scanTool(user);

    expect(await screen.findByText(t.scan.notFound)).toBeInTheDocument();
  });

  it('폐기된 툴은 거부하고 저장을 열지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ tools: [makeTool({ statusCode: 'DISPOSED' })] });

    await scanTool(user);

    expect(await screen.findByText(t.scan.disposed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled();
  });

  it('폐기 툴은 타발수를 기입해도 저장이 열리지 않는다 — 잠긴 사유가 「타발수 없음」이면 안 된다', async () => {
    const user = userEvent.setup();
    renderScreen({ tools: [makeTool({ statusCode: 'DISPOSED' })] });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');

    expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.noTool)).toBeInTheDocument();
  });

  it('「툴 다시 고르기」는 찍은 코드와 고른 툴을 함께 버린다 — 툴을 바꾸는 유일한 길이다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await user.click(screen.getByRole('button', { name: t.scan.clear }));

    expect(screen.queryByText(TOOL_CODE)).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.scan.inputLabel)).toHaveValue('');
    expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.noTool)).toBeInTheDocument();
  });

  it('「다시 입력」은 친 값만 지우고 고른 툴은 남긴다 — 오타 하나에 재스캔시키지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    const field = await screen.findByLabelText(t.shot.inputLabel);
    await user.type(field, '1250');
    await user.click(screen.getByRole('button', { name: t.actions.reset }));

    expect(screen.getByLabelText(t.shot.inputLabel)).toHaveValue('');
    expect(screen.getByText(TOOL_CODE)).toBeInTheDocument();
  });
});

describe('ToolUsageScreen — 누계 구획', () => {
  it('저장 후 누계와 사용 가능을 미리 셈해 보인다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');

    expect(await screen.findByText(`413,550 ${t.shot.unit}`)).toBeInTheDocument();
    expect(screen.getByText(`86,450 ${t.shot.unit}`)).toBeInTheDocument();
  });

  it('적정타수가 있으면 사용률 진행 막대를 보인다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
  });

  it('적정타수가 비면 산출 불가로 적고 진행 막대를 그리지 않는다 — 0% 는 「다 썼다」로 읽힌다', async () => {
    const user = userEvent.setup();
    renderScreen({ tools: [makeTool({ guaranteedShotCount: null })] });

    await scanTool(user);

    expect(await screen.findByText(t.cumulative.guaranteedMissing)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('적정타수를 넘겨도 저장을 막지 않는다 — 경고이지 차단이 아니다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '90000');

    expect(await screen.findByText(t.cumulative.over)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.save })).toBeEnabled();
  });
});

describe('ToolUsageScreen — 연결이 끊겼을 때', () => {
  it('저장 후 누계와 사용 가능을 그리지 않고 「연결 후 확인」으로 둔다', async () => {
    setOnline(false);
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');

    expect(await screen.findByText(t.cumulative.offlineBase)).toBeInTheDocument();
    expect(screen.getAllByText(t.cumulative.offlineProjection).length).toBeGreaterThan(0);
    /* 캐시 누계에 내 입력을 더한 값을 그리면 다른 단말이 더한 몫이 빠진 숫자가 된다. */
    expect(screen.queryByText(`413,550 ${t.shot.unit}`)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('입력은 막지 않되 저장을 막고 사유를 말한다 — 이 저장소에는 보낼 것 보관함이 없다', async () => {
    setOnline(false);
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    const field = await screen.findByLabelText(t.shot.inputLabel);
    await user.type(field, '1250');

    expect(field).toHaveValue('1250');
    expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.offline)).toBeInTheDocument();
  });
});

describe('ToolUsageScreen — 저장', () => {
  it('증분만 보낸다 — 누계를 계산해 보내지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const body = (await writes[0]?.json()) as Record<string, unknown>;

    expect(body.shotCount).toBe(1250);
    expect(body.moldId).toBe(1001);
    expect(body.workOrderId).toBe(1001);
    expect(body.collectionMethodCode).toBe('DIRECT');
    /* 누계는 서버가 더한다 — 본문에 실릴 자리가 없다. */
    expect(body).not.toHaveProperty('cumulativeShotCount');
    expect(body).not.toHaveProperty('currentShotCount');
  });

  it('멱등 키와 사번 헤더를 함께 싣는다 — 사번이 없으면 서버가 거부한다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    expect(writes[0]?.headers.get('X-Worker-No')).toBe('3391');
    expect(writes[0]?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('실패 뒤 같은 값으로 다시 보내면 «같은» 멱등 키다 — 두 번 더해지면 안 된다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes, failFirstSave: true });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(2);
    });

    expect(writes[1]?.headers.get('Idempotency-Key')).toBe(
      writes[0]?.headers.get('Idempotency-Key'),
    );
  });

  it('저장에 성공하면 서버가 더한 누계를 보이고 입력을 비운다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.save.successTitle)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(t.shot.inputLabel)).toHaveValue('');
    });
  });

  it('단말 권한에 막히면 그 사정을 말하고 다시 시도를 권하지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ saveStatus: 403 });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.save.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('업무 규칙에 걸리면 서버가 준 사유를 보이고 다시 시도를 권하지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ saveStatus: 422, saveErrorBody: { message: '이미 마감된 작업지시입니다' } });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText('이미 마감된 작업지시입니다')).toBeInTheDocument();
    /* 같은 값으로 다시 눌러도 같은 답이 온다 — 누를 수 있는데 아무 일도 없는 컨트롤을 두지 않는다. */
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('값이 규칙에 어긋나면 그 칸 옆에 사유를 붙이고 친 값을 남긴다', async () => {
    const user = userEvent.setup();
    renderScreen({
      saveStatus: 400,
      saveErrorBody: {
        errors: [
          { scope: 'field', field: 'shotCount', code: 'INVALID', message: '타발수가 너무 큽니다' },
        ],
      },
    });

    await scanTool(user);
    const field = await screen.findByLabelText(t.shot.inputLabel);
    await user.type(field, '1250');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText('타발수가 너무 큽니다')).toBeInTheDocument();
    expect(field).toHaveValue('1250');
  });

  it('서버 문구가 공백뿐이면 공용 안내로 떨어진다 — 제목만 있고 본문이 빈 배너를 만들지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      saveStatus: 400,
      saveErrorBody: {
        errors: [
          { scope: 'screen', code: 'X', message: '   ' },
          { scope: 'screen', code: 'Y', message: '' },
        ],
      },
    });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.save.rejected)).toBeInTheDocument();
    /* 서버가 말을 못 했다는 사정이 「다시 누르면 달라진다」로 바뀌지는 않는다. */
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('계약 형태가 아닌 400 응답에서도 서버 사유를 보이고 다시 시도를 권하지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ saveStatus: 400, saveErrorBody: { message: '값이 범위를 벗어났습니다' } });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText('값이 범위를 벗어났습니다')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('서버가 사유를 아예 주지 않아도 다시 시도를 권하지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ saveStatus: 422, saveErrorBody: {} });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.save.rejected)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('저장에 실패한 뒤 다른 툴을 찍으면 앞 시도의 배너가 남지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({
      tools: [makeTool(), makeTool({ moldId: 2002, moldCode: 'MLD-0999' })],
      saveStatus: 422,
      saveErrorBody: { message: '이미 마감된 작업지시입니다' },
    });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await user.click(screen.getByRole('button', { name: t.actions.save }));
    expect(await screen.findByText('이미 마감된 작업지시입니다')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(t.scan.inputLabel));
    await scanTool(user, 'MLD-0999');

    await waitFor(() => {
      expect(screen.queryByText('이미 마감된 작업지시입니다')).not.toBeInTheDocument();
    });
  });

  it('진입 컨텍스트가 없으면 저장을 열지 않고 사유를 보인다', async () => {
    const user = userEvent.setup();
    renderScreen({}, '/pop/tool-usage');

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');

    expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.noEntry)).toBeInTheDocument();
  });
});

describe('ToolUsageScreen — 환산', () => {
  it('비율이 설정돼 있지 않으면 환산을 고를 수 없고 사유를 보인다', async () => {
    renderScreen();

    expect(await screen.findByText(t.shot.conversionUnavailable)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: t.shot.convertedLabel })).toBeDisabled();
  });

  it('비율이 서 있으면 수량을 곱한 값을 보내고 기준 수량·비율을 함께 저장한다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ conversionReady: true, writes });

    await scanTool(user);
    await user.click(await screen.findByRole('switch', { name: t.shot.convertedLabel }));
    await user.type(await screen.findByLabelText(t.shot.baseQtyLabel), '500');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    const body = (await writes[0]?.json()) as Record<string, unknown>;

    expect(body.shotCount).toBe(1250);
    expect(body.collectionMethodCode).toBe('CONVERTED');
    expect(body.conversionBaseQty).toBe(500);
    expect(body.conversionRatio).toBe(2.5);
  });
});
