import { formatValue } from './event-format';
import type { FreeFormValues } from './types';

/**
 * 전후 값 두 객체를 **항목별 비교 목록**으로 옮긴다.
 *
 * 계약이 이 두 값을 키 구조가 정해지지 않은 자유 형식으로 두었다. 그래서 이 파일이 지키는 것은
 * 세 가지다 — **해석하지 않는다 · 순서를 부여하지 않는다 · 감추지 않는다.**
 *
 * - 키 → 우리말 대응표를 두지 않는다. 두면 언젠가 쓰인다.
 * - 키 순서는 **받은 순서**다. 사전순 정렬도 화면이 부여하는 순서다.
 * - 화면이 모르는 키도 그대로 낸다. 계약이 「파싱 실패로 감추지 않는다」를 명시했다.
 */

export interface DiffEntry {
  /** 받은 키 이름 그대로. `DiffRow`의 label이 된다. */
  key: string;
  /** 표기용 문자열. 값이 없으면 null → `DiffRow`가 emptyText로 낸다. */
  before: string | null;
  after: string | null;
  /** 두 값이 다른가. false면 `DiffRow`가 한 번만 중립으로 렌더한다. */
  changed: boolean;
}

/**
 * 두 객체의 키 합집합. **`before`의 키 순서를 먼저 쓰고** `after`에만 있는 키를 그 뒤에 붙인다.
 *
 * 목록 표의 「바뀐 항목」 열도 이 순서를 쓴다 — 표와 창의 항목 순서가 갈리면
 * 같은 건을 두 자리에서 다르게 읽게 된다.
 */
export const toValueKeys = (
  before: FreeFormValues | null | undefined,
  after: FreeFormValues | null | undefined,
): string[] => {
  const keys = Object.keys(before ?? {});
  const seen = new Set(keys);

  for (const key of Object.keys(after ?? {})) {
    if (seen.has(key)) continue;

    seen.add(key);
    keys.push(key);
  }

  return keys;
};

export const toDiffEntries = (
  before: FreeFormValues | null | undefined,
  after: FreeFormValues | null | undefined,
): DiffEntry[] =>
  toValueKeys(before, after).map((key) => {
    const beforeText = formatValue(before?.[key]);
    const afterText = formatValue(after?.[key]);

    return {
      key,
      before: beforeText,
      after: afterText,
      /*
       * 표기 문자열로 비교한다 — 화면이 보여 주는 것이 곧 판정 근거여야
       * 「같아 보이는데 바뀌었다고 나온다」가 생기지 않는다.
       */
      changed: beforeText !== afterText,
    };
  });
