import { InfoTip } from '../../patterns/info-tip';

export interface FieldLabelProps {
  /** 이 라벨이 가리키는 컨트롤의 id */
  htmlFor: string;
  label: string;
  /** 라벨 오른쪽 같은 줄의 짧은 안내(작은 보조 글자). */
  hint?: string;
  /** 라벨 옆 ⓘ 에 띄울 규칙 — 라벨 오른쪽에 글자로 늘 펼쳐 두지 않는다(관리웹 정리 시안 A). */
  info?: string;
}

/**
 * 디자인 시스템이 `label` prop을 주지 않는 컨트롤(`Select`)의 라벨. 배치 규범 3을 그대로 구현한다.
 *
 * **필수 표시를 두지 않는다** — 이 화면의 선택칸은 전부 선택 조건이다(출하일 시작만 필수이고
 * 그건 `TextField`가 별도로 표시한다).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FieldLabel = ({ htmlFor, label, hint, info }: FieldLabelProps) => {
  const fieldLabel = (
    <span className="field-label">
      <label htmlFor={htmlFor}>{label}</label>
      {hint !== undefined && <span className="terminal-map-label-hint">{hint}</span>}
    </span>
  );

  if (info === undefined) return fieldLabel;

  /* 공용 `InfoLabel` 과 같은 짜임. */
  return (
    <span className="info-label">
      {fieldLabel}
      <InfoTip text={info} />
    </span>
  );
};
