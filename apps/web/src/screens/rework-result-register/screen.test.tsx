/**
 * `P-04-03` 재작업 실적 등록 — **스펙 §3 이 정한 구획 차례를 잡아 둔다.**
 *
 * 이 화면에는 렌더 감지기가 없었다. 구획을 나누고 액션바를 화면 바닥으로 옮기는 변경이
 * 아무 감지기에도 걸리지 않아, 다음 사람이 되돌려도 게이트가 전부 초록이다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다(`SYN-` 접두).
 */
import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { PopIdentityProvider } from '../../patterns/pop-identity';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { ReworkResultRegisterScreen } from './screen';
import { popGateDeniedText } from '../../patterns/pop-process-gate';

const t = messages.reworkResultRegister;

const TERMINAL_ID = 7001;
const PROCESS_ID = 3001;
const NONCONFORMANCE_ID = 9001;

const WORK_ORDER = {
  workOrderId: 8801,
  workOrderNo: 'SYN-WO-R012',
  productionPlanId: 4001,
  routingOperationId: 3001,
  itemId: 5001,
  itemCode: 'SYN-FG-1001',
  orderQty: 160,
  uomId: 11,
  workOrderTypeCode: 'REWORK',
  statusCode: 'SYN_RELEASED',
  priorityNo: 1,
  reworkSourceNonconformanceId: NONCONFORMANCE_ID,
  reworkSourceLotId: 6001,
  reworkSourceWorkOrderId: 8800,
};

/** 단위 조회가 실제로 실은 질의. 아래 「첫 쪽만 받지 않는다」가 본다. */
let uomQuery: URLSearchParams | null = null;

/** 배포 전 재작업 지시. 기본은 없고, 그 줄을 재는 검사만 채운다. */
let plannedRows: (typeof WORK_ORDER)[] = [];

/** 배포된 쪽의 전체 건수. 기본은 한 쪽이고, 쪽 넘김을 재는 검사만 늘린다. */
let releasedTotal = 1;

const stubFetch: StubFetch = async (request) => {
  const url = new URL(request.url);

  if (url.pathname === '/production/work-orders') {
    /*
     * 화면은 두 번 묻는다 — 배포된 것(`open=true`)과 배포 전(`statusCode=PLANNED`).
     * 기본 하네스는 배포된 것 한 건만 답하고 배포 전은 0건이다(omf-all-around#47).
     */
    const planned = url.searchParams.get('statusCode') === 'PLANNED';

    if (planned) {
      return jsonResponse({
        items: plannedRows,
        page: { page: 1, size: 20, total: plannedRows.length },
      });
    }

    /* 배포된 쪽만 쪽을 나눈다 — 쪽마다 번호가 다른 한 건을 낸다. */
    const page = Number(url.searchParams.get('page') ?? '1');

    return jsonResponse({
      items: [
        page === 1 ? WORK_ORDER : { ...WORK_ORDER, workOrderId: 8899, workOrderNo: 'SYN-WO-R099' },
      ],
      page: { page, size: 20, total: releasedTotal },
    });
  }

  if (url.pathname === `/quality/nonconformances/${String(NONCONFORMANCE_ID)}`) {
    return jsonResponse({
      nonconformanceId: NONCONFORMANCE_ID,
      nonconformanceNo: 'SYN-NC-0071',
      description: '합성 외관 결함',
    });
  }

  if (
    url.pathname === `/quality/nonconformances/${String(NONCONFORMANCE_ID)}/disposition-decisions`
  ) {
    return jsonResponse({
      items: [
        {
          dispositionDecisionId: 1,
          dispositionTypeCode: 'REWORK',
          decisionQty: 160,
          uomId: 11,
          decidedBy: 900001,
          decidedAt: '2026-08-07T09:12:00+09:00',
          followUpQty: 0,
        },
      ],
      page: { page: 1, size: 20, total: 1 },
    });
  }

  if (url.pathname === '/trace/lots/6001') {
    return jsonResponse({
      lot: {
        lotId: 6001,
        lotNo: 'SYN-LOT-0288',
        itemId: 5001,
        lotTypeCode: 'PRODUCT',
        plantId: 1,
        initialQty: 160,
        uomId: 11,
        statusCode: 'NORMAL',
        held: false,
      },
    });
  }

  if (url.pathname === '/mdm/uoms') {
    uomQuery = url.searchParams;

    return jsonResponse({
      items: [
        { uomId: 11, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true },
        { uomId: 12, uomCode: 'KG', uomName: '킬로그램', decimalScale: 3, isActive: true },
      ],
      page: { page: 1, size: 200, total: 2 },
    });
  }

  if (url.pathname === `/mdm/terminals/${String(TERMINAL_ID)}/processes`) {
    return jsonResponse({
      items: [{ processId: PROCESS_ID, canInputResult: true }],
      page: { page: 1, size: 20, total: 1 },
    });
  }

  if (url.pathname === '/quality/defect-codes') {
    return jsonResponse({
      items: [{ defectCodeId: 31, defectCode: 'D-SCR', defectName: '스크래치' }],
      page: { page: 1, size: 100, total: 1 },
    });
  }

  throw new Error(`스텁에 없는 요청입니다: ${url.pathname}`);
};

