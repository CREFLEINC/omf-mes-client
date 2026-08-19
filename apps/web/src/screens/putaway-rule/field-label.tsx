export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
  /**
   * 필수 표시. **등록·수정 폼이 붙는 이 회차가 첫 소비처다.**
   *
   * 문자열에 `*`를 붙이지 않는다 — 그러면 접근성 이름이 「이름 *」이 되어 라벨 조회가 깨진다.
   * 표시를 `<label>` 밖에 두고 보조기술에서 감춘다.
   */
  required?: boolean;
}

/**
 * 선택칸 위에 서는 라벨. **배치 규범 3을 그대로 구현한다.**
 *
 * 디자인 시스템 `Select`에는 `label` prop이 없다 — 라벨을 직접 만들되 내장 라벨과 같은
 * 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다. 그래야 `TextField`처럼 라벨을 내장한
 * 컨트롤과 한 줄에 서도 라벨 층이 어긋나지 않는다.
 *
 * **필수 표시는 등록·수정 폼이 서면서 더해졌다.** 검증이 필수로 막는 칸에 표시가 없으면
 * 사용자는 저장을 눌러야 그 칸이 필수임을 알게 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label, required = false }: FieldLabelProps) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
    {required && <span aria-hidden="true"> *</span>}
  </span>
);
