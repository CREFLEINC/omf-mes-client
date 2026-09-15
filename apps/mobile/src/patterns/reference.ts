import { messages } from '@omf-mes/i18n';

/**
 * 참조 값 하나의 표기 상태.
 *
 * 다섯 갈래를 뭉개면 본 자료가 이름보다 먼저 온 순간 정상 값이 서버에 없는 것으로 보이고,
 * 그 문구는 값이 잘못됐다는 뜻으로 읽힌다. 기다리면 채워질 것에 담당자를 부르게 된다.
 *
 * 어느 갈래에도 내부 번호를 담지 않는다 - 담을 자리가 없으면 화면으로 샐 경로도 없다.
 */
export type ReferenceState =
  | { kind: 'empty' }
  | { kind: 'named'; label: string }
  | { kind: 'unknown' }
  | { kind: 'loading' }
  | { kind: 'failed' };

export type ReferenceResolver = (id: number | null | undefined) => ReferenceState;

const t = messages.common.reference;

/** 상태를 화면에 적을 말로 바꾼다. 화면마다 따로 적으면 같은 상태가 여러 문구로 갈린다. */
export const referenceLabel = (state: ReferenceState): string => {
  switch (state.kind) {
    case 'named':
      return state.label;
    case 'empty':
      return t.empty;
    case 'unknown':
      return t.unknown;
    case 'loading':
      return t.loading;
    case 'failed':
      return t.failed;
  }
};