const renderScreen = (workerNo: string | null = '100027', route = '/pop/rework-results') => {
  const rendered = renderWithProviders(
    <PopIdentityProvider
      value={{
        terminalId: TERMINAL_ID,
        processes: [{ processId: PROCESS_ID }],
        equipment: null,
        workerNo,
      }}
    >
      <ReworkResultRegisterScreen />
    </PopIdentityProvider>,
    { fetch: stubFetch, route },
  );

  return { ...rendered, user: userEvent.setup() };
};

/** 소수를 받는 단위(`KG` · `decimalScale` 3)의 W/O. */
const renderWithFractionalUom = () => {
  const rendered = renderWithProviders(
    <PopIdentityProvider
      value={{
        terminalId: TERMINAL_ID,
        processes: [{ processId: PROCESS_ID }],
        equipment: null,
        workerNo: '100027',
      }}
    >
      <ReworkResultRegisterScreen />
    </PopIdentityProvider>,
    {
      fetch: async (request) => {
        const url = new URL(request.url);

        if (url.pathname === '/production/work-orders') {
          /* 배포 전 조회에는 0건 — 이 검사는 단위 하나만 본다. */
          if (url.searchParams.get('statusCode') === 'PLANNED') {
            return jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } });
          }

          return jsonResponse({
            items: [{ ...WORK_ORDER, uomId: 12 }],
            page: { page: 1, size: 20, total: 1 },
          });
        }

        return stubFetch(request);
      },
      route: '/pop/rework-results',
    },
  );

  return { ...rendered, user: userEvent.setup() };
};

/** 재작업 처분이 없는 W/O — `remaining` 이 0 이 되는 자리다. */
const renderWithoutDisposition = () => {
  const rendered = renderWithProviders(
    <PopIdentityProvider
      value={{
        terminalId: TERMINAL_ID,
        processes: [{ processId: PROCESS_ID }],
        equipment: null,
        workerNo: '100027',
      }}
    >
      <ReworkResultRegisterScreen />
    </PopIdentityProvider>,
    {
      fetch: async (request) => {
        const url = new URL(request.url);

        if (
          url.pathname ===
          `/quality/nonconformances/${String(NONCONFORMANCE_ID)}/disposition-decisions`
        ) {
          return jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } });
        }

        return stubFetch(request);
      },
      route: '/pop/rework-results',
    },
  );

  return { ...rendered, user: userEvent.setup() };
};

const pickWorkOrder = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: new RegExp(WORK_ORDER.workOrderNo) }));
  await screen.findByRole('list', { name: t.steps.label });
};

