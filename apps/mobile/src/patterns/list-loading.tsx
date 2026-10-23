import { Skeleton } from '@crefle/web-ui';

import './list-loading.css';

/**
 * 목록을 받는 동안 목록 자리에 서는 빈 행들.
 *
 * 받아 둔 목록을 그대로 보이며 새로 받으면 조금 전 수량 · 다른 발주의 행이 잠깐 보였다가 바뀐다 -
 * 그 사이에 누르면 엉뚱한 행을 고른다. 받는 동안은 목록 대신 이것을 보인다(사용자 지시 2026-10-22).
 */
export const ListLoading = ({ label, rows = 6 }: { label: string; rows?: number }) => (
  <div className="list-loading" role="status" aria-label={label}>
    {Array.from({ length: rows }, (_, index) => (
      <Skeleton key={index} variant="rect" className="list-loading__row" />
    ))}
  </div>
);
