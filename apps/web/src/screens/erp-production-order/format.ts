import { messages } from '@omf-mes/i18n';

const t = messages.erpProductionOrder;

/** 비어 온 값(키가 빠졌거나 빈 문자열)은 표시 기호로 낸다 — 빈칸이면 화면이 빠뜨린 것과 구분되지 않는다. */
export const displayOr = (value: string | null | undefined): string =>
  value === null || value === undefined || value.trim() === '' ? t.values.missing : value;

export const formatQty = (value: number): string => value.toLocaleString();

/**
 * 재작업 표지(ERP `RE_WORK_FLG`). `Y`·`N` 만 말로 옮기고, 그 밖의 값은 받은 그대로 낸다 —
 * 모르는 값을 「아니오」로 접으면 받은 정보가 바뀐다.
 */
export const reworkLabel = (flag: string | undefined): string => {
  if (flag === undefined || flag.trim() === '') return t.values.missing;
  const normalized = flag.trim().toUpperCase();
  if (normalized === 'Y') return t.values.reworkYes;
  if (normalized === 'N') return t.values.reworkNo;
  return flag;
};
