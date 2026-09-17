import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
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
import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
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

/* ⭐ [확인]으로 숫자를 확정해야 [실적 저장]이 열린다(사용자 지시 2026-09-17). 이미 확정했으면 그대로 둔다. */
const confirmShot = async (user: ReturnType<typeof userEvent.setup>) => {
  const confirm = await screen.findByRole('button', { name: t.actions.confirm });
  if (!(confirm as HTMLButtonElement).disabled) await user.click(confirm);
};

/** ⭐ 사용자 지시 2026-09-14 — 도면 머리줄 「W/O · 설비」. 설비는 단말이 준다. */
describe('ToolUsageScreen — 안내', () => {
  /* ⭐ 누계 안내는 파란 라벨(칩)로 선다 — 구획 카드가 아니다(사용자 지시 2026-09-15). */
  it('누계 안내를 정보 띠 안에 두 줄로 보인다', async () => {
    renderScreen();

    const note = await screen.findByRole('note', { name: t.notice.sectionLabel });
    /* ⭐ 두 줄로 나눠 보인다(사용자 지시 2026-09-15). */
    for (const line of t.notice.serverAdds)
      expect(within(note).getByText(line)).toBeInTheDocument();
    expect(note.closest('.pop-section')).toBeNull();
  });
});

describe('ToolUsageScreen — 머리줄', () => {
  it('타이틀 옆에 W/O 와 단말 설비를 함께 보인다', async () => {
    renderWithProviders(
      <PopIdentityProvider
        value={{
          ...UNKNOWN_POP_IDENTITY,
          equipment: { equipmentId: 6, equipmentCode: 'PRS-01', equipmentName: '프레스 1호기' },
        }}
      >
        <ToolUsageScreen />
      </PopIdentityProvider>,
      { fetch: createStubFetch(routes({})), route: ENTRY_ROUTE },
    );

    expect(
      await screen.findByText(`${t.entry.workOrderLabel} 1001 · 설비 프레스 1호기`),
    ).toBeInTheDocument();
  });

  it('단말 설비가 없으면 W/O 만 보인다', async () => {
    renderScreen();

    expect(await screen.findByText(`${t.entry.workOrderLabel} 1001`)).toBeInTheDocument();
  });
});

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
    /*
     * 사유는 **스캔 구획이** 말한다(스펙 §6-1 「폐기된 툴입니다」) — 액션바가 아니다.
     * ⛔ 「타발수를 기입하세요」로 말하면 안 된다: 값을 이미 넣었는데 그것을 탓하게 된다.
     */
    expect(screen.getByText(t.scan.disposed)).toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.noShot)).not.toBeInTheDocument();
  });

  it('「코드 직접 입력」은 칸을 비우고 안내를 «보이는 자리»에 세운다 — 눌렀는데 아무 일도 없으면 안 된다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    expect(await screen.findByText(TOOL_CODE)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.scan.manualEntry }));

    const field = screen.getByLabelText(t.scan.inputLabel);

    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
    /* 안내는 칸이 비어 있을 때만 보이는 placeholder 가 아니라 늘 보이는 자리에 선다. */
    expect(screen.getByText(t.scan.manualHint)).toBeInTheDocument();
    expect(screen.queryByText(TOOL_CODE)).not.toBeInTheDocument();
  });

  /* ⛔ [툴 다시 고르기]를 두지 않는다(사용자 지시 2026-09-17) — 다른 툴은 다시 스캔하거나 [직접 입력]으로 바꾼다. */
  it('고른 툴 줄에 「툴 다시 고르기」가 없다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);

    expect(await screen.findByText(TOOL_CODE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '툴 다시 고르기' })).not.toBeInTheDocument();
  });

  /* ⚠ 다른 툴을 읽으면 앞 툴에 확정한 숫자가 풀린다(리뷰) — 새 툴 실적으로 저장되지 않게. */
  it('확인 뒤 다른 툴을 읽으면 확정이 풀려 저장이 잠긴다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await confirmShot(user);
    expect(screen.getByRole('button', { name: t.actions.save })).toBeEnabled();

    const scan = screen.getByLabelText(t.scan.inputLabel);
    await user.clear(scan);
    await scanTool(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.save })).toBeDisabled();
    });
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

  it('타발수 칸에 문자를 쳐도 들어가지 않는다 — 저장할 때가 아니라 칠 때 막는다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    const field = await screen.findByLabelText(t.shot.inputLabel);
    await user.type(field, '12a3.5-');

    expect(field).toHaveValue('1235');
  });

  it('숫자 키패드로 친 값이 타발수 칸과 누계에 그대로 간다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    await screen.findByText(TOOL_CODE);

    for (const key of ['1', '2', '5', '0']) {
      await user.click(screen.getByRole('button', { name: key }));
    }

    expect(screen.getByLabelText(t.shot.inputLabel)).toHaveValue('1250');
    expect(screen.getByText(`+1,250 ${t.shot.unit}`)).toBeInTheDocument();
  });

  it('적정타수가 있으면 사용률 진행 막대를 보인다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
    /* 막대가 「남은 비율」로 읽히지 않게 이름을 곁에 세운다. */
    expect(screen.getByText(t.cumulative.usageBarLabel)).toBeInTheDocument();
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

    /* 초과는 수치 옆에 붙는다 — 「−2,300 회(초과)」(스펙 §6-1). 따로 떨어진 문장이 아니다. */
    expect(
      await screen.findByText(`-2,300 ${t.shot.unit}${t.cumulative.overSuffix}`),
    ).toBeInTheDocument();
    await confirmShot(user);
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

describe('ToolUsageScreen — 키패드', () => {
  /*
   * ⛔ **타발수가 비면 [ C ]·[ ⌫ ] 는 잠긴다.** 지울 것이 없는데 열려 있으면 눌러도 아무 일이
   * 일어나지 않아 「눌리는데 안 되는 키」가 된다(사용자 지적). 작업실적 등록·인식표 발행과
   * 같은 부품을 써서 POP 안에서 같게 동작한다.
   */
  /* ⭐ 순서는 금형 QR → 수량이다(사용자 지시 2026-09-17). */
  it('금형을 읽기 전에는 타발수 칸과 키패드가 잠겨 있다', async () => {
    renderScreen();

    expect(await screen.findByLabelText(t.shot.inputLabel)).toBeDisabled();
    expect(screen.getByRole('button', { name: '7' })).toBeDisabled();
  });

  it('타발수가 비면 지움 키 둘이 잠기고, 값이 들어오면 열린다', async () => {
    const user = userEvent.setup();
    renderScreen();
    await scanTool(user);

    const clearKey = () => screen.getByRole('button', { name: t.shot.clearGlyph });
    const backspaceKey = () => screen.getByRole('button', { name: t.shot.backspace });

    await waitFor(() => {
      expect(clearKey()).toBeDisabled();
    });
    expect(backspaceKey()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '7' }));

    await waitFor(() => {
      expect(clearKey()).toBeEnabled();
    });
    expect(backspaceKey()).toBeEnabled();
    expect(screen.getByLabelText(t.shot.inputLabel)).toHaveValue('7');
  });

  /* 타발수는 정수다(스펙 §4-A `bigint`) — 직접 입력에서는 소수점 키를 그리지 않는다. */
  it('직접 입력에서는 소수점 키가 없다', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: t.shot.decimalKey })).not.toBeInTheDocument();
  });
});

