import { describe, expect, it } from 'vitest';

import { shortLotNos } from './lot-short-no';

describe('shortLotNos', () => {
  it('일련번호가 모두 다르면 일련번호만', () => {
    const map = shortLotNos(['SYN-CAP|1000|261111|SYN01|0001', 'SYN-CAP|1000|261111|SYN01|0002']);

    expect([...map.values()]).toEqual(['0001', '0002']);
  });

  it('일련번호가 겹치면 날짜를 앞에 붙인다', () => {
    expect([
      ...shortLotNos(['SYN-CAP|1000|261110|SYN01|0001', 'SYN-CAP|1000|261111|SYN01|0001']).values(),
    ]).toEqual(['261110|0001', '261111|0001']);
  });

  /* 현장 2026-11-19 — 20000|261109|0001 · 30000|261109|0001 로 길어져 표가 카드 밖으로 밀렸다. */
  it('수량만 다르면 수량 칸이 가르므로 일련번호만', () => {
    expect([
      ...shortLotNos(['SYN-CAP|20000|261109|SYN01|0001', 'SYN-CAP|30000|261109|SYN01|0001']).values(),
    ]).toEqual(['0001', '0001']);
  });

  it('형식이 아닌 번호가 끼면 모두 번호 전체', () => {
    const map = shortLotNos(['SYN-CAP|1000|261111|SYN01|0001', 'LEGACY-0001']);

    expect([...map.values()]).toEqual(['SYN-CAP|1000|261111|SYN01|0001', 'LEGACY-0001']);
  });
});
