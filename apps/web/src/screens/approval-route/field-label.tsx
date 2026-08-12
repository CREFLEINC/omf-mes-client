export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
  /**
   * **이 회차에는 넘어오지 않는다.** 읽기 화면에 필수 입력칸이 없다 —
   * 등록 폼이 붙는 회차(PR ③)의 승인 유형 칸이 첫 소비처다.
   */
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
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label, required = false }: FieldLabelProps) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
    {required && <span aria-hidden="true"> *</span>}
  </span>
);
