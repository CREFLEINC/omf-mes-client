import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ResultPane, stockAdjustEntryPath } from './result-pane';
import type { ResultView } from './types';

const t = messages.stocktaking;

const OPENED: ResultView = { kind: 'opened', countNo: 'IC-2026-900014' };

const SAVED: ResultView = {
  kind: 'saved',
  locationLabel: 'SAMPLE-LOC-01 · 합성 위치 가',
  replacedLineCount: 3,
};

/**
 * 마감 결과. **상태 코드는 서버가 준 값 그대로**이고, 픽스처가 실제로 쓰는 합성 값이다 —
 * 화면이 이 값으로 분기하면 그 자리에서 걸린다(감지기 M59).
 *
 * **차이 0이 기본이다** — 이 화면의 마감 게이트가 차이 0을 요구하므로(`close-guard.ts`)
 * 그것이 보통의 마감 결과다. 차이가 남은 갈래는 **서버가 마감 응답에 그렇게 담아 준 경우**이고
 * (요약도 상태 코드도 응답이 준 값 그대로다), 아래에서 그 갈래를 따로 세운다.
 */
const CLOSED: ResultView = {
  kind: 'closed',
  inventoryCountId: 9001,
  countNo: 'IC-2026-900011',
  statusCode: 'SAMPLE_COUNT_STATUS_A',
  summary: { plannedCount: 40, countedCount: 40, uncountedCount: 0, varianceCount: 0 },
};

/** 차이가 남은 채로 마감된 갈래 — **조정 등록 링크가 서는 유일한 갈래**다(D-18). */
const CLOSED_WITH_VARIANCE: ResultView = {
  ...CLOSED,
  summary: { plannedCount: 40, countedCount: 40, uncountedCount: 0, varianceCount: 3 },
};

/** 링크가 생겨 라우터가 필요하다 — 앱과 같은 라우터 문맥 없이는 `Link`가 서지 못한다. */
const renderPane = (result: ResultView = OPENED) =>
  render(
    <MemoryRouter>
      <ResultPane result={result} />
    </MemoryRouter>,
  );

const resultRegion = (): HTMLElement => screen.getByRole('status', { name: t.result.label });

const savedRegion = (): HTMLElement => screen.getByRole('status', { name: t.result.savedLabel });

const closedRegion = (): HTMLElement => screen.getByRole('status', { name: t.result.closedLabel });

