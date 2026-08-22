import { AlertBanner, Breadcrumb, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { channelLimitNote } from './channel-notes';
import { ChannelFormDialog } from './channel-form-dialog';
import { ChannelPane } from './channel-pane';
import { CHANNEL_FORM_FIELDS, validateChannel } from './channel-validation';
import { EquipmentPane } from './equipment-pane';
import { LoadErrorBanner } from './load-error-banner';
import { emptyFormValues, formValuesFrom, toChannelCreate, toChannelUpdate } from './mappers';
import { defaultChannelFilters, defaultEquipmentFilters } from './options';
import {
  CHANNEL_PAGE_SIZE,
  channelDetailPath,
  channelKeys,
  useChannelDetail,
  useChannelList,
  useEquipmentList,
  usePlantLookup,
  useUomLookup,
} from './queries';
import type {
  ChannelFilters,
  ChannelFormValues,
  CollectionChannel,
  Equipment,
  EquipmentFilters,
} from './types';

const t = messages.collectionChannel;

const NO_EQUIPMENTS: Equipment[] = [];
const NO_CHANNELS: CollectionChannel[] = [];

/**
 * 창이 무엇을 다루는지. 닫혀 있으면 `null`.
 *
 * ⭐ **「수정인데 대상이 없다」를 타입으로 없앤다.** 한 모양으로 두면 그 있을 수 없는 상태를
 * 부르는 자리마다 `?? 0` 같은 **닿지 않는 기본값**으로 막게 되고, 그 값은 틀려도 아무도 모른다.
 */
type DialogState = { mode: 'create' } | { mode: 'edit'; collectionChannelId: number };

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
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [values, setValues] = useState<ChannelFormValues>(emptyFormValues);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const { client } = useApiClient();
  const toast = useToast();

  const equipments = useEquipmentList(equipmentFilters);
  const channels = useChannelList(selectedEquipmentId, channelFilters.includeInactive);
  const plantLookup = usePlantLookup();
  const uomLookup = useUomLookup();

  /* 창을 열 때만 상세를 조회한다 — 목록 응답에는 잠금 토큰이 없다. */
  const editingId = dialog?.mode === 'edit' ? dialog.collectionChannelId : null;
  const detail = useChannelDetail(editingId);

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

  /** 창 안의 선택 목록도 같은 규칙으로 한계를 밝힌다. */
  const unitNote = uomLookup.isError
    ? t.optionsLoadFailed
    : uomLookup.truncated
      ? t.optionsTruncated
      : undefined;

  const isCreate = dialog?.mode === 'create';

  const write = useMasterWrite<ChannelFormValues, CollectionChannel>({
    request: (formValues, headers) => {
      if (isCreate) {
        if (selectedEquipment === null) {
          throw new Error('설비를 고르기 전에는 채널을 등록하지 않습니다.');
        }

        /* 등록에는 낙관적 잠금이 없다 — 계약이 If-Match를 요구하지 않는다. */
        return client.POST('/maintenance/collection-channels', {
          params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
          body: toChannelCreate(formValues, selectedEquipment.equipmentId),
        });
      }

      const current = detail.data;

      if (current === undefined) {
        throw new Error('상세를 받기 전에는 저장하지 않습니다.');
      }

      return client.PUT('/maintenance/collection-channels/{collectionChannelId}', {
        params: {
          path: { collectionChannelId: editingId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toChannelUpdate(formValues, current),
      });
    },
    /* 잠금 토큰은 상세 경로에 보관돼 있다. 등록에는 낙관적 잠금이 없다. */
    etagPath: editingId === null ? null : channelDetailPath(editingId),
    invalidateKeys: [channelKeys.all],
    knownFields: CHANNEL_FORM_FIELDS,
    onSuccess: () => {
      setDialog(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * **끝난 쓰기만 거둔다.** 나가는 중인 요청을 `reset()` 으로 끊으면 그 요청의 되먹임
   * (성공 뒤 창 닫기, 실패 뒤 오류 표시)이 통째로 사라져, 화면은 아무 일도 없었다고 믿고
   * 서버는 이미 처리한 상태가 된다(client#96).
   *
   * ⚠ **jsdom 에서는 이 가드에 닿는 길이 없다** — 쓰기가 나가는 동안 「취소」가 잠기고
   * 스크림은 막혀 있다. **브라우저에서는 Escape 로 닿는다**: native `<dialog>` 의 `cancel` 은
   * 잠글 수 없다. 형제 화면과 같은 모양으로 남겨 둔다.
   */
  const resetIfIdle = (target: { isSaving: boolean; reset: () => void }): void => {
    if (target.isSaving) return;

    target.reset();
  };

  /**
   * 창을 떠난다.
   *
   * ⭐ **거두는 자리를 하나로 둔다** — 여는 쪽과 닫는 쪽 둘 다에서 거두면, 한쪽을 고쳐도
   * 다른 쪽이 덮어 주어 **고장이 드러나지 않는다.** 여는 쪽은 값을 세우는 일만 한다.
   */
  const closeDialog = (): void => {
    resetIfIdle(write);
    setLocalErrors({});
    setDialog(null);
  };

  const openCreate = (): void => {
    setValues(emptyFormValues());
    setDialog({ mode: 'create' });
  };

  /**
   * 목록 행으로 폼을 채운다.
   *
   * ⭐ **행이 가진 값으로 먼저 그린다** — 상세를 기다리는 동안 빈 창을 보이면 사용자가
   * 값이 사라진 줄 안다. 상세는 잠금 토큰을 가져오는 것이 일이고, 그것은 저장할 때 쓴다.
   */
  const openEdit = (channel: CollectionChannel): void => {
    setValues(formValuesFrom(channel));
    setDialog({ mode: 'edit', collectionChannelId: channel.collectionChannelId });
  };

  const submit = (): void => {
    const errors = validateChannel(values);

    setLocalErrors(errors);

    if (Object.keys(errors).length > 0) return;

    write.write(values);
  };

  /**
   * 인라인 오류 두 갈래를 겹친다 — **서버 것이 화면 것을 덮는다**(더 최근 판정이다).
   *
   * ⚠ **지금 흐름에서는 둘이 같은 칸에 동시에 서지 않는다** — 화면 검증이 걸리면 쓰기가
   * 나가지 않고, 쓰기가 나갔다는 것은 화면 검증이 비었다는 뜻이다. 그래서 겹치는 차례를
   * 뒤집어도 지금은 결과가 같다. 그럼에도 이 차례로 두는 것은 **검증을 건너뛰는 갈래가
   * 생겼을 때 어느 쪽이 이겨야 하는지**를 여기서 정해 두기 위해서다.
   */
  const fieldErrors = { ...localErrors, ...write.fieldErrors };

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
          onAdd={openCreate}
          onEdit={openEdit}
          loadError={channelError}
        />
      </div>

      {dialog !== null && selectedEquipment !== null && (
        <ChannelFormDialog
          mode={dialog.mode}
          equipmentLabel={t.form.equipmentFixed(
            selectedEquipment.equipmentCode,
            selectedEquipment.equipmentName,
          )}
          values={values}
          onChange={(patch) => {
            setValues((prev) => ({ ...prev, ...patch }));

            /* 고치는 즉시 그 칸의 오류를 거둔다 — 고친 자리에 옛 오류가 남으면 헛돈다. */
            for (const field of Object.keys(patch)) {
              setLocalErrors((prev) => {
                const { [field]: _removed, ...rest } = prev;

                return rest;
              });
              write.clearFieldError(field);
            }
          }}
          fieldErrors={fieldErrors}
          banner={
            <SaveErrorBanner
              error={write.error}
              /* 충돌은 다시 불러와야 풀린다 — 등록에는 불러올 잠금 토큰 자체가 없다. */
              onReload={editingId === null ? undefined : () => void detail.refetch()}
            />
          }
          unitOptions={uomLookup.uoms}
          optionsNote={unitNote}
          isSaving={write.isSaving}
          onClose={closeDialog}
          onSave={submit}
        />
      )}
    </div>
  );
};
