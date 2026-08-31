export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
}

/**
 * 디자인 시스템이 `label` prop을 주지 않는 컨트롤의 라벨. **배치 규범 3을 그대로 구현한다.**
 *
 * `Select`에는 `label` prop 자체가 없다. `aria-label`만 두면 눈으로 보이는 이름이 없어
 * 무엇을 고르는 칸인지 알 수 없으므로, 라벨을 직접 만들고 `htmlFor`로 잇는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label }: FieldLabelProps) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
  </span>
);
