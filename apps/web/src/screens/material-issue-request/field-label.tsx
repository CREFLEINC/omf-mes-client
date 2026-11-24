import { InfoTip } from '../../patterns/info-tip';

export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
  required?: boolean;
  /** 칸을 바르게 쓰는 데 필요한 규칙 — 칸 아래에 펴 두지 않고 라벨 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */
  info?: string;
}

/**
 * 디자인 시스템이 `label` prop을 주지 않는 컨트롤(`Select`·`DatePicker`)의 라벨. 배치 규범 3을
 * 그대로 구현한다.
 *
 * 필수 표시는 `<label>` **밖**에 둔다 — 문자열에 `*`를 붙이면 접근 이름이 「이름 *」가 되어
 * 라벨 조회가 깨진다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label, required = false, info }: FieldLabelProps) => {
  const text = (
    <span className="field-label">
      <label htmlFor={htmlFor}>{label}</label>
      {required && (
        <span className="required-mark" aria-hidden="true">
          {' *'}
        </span>
      )}
    </span>
  );

  return info === undefined ? (
    text
  ) : (
    <span className="info-label">
      {text}
      <InfoTip text={info} />
    </span>
  );
};
