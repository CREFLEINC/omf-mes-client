import type { ReactElement } from 'react';

/** 참조 이름은 「코드 · 이름」 한 줄로 온다(`production-order/item-lookups`). 그 사이를 가른다. */
const SEPARATOR = ' · ';

/**
 * 품목을 **코드 줄과 이름 줄로 나눠** 그린다(사용자 지시 2026-09-20).
 *
 * 좁은 칸에서 「코드 · 이름」이 아무 데서나 접혀 코드가 이름과 같은 줄에 섞여 보였다.
 * ⭐ **항상 두 줄이다** — 이름이 길어도 더 접지 않고 칸 폭에서 끊는다(사용자 지시 2026-09-20).
 * 끊긴 값은 마우스를 올리면 전체가 보인다(`title`).
 * 「코드 · 이름」 모양이 아닌 값(「불러오는 중」·「알 수 없음」 같은 상태 문구)은 그대로 한 줄이다.
 */
export const ItemLabelLines = ({ label }: { label: string }): ReactElement => {
  const at = label.indexOf(SEPARATOR);

  if (at < 0) {
    return (
      <span className="work-order-release-item-label" title={label}>
        {label}
      </span>
    );
  }

  const code = label.slice(0, at);
  const name = label.slice(at + SEPARATOR.length);

  return (
    <span className="work-order-release-item-label" title={label}>
      <span className="work-order-release-item-code">{code}</span>
      <span className="work-order-release-item-name">{name}</span>
    </span>
  );
};