/** ② 불량 등록 단계로 간다 — ①의 아래 작업 줄 [확인]. */
const goDefectStep = async (user: ReturnType<typeof userEvent.setup>) => {
  await waitFor(() => expect(screen.getByRole('button', { name: t.confirm })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: t.confirm }));
  await screen.findByLabelText(t.quantities.defectQty);
};

const key = (name: string) => screen.getByRole('button', { name });

describe('ReworkResultRegisterScreen — 본문 통일 시안(#295)', () => {
  afterEach(() => {
    plannedRows = [];
    releasedTotal = 1;
  });

  /* 작업지시 목록의 [재작업 실적 등록]이 W/O 를 실어 온다(#295) — 그 W/O 를 고른 채로 연다. */
  it('주소의 workOrderId 로 그 재작업 W/O 를 고른 채로 연다', async () => {
    renderScreen('100027', `/pop/rework-results?workOrderId=${String(WORK_ORDER.workOrderId)}`);

    await screen.findByRole('list', { name: t.steps.label });
    expect(
      screen.getByRole('button', { name: new RegExp(WORK_ORDER.workOrderNo) }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  /*
   * ⭐ **배포 전 지시도 목록에 선다**(사용자 결정 2026-09-21 · omf-all-around#47).
   * ⛔ **고르지는 못한다** — 서버가 `PLANNED` 의 실적을 받지 않는다.
   */
  it('배포 전 지시는 표식과 함께 보이되 고를 수 없다', async () => {
    plannedRows = [
      { ...WORK_ORDER, workOrderId: 8802, workOrderNo: 'SYN-WO-R013', statusCode: 'PLANNED' },
    ];
    const { user } = renderScreen();

    expect(await screen.findByText('SYN-WO-R013')).toBeInTheDocument();
    expect(screen.getByText(t.notReleased)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /SYN-WO-R013/ })).toBeNull();
    expect(screen.getByRole('button', { name: /SYN-WO-R012/ })).toBeEnabled();

    /* 줄을 눌러도 열리지 않는다 — 가운데는 그대로 「고르세요」다. */
    await user.click(screen.getByText(t.notReleased));

    expect(screen.getByText(t.pickTitle)).toBeInTheDocument();
  });

  /*
   * ⭐ 배포 전 줄은 배포된 줄이 끝난 다음 자리부터 잇는다 — 한 쪽 건수가 구획 높이로 정해져
   *    한 쪽에 더 얹으면 넘친다. 배포된 쪽의 요청 크기는 그 건수다.
   */
  it('배포 전 줄은 배포된 줄 다음 쪽에 이어 선다', async () => {
    releasedTotal = 5;
    plannedRows = [
      { ...WORK_ORDER, workOrderId: 8802, workOrderNo: 'SYN-WO-R013', statusCode: 'PLANNED' },
    ];
    const { user } = renderScreen();

    expect(await screen.findByText(WORK_ORDER.workOrderNo)).toBeInTheDocument();
    expect(screen.queryByText('SYN-WO-R013')).toBeNull();
    expect(screen.getByText(messages.popUniform.pager.total(6))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.popUniform.pager.next }));

    expect(await screen.findByText('SYN-WO-R099')).toBeInTheDocument();
    expect(screen.getByText('SYN-WO-R013')).toBeInTheDocument();
  });

  it('사번을 모르면 맨 위 공용 띠로 말하고 저장이 잠긴다', async () => {
    const { user } = renderScreen(null);
    await pickWorkOrder(user);

    expect(await screen.findByText(messages.popChrome.workerMissing)).toBeInTheDocument();
    /* ①에서 이미 [확인]이 잠긴다 — 저장 단계로 넘어가지 못한다. */
    expect(screen.getByRole('button', { name: t.confirm })).toBeDisabled();
  });

  /* ⭐ 미전송이 없으면 「미전송 0건」을 두지 않는다(사용자 지시 2026-09-15). */
  it('미전송 건이 없으면 미전송 표시가 없다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    expect(screen.queryByText(t.pending(0))).not.toBeInTheDocument();
  });

  /* 목록은 늘 왼쪽에 서고, 고른 작업지시는 선택 표시와 가운데 정보 띠로 보인다. */
  it('고르기 전에는 가운데가 빈 화면, 고른 뒤에도 목록이 남고 고른 줄이 표시된다', async () => {
    const { user } = renderScreen();

    expect(await screen.findByRole('heading', { name: t.workOrders })).toBeInTheDocument();
    expect(screen.getByText(t.pickTitle)).toBeInTheDocument();
    expect(key('7')).toBeDisabled();

    await pickWorkOrder(user);

    expect(screen.getByRole('heading', { name: t.workOrders })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SYN-WO-R012/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText(t.pickTitle)).toBeNull();
  });

  /* ⭐ 정보 띠는 스펙 §3 ①의 세 줄이다 — 기존 LOT 번호(번호+수량) · 처분 · 근거. 식별자 숫자는 새지 않는다. */
  it('정보 띠가 기존 LOT 번호 · 처분 · 근거 세 줄로 선다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    await screen.findByText(t.sourceLotValue('SYN-LOT-0288', '160', 'EA'));
    const band = screen.getByRole('group', { name: t.workOrders });
    expect(band).toHaveTextContent(t.nonconformanceValue('SYN-NC-0071', '합성 외관 결함'));
    expect(band).toHaveTextContent(t.dispositionValue('160', 'EA', '08-07'));
    expect(band).not.toHaveTextContent('6001');
  });

  /* ⭐ 두 단계: ① 양품·보류·폐기 › ② 불량 수량·불량 코드. [이전]으로 돌아가도 넣은 값은 남는다. */
  it('① [확인]으로 ②에 가고, [이전]·단계 줄로 돌아가도 값이 남는다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    expect(screen.getByLabelText(t.quantities.goodQty)).toBeInTheDocument();
    expect(screen.getByLabelText(t.quantities.holdQty)).toBeInTheDocument();
    expect(screen.getByLabelText(t.quantities.scrapQty)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.quantities.defectQty)).toBeNull();
    /* ① 작업 줄: [입력 초기화] + [확인]. [실적 저장]·[이전]·[불량 등록]은 없다. */
    expect(screen.getByRole('button', { name: t.reset })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.save })).toBeNull();
    expect(screen.queryByRole('button', { name: t.prev })).toBeNull();
    expect(screen.queryByRole('button', { name: /^불량 등록/ })).toBeNull();

    await user.click(key('7'));
    await goDefectStep(user);

    expect(screen.queryByLabelText(t.quantities.goodQty)).toBeNull();
    expect(screen.getByLabelText(t.defectCode)).toBeInTheDocument();
    /* ② 작업 줄: [이전] + [실적 저장]. */
    expect(screen.getByRole('button', { name: t.save })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.confirm })).toBeNull();
    expect(screen.queryByRole('button', { name: t.reset })).toBeNull();
    /* 단계를 바꾸면 그 단계의 첫 칸에 입력된다. */
    await user.click(key('3'));
    expect(screen.getByLabelText(t.quantities.defectQty)).toHaveValue('3');

    await user.click(screen.getByRole('button', { name: t.prev }));
    expect(screen.getByLabelText(t.quantities.goodQty)).toHaveValue('7');

    /* 다시 ②로 가면 불량 수량도 남아 있다. 단계 줄의 끝난 ①을 눌러도 돌아간다. */
    await goDefectStep(user);
    expect(screen.getByLabelText(t.quantities.defectQty)).toHaveValue('3');
    await user.click(
      within(screen.getByRole('list', { name: t.steps.label })).getByRole('button', {
        name: new RegExp(t.steps.input),
      }),
    );
    expect(screen.getByLabelText(t.quantities.goodQty)).toHaveValue('7');
  });

  /* ⛔ 차례대로만 — 단계 줄의 ②는 눌러 앞질러 갈 수 없다. */
  it('단계 줄로 ②에 앞질러 갈 수 없다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);
    await user.click(key('7'));

    const flow = screen.getByRole('list', { name: t.steps.label });
    expect(within(flow).queryByRole('button')).toBeNull();
    await user.click(within(flow).getByText(t.steps.defect));
    expect(screen.queryByLabelText(t.quantities.defectQty)).toBeNull();
    expect(screen.getByLabelText(t.quantities.goodQty)).toHaveValue('7');
  });

  /*
   * ⭐ 저장 요청은 그대로 하나 — ① [확인]은 서버를 부르지 않고, ② [실적 저장]이 불량 수량까지
   *    실어 한 번 보낸다. ①을 비워 두고 불량만 넣어도 저장된다(지금과 같다).
   */
  it('[확인]은 저장하지 않고, [실적 저장]이 불량 수량까지 실어 한 번 보낸다', async () => {
    const posts: Record<string, unknown>[] = [];
    const user = userEvent.setup();
    renderWithProviders(
      <PopIdentityProvider
        value={{
          terminalId: TERMINAL_ID,
          processes: [{ processId: PROCESS_ID }],
          equipment: null,
          workerNo: '100027',
        }}
      >
        <ReworkResultRegisterScreen />
      </PopIdentityProvider>,
      {
        fetch: async (request) => {
          if (request.method === 'POST') {
            posts.push((await request.clone().json()) as Record<string, unknown>);
            return jsonResponse({ productionResultId: 1 }, { status: 201 });
          }
          return stubFetch(request);
        },
        route: '/pop/rework-results',
      },
    );
    await pickWorkOrder(user);

    /* ① 합계 0 이어도 [확인]은 열린다 — 불량이 ②에서 합계를 채울 수 있다. */
    await goDefectStep(user);
    expect(posts).toHaveLength(0);
    expect(screen.getByRole('button', { name: t.save })).toBeDisabled();

    await user.click(key('4'));
    await user.click(screen.getByLabelText(new RegExp(`^${t.defectCode}`)));
    await user.click(await screen.findByRole('option', { name: /D-SCR/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: t.save })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: t.save }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ workOrderId: WORK_ORDER.workOrderId, defectQty: 4 });
    globalThis.localStorage.clear();
  });

  /* ⭐ 키패드는 오른쪽 「수량」 구획에 늘 선다 — 누른 칸이 대상이 되고 다른 칸 값은 남는다. */
  it('키패드는 고른 칸에 숫자를 넣는다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    await user.click(key('7'));
    expect(screen.getByLabelText(t.quantities.goodQty)).toHaveValue('7');

    await user.click(screen.getByLabelText(t.quantities.holdQty));
    await user.click(key('3'));

    expect(screen.getByLabelText(t.quantities.holdQty)).toHaveValue('3');
    expect(screen.getByLabelText(t.quantities.goodQty)).toHaveValue('7');

    await user.click(screen.getByRole('button', { name: messages.popUniform.keypad.clearAll }));
    expect(screen.getByLabelText(t.quantities.holdQty)).toHaveValue('');
    expect(screen.getByLabelText(t.quantities.goodQty)).toHaveValue('7');
  });

  /* ⭐ 키보드로도 친다(사용자 지시 2026-09-17) — 숫자만 남고, 개 단위에는 소수점이 들어가지 않는다. */
  it('키보드로 친 수량이 칸에 들어간다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    await user.type(screen.getByLabelText(t.quantities.goodQty), '01a2.5');

    expect(screen.getByLabelText(t.quantities.goodQty)).toHaveValue('125');
  });

  it('개 단위에는 소수점 키가 꺼져 있다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    expect(key('.')).toBeDisabled();
  });

  it('소수를 받는 단위에는 소수점 키가 켜진다', async () => {
    const { user } = renderWithFractionalUom();
    await pickWorkOrder(user);

    await waitFor(() => {
      expect(key('.')).toBeEnabled();
    });
  });

  /* ⭐ 수량 칸에 단위가 붙는다 — ① 세 칸. */
  it('수량 칸에 단위가 붙고 합계가 칩으로 든다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    await screen.findByText(t.keypad.unit('EA'));
    expect(document.querySelectorAll('.pu-unit')).toHaveLength(3);
    await waitFor(() => {
      expect(screen.getByText(`${t.total} 0 / 160`)).toBeInTheDocument();
    });
  });

  /* ⭐ 부분 · 넘침 안내는 단계 줄 아래 한 줄. 비었을 때는 안내 없이 저장만 꺼진다(사용자 지시 2026-11-19). */
  it('합계에 따라 안내 줄이 바뀌고 넘치면 [확인]·저장이 잠긴다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    expect(screen.queryByText('실적을 입력해 주세요.')).toBeNull();

    await user.click(key('5'));
    expect(await screen.findByText(t.partial(155, 'EA'))).toBeInTheDocument();
    /* 고른 작업지시의 재작업 진행이 넣는 수량을 따라 움직인다. */
    expect(screen.getByText(t.progressValue('5', '160', 'EA'))).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.quantities.goodQty), '00');
    expect(await screen.findByText(t.exceeded(160, 'EA'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm })).toBeDisabled();

    /* 넘치지 않게 고치면 ②로 가서 저장이 열리고, ②에서 불량으로 넘치면 다시 잠긴다. */
    await user.clear(screen.getByLabelText(t.quantities.goodQty));
    await user.type(screen.getByLabelText(t.quantities.goodQty), '150');
    await goDefectStep(user);
    await waitFor(() => expect(screen.getByRole('button', { name: t.save })).toBeEnabled());
    await user.type(screen.getByLabelText(t.quantities.defectQty), '20');
    expect(await screen.findByText(t.exceeded(160, 'EA'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.save })).toBeDisabled();
  });

  it('처분이 없으면 넣는 대로 넘침으로 막힌다', async () => {
    const { user } = renderWithoutDisposition();
    await pickWorkOrder(user);

    await user.click(key('7'));

    expect(await screen.findByText(t.exceeded(0, 'EA'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm })).toBeDisabled();
  });

  /* ⛔ 되돌릴 것이 없으면 [입력 초기화]가 잠긴다(사용자 지적). */
  it('입력이 없으면 「입력 초기화」가 잠기고 수량을 치면 열린다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    const resetButton = () => screen.getByRole('button', { name: t.reset });

    expect(resetButton()).toBeDisabled();

    await user.click(key('7'));
    expect(resetButton()).toBeEnabled();

    await user.click(resetButton());
    expect(resetButton()).toBeDisabled();
    expect(screen.getByLabelText(t.quantities.goodQty)).toHaveValue('');
  });

  /* ⭐ 불량이 있으면 불량 코드가 필수다(스펙 §5-3) — 이름 옆 빨간 *, 칸 테두리가 빨갛다. */
  it('불량이 있으면 불량 코드를 골라야 저장이 열린다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);
    await goDefectStep(user);

    await user.type(screen.getByLabelText(t.quantities.defectQty), '3');

    expect(screen.getByRole('button', { name: t.save })).toBeDisabled();
    /* 이름 옆에 필수 * 가 붙는다(읽는 기계에는 감춘 글자). */
    const codeField = () => screen.getByLabelText(new RegExp(`^${t.defectCode}`));
    expect(codeField().closest('.pu-field')?.querySelector('.req')).not.toBeNull();
    expect(codeField()).toHaveAttribute('aria-invalid', 'true');

    await user.click(codeField());
    await user.click(await screen.findByRole('option', { name: /D-SCR/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.save })).toBeEnabled();
    });
    expect(codeField()).not.toHaveAttribute('aria-invalid');
  });

  /* ⚠ 불량 코드를 못 받으면 필수로 막지 않는다 — 저장이 영영 열리지 않게 되기 때문이다(리뷰 M1). */
  it('불량 코드를 불러오지 못하면 사정을 말하고 코드 없이도 저장이 열린다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PopIdentityProvider
        value={{
          terminalId: TERMINAL_ID,
          processes: [{ processId: PROCESS_ID }],
          equipment: null,
          workerNo: '100027',
        }}
      >
        <ReworkResultRegisterScreen />
      </PopIdentityProvider>,
      {
        fetch: async (request) => {
          if (new URL(request.url).pathname === '/quality/defect-codes') {
            return jsonResponse({ title: 'down' }, { status: 500 });
          }

          return stubFetch(request);
        },
        route: '/pop/rework-results',
      },
    );
    await pickWorkOrder(user);
    await goDefectStep(user);

    expect(await screen.findByText(t.defectCodeLoadFailed)).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.quantities.defectQty), '3');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.save })).toBeEnabled();
    });
  });

  /* ⛔ 단위를 첫 쪽만 받지 않는다 — 잘린 단위는 소수점 키를 지운다. */
  it('단위 조회가 상한을 실어 첫 쪽에서 잘리지 않는다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    await waitFor(() => {
      expect(uomQuery).not.toBeNull();
    });

    expect(Number(uomQuery?.get('size'))).toBeGreaterThanOrEqual(100);
  });

  /* 저장하면 같은 실적을 두 번 보내지 않게 저장이 잠긴다. */
  it('저장하면 저장 단추가 잠긴다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    await user.click(key('5'));
    await goDefectStep(user);
    await waitFor(() => expect(screen.getByRole('button', { name: t.save })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: t.save }));

    await waitFor(() => expect(screen.getByRole('button', { name: t.save })).toBeDisabled());
  });
});

