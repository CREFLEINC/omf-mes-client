import { AlertBanner, Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { toApiError } from '../../patterns/request';
import { channelLimitNote } from './channel-notes';
import { ChannelPane } from './channel-pane';
import { EquipmentPane } from './equipment-pane';
import { LoadErrorBanner } from './load-error-banner';
import { defaultChannelFilters, defaultEquipmentFilters } from './options';
import { CHANNEL_PAGE_SIZE, useChannelList, useEquipmentList, usePlantLookup } from './queries';
import type { ChannelFilters, CollectionChannel, Equipment, EquipmentFilters } from './types';

const t = messages.collectionChannel;

const NO_EQUIPMENTS: Equipment[] = [];
const NO_CHANNELS: CollectionChannel[] = [];

/**
 * W-05-07 수집 채널 매핑 관리.
 *
 * ⭐ **왼쪽에서 설비를 고르고 오른쪽에서 그 설비의 채널을 본다.** 채널 목록은 계약이
 * `equipmentId` 를 조건으로 두어 **고르기 전에는 조회 자체가 없다** — 빈 표가 아니라
 * 「설비를 고르세요」가 선다.
 *
 * ⛔ **이 화면은 연동을 만들지 않는다**(스펙 §5-1) — 통신 설정도, 수신 로그 조회·재처리도
 * 여기 있지 않다. 가변부는 채널↔검사 항목 매핑뿐이다.
 */
export const CollectionChannelScreen = () => {
  const [equipmentFilters, setEquipmentFilters] =
    useState<EquipmentFilters>(defaultEquipmentFilters);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [channelFilters, setChannelFilters] = useState<ChannelFilters>(defaultChannelFilters);

  const equipments = useEquipmentList(equipmentFilters);
  const channels = useChannelList(selectedEquipmentId, channelFilters.includeInactive);
  const plantLookup = usePlantLookup();

  const equipmentItems = equipments.data?.items ?? NO_EQUIPMENTS;
  const channelItems = channels.data?.items ?? NO_CHANNELS;

  /*
   * ⭐ **고른 설비를 «지금 목록»에서 찾는다.** 조건을 좁혀 그 설비가 목록 밖으로 나가면
   * 오른쪽도 함께 「고르세요」로 돌아간다 — 목록에 없는 설비의 채널을 계속 보여 주면
   * 왼쪽과 오른쪽이 다른 말을 한다.
   */
  const selectedEquipment =
    equipmentItems.find((item) => item.equipmentId === selectedEquipmentId) ?? null;

  const limitNote =
    selectedEquipment === null
      ? null
      : channelLimitNote(channelItems.length, channels.data?.totalCount ?? null, CHANNEL_PAGE_SIZE);

  /** 선택 목록의 한계. **실패가 잘림보다 앞선다** — 아무것도 못 받은 것이 더 큰 사실이다. */
  const optionsNote = plantLookup.isError
    ? t.optionsLoadFailed
    : plantLookup.truncated
      ? t.optionsTruncated
      : null;

  const equipmentError = equipments.isError ? (
    <LoadErrorBanner
      error={toApiError(equipments.error)}
      onRetry={() => void equipments.refetch()}
    />
  ) : null;

  const channelError = channels.isError ? (
    <LoadErrorBanner error={toApiError(channels.error)} onRetry={() => void channels.refetch()} />
  ) : null;

  return (
    <div className="screen">
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/* 고를 목록이 반쪽이면 없는 공장처럼 보인다 — 감추지 않고 밝힌다. 실패가 잘림보다 앞선다. */}
      {optionsNote !== null && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{optionsNote}</AlertBanner>
        </div>
      )}

      <div className="two-pane">
        <EquipmentPane
          items={equipmentItems}
          isLoading={equipments.isPending}
          total={equipments.data?.page.total ?? null}
          appliedFilters={equipmentFilters}
          onApplyFilters={setEquipmentFilters}
          plantOptions={plantLookup.plants}
          selectedEquipmentId={selectedEquipmentId}
          onSelect={setSelectedEquipmentId}
          loadError={equipmentError}
        />
        <ChannelPane
          equipment={selectedEquipment}
          channels={channelItems}
          isLoading={channels.isPending}
          filters={channelFilters}
          onChangeFilters={setChannelFilters}
          limitNote={limitNote}
          loadError={channelError}
        />
      </div>
    </div>
  );
};
