/**
 * 적용 생산구간 — 이 검사 결과가 **어느 시간대의 생산분을 대표하는가**(스펙 §5-5).
 *
 * ⭐ **왜 필요한가** — 공정검사는 표본이다. 「09:00~11:00 생산분을 대표한다」가 성립해야
 * 불합격일 때 **회수 범위**가 정해진다. 구간이 없으면 무엇을 되돌려야 하는지 아무도 모른다.
 *
 * ⭐ **자동으로 채우되 사람이 고칠 수 있다.** 검사 시작·종료 시각이 대개 맞지만, 검사자가
 * 「이건 아침 생산분을 본 것」이라고 아는 경우가 있다 — 그때 고칠 수 없으면 화면이 아는
 * 것보다 사람이 아는 것이 정확한데도 틀린 값이 남는다.
 *
 * ⛔ **화면이 실행 환경의 시각을 스스로 읽지 않는다.** 호출부가 준다 — 시각을 읽는 자리가
 * 흩어지면 시험에서 시간을 고정할 수 없고, 그러면 이 구간의 감지기가 실행할 때마다 다른
 * 값을 본다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 편집 상태. **문자열이다** — 치는 동안에는 아직 시각이 아니다. */
export interface CoverageDraft {
  from: string;
  to: string;
}

export const EMPTY_COVERAGE_DRAFT: CoverageDraft = { from: '', to: '' };

/**
 * 저장된 구간을 편집 상태로 옮긴다. 비어 있으면 빈 칸이다 — **지어내지 않는다.**
 */
export const toCoverageDraft = (from: string | null, to: string | null): CoverageDraft => ({
  from: from ?? '',
  to: to ?? '',
});

/**
 * 아직 정해지지 않은 구간을 검사 시각으로 채운다.
 *
 * ⭐ **이미 값이 있으면 덮지 않는다.** 사용자가 고쳐 둔 값을 재조회가 되돌리면, 고친 것이
 * 조용히 사라지고 사용자는 자기가 고쳤다고 믿는다.
 */
export const fillCoverage = (draft: CoverageDraft, inspectedAt: string): CoverageDraft => ({
  from: draft.from === '' ? inspectedAt : draft.from,
  to: draft.to === '' ? inspectedAt : draft.to,
});

/**
 * 구간의 앞뒤가 뒤집혔는가.
 *
 * ⛔ **조용히 뒤집어 고치지 않는다** — 사용자가 넣은 값이 무엇인지 화면이 말해야 사용자가
 * 어디를 잘못 짚었는지 안다. 한쪽이 비어 있으면 아직 판정할 것이 없다.
 *
 * **문자열을 그대로 견준다.** RFC3339 는 같은 offset 안에서 사전순이 시간순이고, 이 두 칸은
 * 같은 단말이 같은 시각대에 채운다. ⚠ 그래서 **offset 이 다르면 판정하지 않는다** —
 * 견줄 수 없는 것을 견주면 틀린 경고가 뜬다.
 */
export const isCoverageOutOfOrder = (draft: CoverageDraft): boolean => {
  if (draft.from === '' || draft.to === '') return false;

  const fromOffset = offsetOf(draft.from);
  const toOffset = offsetOf(draft.to);

  if (fromOffset === null || toOffset === null || fromOffset !== toOffset) return false;

  return draft.to < draft.from;
};

const OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

const offsetOf = (value: string): string | null => OFFSET_PATTERN.exec(value)?.[1] ?? null;

/**
 * 보내는 값으로 옮긴다. **빈 칸은 키 자체를 싣지 않는다** — 빈 문자열은 시각이 아니고,
 * 보내면 서버가 형식 오류로 되돌린다.
 */
export const toCoverageBody = (
  draft: CoverageDraft,
): { coverageFromAt?: string; coverageToAt?: string } => ({
  ...(draft.from === '' ? {} : { coverageFromAt: draft.from }),
  ...(draft.to === '' ? {} : { coverageToAt: draft.to }),
});

/** 화면이 보여 주는 두 칸 — 날짜와 시각. **둘 다 지역 시각이다.** */
export interface CoverageParts {
  date: string;
  time: string;
}

export const EMPTY_COVERAGE_PARTS: CoverageParts = { date: '', time: '' };

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * 저장 값(RFC3339)을 **날짜 · 시각 두 칸**으로 가른다(사용자 지시 2026-09-10 — 「클릭하면
 * 달력이 떠야 한다」). `type="date"`·`type="time"` 이 브라우저의 달력·시각 판을 열어 준다.
 *
 * ⭐ **지역 시각으로 옮겨 보인다.** 저장 값은 `toISOString()` 이 만든 `Z` 라, 글자를 그대로
 * 잘라 보이면 한국 단말에 아홉 시간 어긋난 시각이 뜬다.
 *
 * ⛔ 이것은 «시각을 읽는 것»이 아니라 «옮기는 것»이다 — 이 파일 머리말의 금지(실행 환경의
 * 시각을 스스로 읽지 않는다)는 지금이 몇 시인지 묻는 일을 말한다.
 *
 * ⚠ 초는 버린다 — 생산구간은 분 단위로 짚는 값이고, 칸이 초를 받지 않는다.
 */
export const toCoverageParts = (value: string): CoverageParts => {
  if (value === '') return EMPTY_COVERAGE_PARTS;

  const at = new Date(value);

  /* 읽을 수 없는 값은 지어내지 않는다 — 빈 칸으로 두면 사용자가 다시 넣는다. */
  if (Number.isNaN(at.getTime())) return EMPTY_COVERAGE_PARTS;

  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
};

/**
 * 두 칸을 저장 값으로 되돌린다.
 *
 * ⛔ **한쪽만 찬 것은 시각이 아니다** — 빈 문자열로 둔다. 날짜만 있는 것을 자정으로 읽으면
 * 사용자가 넣지 않은 시각이 기록에 남는다.
 */
export const fromCoverageParts = (parts: CoverageParts): string => {
  if (parts.date === '' || parts.time === '') return '';

  const at = new Date(`${parts.date}T${parts.time}`);

  return Number.isNaN(at.getTime()) ? '' : at.toISOString();
};
