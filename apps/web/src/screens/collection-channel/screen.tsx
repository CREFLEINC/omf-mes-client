import { AlertBanner, Breadcrumb, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest, toApiError } from '../../patterns/request';
import { channelLimitNote } from './channel-notes';
import { ChannelFormDialog } from './channel-form-dialog';
import { ChannelPane } from './channel-pane';
import { CHANNEL_FORM_FIELDS, validateChannel } from './channel-validation';
import { EquipmentPane } from './equipment-pane';
import { LoadErrorBanner } from './load-error-banner';
import { ImportDialog } from './import-dialog';
import { emptyFormValues, formValuesFrom, toChannelCreate, toChannelUpdate } from './mappers';
import {
  retainSelectable,
  summarize,
  toggleSelected,
  type ImportOutcome,
  type ImportSummary,
} from './observation';
import { defaultChannelFilters, defaultEquipmentFilters } from './options';
import {
  CHANNEL_PAGE_SIZE,
  channelDetailPath,
  channelKeys,
  useChannelDetail,
  useChannelList,
  useEquipmentList,
  useInspectionItemSpecs,
  useInspectionPlans,
  useInspectionPlanVersions,
  observationKeys,
  useObservations,
  usePlantLookup,
  useUomCodeById,
  useUomLookup,
} from './queries';
import type {
  ChannelFilters,
  ChannelFormValues,
  CollectionChannel,
  CollectionChannelObservation,
  Equipment,
  EquipmentFilters,
  ItemPickerPath,
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
 * 창을 열 때마다 **처음부터 좁힌다.**
 *
 * ⛔ 길을 남기면 앞 채널을 잇던 기준·버전이 다음 창에 그대로 보인다. 고른 항목 자체는
 * 채널마다 따로라 섞이지 않지만, **화면에 보이는 길이 이 채널의 것이라고 읽힌다** — 이 창은
 * 바로 위에서 「어느 항목인지 확인할 수 없습니다」라고 말해 놓고 그 아래에 엉뚱한 길을
 * 펼쳐 두는 셈이 된다. 여러 채널을 같은 기준에 잇는 수고를 덜자고 그 오독을 살 수는 없다.
 */
const NO_PICKER_PATH: ItemPickerPath = {
  inspectionPlanId: null,
  inspectionPlanVersionId: null,
};

const NO_OBSERVATIONS: CollectionChannelObservation[] = [];
const NO_SELECTION: string[] = [];

/**
 * 고른 신호를 채널로 만든다 — **한 건씩.**
 *
 * ⛔ **계약에 일괄 등록이 없다.** 그래서 「다 됐다 / 다 안 됐다」가 아니라 **일부만 되는 것이
 * 정상**이고, 화면은 그것을 뭉개지 않는다.
 *
 * ⭐ **한 건이 실패해도 멈추지 않는다** — 첫 실패에서 멈추면 뒤에 고른 것들이 왜 안 됐는지
 * 알 수 없고, 다시 시도할 때 무엇이 이미 만들어졌는지도 알 수 없다.
 *
 * ⭐ **건마다 새 멱등 키를 준다** — 서로 다른 쓰기다. 하나로 돌려 쓰면 두 번째부터
 * 서버가 첫 응답을 되돌려 주어 **만들어지지 않았는데 만들어진 것처럼 보인다.**
 */
const useObservationImport = (equipmentId: number | null) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelKeys: readonly string[]): Promise<ImportOutcome[]> => {
      if (equipmentId === null) {
        throw new Error('설비를 고르기 전에는 채널을 만들지 않습니다.');
      }

      const outcomes: ImportOutcome[] = [];

      for (const channelKey of channelKeys) {
        try {
          await runRequest(() =>
            client.POST('/maintenance/collection-channels', {
              params: { header: { 'Idempotency-Key': crypto.randomUUID() } },
              body: { equipmentId, channelKey },
            }),
          );
          outcomes.push({ channelKey, reason: null });
        } catch (caught) {
          outcomes.push({ channelKey, reason: reasonOf(caught) });
        }
      }

      return outcomes;
    },
    onSettled: () => {
      /* 한 건이라도 만들어졌으면 목록이 낡았다 — 되든 안 되든 다시 받는다. */
      void queryClient.invalidateQueries({ queryKey: channelKeys.all });
      void queryClient.invalidateQueries({ queryKey: observationKeys.all });
    },
  });
};

/**
 * 실패 한 건의 사유를 사람이 읽는 한 줄로.
 *
 * ⛔ **삼키지 않는다** — 서버가 준 문구가 「무엇을 고쳐야 하는지」의 유일한 단서다.
 * 얻지 못하면 `null` 을 돌려 「알 수 없는 이유」로 그리게 한다(지어내지 않는다).
 */
