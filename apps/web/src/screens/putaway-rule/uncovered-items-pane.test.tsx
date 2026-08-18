import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { uncoveredItemFixtures } from './fixtures';
import {
  UncoveredItemsPane,
  formatDateTime,
  type UncoveredItemsPaneProps,
} from './uncovered-items-pane';

const t = messages.putawayRule;

const baseProps = (overrides: Partial<UncoveredItemsPaneProps> = {}): UncoveredItemsPaneProps => ({
  items: uncoveredItemFixtures,
  total: uncoveredItemFixtures.length,
  isLoading: false,
  loadError: null,
  ...overrides,
});

const renderPane = (overrides: Partial<UncoveredItemsPaneProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<UncoveredItemsPane {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const expandToggle = (): HTMLElement =>
  screen.getByRole('button', { name: t.actions.expandUncovered });

/**
 * `formatDateTime`이 존재하는 이유는 **두 조항**이다. 렌더 감지기는 정상 형식 한 갈래만
 * 지나므로 두 조항 어느 쪽도 재지 못한다 — 함수를 직접 부르는 단위 감지기를 따로 둔다
 * (전례 6화면이 예외 없이 갖는 형태).
 */
describe('formatDateTime — 조항 ⓐ 실행 환경 시간대로 옮기지 않는다', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * **고정 시각만으로는 잴 수 없다.** 기계 시간대가 `Asia/Seoul`이면 픽스처의 `+09:00`과
   * 변환 결과가 같아 원리상 구분되지 않는다 — 시간대 자체를 갈아 끼워 **세 시간대에서
   * 결과가 흔들리지 않음**을 잰다.
   */
  it.each([
    ['UTC+09:00 (동쪽)', -540],
    ['UTC-05:00 (서쪽)', 300],
    ['UTC±00:00 (본초)', 0],
  ])('%s 에서도 실려 온 시각을 그대로 낸다', (_label, offsetMinutes) => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(offsetMinutes);

    expect(formatDateTime('2026-08-06T09:14:00+09:00')).toBe('2026-08-06 09:14');
  });

  /**
   * **`+00:00` 경계** — 벽시계 숫자가 같고 offset만 다른 두 값은 서로 다른 순간이지만,
   * 서버가 적어 보낸 벽시계 표기는 같다. 옮기는 구현은 여기서 두 값을 갈라 놓는다.
   */
  it('벽시계가 같고 offset만 다르면 표기도 같다', () => {
    const seoul = formatDateTime('2026-08-06T09:14:00+09:00');
    const utc = formatDateTime('2026-08-06T09:14:00+00:00');

    expect(seoul).toBe('2026-08-06 09:14');
    expect(utc).toBe('2026-08-06 09:14');
    expect(seoul).toBe(utc);
  });

  it('벽시계 숫자가 다르면 표기도 다르다', () => {
    expect(formatDateTime('2026-08-06T18:14:00+00:00')).toBe('2026-08-06 18:14');
  });
});

describe('formatDateTime — 조항 ⓑ 형식이 아니면 원문을 그대로 낸다', () => {
  /**
   * 「—」로 바꾸면 **값이 없는 것과 못 알아본 것이 구분되지 않는다.** 서버가 보낸 값을 화면이
   * 삼키지 않는다 — 없는 값은 호출부가 `t.values.neverReceived`로 따로 말한다.
   */
  it.each(['2026-08-06', '알 수 없는 값', '', '2026/08/06 09:14'])(
    '형식이 아닌 값(%s)은 원문 그대로 낸다',
    (raw) => {
      expect(formatDateTime(raw)).toBe(raw);
    },
  );

  it('원문을 대시로 바꾸지 않는다', () => {
    expect(formatDateTime('2026-08-06')).not.toBe('—');
    expect(formatDateTime('')).not.toBe('—');
  });
});

