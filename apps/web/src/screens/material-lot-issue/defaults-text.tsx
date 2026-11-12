import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useItemStorageUnit, type UomOption } from '../../patterns/material-lot-batch';
import { formatBaseQty, formatPackageQty } from '../../patterns/package-qty';
import type { Defaults, Group } from './types';

const t = messages.materialLotIssue;

/** 품목 기본 보관 단위 글 — 「봉지 100 EA」(환산이 없으면 단위만). 없으면 null. */
export const storageText = (
  storage: { uomId: number; qtyPerPackage: number | null } | null | undefined,
  uoms: readonly UomOption[] | undefined,
  baseUomCode: string,
): string | null => {
  if (storage === null || storage === undefined) return null;
  const code = uoms?.find((row) => row.uomId === storage.uomId)?.uomCode ?? '';
  return storage.qtyPerPackage === null
    ? code
    : `${code} ${formatBaseQty(storage.qtyPerPackage, baseUomCode)}`;
};

/** 기본 정보 한 줄(screens/W-01-14.md 「기본 정보 칸」). */
export const defaultsLine = (group: Group, defaults: Defaults): string =>
  defaults.package === null
    ? t.defaults.noPackage(formatBaseQty(defaults.lotQty, group.uomCode))
    : formatPackageQty(defaults.lotQty, group.uomCode, defaults.package);

/**
 * 기본 정보가 없을 때 — 「기본 정보 없음」 칩과 발행 창이 무엇으로 채우는지(품목 기본 보관 단위 또는 직접 입력).
 * 보관 단위는 그 품목만 따로 읽는다(기본 정보가 없는 줄에서만).
 */
const MissingDefaults = ({
  group,
  uoms,
}: {
  group: Group;
  uoms: readonly UomOption[] | undefined;
}) => {
  const storage = useItemStorageUnit(group.itemId);
  const unit = storageText(storage.data, uoms, group.uomCode);
  return (
    <span className="mlot-issue-defaults">
      <Chip size="sm" status="warning">
        {t.defaults.missing}
      </Chip>
      {!storage.isPending && (
        <span className="field-note">
          {unit === null ? t.defaults.manual : t.defaults.fromStorage(unit)}
        </span>
      )}
    </span>
  );
};

export const DefaultsText = ({
  group,
  defaults,
  uoms,
}: {
  group: Group;
  defaults: Defaults | undefined;
  uoms: readonly UomOption[] | undefined;
}) =>
  defaults === undefined ? (
    <MissingDefaults group={group} uoms={uoms} />
  ) : (
    <span>{defaultsLine(group, defaults)}</span>
  );
