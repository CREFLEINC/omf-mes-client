import { describe, expect, it } from 'vitest';

import { MAX_PHOTOS, scanMissOf, toOutboxDraft, toPhotoDrafts, validateReport } from './report';

/* 화면의 시각 칸이 주는 모양 그대로 둔다 - 시:분뿐이다. */
const report = {
  equipmentId: 7,
  symptom: '유압 누유 · 실린더 하부',
  occurrenceState: 'STOPPED' as const,
  stoppedAt: '14:20',
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
    const draft = toOutboxDraft(report, OCCURRED_AT, 'r-1');

    expect(draft.method).toBe('POST');
    expect(draft.path).toBe('/maintenance/breakdowns');
    expect(draft.body).toEqual({
      equipmentId: 7,
      symptom: '유압 누유 · 실린더 하부',
      occurrenceStateCode: 'STOPPED',
      stoppedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as unknown as string,
      reportedAt: OCCURRED_AT,
      notifyAssignee: true,
    });
  });

  /* 오프라인 지연이 고장 발생 시각을 뒤로 밀면 안 된다. */
  it('보고 시각은 단말 시계가 정한 값을 그대로 싣는다', () => {
    expect(toOutboxDraft(report, OCCURRED_AT, 'r-1').occurredAt).toBe(OCCURRED_AT);
  });

  /* 설비담당이 와야 끝나는 일이라 서버가 받기 전까지 보고됨으로 그리지 않는다. */
  it('담긴 것만으로 확정으로 보지 않는다', () => {
    expect(toOutboxDraft(report, OCCURRED_AT, 'r-1').confirmation).toBe('pending');
  });

  it('증상의 앞뒤 공백은 떼고 담는다', () => {
    const draft = toOutboxDraft({ ...report, symptom: '  누유  ' }, OCCURRED_AT, 'r-1');

    expect((draft.body as { symptom: string }).symptom).toBe('누유');
  });

  /* 계약이 받는 것은 날짜까지 있는 시각이다. 화면의 시각 칸은 시:분만 준다. */
  it('시각 칸의 시:분을 그날의 시각으로 만들어 담는다', () => {
    const draft = toOutboxDraft(
      { ...report, stoppedAt: '14:20' },
      '2026-09-01T14:31:00.000Z',
      'r-1',
    );
    const sent = (draft.body as { stoppedAt: string }).stoppedAt;

    expect(sent).not.toBe('14:20');
    expect(Number.isNaN(Date.parse(sent))).toBe(false);
    expect(new Date(sent).getHours()).toBe(14);
    expect(new Date(sent).getMinutes()).toBe(20);
  });

  /* 자정 직후에 보고하면 그날로 잡은 정지 시각이 아직 오지 않은 시각이 된다. */
  it('보고보다 뒤인 정지 시각은 앞날로 본다', () => {
    const draft = toOutboxDraft(
      { ...report, stoppedAt: '23:50' },
      '2026-09-02T00:10:00.000Z',
      'r-1',
    );
    const sent = (draft.body as { stoppedAt: string }).stoppedAt;

    expect(new Date(sent).getTime()).toBeLessThan(Date.parse('2026-09-02T00:10:00.000Z'));
  });

  it('정지 시각을 모르면 비운 채로 담는다', () => {
    const draft = toOutboxDraft({ ...report, stoppedAt: null }, OCCURRED_AT, 'r-1');

    expect((draft.body as { stoppedAt: string | null }).stoppedAt).toBeNull();
  });

  /* 본문만으로 키를 만들면 다른 설비에 보낸 뒤 요청이 조용히 사라진다. */
  it('멱등키가 설비를 담는다', () => {
    expect(
      toOutboxDraft(report, OCCURRED_AT, 'r-1').idempotencyKey.startsWith('breakdown-report:7:'),
    ).toBe(true);
  });

  it('같은 설비라도 부를 때마다 다른 키다', () => {
    expect(toOutboxDraft(report, OCCURRED_AT, 'r-1').idempotencyKey).not.toEqual(
      toOutboxDraft(report, OCCURRED_AT, 'r-1').idempotencyKey,
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

describe('사진을 본문에 딸린 건으로 담기', () => {
  const body = toOutboxDraft(report, OCCURRED_AT, 'r-1');
  const photo = (name: string) => ({
    fileName: name,
    mimeType: 'image/jpeg',
    data: 'AAAA',
    previewUrl: 'blob:x',
    byteLength: 10,
  });

  it('본문이 만들 식별자로 경로를 완성하게 담는다', () => {
    const [first] = toPhotoDrafts([photo('a.jpg')], body, OCCURRED_AT);

    expect(first?.path).toBe('/maintenance/breakdowns/:breakdownId/attachments');
    expect(first?.pathFrom).toEqual({
      entryId: 'r-1',
      field: 'breakdownId',
      token: ':breakdownId',
    });
  });

  /* 본문이 성공해야 붙을 곳이 생기므로 사진에 따로 키를 두지 않는다. */
  it('사진의 키는 본문의 키에서 나온다', () => {
    const [first, second] = toPhotoDrafts([photo('a.jpg'), photo('b.jpg')], body, OCCURRED_AT);

    expect(first?.idempotencyKey.startsWith(body.idempotencyKey)).toBe(true);
    expect(second?.idempotencyKey.startsWith(body.idempotencyKey)).toBe(true);
    expect(first?.idempotencyKey).not.toEqual(second?.idempotencyKey);
  });

  /* 본문이 거부되면 사진도 함께 되돌아와야 한다. */
  it('본문과 같은 묶음에 담는다', () => {
    const [first] = toPhotoDrafts([photo('a.jpg')], body, OCCURRED_AT);

    expect(first?.batchId).toBe(body.batchId);
  });

  it('담긴 것만으로 붙었다고 하지 않는다', () => {
    const [first] = toPhotoDrafts([photo('a.jpg')], body, OCCURRED_AT);

    expect(first?.confirmation).toBe('pending');
  });

  it('파일을 몸이 아니라 파일 자리에 담는다', () => {
    const [first] = toPhotoDrafts([photo('a.jpg')], body, OCCURRED_AT);

    expect(first?.body).toBeNull();
    expect(first?.file).toEqual({ fileName: 'a.jpg', mimeType: 'image/jpeg', data: 'AAAA' });
  });

  it('사진이 없으면 담을 것도 없다', () => {
    expect(toPhotoDrafts([], body, OCCURRED_AT)).toEqual([]);
  });

  it('계약이 정한 한도가 셋이다', () => {
    expect(MAX_PHOTOS).toBe(3);
  });
});
