import { Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.lotStatusHistory.current.summary;

interface RefreshStatusProps {
  /** 마지막으로 조회가 성공한 때(ms). 아직 없으면 0. */
  updatedAt: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

/**
 * 「마지막 갱신 …」 + [갱신] — 대시보드 조건 줄 오른쪽 묶음과 같은 문구 · 모양이다(사용자 2026-10-30).
 * 대시보드와 달리 자동 갱신은 없다. 안내를 단추에 잇는다(`aria-describedby`).
 */
export const RefreshStatus = ({ updatedAt, isRefreshing, onRefresh }: RefreshStatusProps) => {
  const noteId = useId();
  const at = updatedAt > 0 ? formatPlantDateTime(new Date(updatedAt).toISOString()) : null;

  return (
    <div className="lot-status-refresh">
      {at !== null && (
        <p id={noteId} className="lot-status-refresh-status">
          {t.lastUpdated(at)}
        </p>
      )}
      <Button
        variant="outlined"
        className="lot-status-refresh-button"
        leadingIcon={<Icon name="refresh" size={18} />}
        onClick={onRefresh}
        disabled={isRefreshing}
        loading={isRefreshing}
        aria-describedby={at === null ? undefined : noteId}
      >
        {t.refresh}
      </Button>
    </div>
  );
};
