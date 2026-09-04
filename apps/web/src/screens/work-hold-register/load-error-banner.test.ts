import { describe, expect, it } from 'vitest';
import { messages } from '@omf-mes/i18n';

import { describeError } from './load-error-banner';

/**
 * ⚠ **잇기 전에 거른다.** 이어 붙인 뒤 빈 문자열인지 보면 공백 하나·이음쇠 한 칸이 검사를
 * 통과해 본문이 빈 배너가 선다. 같은 구멍이 다른 화면 사본들에 남아 있어 감지기를 둔다.
 */
describe('조회 실패 문구', () => {
  it('공백만 있는 문구는 공용 안내로 떨어진다', () => {
    expect(
      describeError({
        kind: 'validation',
        errors: [{ scope: 'field', code: 'REQUIRED', message: '   ' }],
      }),
    ).toBe(messages.httpError.description);
  });

  it('빈 문구가 여럿이어도 이음쇠 공백이 본문이 되지 않는다', () => {
    expect(
      describeError({
        kind: 'validation',
        errors: [
          { scope: 'field', code: 'A', message: '' },
          { scope: 'field', code: 'B', message: '' },
        ],
      }),
    ).toBe(messages.httpError.description);
  });

  it('쓸 수 있는 문구는 그대로 잇는다', () => {
    expect(
      describeError({
        kind: 'validation',
        errors: [
          { scope: 'field', code: 'A', message: '사유가 필요합니다.' },
          { scope: 'field', code: 'B', message: '   ' },
        ],
      }),
    ).toBe('사유가 필요합니다.');
  });

  it('연결이 끊긴 것은 오프라인으로 말한다', () => {
    expect(describeError({ kind: 'network' })).toBe(messages.httpError.offline);
  });
});
