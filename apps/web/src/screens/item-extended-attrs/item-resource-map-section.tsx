import { AlertBanner, useToast } from '@crefle/web-ui';
import type { ItemResourceMap, ItemResourceMapUpdate } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import {
  createItemResourceMapFormValues,
  ITEM_RESOURCE_MAP_FORM_FIELDS,
  toItemResourceMapCreate,
  toItemResourceMapFormValues,
  toItemResourceMapUpdate,
  type ItemResourceMapFormValues,
} from './item-resource-map-draft';
import { ItemResourceMapFormDialog } from './item-resource-map-form-dialog';
import { ItemResourceMapPane } from './item-resource-map-pane';
import {
  restateItemResourceMapApiError,
  restateItemResourceMapError,
} from './item-resource-map-validation';
import { LoadErrorBanner } from './load-error-banner';
import { usePlantOptions, useProcessOptions, type LookupResult } from './lookups';
import { lookupLabel, selectableOptions } from './options';
import { subsidiaryKeys, useItemResourceMaps } from './subsidiary-queries';

const t = messages.itemExtendedAttrs;

/** 설비·금형 매핑 저장 한 번이 들고 가는 것. 고치는 줄이 없으면 등록이다. */
interface ItemResourceMapWriteVariables {
  row: ItemResourceMap | null;
  values: ItemResourceMapFormValues;
  plantId: number;
  itemId: number;
}

/** 표의 줄 작업(기본 지정·사용 중지·다시 사용). 바꾸는 칸만 싣는다 — 나머지는 서버가 유지한다. */
interface ItemResourceMapRowActionVariables {
  row: ItemResourceMap;
  body: ItemResourceMapUpdate;
}

/** 선택 목록이 실패했거나 잘렸다는 사실을 감추지 않는다 — 이름이 이유 없이 비어 보인다. */
const optionsNoticeOf = (lookups: LookupResult[]): ReactNode => {
  const text = lookups.some((lookup) => lookup.isError)
    ? t.optionsLoadFailed
    : lookups.some((lookup) => lookup.truncated)
      ? t.optionsTruncated
      : null;

  return text === null ? null : (
    <div className="banner-slot">
      <AlertBanner variant="warning">{text}</AlertBanner>
    </div>
  );
};

export interface ItemResourceMapSectionProps {
  itemId: number;
}

/**
 * 부속 정보의 「설비·금형」 하위 탭 전체 — 공장 선택, 목록, 줄 작업, 편집 창.
 *
 * 다른 부속 하위 탭과 달리 **되감길 초안이 없어** 상태를 화면이 아니라 이 부품이 갖는다.
 * 부르는 쪽이 품목 번호를 `key`로 주면 품목이 바뀔 때 창·오류·공장 선택이 함께 비워진다.
 */
