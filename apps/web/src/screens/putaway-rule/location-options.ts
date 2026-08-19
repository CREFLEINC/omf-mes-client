import { messages } from '@omf-mes/i18n';

import { toSelectOptions, type ReferenceSource } from './lookups';
import type { SelectOption } from './types';

/**
 * 폼의 **위치 선택지**.
 *
 * ## 빈 선택지가 「창고 전체」다
 *
 * 위치를 비운 규칙은 **그 창고 전체에 적용되는 규칙**이며, 이것은 값이 없는 것이 아니라
 * 확정된 뜻이다. 그래서 빈 값을 고를 수 있는 자리로 **늘 세운다** — 한 번 고른 뒤에 다시
 * 비울 방법이 칸 안에 없으면 창고 전체 규칙을 만들 길이 사라진다.
 *
 * 조건 줄의 빈 선택지(「전체」 — 좁히지 않음)와 **뜻이 다르다.** 그래서 같은 함수를 쓰지
 * 않는다 — 한 함수로 합치면 두 뜻 중 하나가 다른 쪽의 문구를 입는다.
 *
 * ## 좁힘은 조회가 이미 했다
 *
 * 선택지는 `useLocationLookup(창고)`가 준 목록 그대로다. 계약이 `warehouseId`를 필수로
 * 요구해 **그 창고의 위치만** 온다 — 화면이 다시 거르지 않는다. 거르는 자리를 하나 더 두면
 * 조회 조건과 화면 조건이 갈릴 수 있고, 그때 어느 쪽이 사실인지 알 수 없다.
 *
 * ⚠ 이것은 사본 체크리스트 10번이 말하는 좁힘이 아니다. **이름 풀이가 아니라 선택지**이며,
 * 다른 창고의 위치를 고를 수 있어야 할 이유가 없다(계약이 그 조합을 받지 않는다).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.putawayRule;

export const toLocationChoices = (source: ReferenceSource): SelectOption[] => [
  { value: '', label: t.values.warehouseWide },
  ...toSelectOptions(source),
];
