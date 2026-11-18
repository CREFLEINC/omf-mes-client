import './lot-no-line.css';

export interface LotNoLineProps {
  lotNo: string;
  className?: string;
}

/**
 * 자재 관리 LOT 번호 한 줄 — 넘치면 **가운데**를 줄인다. 끝 두 칸(공급사 · 일련번호)은 늘 보인다.
 *
 * 끝을 자르면 같은 카드의 LOT 을 서로 갈라 주는 일련번호가 먼저 사라진다. 줄인 자리에는 말줄임표가
 * 남아 잘렸다는 것이 보인다(`app/code-wrapping.test.ts` 가 막으려는 「잘린 줄 모르고 읽기」가 아니다).
 * 번호 전체는 화면 낭독기용 글로 한 번 싣고, 보이는 두 조각은 낭독하지 않는다.
 */
export const LotNoLine = ({ lotNo, className }: LotNoLineProps) => {
  const classes = ['lot-no-line', className].filter(Boolean).join(' ');
  const parts = lotNo.split('|');

  if (parts.length <= 2) return <span className={classes}>{lotNo}</span>;

  const tail = `|${parts.slice(-2).join('|')}`;

  return (
    <span className={classes}>
      <span className="lot-no-line__full">{lotNo}</span>
      <span className="lot-no-line__head" aria-hidden="true">
        {lotNo.slice(0, -tail.length)}
      </span>
      <span className="lot-no-line__tail" aria-hidden="true">
        {tail}
      </span>
    </span>
  );
};