describe('ReworkResultRegisterScreen — 공정이 여럿인 단말', () => {
  const OTHER_PROCESS_ID = PROCESS_ID + 1;
  const renderMulti = (canInputResult: boolean) => {
    const user = userEvent.setup();
    renderWithProviders(
      <PopIdentityProvider
        value={{
          terminalId: TERMINAL_ID,
          processes: [{ processId: OTHER_PROCESS_ID }, { processId: PROCESS_ID }],
          equipment: null,
          workerNo: '100027',
        }}
      >
        <ReworkResultRegisterScreen />
      </PopIdentityProvider>,
      {
        fetch: async (request) => {
          const url = new URL(request.url);
          if (url.pathname === `/mdm/terminals/${String(TERMINAL_ID)}/processes`) {
            return jsonResponse({
              items: [
                {
                  processId: OTHER_PROCESS_ID,
                  processName: '합성 조립',
                  canInputResult: !canInputResult,
                },
                { processId: PROCESS_ID, processName: '합성 재작업', canInputResult },
              ],
            });
          }
          if (url.pathname === '/production/work-orders') {
            if (url.searchParams.get('statusCode') === 'PLANNED') {
              return jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } });
            }
            return jsonResponse({
              items: [{ ...WORK_ORDER, processId: PROCESS_ID, processName: '합성 재작업' }],
              page: { page: 1, size: 20, total: 1 },
            });
          }
          return stubFetch(request);
        },
        route: '/pop/rework-results',
      },
    );
    return user;
  };

  it('고르기 전에는 막는 문구를 내지 않는다', async () => {
    renderMulti(false);

    await screen.findByText(WORK_ORDER.workOrderNo);
    expect(screen.queryByText(t.gateUnidentified)).toBeNull();
    expect(
      screen.queryByText(popGateDeniedText({ processName: '합성 재작업' }, 'canInputResult')),
    ).toBeNull();
  });

  it('고른 W/O 의 공정으로 판정해 저장이 열린다', async () => {
    const user = renderMulti(true);
    await pickWorkOrder(user);

    await user.type(await screen.findByLabelText(t.quantities.goodQty), '3');
    await goDefectStep(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.save })).toBeEnabled();
    });
    expect(screen.queryByText(t.gateUnidentified)).toBeNull();
  });

  it('고른 W/O 공정의 실적 입력이 꺼져 있으면 공정 이름과 켜는 곳을 말하며 막는다', async () => {
    const user = renderMulti(false);
    await pickWorkOrder(user);

    expect(
      await screen.findByText(popGateDeniedText({ processName: '합성 재작업' }, 'canInputResult')),
    ).toBeInTheDocument();
    await user.type(await screen.findByLabelText(t.quantities.goodQty), '3');
    expect(screen.getByRole('button', { name: t.confirm })).toBeDisabled();
  });
});

