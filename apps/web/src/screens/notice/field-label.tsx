import { InfoTip } from '../../patterns/info-tip';

export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
  /** 칸을 바르게 쓰려면 알아 둘 규칙. 있으면 라벨 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */
  info?: string;
  /** 빨간 필수 표시(`required-mark`) — `<label>` 밖이라 접근 이름은 그대로다. */
  required?: boolean;
}

/**
 * 디자인 시스템이 `label` prop을 주지 않는 컨트롤(`Select`)의 라벨. 배치 규범 3을 그대로 구현한다.
 *
 * 필수 칸(등록·수정 폼)은 `required` 로 빨간 * 를 `<label>` 밖에 붙인다 — 접근 이름은 그대로다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label, info, required = false }: FieldLabelProps) => {
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

  if (info === undefined) return text;

  return (
    <span className="info-label">
      {text}
      <InfoTip text={info} />
    </span>
  );
};
