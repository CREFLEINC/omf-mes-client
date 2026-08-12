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
 * **필수 표시를 담지 않는다.** 이 회차의 소비처는 조건 줄의 선택칸뿐이고 그중 필수인 칸이
 * 없다 — 쓰이지 않는 갈래를 미리 만들면 검사되지 않은 채 「이미 되는 것」으로 보인다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label }: FieldLabelProps) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
  </span>
);
