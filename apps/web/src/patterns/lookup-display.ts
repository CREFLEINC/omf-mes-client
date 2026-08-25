import { messages } from '@omf-mes/i18n';

export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface LookupSource<Entry extends LookupEntry = LookupEntry> {
  entries: readonly Entry[];
  isError: boolean;
  isLoading: boolean;
}

export type LookupDisplayState =
  | { kind: 'empty' }
  | { kind: 'named'; label: string }
  | { kind: 'unknown' }
  | { kind: 'loading' }
  | { kind: 'failed' };

const t = messages.common.reference;

export const toLookupDisplayState = (
  source: LookupSource,
  value: string | number | null | undefined,
): LookupDisplayState => {
  if (value === null || value === undefined || value === '') return { kind: 'empty' };
  if (source.isError) return { kind: 'failed' };
  if (source.isLoading) return { kind: 'loading' };

  const label = source.entries.find((entry) => entry.value === String(value))?.label;

  return label === undefined ? { kind: 'unknown' } : { kind: 'named', label };
};

export const lookupDisplayLabel = (
  source: LookupSource,
  value: string | number | null | undefined,
): string => {
  const state = toLookupDisplayState(source, value);

  switch (state.kind) {
    case 'empty':
      return t.empty;
    case 'named':
      return state.label;
    case 'unknown':
      return t.unknown;
    case 'loading':
      return t.loading;
    case 'failed':
      return t.failed;
  }
};

/** 읽기 표시에서 미사용 이름을 구분하되 조회 상태가 이름보다 우선하도록 한다. */
export const lookupDisplayLabelWithInactive = (
  source: LookupSource,
  value: string | number | null | undefined,
): string => {
  const state = toLookupDisplayState(source, value);

  return state.kind === 'named' &&
    source.entries.find((entry) => entry.value === String(value))?.isActive === false
    ? `${state.label}${t.inactiveSuffix}`
    : lookupDisplayLabel(source, value);
};

export const selectableLookupOptions = (
  source: LookupSource,
  selected: string,
): { value: string; label: string }[] => {
  const options = source.entries
    .filter((entry) => entry.isActive || entry.value === selected)
    .map((entry) => ({
      value: entry.value,
      label: entry.isActive ? entry.label : `${entry.label}${t.inactiveSuffix}`,
    }));

  return selected === '' || options.some((option) => option.value === selected)
    ? options
    : [...options, { value: selected, label: lookupDisplayLabel(source, selected) }];
};
