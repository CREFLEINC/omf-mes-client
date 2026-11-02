import { Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.inspectionResultInsights.overview;
const KEY = ['inspection-result-insights'] as const;

/**
 * 「마지막 갱신 …」 + [갱신] — 대시보드 조건 줄 오른쪽 묶음과 같은 문구 · 모양이다(사용자 2026-10-30 · #217).
 * 대시보드와 달리 자동 갱신은 없다. 누르면 이 화면이 지금 띄운 조회(요약 · 추이 · 분포 · 목록 · 판정 칩 건수)를 모두 다시 부른다.
 * 「마지막 갱신」은 검사 결과 목록 조회가 성공한 때다.
 */
export const RefreshStatus = ({ updatedAt }: { updatedAt: number }) => {
  const queryClient = useQueryClient();
  const isRefreshing = useIsFetching({ queryKey: KEY }) > 0;
  const noteId = useId();
  const at = updatedAt > 0 ? formatPlantDateTime(new Date(updatedAt).toISOString()) : null;

  return (
    <div className="inspection-results-refresh">
      {at !== null && (
        <p id={noteId} className="inspection-results-refresh-status">
          {t.lastUpdated(at)}
        </p>
      )}
      <Button
        variant="outlined"
        className="inspection-results-refresh-button"
        leadingIcon={<Icon name="refresh" size={18} />}
        onClick={() => void queryClient.refetchQueries({ queryKey: KEY, type: 'active' })}
        disabled={isRefreshing}
        loading={isRefreshing}
        aria-describedby={at === null ? undefined : noteId}
      >
        {t.refresh}
      </Button>
    </div>
  );
};
