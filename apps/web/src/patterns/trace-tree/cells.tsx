import { plantToday, toPlantDateTimeParts } from '../plant-time';

/** 추적 두 화면의 칸 그리기 — LOT 번호, 상태 칩 색, 짧은 일시. */

/**
 * LOT 번호 — 한 줄. 칸이 모자라면 앞쪽만 줄이고 끝 마디(일련번호)는 남긴다. 같은 품목, 같은 날 LOT 은 끝 마디만
 * 달라 끝이 잘리면 줄끼리 구분이 안 된다(LOT 생산 이력 조회·검사 조회와 같다). 전체 번호는 마우스를 올리면 보인다.
 */
export const TraceLotNo = ({ lotNo }: { lotNo: string }) => {
  /* 구분자가 없는 번호(생산 LOT)는 끝 8자를 남긴다 — 같은 날 LOT 은 앞이 같고 끝이 다르다. */
  const cut = lotNo.includes('|') ? lotNo.lastIndexOf('|') + 1 : Math.max(0, lotNo.length - 8);
  return (
    <span className="trace-tree-lot mono-cell" title={lotNo}>
      {cut > 0 && cut < lotNo.length ? (
        <>
          <span className="trace-tree-lot-head">{lotNo.slice(0, cut)}</span>
          <span className="trace-tree-lot-tail">{lotNo.slice(cut)}</span>
        </>
      ) : (
        lotNo
      )}
    </span>
  );
};

/**
 * LOT 번호와 그 아래 보조 줄(들어온 번호 · 품목 · 상대) — 목록과 최종 LOT 표의 첫 칸(시안 2판).
 * LOT 번호는 이 화면의 대조 값이라 줄이지 않고 칸 폭에서 접어 끝까지 보인다(C-10 · C-16 이탈, 화면 머리주석).
 */
export const TraceLotCell = ({
  lotNo,
  sub,
  subTitle,
  source = null,
}: {
  lotNo: string;
  sub: string;
  subTitle?: string;
  source?: string | null;
}) => (
  <span className="trace-tree-lot-cell">
    <span className="trace-tree-lot-full mono-cell">{lotNo}</span>
    {(source !== null || sub !== '') && (
      <span className="trace-tree-lot-sub" title={subTitle ?? sub}>
        {source !== null && <span className="trace-tree-source">{source}</span>}
        {sub}
      </span>
    )}
  </span>
);

/** LOT 상태 칩 색 — LOT 상태 조회와 같다(정상 초록, 검사 대기 노랑, 불량 빨강, 그 밖 회색). */
export const lotStatusTone = (statusCode: string): 'success' | 'warning' | 'error' | 'idle' => {
  if (statusCode === 'NORMAL') return 'success';
  if (statusCode === 'INSPECTION_PENDING' || statusCode === 'HOLD') return 'warning';
  if (statusCode === 'DEFECTIVE' || statusCode === 'SCRAPPED') return 'error';
  return 'idle';
};

/**
 * 짧은 일시(공장 시각) — 올해면 해를 빼고 「MM-DD HH:mm」, 다른 해면 「YYYY-MM-DD」. `dateOnly` 면 날짜만.
 * 날짜만 있는 값(`YYYY-MM-DD`)은 그대로 해만 줄인다. 읽을 수 없는 값은 받은 글자 그대로.
 */
export const shortDateTime = (
  value: string | null,
  dateOnly = false,
  today = plantToday(),
): string => {
  if (value === null) return '';
  const parts = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? { date: value, time: '' }
    : toPlantDateTimeParts(value);
  if (parts === null) return value;
  const thisYear = parts.date.slice(0, 4) === today.slice(0, 4);
  if (!thisYear) return parts.date;
  const date = parts.date.slice(5);
  return dateOnly || parts.time === '' ? date : `${date} ${parts.time}`;
};
