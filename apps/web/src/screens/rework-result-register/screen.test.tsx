/**
 * `P-04-03` 재작업 실적 등록 — **스펙 §3 이 정한 구획 차례를 잡아 둔다.**
 *
 * 이 화면에는 렌더 감지기가 없었다. 구획을 나누고 액션바를 화면 바닥으로 옮기는 변경이
 * 아무 감지기에도 걸리지 않아, 다음 사람이 되돌려도 게이트가 전부 초록이다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다(`SYN-` 접두).
 */
import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider } from '../../patterns/pop-identity';
import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { ReworkResultRegisterScreen } from './screen';

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

const stubFetch: StubFetch = async (request) => {
  const url = new URL(request.url);

  if (url.pathname === '/production/work-orders') {
    return jsonResponse({
      items: [WORK_ORDER],
      page: { page: 1, size: 20, total: 1 },
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
          followUpQty: 0,
        },
      ],
      page: { page: 1, size: 20, total: 1 },
    });
  }

  if (url.pathname === `/mdm/terminals/${String(TERMINAL_ID)}/processes`) {
    return jsonResponse({
      items: [{ processId: PROCESS_ID, canInputResult: true }],
      page: { page: 1, size: 20, total: 1 },
    });
  }

  throw new Error(`스텁에 없는 요청입니다: ${url.pathname}`);
};

const renderScreen = () => {
  const rendered = renderWithProviders(
    <PopIdentityProvider
      value={{ terminalId: TERMINAL_ID, processId: PROCESS_ID, workerNo: '100027' }}
    >
      <ReworkResultRegisterScreen />
    </PopIdentityProvider>,
    { fetch: stubFetch, route: '/pop/rework-results' },
  );

  return { ...rendered, user: userEvent.setup() };
};

const pickWorkOrder = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByText(WORK_ORDER.workOrderNo));
};

