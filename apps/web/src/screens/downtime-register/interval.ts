/**
 * 구간 — **이 화면에서는 시각 자체가 데이터다**(스펙 §5-2). 다른 화면에서는 「언제 적었나」가
 * 몇 분 틀려도 기록의 뜻이 변하지 않지만, 비가동은 **시작과 끝의 차가 곧 값**이다.
 *
 * ⛔ **화면이 시각을 보정하지 않는다.** 단말 시계가 몇 분 빠르더라도 시작·끝을 **같은 단말**이
 * 찍으므로 차는 정확하다. 보정하면 작업자가 본 값과 저장된 값이 갈리고, 보정값을 잃으면
 * 끝이 시작보다 앞서 저장이 통째로 실패한다.
 *
 * ⛔ **끝이 비어 있는 것이 「진행 중」이다.** 깃발을 따로 두지 않는다(스펙 §5-3).
 */

/** 날짜·시각 칸 한 쌍. 브라우저 입력이 주는 그대로의 글자다(`yyyy-mm-dd` · `HH:MM`). */
export interface TimeFieldDraft {
  date: string;
  time: string;
}

export const EMPTY_TIME_FIELD: TimeFieldDraft = { date: '', time: '' };

export interface IntervalDraft {
  startedAt: TimeFieldDraft;
  endedAt: TimeFieldDraft;
  /** 「아직 진행 중」 체크. 켜지면 끝 시각을 **보내지 않는다**. */
  stillOngoing: boolean;
}

export const EMPTY_INTERVAL: IntervalDraft = {
  startedAt: EMPTY_TIME_FIELD,
  endedAt: EMPTY_TIME_FIELD,
  stillOngoing: false,
};

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/** `Date`를 날짜·시각 두 칸으로 나눈다 — `[지금]` 버튼이 쓴다. */
export const toTimeFieldDraft = (at: Date): TimeFieldDraft => ({
  date: `${String(at.getFullYear())}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}`,
  time: `${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}`,
});

/**
 * 두 칸을 하나의 순간으로 읽는다. 한쪽이라도 비었거나 모양이 깨졌으면 `null`이다.
 *
 * ⛔ **`new Date(문자열)`에 통째로 넘기지 않는다.** 구획을 직접 세워 지역 시각으로 만든다 —
 * 문자열 해석은 실행 환경에 따라 UTC로 읽힐 수 있고, 그러면 **단말 시각을 넣는다는 규칙이
 * 조용히 깨진다.**
 */
export const readTimeField = (field: TimeFieldDraft): Date | null => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(field.date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(field.time);
  if (dateMatch === null || timeMatch === null) return null;

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;

  const at = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );

  /* 존재하지 않는 날짜(2월 30일 등)는 자리가 넘어가 다른 달이 된다 — 되짚어 확인한다. */
  return at.getMonth() === Number(month) - 1 && at.getDate() === Number(day) ? at : null;
};

/**
 * 이 구간이 실제로 가리키는 두 순간.
 *
 * `ended`가 `null`인 경우는 둘이다 — **아직 진행 중**이거나 **아직 다 치지 않은 것**이다.
 * 두 경우를 화면이 갈라야 하므로 검증 쪽에서 다시 본다.
 */
export interface IntervalMoments {
  started: Date | null;
  ended: Date | null;
}

export const readInterval = (draft: IntervalDraft): IntervalMoments => ({
  started: readTimeField(draft.startedAt),
  /* 「아직 진행 중」이면 끝 칸을 읽지 않는다 — 남아 있는 글자가 본문에 실리지 않게. */
  ended: draft.stillOngoing ? null : readTimeField(draft.endedAt),
});

/** 어느 칸에 무엇이 잘못됐는가. 짝 제약은 **두 칸에 함께** 붙는다(스펙 §6-1). */
export interface IntervalErrors {
  startedAt: 'required' | 'future' | 'order' | null;
  endedAt: 'future' | 'order' | null;
}

