export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
  /** 라벨 오른쪽 같은 줄의 짧은 안내. 칸이 `aria-describedby` 로 이 id 를 잇는다. */
  hint?: { id: string; text: string };
  /** 입고 처리에 꼭 필요한 칸 — 라벨 뒤에 `*` 를 단다(스크린리더는 칸의 `aria-required` 로 읽는다). */
  required?: boolean;
}

/**
 * 디자인 시스템이 `label` prop을 주지 않는 컨트롤의 라벨. **배치 규범 3을 그대로 구현한다.**
 *
 * `Select`에는 `label` prop 자체가 없다(설치본 실측). `aria-label`만 두면 눈으로 보이는 이름이
 * 없어 무엇을 고르는 칸인지 알 수 없으므로, 라벨을 직접 만들고 `htmlFor`로 잇는다.
 * `.field-label`이 내장 라벨과 같은 토큰을 쓰므로 두 방식이 같은 줄에 있어도 라벨 층이 어긋나지 않는다.
 *
 * 필수 표시(`*`)는 입고 처리 폼의 필수 칸에만 붙인다 — 기준은 `validation.ts` 의 입고 처리 조건이다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label, hint, required = false }: FieldLabelProps) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
    {required && (
      <span className="goods-receipt-required" aria-hidden="true">
        *
      </span>
    )}
    {hint !== undefined && (
      <span id={hint.id} className="goods-receipt-label-hint">
        {hint.text}
      </span>
    )}
  </span>
);
