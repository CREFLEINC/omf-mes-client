export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
}

/**
 * 선택칸 위에 서는 라벨. **배치 규범 3을 그대로 구현한다.**
 *
 * 디자인 시스템 `Select`에는 `label` prop이 없다 — 라벨을 직접 만들되 내장 라벨과 같은
 * 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다. 그래야 라벨을 내장한 컨트롤과 한 줄에
 * 서도 라벨 층이 어긋나지 않는다.
 *
 * ⛔ **필수 표시(`required`)를 두지 않는다.** 형제 사본들이 그 인자를 갖는 이유는 등록·수정
 * 폼이 있어 필수 칸을 표시해야 하기 때문인데, 이 화면은 **조회뿐이고 필수 칸이 없다.**
 * 쓰지 않는 인자를 함께 가져오면 다음 사람이 그것을 근거로 없는 폼을 상상한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label }: FieldLabelProps) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
  </span>
);