const reasonOf = (caught: unknown): string | null => {
  const error = toApiError(caught);

  if (error.kind === 'validation' || error.kind === 'stateLocked') {
    const line = error.errors.map((item) => item.message).find((message) => message.trim() !== '');

    return line ?? null;
  }

  return error.kind === 'network' ? messages.httpError.offline : null;
};

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
  const [pickerPath, setPickerPath] = useState<ItemPickerPath>(NO_PICKER_PATH);
  /** 수신 로그 창이 떠 있는가 */
  const [importing, setImporting] = useState(false);
  const [importUnmappedOnly, setImportUnmappedOnly] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>(NO_SELECTION);
  /** 보낸 결과. 아직 안 보냈으면 `null` */
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const { client } = useApiClient();
  const toast = useToast();

  const equipments = useEquipmentList(equipmentFilters);
  const channels = useChannelList(selectedEquipmentId, channelFilters.includeInactive);
  const plantLookup = usePlantLookup();
  const uomLookup = useUomLookup();

  /* 창을 열 때만 상세를 조회한다 — 목록 응답에는 잠금 토큰이 없다. */
  const editingId = dialog?.mode === 'edit' ? dialog.collectionChannelId : null;
  const detail = useChannelDetail(editingId);

  /*
   * ⭐ **검사 항목을 찾아가는 세 조회는 창이 열렸을 때만 돈다.** 목록만 보는 사람에게는
   * 쓸 일이 없는 자료라, 화면을 열자마자 부르면 아무도 안 볼 것을 세 번 받아 온다.
   */
  const plans = useInspectionPlans(dialog !== null);
  const versions = useInspectionPlanVersions(pickerPath.inspectionPlanId);
  const specs = useInspectionItemSpecs(pickerPath.inspectionPlanVersionId);
  const uomCodeById = useUomCodeById();

  /*
   * ⭐ **가져오기 단추의 활성 여부가 이 조회에 달려 있다** — 「받은 기록이 있는가」를
   * 알아야 잠글지 열지 정한다. 그래서 창을 열기 전에 미리 한 번 받아 둔다.
   *
   * 창 안의 조건(`아직 잇지 않은 것만`)은 **서버가 거른다** — 화면이 받아 온 것만 거르면
   * 목록이 잘렸을 때 조건이 반쪽이 된다.
   */
  const anyObservations = useObservations(selectedEquipmentId, false);
  /*
   * ⛔ **창이 열렸을 때만 돈다.** 창 밖에서도 돌게 두면 설비를 고를 때마다 수신 조회가
   * «두 번» 나간다 — 하나는 단추를 열지 말지 정하려는 것이고, 하나는 아무도 안 볼 목록이다.
   */
  const shownObservations = useObservations(
    importing ? selectedEquipmentId : null,
    importUnmappedOnly,
  );

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
    setPickerPath(NO_PICKER_PATH);
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
    /*
     * ⛔ **이어 둔 항목이 어느 기준·버전의 것인지 되찾을 길이 없다**(계약에 단건 조회가
     * 없다). 그래서 길은 늘 비어서 시작하고, 창이 그 사실을 문면으로 말한다.
     */
    setPickerPath(NO_PICKER_PATH);
    setDialog({ mode: 'edit', collectionChannelId: channel.collectionChannelId });
  };

  /**
   * ⭐ **위 칸을 바꾸면 아래 칸이 함께 풀린다.** 기준을 바꿨는데 앞 기준에서 고른 버전이
   * 남아 있으면, 화면은 새 기준을 보이면서 **옛 기준의 항목을 이어 두게 된다.**
   */
  const changePlan = (inspectionPlanId: number | null): void => {
    setPickerPath({ inspectionPlanId, inspectionPlanVersionId: null });
  };

  const changeVersion = (inspectionPlanVersionId: number | null): void => {
    setPickerPath((prev) => ({ ...prev, inspectionPlanVersionId }));
  };

  const importWrite = useObservationImport(selectedEquipmentId);

  const observationItems = shownObservations.data?.items ?? NO_OBSERVATIONS;

  /**
   * ⭐ **목록이 바뀌면 고른 것에서 고를 수 없게 된 것을 거둔다.** 조건을 껐다 켜는 사이에
   * 사라진 신호를 그대로 들고 있으면 **화면에 보이지 않는 것이 저장 대상에 남는다.**
   */
  const selected = retainSelectable(selectedKeys, observationItems);

  const openImport = (): void => {
    setImportUnmappedOnly(true);
    setSelectedKeys(NO_SELECTION);
    setImportSummary(null);
    setImporting(true);
  };

  const runImport = (): void => {
    setImportSummary(null);
    importWrite.mutate(selected, {
      onSuccess: (outcomes) => {
        const summary = summarize(outcomes);

        setImportSummary(summary);
        /*
         * ⭐ **실패한 것만 골라 둔 채로 남긴다.** 성공한 것을 그대로 두면 다시 눌렀을 때
         * 같은 채널을 또 만들려 하고, 서버는 유일 위반으로 되받는다.
         */
        setSelectedKeys(summary.failed.map((outcome) => outcome.channelKey));
      },
    });
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
          canImport={(anyObservations.data?.items.length ?? 0) > 0}
          onImport={openImport}
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
          inspectionPlanId={pickerPath.inspectionPlanId}
          onChangePlan={changePlan}
          inspectionPlanVersionId={pickerPath.inspectionPlanVersionId}
          onChangeVersion={changeVersion}
          plans={plans}
          versions={versions}
          specs={specs}
          uomCodeById={uomCodeById}
          onClose={closeDialog}
          onSave={submit}
        />
      )}

      {importing && (
        <ImportDialog
          observations={observationItems}
          isLoading={shownObservations.isPending}
          isError={shownObservations.isError}
          unmappedOnly={importUnmappedOnly}
          onChangeUnmappedOnly={setImportUnmappedOnly}
          selected={selected}
          onToggle={(observation) => setSelectedKeys((prev) => toggleSelected(prev, observation))}
          summary={importSummary}
          isSaving={importWrite.isPending}
          onClose={() => {
            /* 나가는 중인 쓰기는 끊지 않는다 — 되먹임이 통째로 사라진다(client#96). */
            if (importWrite.isPending) return;

            setImporting(false);
          }}
          onImport={runImport}
        />
      )}
    </div>
  );
};