export const NO_INTERVAL_ERRORS: IntervalErrors = { startedAt: null, endedAt: null };

/**
 * 구간을 검사한다. **미래 시각과 순서 뒤바뀜은 저장을 막고, 겹침은 막지 않는다**(스펙 §6-1).
 *
 * ⚠ `now`를 인자로 받는 것은 시험을 위해서만이 아니다 — 검사와 본문 만들기가 **같은 순간**을
 * 봐야 「검사할 때는 과거였는데 보낼 때는 미래」 같은 틈이 생기지 않는다.
 */
export const validateInterval = (draft: IntervalDraft, now: Date): IntervalErrors => {
  const { started, ended } = readInterval(draft);

  if (started === null) {
    return { ...NO_INTERVAL_ERRORS, startedAt: 'required' };
  }

  if (started.getTime() > now.getTime()) {
    return { ...NO_INTERVAL_ERRORS, startedAt: 'future' };
  }

  if (ended === null) return NO_INTERVAL_ERRORS;

  if (ended.getTime() > now.getTime()) {
    return { ...NO_INTERVAL_ERRORS, endedAt: 'future' };
  }

  /*
   * 끝이 시작보다 앞선다 — **두 칸에 함께** 붙인다. 한쪽에만 붙이면 작업자가 그 칸만 고치고,
   * 고쳐야 할 쪽이 반대일 때 같은 오류를 다시 만난다.
   */
  if (ended.getTime() < started.getTime()) {
    return { startedAt: 'order', endedAt: 'order' };
  }

  return NO_INTERVAL_ERRORS;
};

export const hasIntervalError = (errors: IntervalErrors): boolean =>
  errors.startedAt !== null || errors.endedAt !== null;

/**
 * 구간의 길이(분). 끝이 없으면 `null`이다 — **진행 중은 산출 불가**이지 0이 아니다.
 *
 * ⚠ 이 값은 **입력 확인용**이다. 저장되는 길이는 서버가 낸다(공유계약 L-2).
 */
export const intervalMinutes = (moments: IntervalMoments): number | null => {
  const { started, ended } = moments;
  if (started === null || ended === null) return null;

  return Math.round((ended.getTime() - started.getTime()) / 60_000);
};

/** 겹침을 볼 대상 한 건. 끝이 없으면 아직 열려 있다. */
export interface IntervalRange {
  startedAt: string;
  endedAt: string | null;
}

const OPEN_END = Number.POSITIVE_INFINITY;

const rangeBounds = (range: IntervalRange): { from: number; to: number } | null => {
  const from = new Date(range.startedAt).getTime();
  if (Number.isNaN(from)) return null;

  if (range.endedAt === null) return { from, to: OPEN_END };

  const to = new Date(range.endedAt).getTime();

  return { from, to: Number.isNaN(to) ? OPEN_END : to };
};

/**
 * 이미 있는 구간 중 새 구간과 겹치는 것들.
 *
 * ⛔ **막지 않는다**(스펙 §6-1 · 미결 처리 「만들지 않는다」). 한 설비에 두 사유가 동시에
 * 걸리는 일이 실제로 있고, 저장 측도 이것을 막지 않는다. 화면은 **알리기만** 한다.
 *
 * 경계가 맞닿은 것(앞 구간의 끝 = 새 구간의 시작)은 겹침이 아니다 — 연달아 선 두 구간을
 * 겹쳤다고 말하면 경고가 늘 떠 있어 진짜 겹침을 가린다.
 */
export const findOverlaps = <T extends IntervalRange>(
  existing: readonly T[],
  moments: IntervalMoments,
): T[] => {
  const { started, ended } = moments;
  if (started === null) return [];

  const from = started.getTime();
  const to = ended === null ? OPEN_END : ended.getTime();

  return existing.filter((one) => {
    const bounds = rangeBounds(one);
    if (bounds === null) return false;

    return from < bounds.to && bounds.from < to;
  });
};
