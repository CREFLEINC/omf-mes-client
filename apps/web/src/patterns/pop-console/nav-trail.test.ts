import { beforeEach, describe, expect, it } from 'vitest';

import { renderHook } from '@testing-library/react';

import { clearTrail, previousOf, recordVisit, usePopRecent, usePopTrail } from './nav-trail';

const current = (): readonly string[] => renderHook(() => usePopTrail()).result.current;
const recent = (): readonly string[] => renderHook(() => usePopRecent()).result.current;

beforeEach(() => {
  clearTrail();
});

describe('지나온 화면 기록', () => {
  it('[이전]은 바로 앞 화면이고, 기록이 없으면 홈이다', () => {
    expect(previousOf(current())).toBe('/pop/home');

    recordVisit('/pop/home');
    recordVisit('/pop/material-input?workOrderId=42');

    expect(previousOf(current())).toBe('/pop/home');
  });

  it('되돌아오면 끝을 걷어 오가기만으로 기록이 늘지 않는다', () => {
    recordVisit('/pop/home');
    recordVisit('/pop/material-input?workOrderId=42');
    recordVisit('/pop/work-hold?workOrderId=42');
    recordVisit('/pop/material-input?workOrderId=42');

    expect(current()).toEqual(['/pop/home', '/pop/material-input?workOrderId=42']);
  });

  it('같은 화면에서 인자만 바뀌면 한 칸으로 둔다', () => {
    recordVisit('/pop/home');
    recordVisit('/pop/material-input?workOrderId=1');
    recordVisit('/pop/material-input?workOrderId=2');

    expect(current()).toEqual(['/pop/home', '/pop/material-input?workOrderId=2']);
  });

  /* 홈을 거쳐 다른 화면으로 가도 앞서 본 화면이 「최근 화면」에 남는다 — [이전] 기록과 따로 든다. */
  it('최근 화면은 최근 것부터 화면마다 하나, 홈은 빼고 센다', () => {
    recordVisit('/pop/home');
    recordVisit('/pop/pqc-inspection?ir=7');
    recordVisit('/pop/home');
    recordVisit('/pop/material-defect');
    recordVisit('/pop/pqc-inspection?ir=8');

    expect(recent()).toEqual(['/pop/pqc-inspection?ir=8', '/pop/material-defect']);
  });

  it('사용자 전환이 기록과 최근 화면을 함께 비운다', () => {
    recordVisit('/pop/home');
    recordVisit('/pop/downtime');
    clearTrail();

    expect(current()).toEqual([]);
    expect(recent()).toEqual([]);
  });
});