export const ItemResourceMapSection = ({ itemId }: ItemResourceMapSectionProps) => {
  const { client } = useApiClient();
  const toast = useToast();

  const plantOptions = usePlantOptions(true);

  /**
   * 고른 공장. 품목은 공장에 매이지 않아 화면이 따로 고른다.
   * 고르지 않았으면 **사용 중인 첫 공장**으로 본다 — 공장이 하나뿐인 현장에서 매번 고르게 하지 않는다.
   */
  const [chosenPlantId, setChosenPlantId] = useState('');
  const plantId =
    chosenPlantId !== ''
      ? chosenPlantId
      : (plantOptions.entries.find((entry) => entry.isActive)?.value ?? '');
  const plantNumber = plantId === '' ? null : Number(plantId);

  const list = useItemResourceMaps(itemId, plantNumber, true);
  const rows = list.data?.items ?? [];

  /** 열려 있는 편집 창. `row`가 `null`이면 등록 창이다. */
  const [editing, setEditing] = useState<{ row: ItemResourceMap | null } | null>(null);

  /* 공정 선택지는 창을 열 때만 받는다. 설비·금형은 창 안의 찾기 창이 서버에서 찾는다. */
  const processOptions = useProcessOptions(editing !== null);

  /* 기본을 세우면 서버가 다른 줄의 기본을 내리므로 목록 전체를 다시 받는다. */
  const invalidateKeys = [subsidiaryKeys.itemResourceMapsOfItem(itemId)];

  const formWrite = useMasterWrite<ItemResourceMapWriteVariables, ItemResourceMap>({
    request: ({ row, values, plantId: targetPlantId, itemId: targetItemId }, headers) =>
      row === null
        ? client.POST('/mdm/item-resource-maps', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toItemResourceMapCreate(values, targetPlantId, targetItemId),
          })
        : client.PUT('/mdm/item-resource-maps/{itemResourceMapId}', {
            params: {
              path: { itemResourceMapId: row.itemResourceMapId },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                /* 목록이 줄마다 `versionNo`를 준다 — 창을 연 시점의 판으로 잠근다. */
                'If-Match': String(row.versionNo),
              },
            },
            body: toItemResourceMapUpdate(values),
          }),
    /* 토큰 보관소를 쓰지 않는다 — 목록 조회에 `ETag`가 없고 줄의 `versionNo`가 토큰이다. */
    etagPath: null,
    invalidateKeys,
    knownFields: ITEM_RESOURCE_MAP_FORM_FIELDS,
    restateFieldError: restateItemResourceMapError,
    onSuccess: () => {
      setEditing(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const rowWrite = useMasterWrite<ItemResourceMapRowActionVariables, ItemResourceMap>({
    request: ({ row, body }, headers) =>
      client.PUT('/mdm/item-resource-maps/{itemResourceMapId}', {
        params: {
          path: { itemResourceMapId: row.itemResourceMapId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': String(row.versionNo),
          },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys,
    // 대응하는 입력칸이 없다 — 필드 오류도 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const openDialog = (row: ItemResourceMap | null) => {
    formWrite.reset();
    setEditing({ row });
  };

  const closeDialog = () => {
    formWrite.reset();
    setEditing(null);
  };

  return (
    <>
      <ItemResourceMapPane
        rows={rows}
        isLoading={list.isPending}
        plantOptions={selectableOptions(plantOptions, plantId)}
        plantId={plantId}
        onChangePlant={(next) => {
          rowWrite.reset();
          setChosenPlantId(next);
        }}
        optionsNotice={optionsNoticeOf([plantOptions])}
        loadError={
          list.isError ? (
            <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
          ) : null
        }
        /* 줄마다 `versionNo`로 잠그므로 충돌 갈래가 있다 — 다시 받으면 새 판으로 다시 누를 수 있다. */
        banner={
          <SaveErrorBanner
            error={rowWrite.error}
            onReload={() => {
              rowWrite.reset();
              void list.refetch();
            }}
          />
        }
        rowActionsLocked={rowWrite.isSaving || list.isFetching}
        onAdd={() => openDialog(null)}
        onEdit={(row) => openDialog(row)}
        onSetDefault={(row) => rowWrite.write({ row, body: { isDefault: true } })}
        onToggleActive={(row) => rowWrite.write({ row, body: { isActive: !row.isActive } })}
      />

      {/* 열 때만 마운트한다 — 닫힌 창을 남기면 지난 값이 살아 있다. */}
      {editing !== null && plantNumber !== null && (
        <ItemResourceMapFormDialog
          row={editing.row}
          initialValues={
            editing.row === null
              ? createItemResourceMapFormValues()
              : toItemResourceMapFormValues(editing.row)
          }
          plantId={plantNumber}
          plantLabel={lookupLabel(
            plantOptions.entries,
            plantNumber,
            plantOptions.isLoading,
            plantOptions.isError,
          )}
          rows={rows}
          processOptions={(selected) => selectableOptions(processOptions, selected)}
          fieldErrors={formWrite.fieldErrors}
          banner={
            <>
              {optionsNoticeOf([processOptions])}
              {/*
               * 충돌이면 창을 닫고 목록을 다시 받는다 — 창이 든 판(`versionNo`)이 낡았으므로
               * 새 줄로 창을 다시 열어야 저장이 성립한다.
               */}
              <SaveErrorBanner
                error={restateItemResourceMapApiError(formWrite.error)}
                onReload={() => {
                  closeDialog();
                  void list.refetch();
                }}
              />
            </>
          }
          isSaving={formWrite.isSaving}
          onClose={closeDialog}
          onSave={(values) => {
            formWrite.write({ row: editing.row, values, plantId: plantNumber, itemId });
          }}
        />
      )}
    </>
  );
};
