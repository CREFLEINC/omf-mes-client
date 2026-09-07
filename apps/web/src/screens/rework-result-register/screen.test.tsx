/**
 * `P-04-03` 재작업 실적 등록 — **스펙 §3 이 정한 구획 차례를 잡아 둔다.**
 *
 * 이 화면에는 렌더 감지기가 없었다. 구획을 나누고 액션바를 화면 바닥으로 옮기는 변경이
 * 아무 감지기에도 걸리지 않아, 다음 사람이 되돌려도 게이트가 전부 초록이다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다(`SYN-` 접두).
 */
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
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

  if (url.pathname === '/mdm/uoms') {
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

/** 소수를 받는 단위(`KG` · `decimalScale` 3)의 W/O. */
const renderWithFractionalUom = () => {
  const rendered = renderWithProviders(
    <PopIdentityProvider
      value={{ terminalId: TERMINAL_ID, processId: PROCESS_ID, workerNo: '100027' }}
    >
      <ReworkResultRegisterScreen />
    </PopIdentityProvider>,
    {
      fetch: async (request) => {
        const url = new URL(request.url);

        if (url.pathname === '/production/work-orders') {
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
   * ⛔ **네 구획이 남는 높이를 나눠 가지면 안 된다.** POP 규격의 기본이 그렇게 배분하는데,
   *    본문이 구획 넷인 이 화면에서는 각자 1/4 을 받아 **한 구획이 90px 로 눌리고 그 안에서
   *    또 잘린다**(실측 — 대상 카드가 두 줄, 실적 입력이 라벨 줄만 남았다).
   *
   *    네 구획을 **한 겹**으로 묶어 그 겹만 스크롤한다. 머리줄과 액션바는 제자리에 선다.
   *    겹에 붙인 `pop-fixed` 는 「내용만큼만」이 아니라 «규격의 높이 배분에서 뺀다»는 뜻이다 —
   *    그 규칙이 걸리면 `overflow: hidden` 이 스크롤을 죽인다.
   */
  it('네 구획이 한 겹에 묶여 그 겹만 스크롤한다', async () => {
    const { container, user } = renderScreen();
    await pickWorkOrder(user);

    await screen.findByRole('heading', { name: t.quantities.title });

    const body = container.querySelector('.rework-result-body');

    expect(body).toHaveClass('pop-fixed');
    expect(body?.parentElement).toBe(container.querySelector('.pop-ui'));
    /* 네 구획이 전부 그 겹 «안»에 있다 — 하나라도 밖에 나가면 규격이 그것만 늘린다. */
    for (const selector of [
      '.rework-target-card',
      '.rework-result-input',
      '.rework-result-lot',
      '.rework-result-summary',
    ]) {
      expect(body?.querySelector(selector)).not.toBeNull();
    }
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
   * ⛔ **칸이 비면 [ C ]·[ ⌫ ] 는 잠긴다**(사용자 지적). 지울 것이 없는데 열려 있으면 눌러도
   *    아무 일이 없어 「눌리는데 안 되는 키」가 된다. DS `NumberPad` 는 «전체 잠금»만 있어
   *    키마다 조건을 걸 수 없다 — POP 이 공유하는 키패드로 바꿔야 풀린다.
   */
  it('칸이 비면 지움 키 둘이 잠기고 값이 들어오면 열린다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    const clearKey = () => screen.getByRole('button', { name: t.quantities.clearGlyph });
    const backspaceKey = () => screen.getByRole('button', { name: t.quantities.backspace });

    await waitFor(() => {
      expect(clearKey()).toBeDisabled();
    });
    expect(backspaceKey()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '7' }));

    await waitFor(() => {
      expect(clearKey()).toBeEnabled();
    });
    expect(backspaceKey()).toBeEnabled();
  });

  /*
   * ⭐ **수량 칸에 단위를 붙인다**(사용자 결정) — 네 칸이 모두 수량이라 단위 없이 숫자만
   *    서면 무엇의 몫인지가 칸 이름에만 걸린다. 전례는 `P-02-04` 의 「양품수량 [ 120 ] EA」.
   *
   * ⚠ **[ 변경 ] 은 ① 구획의 오른쪽 «아래»다**(사용자 결정). 스펙에는 없는 조작이라 자리를
   *    우리가 정한다 — 오른쪽 위는 120px 짜리 구획에서 세 줄을 왼쪽으로 몰아붙인다.
   */
  it('수량 칸에 단위가 붙고 「변경」이 대상 구획의 발치에 선다', async () => {
    const { container, user } = renderScreen();
    await pickWorkOrder(user);

    await screen.findByRole('heading', { name: t.quantities.title });

    expect(await screen.findAllByText('EA')).toHaveLength(4);

    const change = screen.getByRole('button', { name: t.changeWorkOrder });

    expect(change.closest('.rework-target-foot')).not.toBeNull();
    expect(change.closest('.rework-target-card')).toBe(
      container.querySelector('.rework-target-card'),
    );

    /*
     * ⛔ DS `Card` 는 여백을 «본문 상자»에만 주고 그 위쪽이 0 이라, 카드에 직접 놓인 제목이
     *    모서리에 붙는다. POP 규격의 `pop-section` 이 그 자리를 고친다 — 빠지면 제목이 다시
     *    붙는다(사용자 지적).
     */
    expect(container.querySelector('.rework-target-card')).toHaveClass('pop-section');
  });

  /*
   * ⭐ **네 구획이 모두 상자다** — 스펙 §3 이 ①②③④를 전부 `┌ … ┐` 로 그렸다. §7 이 `Card` 를
   *    ① 에만 적은 것은 «어떤 DS 부품을 쓰는가»의 표이기 때문이고, 구획 상자는 화면 골격이라
   *    그 표에 나오지 않는다 — 자매 화면(`P-02-01`)도 같은 도면을 실제 테두리로 구현했다.
   *
   * ⭐ 합계는 §7 이 지정한 `Chip` 이다(「합계 표시 | Chip + AlertBanner」).
   */
  it('네 구획이 모두 상자로 서고 합계가 칩으로 든다', async () => {
    const { container, user } = renderScreen();
    await pickWorkOrder(user);

    await screen.findByRole('heading', { name: t.quantities.title });

    for (const selector of [
      '.rework-target-card',
      '.rework-input-card',
      '.rework-lot-card',
      '.rework-progress-card',
    ]) {
      expect(container.querySelector(selector)).toHaveClass('pop-section');
    }

    const total = container.querySelector('.rework-qty-total');

    expect(total?.firstElementChild).not.toBeNull();
    expect(total).toHaveTextContent(`${t.total} 0 / 160`);
  });

  /*
   * ⛔ **소수점 키는 «단위»가 정한다.** 수량 컬럼이 `numeric(20,6)` 이라 소수를 담을 수는
   *    있지만, 담을 수 있다는 것과 그 단위에 소수가 뜻이 있다는 것은 다르다 — `EA`(개)는
   *    `decimalScale` 이 0 이라 1.5개가 없다(사용자 지적). 계약이 단위마다 그 값을 갖는다.
   */
  it('개 단위에는 소수점 키를 세우지 않는다', async () => {
    const { user } = renderScreen();
    await pickWorkOrder(user);

    await screen.findByRole('heading', { name: t.quantities.title });

    expect(screen.queryByRole('button', { name: t.quantities.decimalKey })).not.toBeInTheDocument();
  });

  it('소수를 받는 단위에는 소수점 키가 선다', async () => {
    const { user } = renderWithFractionalUom();
    await pickWorkOrder(user);

    await screen.findByRole('heading', { name: t.quantities.title });

    expect(
      await screen.findByRole('button', { name: t.quantities.decimalKey }),
    ).toBeInTheDocument();
  });

  /*
   * ⛔ **네 제목이 같은 자리에서 시작해야 한다** — 카드 본문 바로 아래다. ②의 제목만 «입력 칸
   *    묶음 안»에 있으면 좌우 2단(칸 · 키패드)의 왼쪽 칸 폭에 갇혀 혼자 안쪽으로 들어간다
   *    (사용자 지적).
   */
  it('네 구획의 제목이 모두 카드 본문 바로 아래에 선다', async () => {
    const { container, user } = renderScreen();
    await pickWorkOrder(user);

    await screen.findByRole('heading', { name: t.quantities.title });

    for (const [selector, title] of [
      ['.rework-target-card', t.target],
      ['.rework-input-card', t.quantities.title],
      ['.rework-lot-card', t.resultLot.title],
      ['.rework-progress-card', t.progress.title],
    ] as const) {
      const card = container.querySelector(selector) as HTMLElement;
      const heading = within(card).getByRole('heading', { name: title });

      /*
       * ⛔ 좌우 2단(칸 · 키패드) «안»에 들어가면 왼쪽 칸 폭에 갇혀 혼자 안쪽에서 시작한다 —
       *    ②가 그랬다. 구획을 나누는 `section` 은 여백이 없어 자리를 밀지 않는다.
       */
      expect(heading.closest('.rework-result-input')).toBeNull();
      expect(heading.closest('.rework-result-fields')).toBeNull();
      /* 카드 본문에서 «맨 처음» 나온다 — 앞에 무엇이 오면 제목이 그만큼 밀린다. */
      expect(card.querySelector('.pane-title')).toBe(heading);
    }
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
