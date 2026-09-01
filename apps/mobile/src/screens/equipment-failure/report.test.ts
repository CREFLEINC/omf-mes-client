import { describe, expect, it } from 'vitest';

import { scanMissOf, toOutboxDraft, validateReport } from './report';

const report = {
  equipmentId: 7,
  symptom: '유압 누유 · 실린더 하부',
  occurrenceState: 'STOPPED' as const,
  stoppedAt: '2026-09-01T14:20:00.000Z',
  notifyAssignee: true,
};

const OCCURRED_AT = '2026-09-01T14:31:00.000Z';

describe('보고를 낼 수 있는가', () => {
  it('설비·증상·발생 상태가 모두 있어야 낼 수 있다', () => {
    expect(validateReport(report).canSubmit).toBe(true);
  });

  it('설비를 안 골랐으면 못 낸다', () => {
    expect(validateReport({ ...report, equipmentId: undefined }).canSubmit).toBe(false);
  });

  it('발생 상태를 안 골랐으면 못 낸다', () => {
    expect(validateReport({ ...report, occurrenceState: undefined }).canSubmit).toBe(false);
  });

  /* 설비담당은 이 한 줄만 보고 출동한다. */
  it('증상이 비어 있으면 못 낸다', () => {
    const result = validateReport({ ...report, symptom: '   ' });

    expect(result.canSubmit).toBe(false);
    expect(result.symptomMissing).toBe(true);
  });

  /* 길이를 요구하면 자릿수를 채우려고 아무 말이나 적게 된다. */
  it('짧다고 막지 않는다', () => {
    expect(validateReport({ ...report, symptom: '누유' }).canSubmit).toBe(true);
  });
});

describe('큐에 담을 모양', () => {
  it('계약이 정한 경로와 필드로 담는다', () => {
    const draft = toOutboxDraft(report, OCCURRED_AT);

    expect(draft.method).toBe('POST');
    expect(draft.path).toBe('/maintenance/breakdowns');
    expect(draft.body).toEqual({
      equipmentId: 7,
      symptom: '유압 누유 · 실린더 하부',
      occurrenceStateCode: 'STOPPED',
      stoppedAt: '2026-09-01T14:20:00.000Z',
      reportedAt: OCCURRED_AT,
      notifyAssignee: true,
    });
  });

  /* 오프라인 지연이 고장 발생 시각을 뒤로 밀면 안 된다. */
  it('보고 시각은 단말 시계가 정한 값을 그대로 싣는다', () => {
    expect(toOutboxDraft(report, OCCURRED_AT).occurredAt).toBe(OCCURRED_AT);
  });

  /* 설비담당이 와야 끝나는 일이라 서버가 받기 전까지 보고됨으로 그리지 않는다. */
  it('담긴 것만으로 확정으로 보지 않는다', () => {
    expect(toOutboxDraft(report, OCCURRED_AT).confirmation).toBe('pending');
  });

  it('증상의 앞뒤 공백은 떼고 담는다', () => {
    const draft = toOutboxDraft({ ...report, symptom: '  누유  ' }, OCCURRED_AT);

    expect((draft.body as { symptom: string }).symptom).toBe('누유');
  });

  it('정지 시각을 모르면 비운 채로 담는다', () => {
    const draft = toOutboxDraft({ ...report, stoppedAt: null }, OCCURRED_AT);

    expect((draft.body as { stoppedAt: string | null }).stoppedAt).toBeNull();
  });

  /* 본문만으로 키를 만들면 다른 설비에 보낸 뒤 요청이 조용히 사라진다. */
  it('멱등키가 설비를 담는다', () => {
    expect(
      toOutboxDraft(report, OCCURRED_AT).idempotencyKey.startsWith('breakdown-report:7:'),
    ).toBe(true);
  });

  it('같은 설비라도 부를 때마다 다른 키다', () => {
    expect(toOutboxDraft(report, OCCURRED_AT).idempotencyKey).not.toEqual(
      toOutboxDraft(report, OCCURRED_AT).idempotencyKey,
    );
  });
});

describe('읽은 코드를 못 찾았다고 말할 수 있는가', () => {
  /* 오는 중에 없다고 하면 작업자는 맞는 코드를 들고 계속 다시 쏜다. */
  it('목록이 오는 동안에는 말하지 않는다', () => {
    expect(scanMissOf('PRS-01', false, undefined)).toBeNull();
  });

  it('목록이 왔는데 못 찾았으면 그 코드를 낸다', () => {
    expect(scanMissOf('PRS-01', true, undefined)).toBe('PRS-01');
  });

  it('그 코드로 골라졌으면 못 찾은 것이 아니다', () => {
    expect(scanMissOf('PRS-01', true, 'PRS-01')).toBeNull();
  });

  it('아직 쏘지 않았으면 말할 것이 없다', () => {
    expect(scanMissOf(null, true, undefined)).toBeNull();
  });
});