describe('ResultPane — 개시 갈래', () => {
  /* **C29** — 만들어진 실사의 **업무 번호**를 낸다. 그것이 사용자가 나중에 찾을 때 쓰는 값이다. */
  it('만들어진 실사번호를 낸다', () => {
    renderPane();

    expect(within(resultRegion()).getByText(t.result.openedNo)).toBeInTheDocument();
    expect(within(resultRegion()).getByText('IC-2026-900014')).toBeInTheDocument();
  });

  /*
   * **#44** — 결과 구획 어디에도 내부 번호가 없다. 받는 타입에 자리 자체가 없어 낼 값이 없다 —
   * `inventoryCountNo`는 사용자 대면 업무 번호라 내는 것이 맞고, 그 구분을 여기서 고정한다.
   */
  it('내부 번호를 내지 않는다', () => {
    const { container } = renderPane();

    /* 짝 방향 — 업무 번호는 실제로 보인다(아무것도 안 그려서 통과하는 것이 아니다). */
    expect(within(resultRegion()).getByText('IC-2026-900014')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('9001');
    expect(container.textContent ?? '').not.toContain('9101');
  });

  /*
   * **사용자가 부르지 않은 시점에 나타나는 내용**이라 살아 있는 영역으로 알린다.
   * 알리지 않으면 화면을 보지 않는 사용자에게는 아무 일도 일어나지 않은 것이 된다.
   */
  it('살아 있는 영역으로 알린다', () => {
    renderPane();

    expect(resultRegion()).toBeInTheDocument();
  });

  /*
   * **성공을 단정하는 말을 쓰지 않는다.** 화면이 증거를 갖는 것은 응답이 준 실사번호뿐이고,
   * 진행 요약은 아래 구획이 상세 조회로 따로 받는다 — 그 사실을 안내가 밝힌다.
   */
  it('진행 요약을 어디서 보는지 밝힌다', () => {
    renderPane();

    expect(within(resultRegion()).getByText(t.result.openedNote)).toBeInTheDocument();
  });

  /*
   * **어디로도 이동하지 않는다.** 만들어진 실사는 같은 화면의 아래 구획에서 이어 다루므로
   * 갈 곳이 없다 — 링크나 버튼을 두면 없는 화면으로 가는 경로가 생긴다. PR ④의 「조정 등록」이
   * 같은 규칙을 더 센 형태로 받으므로(이슈 §5 ⚠) 그 잣대를 여기서 미리 세워 둔다.
   */
  it('결과 구획에 이동 수단을 두지 않는다', () => {
    renderPane();

    /* 짝 방향 — 구획은 실제로 그려졌다. */
    expect(within(resultRegion()).getByText('IC-2026-900014')).toBeInTheDocument();
    expect(within(resultRegion()).queryAllByRole('link')).toHaveLength(0);
    expect(within(resultRegion()).queryAllByRole('button')).toHaveLength(0);
  });
});

describe('ResultPane — 저장 갈래', () => {
  /*
   * **계획 결정 14** — 한 자리에 갈래 하나만 보인다. 구획을 갈래마다 두면 「방금 개시했다」와
   * 「방금 저장했다」가 나란히 서서 사용자가 무엇이 지금 일어난 일인지 가릴 수 없다.
   * 라벨까지 갈리는 것이 그 규칙의 실물이다.
   */
  it('저장 갈래에는 개시 갈래가 보이지 않는다', () => {
    renderPane(SAVED);

    expect(savedRegion()).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    expect(screen.queryByText(t.result.openedNote)).not.toBeInTheDocument();
  });

  /** 무엇을 어디에 저장했는지 — **위치는 이름으로 온다**(#44). */
  it('치환한 위치를 이름으로 낸다', () => {
    renderPane(SAVED);

    expect(within(savedRegion()).getByText(t.result.savedLocation)).toBeInTheDocument();
    expect(within(savedRegion()).getByText('SAMPLE-LOC-01 · 합성 위치 가')).toBeInTheDocument();
  });

  /*
   * **서버가 되돌려 준 줄 수를 낸다** — 화면이 센 숫자가 아니다. 둘이 갈리면 그 자리가
   * 「보낸 것과 저장된 것이 다르다」는 사실을 드러낸다.
   */
  it('치환한 줄 수를 낸다', () => {
    renderPane(SAVED);

    expect(within(savedRegion()).getByText(t.result.savedLineCount)).toBeInTheDocument();
    expect(within(savedRegion()).getByText(t.result.savedCount(3))).toBeInTheDocument();
  });

  it('요약이 어디서 갱신됐는지 밝힌다', () => {
    renderPane(SAVED);

    expect(within(savedRegion()).getByText(t.result.savedNote)).toBeInTheDocument();
  });

  /** 저장 갈래에도 내부 번호가 없다 — 위치 번호(9701)가 이름으로 풀려 들어온다. */
  it('내부 번호를 내지 않는다', () => {
    const { container } = renderPane(SAVED);

    expect(within(savedRegion()).getByText('SAMPLE-LOC-01 · 합성 위치 가')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('9701');
    expect(container.textContent ?? '').not.toContain('9401');
  });

  it('결과 구획에 이동 수단을 두지 않는다', () => {
    renderPane(SAVED);

    expect(within(savedRegion()).queryAllByRole('link')).toHaveLength(0);
    expect(within(savedRegion()).queryAllByRole('button')).toHaveLength(0);
  });
});

describe('ResultPane — 마감 갈래', () => {
  /*
   * **계획 결정 14** — 갈래가 셋이 됐어도 **한 자리에 하나만** 보인다. 라벨까지 갈리는 것이
   * 그 규칙의 실물이라, 마감 결과가 섰을 때 앞 두 갈래의 라벨·안내가 함께 서 있으면 안 된다.
   */
  it('마감 갈래에는 앞 두 갈래가 보이지 않는다', () => {
    renderPane(CLOSED);

    expect(closedRegion()).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.result.savedLabel })).not.toBeInTheDocument();
    expect(screen.queryByText(t.result.openedNote)).not.toBeInTheDocument();
    expect(screen.queryByText(t.result.savedNote)).not.toBeInTheDocument();
  });

  /** 무엇을 마감했는지 — **업무 번호**로 낸다. 사용자가 나중에 이 실사를 찾을 때 쓰는 값이다. */
  it('마감한 실사번호를 낸다', () => {
    renderPane(CLOSED);

    expect(within(closedRegion()).getByText(t.result.closedNo)).toBeInTheDocument();
    expect(within(closedRegion()).getByText('IC-2026-900011')).toBeInTheDocument();
  });

  /*
   * **완료 조건 C57 · 감지기 M59** — 상태 코드를 **그대로** 낸다.
   *
   * 실측 근거가 있다: 목 서버의 `:close` 200 응답이 `IN_PROGRESS`를 되돌려 준다. 값으로
   * 「마감됨」을 판정했다면 그 자리에서 거짓말을 한다 — 값 집합이 확정되지도 않았다
   * (`omf-mes#64` · 공유계약 G-2).
   *
   * **픽스처가 실제로 쓰는 값 둘로 센다.** 코드가 달라져도 라벨·안내가 그대로여야 한다 —
   * 한 값만 재면 그 값에만 붙는 분기를 넣어도 통과한다.
   */
  it.each(['SAMPLE_COUNT_STATUS_A', 'SAMPLE_COUNT_STATUS_C'])(
    '상태 코드 %s를 해석하지 않고 그대로 낸다',
    (statusCode) => {
      renderPane({ ...CLOSED, statusCode });

      expect(within(closedRegion()).getByText(t.result.closedStatus)).toBeInTheDocument();
      expect(within(closedRegion()).getByText(statusCode)).toBeInTheDocument();
      /* 안내가 코드에 따라 갈리지 않는다 — 갈리면 화면이 값을 해석한 것이다. */
      expect(within(closedRegion()).getByText(t.result.closedNote)).toBeInTheDocument();
    },
  );

  /*
   * **마감 시점의 요약이 결과에 박혀 있다.** 그 뒤 다른 실사를 골라 위 구획의 요약이 바뀌어도
   * 「무엇을 마감했는가」가 흔들리지 않는다 — 위 구획을 다시 읽으라고만 하면 그 순간의 사실이
   * 어디에도 남지 않는다.
   */
  it('마감 시점의 요약 4칸을 그대로 낸다', () => {
    renderPane({
      ...CLOSED,
      summary: { plannedCount: 40, countedCount: 38, uncountedCount: 0, varianceCount: 0 },
    });

    for (const label of [
      t.detail.planned,
      t.detail.counted,
      t.detail.uncounted,
      t.detail.variance,
    ]) {
      expect(within(closedRegion()).getByText(label)).toBeInTheDocument();
    }

    expect(within(closedRegion()).getByText(t.detail.countValue(40))).toBeInTheDocument();
    expect(within(closedRegion()).getByText(t.detail.countValue(38))).toBeInTheDocument();
  });

  /*
   * **감지기 M58 갱신 — 「자리만 둔다」에서 「차이가 있을 때만 이어진다」로**(D-18 · C47).
   *
   * 앞 회차의 판정 문장은 「조정 등록이 **비활성**이고 사유가 이어져 있다」였다. 그 사실의
   * 근거(W-01-12가 아직 없다)가 사라졌으므로 **판정 강도를 유지한 채 사실을 갈아 끼운다** —
   * 잠겼는지 대신 **어디로 가는지**를 잰다. 무력화가 아닌 근거: 아래 짝(차이 0 갈래)이
   * 「0건」을 그대로 세고, 주소의 질의 열쇠까지 값으로 대조한다.
   */
  it('차이가 남은 마감에는 조정 등록 링크가 서고 그 실사를 가리킨다', () => {
    renderPane(CLOSED_WITH_VARIANCE);

    const action = within(closedRegion()).getByRole('link', { name: t.actions.adjustment });

    expect(action).toHaveAttribute('href', '/logistics/stock-adjust?count=9001');
    /* 왜 이 마감에만 링크가 있는지 — 서버가 준 건수를 그대로 인용한다. */
    expect(within(closedRegion()).getByText(t.result.adjustmentNote(3))).toBeInTheDocument();
  });

  /**
   * **주소를 손으로 적지 않는다** — 링크가 만드는 값과 라우트 표를 잇는 시험
   * (`routes/index.test.tsx`)이 같은 함수를 태워야 한쪽만 고쳤을 때 죽은 링크가 드러난다.
   */
  it('링크 주소를 만드는 함수가 화면이 쓰는 값과 같다', () => {
    renderPane(CLOSED_WITH_VARIANCE);

    expect(
      within(closedRegion()).getByRole('link', { name: t.actions.adjustment }),
    ).toHaveAttribute('href', stockAdjustEntryPath(9001));
  });

  /*
   * **링크는 이름-값 목록 밖에 선다**(부품 주석이 길게 논증한 배치 — 그 판단에 붙이는 잣대).
   *
   * `<dl>` 안으로 옮기면 보조기술이 링크를 **「차이」의 값**으로 읽거나 이름 없는 조각으로
   * 목록에 섞어 읽는다. 건수·`href`·접근 이름은 셋 다 **위치와 무관**해서, 이 단언이 없으면
   * 다음 사람이 간격·줄바꿈을 이유로 링크를 목록 안으로 옮겨도 아무도 울지 않는다.
   * 이 부품에서는 특히 자연스러운 이동이다 — 링크를 감싼 `.field-cell`이 `<dl>` 안 칸과
   * **같은 클래스 이름**이라 옮겨도 겉모습이 달라지지 않는다.
   *
   * 전례가 같은 자리에 같은 잣대를 세웠다(`over-receipt-split/created-receipts-pane.test.tsx`).
   * 이번 회차가 그 주석 문면을 사본하면서 이 감지기를 빠뜨렸던 자리다(리뷰 R-1).
   */
  it('링크가 이름-값 목록 안에 있지 않다', () => {
    renderPane(CLOSED_WITH_VARIANCE);

    const region = closedRegion();
    const definitionList = region.querySelector('dl');

    /* 짝 양성 — 목록도 링크도 실제로 있다. 둘 다 없으면 아래 0건은 뜻이 없다. */
    expect(definitionList).not.toBeNull();
    expect(within(region).getAllByRole('link')).toHaveLength(1);
    expect(definitionList?.querySelectorAll('a').length).toBe(0);
  });

  /*
   * **완료 조건 C48 · 갱신된 감지기의 짝** — 차이가 0인 마감에는 **링크도 버튼도 없다**.
   * 조정할 것이 없는 자리에 길을 두면 사용자는 무엇을 조정하러 가는지 모른 채 화면을 연다.
   *
   * **개수까지 센다** — 「링크가 없다」만 재면 옆에 비활성 버튼을 다시 붙여도 통과한다
   * (자리표시 시절의 모습이 되살아나는 경로가 바로 그것이다).
   */
  it('차이가 0인 마감에는 링크도 버튼도 없다', () => {
    renderPane(CLOSED);

    /* 짝 양성 — 마감 결과 자체는 실제로 그려졌다. */
    expect(within(closedRegion()).getByText('IC-2026-900011')).toBeInTheDocument();
    expect(within(closedRegion()).queryAllByRole('link')).toHaveLength(0);
    expect(within(closedRegion()).queryAllByRole('button')).toHaveLength(0);
    expect(within(closedRegion()).queryByText(t.result.adjustmentNote(0))).not.toBeInTheDocument();
  });

  /*
   * **차이 갈래에도 버튼은 없다** — 이동은 링크 하나로만 한다(주소를 갖는 이동이라야 새 탭·
   * 주소 복사가 되고 히스토리가 한 칸만 는다). 링크 개수도 함께 세어 두 번째 길이 생기는 것을 막는다.
   */
  it('차이 갈래의 이동 수단은 링크 하나뿐이다', () => {
    renderPane(CLOSED_WITH_VARIANCE);

    expect(within(closedRegion()).queryAllByRole('link')).toHaveLength(1);
    expect(within(closedRegion()).queryAllByRole('button')).toHaveLength(0);
  });

  /*
   * **#44 · 감지기 M57 갱신 — 「타입에 자리가 없다」에서 「받지만 주소로만 쓴다」로**(D-18).
   *
   * 앞 회차의 근거는 「받는 타입에 자리 자체가 없어 낼 값이 없다」였다. 주소를 만들려면 번호가
   * 필요해 자리가 생겼으므로, **같은 잣대를 더 센 형태로** 다시 세운다 — 번호가 실제로 들어와
   * 링크 주소에 실리는데도 **보이는 글자에는 0건**이다. 값이 없어서 통과하는 것이 아님을
   * `href` 대조가 증명한다.
   */
  it('내부 번호를 주소에만 싣고 글자로는 내지 않는다', () => {
    const { container } = renderPane(CLOSED_WITH_VARIANCE);

    /* 짝 방향 — 업무 번호는 실제로 보이고, 내부 번호는 주소에 실제로 실렸다. */
    expect(within(closedRegion()).getByText('IC-2026-900011')).toBeInTheDocument();
    expect(
      within(closedRegion()).getByRole('link', { name: t.actions.adjustment }).getAttribute('href'),
    ).toContain('9001');

    for (const internalId of ['9001', '9101', '9701']) {
      expect(container.textContent ?? '').not.toContain(internalId);
    }
  });

  /** 차이 0 갈래에도 같은 잣대가 선다 — 그 갈래에는 주소조차 없어 새어 나갈 자리가 더 없다. */
  it('차이 0 갈래의 글자에도 내부 번호가 없다', () => {
    const { container } = renderPane(CLOSED);

    expect(within(closedRegion()).getByText('IC-2026-900011')).toBeInTheDocument();

    for (const internalId of ['9001', '9101', '9701']) {
      expect(container.textContent ?? '').not.toContain(internalId);
    }
  });
});
