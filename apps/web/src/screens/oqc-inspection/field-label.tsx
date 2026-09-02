export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
  required?: boolean;
}

/**
 * 디자인 시스템이 `label` prop 을 주지 않는 컨트롤의 라벨.
 *
 * `Select` 에는 `label` prop 자체가 없다(설치본 실측 — `id` 로 외부 라벨과 잇는다). `aria-label`
 * 만 두면 눈으로 보이는 이름이 없어 무엇을 고르는 칸인지 알 수 없으므로, 라벨을 직접 만들고
 * `htmlFor` 로 잇는다. `.field-label` 이 내장 라벨과 같은 토큰을 쓰므로 두 방식이 같은 줄에
 * 있어도 라벨 층이 어긋나지 않는다.
 *
 * 필수 표시는 `<label>` **밖**에 둔다 — 문자열에 `*` 를 붙이면 접근 이름이 「이름 *」이 되어
 * 라벨 조회가 깨진다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label, required = false }: FieldLabelProps) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
    {required && <span aria-hidden="true"> *</span>}
  </span>
);
