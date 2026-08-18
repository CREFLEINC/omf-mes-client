import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TAB,
  STOCK_ADJUST_TABS,
  TAB_KEY,
  readTab,
  tabLabel,
  toTabParam,
  type StockAdjustTab,
} from './tabs';

const t = messages.stockAdjust;

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('STOCK_ADJUST_TABS — 탭 둘', () => {
  it('탭이 둘이고 차례가 업무 차례다 — 세우고, 나중에 되찾는다', () => {
    expect([...STOCK_ADJUST_TABS]).toEqual(['register', 'history']);
  });

  /**
   * ⛔ 조심 ① · D-3의 자리. **셋째 탭이 생길 자리를 만들지 않는다** — 승인·반려는 결재함이
   * 소유한다. 목록 길이만 재면 이름을 갈아 끼운 셋째 탭이 통과하므로 **값까지 함께** 잰다.
   */
  it('승인 대기 탭이 없다 — 목록에도 문구에도 그 자리가 없다', () => {
    expect(STOCK_ADJUST_TABS).toHaveLength(2);
    expect(Object.keys(t.tabs)).toEqual(['label', 'register', 'history']);
  });

  it('두 탭의 이름이 서로 다르다 — 같으면 사용자가 어느 자리인지 가리지 못한다', () => {
    expect(tabLabel('register')).toBe(t.tabs.register);
    expect(tabLabel('history')).toBe(t.tabs.history);
    expect(tabLabel('register')).not.toBe(tabLabel('history'));
  });

  it('첫 탭이 조정 등록이다 — 이 화면에 들어오는 이유가 조정을 세우는 것이다', () => {
    expect(DEFAULT_TAB).toBe('register');
  });
});

describe('readTab — 주소가 가리키는 탭', () => {
  it('우리가 정한 값만 그대로 읽는다', () => {
    expect(readTab(params(`?${TAB_KEY}=history`))).toBe('history');
    expect(readTab(params(`?${TAB_KEY}=register`))).toBe('register');
  });

  it('키가 없으면 기본 탭이다', () => {
    expect(readTab(params(''))).toBe(DEFAULT_TAB);
  });

  /** 주소는 손으로 고쳐지는 자리다 — 오타 하나에 아무 탭도 서지 않으면 고장으로 읽힌다. */
  it.each(['approval', 'HISTORY', '', 'pending'])('모르는 값 %o은 기본 탭으로 본다', (raw) => {
    expect(readTab(params(`?${TAB_KEY}=${raw}`))).toBe(DEFAULT_TAB);
  });

  /**
   * ⛔ **없는 탭 이름이 주소로 들어와도 그 값이 살아남지 않는다.** 살아남으면 「승인 대기」를
   * 주소로 켜는 길이 생기고, 그 값이 조회 조건으로 새는 경로의 첫 칸이 된다.
   */
  it('모르는 값을 주소로 되돌리면 기본 탭의 표기가 된다', () => {
    const tab: StockAdjustTab = readTab(params(`?${TAB_KEY}=approval`));

    expect(toTabParam(tab)).toBeNull();
  });
});

describe('toTabParam — 주소에 적을 값', () => {
  it('기본 탭이면 적지 않는다 — 같은 화면의 주소가 두 가지가 되지 않게', () => {
    expect(toTabParam('register')).toBeNull();
  });

  it('기본이 아닌 탭만 주소에 실린다', () => {
    expect(toTabParam('history')).toBe('history');
  });

  it('읽기와 쓰기가 서로를 되돌린다 — 주소를 공유해도 같은 탭이 선다', () => {
    for (const tab of STOCK_ADJUST_TABS) {
      const written = toTabParam(tab);
      const search = written === null ? '' : `?${TAB_KEY}=${written}`;

      expect(readTab(params(search))).toBe(tab);
    }
  });
});
