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

/**
 * 상태를 화면에 적을 말로 바꾼다. 화면마다 따로 적으면 같은 상태가 여러 문구로 갈린다.
 *
 * 못 받은 것은 현장 단말용 문구를 쓴다. 관리웹은 앉아서 보는 화면이라 안 된다는 사실만
 * 알면 되지만, 현장은 손에 물건을 들고 서서 본다 - 기다리면 될 일인지 담당자를 불러야 할
 * 일인지가 그 자리에서 갈려야 한다.
 */
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
      return t.failedOffline;
  }
};

/**
 * 한 번에 받는 조회의 결과를 표기 상태로 옮긴다.
 *
 * 번호마다 따로 묻는 조회는 줄마다 상태가 다르지만, 한 번에 받는 것은 실패하면 그 화면이
 * 전부 같은 상태다. 그래도 빈 자리에 대리키를 끼우면 사람이 읽을 수 없는 숫자가 값인
 * 척하므로, 못 받은 것과 그 안에 없는 것을 갈라 말한다.
 */
export const referenceFromQuery = <T>(
  result: { isError: boolean; isPending: boolean; data?: Map<number, T> },
  label: (value: T) => string,
): ReferenceResolver => {
  return (id) => {
    if (id === null || id === undefined) {
      return { kind: 'empty' };
    }

    if (result.isError) {
      return { kind: 'failed' };
    }

    const found = result.data?.get(id);

    if (found !== undefined) {
      return { kind: 'named', label: label(found) };
    }

    return result.isPending ? { kind: 'loading' } : { kind: 'unknown' };
  };
};