describe('UncoveredItemsPane — 건수', () => {
  /**
   * ⭐ 등록된 것만 보이면 「비어 있다」는 사실이 화면 어디에도 드러나지 않는다(공유계약 G-12).
   * 건수는 **펼치기 전에** 보여야 한다.
   */
  it('펼치기 전에도 건수가 보인다', () => {
    renderPane();

    expect(screen.getByText(t.uncovered.countTitle(2))).toBeInTheDocument();
    expect(screen.getByText(t.uncovered.countDescription)).toBeInTheDocument();
  });

  /**
   * **0건은 좋은 상태다.** 경고 톤을 쓰면 사용자가 조치할 것이 있다고 읽는다 —
   * 라이브 강도가 assertive인 `alert`가 아니라 `status`로 서야 한다.
   */
  it('0건은 경고 톤을 쓰지 않는다', () => {
    renderPane({ items: [], total: 0 });

    expect(screen.getByText(t.uncovered.noneTitle)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  /** 0건이면 펼칠 것이 없다 — 눌러도 아무 일이 없는 손잡이를 두지 않는다. */
  it('0건에서는 펼침 손잡이를 두지 않는다', () => {
    renderPane({ items: [], total: 0 });

    expect(
      screen.queryByRole('button', { name: t.actions.expandUncovered }),
    ).not.toBeInTheDocument();
  });

  /** 건수가 있으면 경고다 — 그 품목들이 현장에서 위치 검증 없이 통과한다. */
  it('건수가 있으면 경고로 선다', () => {
    renderPane();

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('UncoveredItemsPane — 펼침', () => {
  it('처음에는 접혀 있다', () => {
    renderPane();

    expect(expandToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('펼치면 품목 목록이 보인다', async () => {
    const { user } = renderPane();

    await user.click(expandToggle());

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('SYN-ITEM-03')).toBeInTheDocument();
    expect(screen.getByText('합성품목 다')).toBeInTheDocument();
  });

  it('펼친 뒤에는 접는 손잡이가 된다', async () => {
    const { user } = renderPane();

    await user.click(expandToggle());

    const toggle = screen.getByRole('button', { name: t.actions.collapseUncovered });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /**
   * **접혀 있는 동안에는 가리키지 않는다.** 본문이 조건부 렌더라 접히면 그 id를 가진 요소가
   * DOM에 없는데, `aria-controls`는 존재하는 요소를 가리켜야 한다.
   */
  it('접혀 있는 동안 없는 요소를 가리키지 않는다', async () => {
    const { user } = renderPane();

    expect(expandToggle()).not.toHaveAttribute('aria-controls');

    await user.click(expandToggle());

    const controls = screen
      .getByRole('button', { name: t.actions.collapseUncovered })
      .getAttribute('aria-controls');

    expect(controls).not.toBeNull();
    expect(document.getElementById(controls ?? '')).not.toBeNull();
  });

  /** 입고 시각이 없는 것과 못 알아본 것은 다르다 — 없는 것은 그 사실을 적는다. */
  it('입고 이력이 없는 품목은 그 사실을 적는다', async () => {
    const { user } = renderPane();

    await user.click(expandToggle());

    expect(await screen.findByText(t.values.neverReceived)).toBeInTheDocument();
  });

  it('입고 시각을 연·월·일 시·분으로 낸다', async () => {
    const { user } = renderPane();

    await user.click(expandToggle());

    expect(await screen.findByText('2026-08-06 09:14')).toBeInTheDocument();
  });

  /** 잘림을 감추면 사용자가 앞쪽 일부를 전부로 읽는다. */
  it('건수보다 적게 왔으면 잘림을 밝힌다', async () => {
    const { user } = renderPane({ total: 12 });

    await user.click(expandToggle());

    expect(await screen.findByText(t.uncovered.truncated)).toBeInTheDocument();
  });

  it('전부 왔으면 잘림을 말하지 않는다', async () => {
    const { user } = renderPane();

    await user.click(expandToggle());

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByText(t.uncovered.truncated)).not.toBeInTheDocument();
  });

  /** 건수와 목록이 어긋난 상태를 감추지 않는다. */
  it('건수는 있는데 목록이 비면 그 사실을 말한다', async () => {
    const { user } = renderPane({ items: [], total: 3 });

    await user.click(expandToggle());

    expect(await screen.findByText(t.uncovered.emptyListTitle)).toBeInTheDocument();
  });
});

describe('UncoveredItemsPane — 로딩과 실패', () => {
  /**
   * **실패를 로딩보다 앞에서 판정한다**(사본 대조 추가 ①). 먼저 로딩을 보면 실패한 조회가
   * 영원히 「불러오는 중」으로 보인다.
   */
  it('실패는 로딩보다 앞에서 판정한다', () => {
    renderPane({ isLoading: true, loadError: <p>조회 실패</p> });

    expect(screen.getByText('조회 실패')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.loading.uncovered })).not.toBeInTheDocument();
  });

  /**
   * **실패했으면 건수를 내지 않는다.** 0을 내면 「규칙 없는 품목이 없다」는 좋은 소식으로
   * 읽히는데, 실제로는 그것을 확인하지 못한 것이다.
   */
  it('실패했으면 건수를 내지 않는다', () => {
    renderPane({ items: [], total: 0, loadError: <p>조회 실패</p> });

    expect(screen.getByText('조회 실패')).toBeInTheDocument();
    expect(screen.queryByText(t.uncovered.noneTitle)).not.toBeInTheDocument();
  });

  it('불러오는 중임을 이름으로 밝힌다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.uncovered })).toBeInTheDocument();
  });

  it('불러오는 중에는 건수를 내지 않는다', () => {
    renderPane({ items: [], total: 0, isLoading: true });

    expect(screen.queryByText(t.uncovered.noneTitle)).not.toBeInTheDocument();
  });
});
