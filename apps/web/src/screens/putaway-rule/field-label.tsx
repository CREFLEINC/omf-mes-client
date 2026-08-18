export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
}

/**
 * 선택칸 위에 서는 라벨. **배치 규범 3을 그대로 구현한다.**
 *
 * 디자인 시스템 `Select`에는 `label` prop이 없다 — 라벨을 직접 만들되 내장 라벨과 같은
 * 토큰(`.field-label`)을 써 라벨 층 높이를 맞춘다. 그래야 `TextField`처럼 라벨을 내장한
 * 컨트롤과 한 줄에 서도 라벨 층이 어긋나지 않는다.
 *
 * **필수 표시(`required`)를 두지 않는다.** 이 회차에는 입력 폼이 없어 필수 표시가 설 자리가
 * 없다 — 값만 안 넘기고 prop 정의를 남기면 「이 슬라이스에 그 기능이 없다」가 타입 수준의
 * 사실이 되지 못하고 죽은 통로가 다음 사본으로 전파된다(사본 체크리스트 7번).
 * 등록·수정 폼이 붙는 회차가 그때 필요한 형태로 더한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label }: FieldLabelProps) => (
  <span className="field-label">
    <label htmlFor={htmlFor}>{label}</label>
  </span>
);
