import { plantShortDateTime } from './plant-time';

/**
 * 좁은 표 칸의 시각 — 날짜 위 · 시각 아래 두 줄(「11-23」 / 「10:05」, 공장 시각). 한 줄로 두면 칸이 넓어지거나 날짜와
 * 시각 사이가 아무 데서나 꺾인다. 입하 등록 · 입하 마감 표의 스캔 시각 · 마감 시각 칸(사용자 지시 2026-11-23).
 */
export const DateTimeLines = ({ iso }: { iso: string | null }) => {
  const [date = '', time = ''] = (iso === null ? '' : plantShortDateTime(iso)).split(' ');

  return (
    <>
      <span>{date}</span>
      <span>{time}</span>
    </>
  );
};
