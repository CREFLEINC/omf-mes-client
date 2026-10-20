import { describe, expect, it } from 'vitest';

import { popScreenAt } from './pop-screen-catalog';
import { destinationOf } from './pop-screen-nav';

const screenAt = (path: string) => {
  const screen = popScreenAt(path);

  if (screen === null) throw new Error(`화면 목록에 없습니다: ${path}`);

  return screen;
};

describe('화면 이동 — 갈 곳 주소(G-34)', () => {
  it('작업지시를 받는 화면으로 갈 때는 지금 주소의 작업지시를 실어 준다', () => {
    expect(destinationOf(screenAt('/pop/production-result'), '?workOrderId=11002')).toBe(
      '/pop/production-result?workOrderId=11002',
    );
  });

  it('작업지시를 받지 않는 화면에는 싣지 않는다', () => {
    expect(destinationOf(screenAt('/pop/downtime'), '?workOrderId=11002')).toBe('/pop/downtime');
  });

  it('지금 주소에 작업지시가 없으면 주소만 낸다', () => {
    expect(destinationOf(screenAt('/pop/material-input'), '')).toBe('/pop/material-input');
  });
});