describe('ToolUsageScreen — 저장', () => {
  it('증분만 보낸다 — 누계를 계산해 보내지 않는다', async () => {
    const user = userEvent.setup();
    const writes: Request[] = [];
    renderScreen({ writes });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await confirmShot(user);
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
    await confirmShot(user);
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
    await confirmShot(user);
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });

    await confirmShot(user);
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
    await confirmShot(user);
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.save.successTitle)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(t.shot.inputLabel)).toHaveValue('');
    });
  });

  /* ⭐ 저장되면 금형 QR 칸과 고른 금형 안내를 비운다(사용자 지시 2026-09-17) — 다음 실적은 QR 부터다. */
  it('저장 뒤 금형 QR 칸과 고른 금형 안내가 비워진다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await confirmShot(user);
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.save.successTitle)).toBeInTheDocument();
    expect(screen.getByLabelText(t.scan.inputLabel)).toHaveValue('');
    expect(screen.queryByText(TOOL_CODE)).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.shot.inputLabel)).toBeDisabled();
  });

  it('단말 권한에 막히면 그 사정을 말하고 다시 시도를 권하지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ saveStatus: 403 });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await confirmShot(user);
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText(t.save.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('업무 규칙에 걸리면 서버가 준 사유를 보이고 다시 시도를 권하지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ saveStatus: 422, saveErrorBody: { message: '이미 마감된 작업지시입니다' } });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await confirmShot(user);
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
    await confirmShot(user);
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
    await confirmShot(user);
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
    await confirmShot(user);
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await screen.findByText('값이 범위를 벗어났습니다')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('서버가 사유를 아예 주지 않아도 다시 시도를 권하지 않는다', async () => {
    const user = userEvent.setup();
    renderScreen({ saveStatus: 422, saveErrorBody: {} });

    await scanTool(user);
    await user.type(await screen.findByLabelText(t.shot.inputLabel), '1250');
    await confirmShot(user);
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
    await confirmShot(user);
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

  /* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */
  it('사번이 없으면 맨 위에 공용 사번 미확인 띠가 선다', async () => {
    renderScreen({}, '/pop/tool-usage?workOrderId=1001');

    expect(await screen.findByText(messages.popChrome.workerMissing)).toBeInTheDocument();
  });

  it('사번이 있으면 사번 미확인 띠가 없다', async () => {
    renderScreen();

    await screen.findByLabelText(t.scan.inputLabel);
    expect(screen.queryByText(messages.popChrome.workerMissing)).not.toBeInTheDocument();
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
    await confirmShot(user);
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
