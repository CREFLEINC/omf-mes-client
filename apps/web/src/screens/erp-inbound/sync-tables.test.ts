import { describe, expect, it } from 'vitest';

import { syncTable } from './sync-table-fixtures';
import { isRunFinished, isSyncBusy, toSyncStateView } from './sync-tables';

describe('isSyncBusy — 바쁠 때만 다시 읽는다', () => {
  it('요청이 걸린 표가 있으면 바쁘다', () => {
    expect(
      isSyncBusy({ enabled: true, items: [syncTable({ requestedAt: '2026-10-20T08:00:00Z' })] }),
    ).toBe(true);
  });

  it('도는 표가 있으면 바쁘다 — 주기 회차도 따라간다', () => {
    expect(isSyncBusy({ enabled: true, items: [syncTable({ running: true })] })).toBe(true);
  });

  it('요청도 도는 표도 없으면 다시 읽지 않는다', () => {
    expect(isSyncBusy({ enabled: true, items: [syncTable()] })).toBe(false);
    expect(isSyncBusy(undefined)).toBe(false);
  });
});

describe('toSyncStateView — 지금 벌어지는 일이 지난 결과보다 먼저 읽힌다', () => {
  it('도는 중이면 지난 결과가 실패여도 「읽는 중」이다', () => {
    expect(toSyncStateView(syncTable({ running: true, lastStatusCode: 'FAILED' }))).toEqual({
      tone: 'info',
      label: '읽는 중',
      note: null,
    });
  });

  it('요청이 걸려 있으면 「대기 중」과 요청 시각(공장 시각)을 낸다', () => {
    expect(toSyncStateView(syncTable({ requestedAt: '2026-10-20T08:00:00Z' }))).toEqual({
      tone: 'info',
      label: '대기 중',
      note: '2026-10-20 15:00 요청',
    });
  });

  it('실패면 사유를 보조 줄로 낸다', () => {
    expect(
      toSyncStateView(
        syncTable({ lastStatusCode: 'FAILED', lastErrorMessage: '중계 DB 응답 없음' }),
      ),
    ).toEqual({ tone: 'error', label: '실패', note: '중계 DB 응답 없음' });
  });

  it('한 번도 돌지 않았으면 「기록 없음」이다', () => {
    expect(toSyncStateView(syncTable({ lastStatusCode: null })).label).toBe('기록 없음');
  });

  it('모르는 결과 코드는 코드 그대로 낸다 — 이름을 지어내지 않는다', () => {
    expect(toSyncStateView(syncTable({ lastStatusCode: 'PARTIAL' })).label).toBe('PARTIAL');
  });
});

describe('isRunFinished — 요청 시각이 비고 마지막 끝난 시각이 바뀌면 다 읽었다', () => {
  const baseline = '2026-10-20T07:00:00Z';

  it('끝난 시각이 바뀌고 요청이 비었으면 끝났다', () => {
    expect(isRunFinished(syncTable({ lastFinishedAt: '2026-10-20T08:00:05Z' }), baseline)).toBe(
      true,
    );
  });

  it('요청이 아직 걸려 있으면 끝나지 않았다 — 앞서 돌던 주기 회차가 끝난 것일 수 있다', () => {
    expect(
      isRunFinished(
        syncTable({ lastFinishedAt: '2026-10-20T08:00:05Z', requestedAt: '2026-10-20T08:00:00Z' }),
        baseline,
      ),
    ).toBe(false);
  });

  it('끝난 시각이 그대로면 끝나지 않았다 — 요청을 아직 싣지 않은 목록일 수 있다', () => {
    expect(isRunFinished(syncTable({ lastFinishedAt: baseline }), baseline)).toBe(false);
  });

  it('처음 도는 표도 끝을 안다(누를 때 끝난 시각이 없었다)', () => {
    expect(isRunFinished(syncTable({ lastFinishedAt: '2026-10-20T08:00:05Z' }), null)).toBe(true);
  });
});
