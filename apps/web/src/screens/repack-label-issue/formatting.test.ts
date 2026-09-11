import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { localDateTimeText } from './formatting';

const originalTz = process.env.TZ;

describe('발행 화면의 시각 표기', () => {
  /* 현지 시각으로 옮겨졌는지 보려면 기준 시간대가 고정돼야 한다 — 기계마다 다르면 판정이 흔들린다. */
  beforeAll(() => {
    process.env.TZ = 'Asia/Seoul';
  });

  /*
   * ⛔ **다시 대입하지 않는다.** `TZ` 가 원래 비어 있으면 대입은 리터럴 `'undefined'` 를 넣고,
   *    Node 는 그것을 잘못된 시간대로 보아 조용히 UTC 로 떨어뜨린다. 지금은 파일마다 프로세스가
   *    갈려 새지 않지만, 격리를 끄는 날 뒤에 도는 시각 시험이 UTC 를 보게 된다.
   */
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  /* #1043 — 서버가 내리는 표준시 문자열이 그대로 서면 현지와 아홉 시간 어긋나 보인다. */
  it('표준시 문자열을 현지 시각으로 옮긴다', () => {
    expect(localDateTimeText('2026-09-10T09:12:00.000Z', '—')).toBe('09-10 18:12');
  });

  /* 오프셋이 붙은 문자열도 같은 자리를 가리킨다 — 표기만 다르다. */
  it('오프셋이 붙어 와도 같은 꼴로 적는다', () => {
    expect(localDateTimeText('2026-09-10T18:12:00+09:00', '—')).toBe('09-10 18:12');
  });

  it('값이 없거나 읽을 수 없으면 지어내지 않는다', () => {
    expect(localDateTimeText(null, '—')).toBe('—');
    expect(localDateTimeText('언제인지 모름', '—')).toBe('—');
  });
});
