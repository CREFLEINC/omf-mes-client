export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
}

/**
 * 라벨 prop이 없는 컨트롤에 붙이는 라벨.
 *
 * 디자인 시스템 `Select`에는 `label` prop 자체가 없다(배치 규범 3) — 라벨을 직접 만들되
 * 내장 라벨과 같은 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다.
 *
 * **필수 표시를 담지 않는다.** 앞 회차에는 「반려 의견이 첫 소비처」로 두었으나, 그 칸은
 * **하나로 승인(선택)과 반려(필수)를 함께 받으므로** 필수 표시를 붙이면 승인에는 거짓말이
 * 된다 — 어느 쪽에 무엇이 필요한지는 도움말과 버튼의 비활성 사유가 말한다.
 * 문자열 라벨에 `*`를 붙이는 길은 접근성 이름이 「이름 *」이 되어 애초에 막혀 있다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label }: FieldLabelProps) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
  </span>
);
