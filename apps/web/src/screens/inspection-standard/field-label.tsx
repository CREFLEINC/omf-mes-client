export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
  required?: boolean;
}

/**
 * 필수 표시가 붙는 입력칸의 라벨. **배치 규범 3을 그대로 구현한다.**
 *
 * 디자인 시스템 `TextField`의 내장 라벨은 `label` prop이 문자열이라 필수 표시를 끼워 넣을
 * 자리가 없고, `Select`에는 `label` prop 자체가 없다. 문자열에 `*`를 붙이면
 * **접근성 이름이 「이름 *」이 되어** 라벨 조회가 깨지므로, 라벨을 직접 만들고 표시는 `<label>` 밖에 둔다.
 * `.field-label`이 내장 라벨과 같은 토큰을 쓰므로 두 방식이 같은 줄에 있어도 라벨 층이 어긋나지 않는다.
 *
 * 표시를 `.field-label` **안**에 두는 이유는 그것이 블록 서식이라
 * 밖에 두면 `*`가 별도 줄로 떨어지기 때문이다.
 *
 * 값을 보여 주기만 하는 자리(버전 번호·상태·승인 여부)는 이 부품을 쓰지 않는다 —
 * 거기에는 가리킬 컨트롤이 없고 `aria-labelledby`로 값과 잇는다.
 */
export const FieldLabel = ({ htmlFor, label, required = false }: FieldLabelProps) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
    {required && <span aria-hidden="true"> *</span>}
  </span>
);
