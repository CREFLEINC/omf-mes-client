import {
  AlertBanner,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { countUnmapped, isUnmapped, unmappedScopeNote, visibleChannels } from './channel-notes';
import { withInactiveSuffix } from './options';
import type { ChannelFilters, CollectionChannel, Equipment } from './types';

const t = messages.collectionChannel;

export interface ChannelPaneProps {
  /** 고른 설비. 고르기 전에는 null이고 그때는 조회 자체가 없다 */
  equipment: Equipment | null;
  /** 서버가 준 채널 — 조건을 걸기 «전»이다. 미매핑 건수는 이것으로 센다 */
  channels: CollectionChannel[];
  isLoading: boolean;
  filters: ChannelFilters;
  onChangeFilters: (next: ChannelFilters) => void;
  /** 목록이 전부인지 아닌지 한 줄. null이면 다 보이고 있다 */
  limitNote: string | null;
  loadError: ReactNode;
}

/**
 * 대상 검사 항목 칸.
 *
 * ⭐ **두 값이 뜻이 다르다** — 「미매핑」은 **값이 버려진다**는 뜻이고 「연결됨」은 정상이다.
 * 그래서 앞엣것만 경고 표식을 단다. ⛔ 「연결됨」에 항목 이름을 지어 붙이지 않는다 —
 * 계약이 이름을 내려주지 않는다(표 위 안내가 그 사실을 말한다).
 */
const mappingCell = (row: CollectionChannel): ReactNode =>
  isUnmapped(row) ? (
    <Chip variant="status" status="warning">
      {t.mapping.unmapped}
    </Chip>
  ) : (
    t.mapping.mapped
  );

/** 값이 오지 않은 칸을 빈 칸으로 두지 않는다 — 없는 것인지 못 받은 것인지 구별이 안 된다. */
const orNotRecorded = (value: string | undefined): string =>
  value === undefined || value === '' ? t.fields.notRecorded : value;

export const ChannelPane = ({
  equipment,
  channels,
  isLoading,
  filters,
  onChangeFilters,
  limitNote,
  loadError,
}: ChannelPaneProps) => {
  const columns: Column<CollectionChannel>[] = [
    {
      key: 'channelKey',
      header: t.fields.channelKey,
      width: '180px',
      /* 설비가 정한 이름이다 — 화면이 다듬지 않고 온 그대로 세운다. */
      render: (row) => withInactiveSuffix(row.channelKey, row.isActive),
    },
    {
      key: 'signalName',
      header: t.fields.signalName,
      render: (row) => orNotRecorded(row.signalName),
    },
    {
      key: 'unitCode',
      header: t.fields.unit,
      width: '92px',
      render: (row) => orNotRecorded(row.unitCode),
    },
    {
      key: 'inspectionItemId',
      header: t.fields.inspectionItem,
      width: '132px',
      render: mappingCell,
    },
  ];

  /* 고르기 전에는 빈 표가 아니라 무엇을 해야 하는지 말한다. */
  if (equipment === null) {
    return (
      <section className="pane" aria-label={t.channels.paneTitle}>
        <EmptyState
          size="sm"
          live
          title={t.channels.noEquipmentTitle}
          description={t.channels.noEquipmentDescription}
        />
      </section>
    );
  }

  const rows = visibleChannels(channels, filters);
  /*
   * ⭐ **설명할 것이 보일 때만 설명한다.** 「미매핑만 보기」를 켜면 표에 「연결됨」이 한 줄도
   * 없는데, 그 자리에서 「연결된 항목의 이름은 오지 않습니다」를 읽으면 무엇을 두고 하는
   * 말인지 알 수 없다 — 브라우저 확인에서 실제로 그렇게 보였다.
   */
  const hasMappedRow = rows.some((row) => !isUnmapped(row));
  /*
   * ⭐ **거르기 «전»의 목록으로 센다.** 지금은 미매핑만 보기가 켜져도 걸러 남는 것이 정확히
   * 미매핑이라 결과가 같지만(관찰상 동치), 그것은 우연이다 — 거르는 축이 하나라도 늘면
   * 「미매핑 5개」가 조건에 따라 3개로 줄어드는 요약이 된다. 요약은 **서버가 준 것**을 말한다.
   */
  const unmappedCount = countUnmapped(channels);
  const scopeNote = unmappedScopeNote(filters.unmappedOnly, limitNote);

  const emptySlot = filters.unmappedOnly ? (
    <EmptyState
      size="sm"
      live
      title={t.channels.noMatchTitle}
      description={t.channels.noMatchDescription}
    />
  ) : (
    <EmptyState
      size="sm"
      live
      title={t.channels.emptyTitle}
      description={t.channels.emptyDescription}
    />
  );

  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.channels.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.collectionChannelId)}
        empty={emptySlot}
      />
    );
  };

  return (
    <section className="pane" aria-label={t.channels.paneTitle}>
      <h3>{t.channels.paneOf(equipment.equipmentCode, equipment.equipmentName)}</h3>

      <div className="filter-bar">
        <div className="field-cell field-cell-unlabeled">
          <div className="check-group">
            <Checkbox
              checked={filters.unmappedOnly}
              onChange={(event) =>
                onChangeFilters({ ...filters, unmappedOnly: event.target.checked })
              }
            >
              {t.channels.unmappedOnly}
            </Checkbox>
            <Checkbox
              checked={filters.includeInactive}
              onChange={(event) =>
                onChangeFilters({ ...filters, includeInactive: event.target.checked })
              }
            >
              {messages.common.includeInactive}
            </Checkbox>
          </div>
        </div>
      </div>

      {/*
       * ⭐ **버려진다는 사실을 건수와 함께 먼저 말한다**(스펙 §9-2). 표 아래에 두면
       * 다 읽고 난 뒤에야 「그런데 이것들은 버려집니다」가 오고, 그때는 이미 늦다.
       *
       * ⛔ **조회가 실패한 자리에는 세우지 않는다.** 다시 불러오기가 실패해도 앞서 받은
       * 목록은 캐시에 남아 건수가 계속 나온다 — 표는 오류 배너로 바뀌었는데 「미매핑 2개」만
       * 남으면 **보이지 않는 줄을 두고 하는 말**이 된다. 로딩 가드는 두지 않았다: 받은 것이
       * 없으면 건수가 0이라 조건이 이미 막는다.
       */}
      {loadError === null && unmappedCount > 0 && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.channels.unmappedSummaryTitle}>
            {t.channels.unmappedSummary(unmappedCount)}
          </AlertBanner>
        </div>
      )}

      {limitNote !== null && (
        <p className="field-note" role="status">
          {limitNote}
        </p>
      )}
      {scopeNote !== null && (
        <p className="field-note" role="status">
          {scopeNote}
        </p>
      )}
      {hasMappedRow && <p className="field-note">{t.mapping.nameUnavailable}</p>}

      {listSlot()}
    </section>
  );
};
