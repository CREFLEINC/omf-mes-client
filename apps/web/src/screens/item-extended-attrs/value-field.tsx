import { useId } from 'react';

export interface ValueFieldProps {
  label: string;
  value: string;
}

/**
 * 라벨 + 값 표기. **폼 컨트롤이 아니다.**
 *
 * 배치 규범 3 말미가 정한 형태다(`<span className="field-label" id>` + `<p aria-labelledby>`) —
 * 값을 보여 주기만 하면 되는 자리는 폼 컨트롤을 잠그지 않고 값 표기로 낸다.
 * **비활성 입력칸을 두지 않는다**: 잠긴 입력칸은 「언젠가 열린다」는 뜻이 되는데
 * 이 화면의 원본 열에는 계약에 그 경로가 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ValueField = ({ label, value }: ValueFieldProps) => {
  const labelId = useId();

  return (
    <div className="field-cell">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <p aria-labelledby={labelId}>{value}</p>
    </div>
  );
};