describe('ReworkResultRegisterScreen — 스펙 §3 의 구획', () => {
  /*
   * ⭐ 스펙 §3 은 본문을 ① 재작업 대상 · ② 실적 입력 · ③ 결과 LOT · ④ 진행으로 갈랐다.
   *    ③ 이 없으면 「새 LOT 이 생기나」를 화면이 답하지 못한다(§5-4 가 답을 정해 두었다).
   */
  it('본문이 대상 · 입력 · 결과 LOT · 진행 네 구획으로 선다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    expect(await screen.findByRole('heading', { name: t.target })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.quantities.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.resultLot.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.progress.title })).toBeInTheDocument();
  });

  /*
   * ⛔ **①·③·④는 내용만큼만 서야 한다.** POP 규격의 기본은 「머리줄·액션 줄이 아닌 것이 남는
   *    높이를 나눠 갖는다」인데, 본문이 구획 넷인 이 화면에서는 그 규칙이 넷 모두에 걸려
   *    **각자 1/4 을 받고 내용이 잘린다**(실측 — 대상 카드에 두 줄만 남았다).
   *
   *    남는 높이는 ②가 받아 그 안에서 스크롤한다 — 스펙 §3 의 ⚠ E-4 다.
   */
  it('대상·결과 LOT·진행은 내용만큼만 서고 남는 높이는 실적 입력이 받는다', async () => {
    const { container, user } = renderScreen();
    await pickWorkOrder(user);

    await screen.findByRole('heading', { name: t.quantities.title });

    expect(container.querySelector('.rework-target-card')).toHaveClass('pop-fixed');
    expect(container.querySelector('.rework-result-lot')).toHaveClass('pop-fixed');
    expect(container.querySelector('.rework-result-summary')).toHaveClass('pop-fixed');
    /* ⛔ ②에는 붙이지 않는다 — 붙이면 남는 높이를 아무도 받지 않는다. */
    expect(container.querySelector('.rework-result-input')).not.toHaveClass('pop-fixed');
  });

  /*
   * ⭐ **머리줄 왼쪽은 «값»이다** — 스펙 §3 의 `W/O-2026-R012 · FG-1001`.
   *    ⛔ 「고르세요」 같은 안내문을 두지 않는다(본문 목록이 이미 말한다) · 사번에는 라벨을
   *    붙인다(숫자만 두면 무슨 번호인지 알 수 없다 · `P-02-01`·`P-02-02` §3).
   */
  it('머리줄이 W/O·품목을 값으로 보이고 사번에 라벨을 붙인다', async () => {
    const { container, user } = renderScreen();

    const header = container.querySelector('.pop-header');

    expect(header).toHaveTextContent(t.workerLabel('100027'));
    expect(header).toHaveTextContent(t.workOrderUnknown);
    expect(header).not.toHaveTextContent(t.selectWorkOrder);

    await pickWorkOrder(user);

    expect(header).toHaveTextContent(
      t.headerContext(WORK_ORDER.workOrderNo, WORK_ORDER.itemCode),
    );
  });

  /*
   * ⭐ **목록은 고르기 «전»에만 선다** — §5-6 이 W/O 선택을 「진입 시」로 적었고 §3 도면에는
   *    목록 구획이 없다. 좌우 2단으로 목록을 상시 두면 왼쪽 절반이 늘 목록이라 §3-1 의 세로
   *    검산(① 120 + ② 280 + ③ 96 + ④ 88 = 616)이 성립하지 않는다.
   */
  it('고르기 전에는 목록만, 고른 뒤에는 목록이 접히고 「변경」이 선다', async () => {
    const { user } = renderScreen();

    expect(await screen.findByRole('heading', { name: t.workOrders })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: t.quantities.title })).not.toBeInTheDocument();

    await pickWorkOrder(user);

    expect(await screen.findByRole('heading', { name: t.quantities.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: t.workOrders })).not.toBeInTheDocument();

    /* 다른 W/O 로 옮기려면 ① 구획의 [ 변경 ] 이 목록을 다시 편다. */
    await user.click(screen.getByRole('button', { name: t.changeWorkOrder }));

    expect(await screen.findByRole('heading', { name: t.workOrders })).toBeInTheDocument();
  });

  /*
   * ⛔ **액션바는 화면의 최상위 자식이어야 한다** — POP 규격의 바닥 띠 규칙이 그 자리만
   *    겨냥한다(`.pop-ui > [class*='action']`). 구획 안으로 들어가면 띠가 서지 않고 본문의
   *    일부로 흐른다. 스펙 §3 의 세로 예산(헤더 64 + 본문 616 + 액션바 88)이 그 전제다.
   */
  it('액션바가 화면 바닥의 띠로 서고, 고르기 전에도 자리를 지킨다', async () => {
    const { container } = renderScreen();

    const bar = await screen.findByRole('button', { name: t.save });
    const actionBar = bar.closest('.pop-action-bar');

    expect(actionBar?.parentElement).toBe(container.querySelector('.pop-ui'));
    /* 고르기 전에도 사라지지 않는다 — 조작이 나타났다 사라지면 본문이 그만큼 움직인다. */
    expect(screen.getByRole('button', { name: t.reset })).toBeDisabled();
  });

  /*
   * ③ 결과 LOT — **넣은 수량으로 즉시 바뀐다**(§3 ⚠ E-4 「③은 접지 않는다」).
   * 재작업은 LOT 을 가르지 않는다(§5-4) — 선별과 다른 자리다.
   */
  it('결과 LOT 구획이 넣은 양품 수량을 그대로 말한다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    const section = await screen.findByRole('region', { name: t.resultLot.title });

    /* ⚠ 문장이 여러 요소로 쪼개져 있다 — 구획의 글자 전체로 본다. */
    expect(section).toHaveTextContent(t.resultLot.keep);
    expect(section).toHaveTextContent(t.resultLot.good('0'));

    await user.click(await screen.findByRole('button', { name: '5' }));

    expect(section).toHaveTextContent(t.resultLot.good('5'));
  });

  /* ② 수량 네 칸은 2×2 다 — 세로로 쌓으면 280px 예산을 넘어 ③·④가 밀린다(§3-1 슬랙 0). */
  it('수량 네 칸이 한 격자에 함께 선다', async () => {
    const { container, user } = renderScreen();
    await pickWorkOrder(user);

    await screen.findByRole('heading', { name: t.quantities.title });
    const grid = container.querySelector('.rework-qty-grid');

    expect(grid).not.toBeNull();
    expect(grid?.querySelectorAll('input')).toHaveLength(4);
  });
});
