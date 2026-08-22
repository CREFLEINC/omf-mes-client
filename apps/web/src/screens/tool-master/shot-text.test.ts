import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { countText, figureText, ratioText } from './shot-text';

const t = messages.toolMaster.shots;

describe('countText', () => {
  /** 자릿수가 커서 무리 짓지 않으면 50 만과 5 만이 눈으로 갈리지 않는다. */
  it('세 자리마다 끊는다', () => {
    expect(countText(500_000)).toBe('500,000');
    expect(countText(0)).toBe('0');
  });

  it('음수도 그대로 보인다', () => {
    expect(countText(-2_500)).toBe('-2,500');
  });
});

describe('ratioText', () => {
  it('소수 한 자리까지 보인다', () => {
    expect(ratioText(102.5)).toBe(t.percent('102.5'));
    expect(ratioText(4)).toBe(t.percent('4.0'));
  });
});

describe('figureText', () => {
  it('온 값은 셈한 글자로 낸다', () => {
    expect(figureText({ kind: 'value', value: 1_000 }, countText)).toBe('1,000');
  });

  /*
   * ⛔ **못 세는 두 갈래가 같은 말이 되면 안 된다** — 앞은 채우면 풀리는 것이고
   * 뒤는 사용자가 할 수 있는 일이 없다.
   */
  it('못 세는 두 갈래를 다른 말로 낸다', () => {
    const missing = figureText({ kind: 'guaranteedMissing' }, countText);
    const notCalculable = figureText({ kind: 'notCalculable' }, countText);

    expect(missing).toBe(t.guaranteedMissing);
    expect(notCalculable).toBe(t.notCalculable);
    expect(missing).not.toBe(notCalculable);
  });

  /* ⛔ 못 셀 때 0 을 그리면 「다 썼다」로 읽힌다. */
  it('못 셀 때 0 을 그리지 않는다', () => {
    expect(figureText({ kind: 'notCalculable' }, countText)).not.toContain('0');
  });
});
