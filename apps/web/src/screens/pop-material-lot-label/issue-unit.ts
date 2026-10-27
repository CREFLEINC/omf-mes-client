/**
 * 발행 단위 — **N장마다 멈추고 「다음 N장 발행」으로 이어 간다**(사용자 지시 2026-10-27).
 *
 * ⭐ 수십 장을 한 번에 뽑으면 라벨이 프린터 앞에 쌓여 어느 상자 것인지 섞인다. 작업자는 N장을 붙이고
 *    다음 N장을 찍는다 — 단위는 그 손의 박자다. 「전체」(`null`)는 멈추지 않는다(지금까지와 같다).
 * ⭐ **단말이 기억한다** — 작업자는 늘 같은 단위로 일한다(프린터 선택 `printer-choice` 와 같은 길).
 * ⚠ 발행 대기에서만 쓴다. 다시 인쇄는 한두 장이라 나눌 까닭이 없다.
 */
export type IssueUnit = number | null;

export const ISSUE_UNITS: readonly IssueUnit[] = [null, 10, 20, 50];

export const ISSUE_UNIT_STORAGE_KEY = 'omf-mes.pop-material-lot-label.issue-unit';

/** 기억해 둔 단위 — 없거나 고를 수 있는 값이 아니면 「전체」. 저장소가 막혀도 던지지 않는다. */
export const storedIssueUnit = (): IssueUnit => {
  try {
    const raw = globalThis.localStorage.getItem(ISSUE_UNIT_STORAGE_KEY);
    const unit = raw === null ? null : Number(raw);

    return ISSUE_UNITS.includes(unit) ? unit : null;
  } catch {
    return null;
  }
};

export const rememberIssueUnit = (unit: IssueUnit): void => {
  try {
    if (unit === null) globalThis.localStorage.removeItem(ISSUE_UNIT_STORAGE_KEY);
    else globalThis.localStorage.setItem(ISSUE_UNIT_STORAGE_KEY, String(unit));
  } catch {
    /* 저장이 막혔다. 이번 실행 동안은 고른 것이 그대로 쓰인다. */
  }
};