describe('ReworkResultRegisterScreen — 서버 거부', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('단말 권한으로 서버가 거부하면(401) 서버 문구를 그대로 보인다', async () => {
    const message =
      '이 단말에는 이 W/O 공정의 실적 입력 권한이 없습니다. 관리웹 시스템 관리 › 단말기-공정 매핑에서 해당 공정의 「실적 입력」을 켜세요.';
    const user = userEvent.setup();
    renderWithProviders(
      <PopIdentityProvider
        value={{
          terminalId: TERMINAL_ID,
          processes: [{ processId: PROCESS_ID }],
          equipment: null,
          workerNo: '100027',
        }}
      >
        <ReworkResultRegisterScreen />
      </PopIdentityProvider>,
      {
        fetch: async (request) => {
          if (
            request.method === 'POST' &&
            new URL(request.url).pathname === '/production/production-results'
          ) {
            return jsonResponse(
              { errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message }] },
              { status: 401 },
            );
          }
          return stubFetch(request);
        },
        route: '/pop/rework-results',
      },
    );
    await pickWorkOrder(user);
    await user.type(await screen.findByLabelText(t.quantities.goodQty), '3');
    await goDefectStep(user);
    await waitFor(() => expect(screen.getByRole('button', { name: t.save })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: t.save }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByText(t.rejected)).toBeInTheDocument();
  });

  it('서버가 이유 없이 거부하면(404) 일반 문구 대신 할 일을 말한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PopIdentityProvider
        value={{
          terminalId: TERMINAL_ID,
          processes: [{ processId: PROCESS_ID }],
          equipment: null,
          workerNo: '100027',
        }}
      >
        <ReworkResultRegisterScreen />
      </PopIdentityProvider>,
      {
        fetch: async (request) => {
          if (
            request.method === 'POST' &&
            new URL(request.url).pathname === '/production/production-results'
          ) {
            return jsonResponse({ message: 'Not Found' }, { status: 404 });
          }
          return stubFetch(request);
        },
        route: '/pop/rework-results',
      },
    );
    await pickWorkOrder(user);
    await user.type(await screen.findByLabelText(t.quantities.goodQty), '3');
    await goDefectStep(user);
    await waitFor(() => expect(screen.getByRole('button', { name: t.save })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: t.save }));

    expect(await screen.findByText(t.rejectedHint)).toBeInTheDocument();
    expect(screen.queryByText(/Not Found/)).toBeNull();
    expect(screen.getByText(t.rejected)).toBeInTheDocument();
  });

  it('목록 조회가 단말 권한(401)으로 거부되면 「불러오지 못했다」와 서버 문구를 함께 보인다', async () => {
    const message = '단말 인증 범위 밖입니다.';
    renderWithProviders(
      <PopIdentityProvider
        value={{
          terminalId: TERMINAL_ID,
          processes: [{ processId: PROCESS_ID }],
          equipment: null,
          workerNo: '100027',
        }}
      >
        <ReworkResultRegisterScreen />
      </PopIdentityProvider>,
      {
        fetch: async (request) => {
          const url = new URL(request.url);
          if (
            url.pathname === '/production/work-orders' &&
            url.searchParams.get('statusCode') === 'PLANNED'
          ) {
            return jsonResponse(
              { errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message }] },
              { status: 401 },
            );
          }
          return stubFetch(request);
        },
        route: '/pop/rework-results',
      },
    );

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByText(t.loadError)).toBeInTheDocument();
  });
});
