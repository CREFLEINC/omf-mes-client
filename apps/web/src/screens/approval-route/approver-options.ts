import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { AppUser, PageMeta, SelectOption } from './types';

/**
 * 단계 추가 줄의 **승인자 선택지**.
 *
 * **참조 조회(`lookups.ts`)와 성격이 다르다.** 사업부는 이미 저장된 번호를 이름으로 *푸는*
 * 참조라 네 갈래(미도착·목록에 없음·실패·정상)를 갈라야 하지만, 승인자는 **고르는 값**이다 —
 * 목록에 없는 값을 고를 길이 없으므로 「목록에 없음」이라는 갈래 자체가 생기지 않는다.
 *
 * **이미 단계에 들어 있는 승인자는 여기서 풀지 않는다.** 계약이 단계 응답에 표시 이름을
 * 실어 보내기 때문이다 — 그래서 결재선을 *읽는* 데는 이 조회가 필요 없고, **고른 뒤에만** 부른다.
 *
 * **미사용 사용자를 담지 않는다.** 계약의 사용자 목록이 기본으로 사용 중인 것만 내려주고,
 * 여기서 고른 값은 새 단계로 저장되므로 유효하지 않은 승인자를 고르게 두면 안 된다.
 * 반대로 **이미 단계에 있던 승인자가 나중에 사용 중지된 경우**는 단계 응답의 사용 여부가
 * 거짓으로 와서 경고로 드러난다(그쪽은 지우게 하지 않고 알리기만 한다).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.approvalRoute;

/**
 * 고를 수 있는 승인자 하나.
 *
 * **부서 이름이 없다.** 계약의 사용자 목록은 부서 **번호**만 주고, 단계 응답이 주는
 * 표시용 부서 이름에 해당하는 값이 없다 — 화면이 지어내지 않는다. 새로 고른 승인자의
 * 부서는 **저장 뒤 서버 응답이 채운다**(치환 200이 갱신된 단계 목록을 돌려준다).
 */
export interface ApproverOption extends SelectOption {
  appUserId: number;
  /** 단계 행에 그대로 앉을 표시 이름. 내부 번호가 여기에 들어올 자리는 없다. */
  approverName: string;
  isActive: boolean;
}

/**
 * **「불러오는 중」 갈래가 없다.** 사업부 참조는 이미 저장된 번호를 푸는 자리라 미도착과
 * 「목록에 없음」을 갈라야 하지만, 여기서는 아직 오지 않은 목록이 곧 **비어 있는 선택지**이고
 * 그때 사용자가 할 일은 기다리는 것뿐이다 — 읽는 곳이 없는 필드를 형태만 맞추려고 두지 않는다.
 */
export interface ApproverLookup {
  options: ApproverOption[];
  isError: boolean;
  /** 목록이 잘렸으면 참. **읽는 쪽이 이 값을 볼 수 있어야** 고를 수 없는 사람이 생긴 것을 밝힌다. */
  truncated: boolean;
  refetch: () => void;
}

/**
 * 표시명이 빈 문자열로 오는 일이 있다. 그때 **로그인ID로 적고 내부 번호를 대신 내지 않는다** —
 * 로그인ID는 사용자가 아는 값이지만 `appUserId`는 아니다.
 */
const toApproverName = (user: AppUser): string =>
  user.userName === '' ? user.loginId : user.userName;

/**
 * 사용자 목록을 선택지로 옮긴다.
 *
 * **로그인ID를 함께 적는다.** 같은 표시명을 가진 사람이 둘일 수 있고, 승인자를 잘못 고르면
 * 결재가 엉뚱한 사람에게 간다 — 사업부 선택지가 「코드 · 이름」인 것과 같은 이유다.
 *
 * **차례를 바꾸지 않는다.** 서버가 준 차례가 뜻일 수 있다.
 */
export const toApproverOptions = (users: readonly AppUser[]): ApproverOption[] =>
  users.map((user) => {
    const approverName = toApproverName(user);

    return {
      value: String(user.appUserId),
      label: user.userName === '' ? user.loginId : `${approverName} · ${user.loginId}`,
      appUserId: user.appUserId,
      approverName,
      isActive: user.isActive,
    };
  });

/**
 * 선택칸 아래에 붙일 안내.
 *
 * **실패가 잘림보다 앞선다.** 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면 둘이 함께
 * 참이 되는데, 그때 먼저 알아야 하는 것은 「지금 보이는 것이 낡았다」는 쪽이다.
 */
export const approverNote = (lookup: ApproverLookup): string | undefined => {
  if (lookup.isError) return t.notes.approverListFailed;
  if (lookup.truncated) return t.notes.approverListTruncated;

  return undefined;
};

/** 참조가 매 렌더 새로 만들어지면 이 값을 읽는 판정이 매번 달라 보인다. */
const EMPTY_OPTIONS: ApproverOption[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

export const approverKeys = {
  users: ['approval-route-lookups', 'approver-users'] as const,
};

/**
 * 승인자 후보 — **결재선을 고른 뒤에만 부른다.**
 *
 * 목록만 보는 사용자에게까지 나가면 이 화면의 첫 진입이 조회 셋으로 늘어난다.
 * 단계를 편집할 수 있는 자리는 결재선을 고른 뒤에만 열리므로 그때 부르는 것으로 족하다.
 *
 * **결재선 쓰기의 무효화 범위에 넣지 않는다**(`routeKeys.all` 바깥의 열쇠를 쓴다) —
 * 결재선을 저장했다고 사용자 마스터가 바뀌지는 않는다.
 *
 * **「미사용 포함」을 켜지 않는다.** 계약의 사용자 목록은 기본으로 사용 중인 것만 내려주고,
 * 여기서 고른 값은 **새 단계로 저장된다** — 이미 사용 중지된 사람을 고르게 두면 그 단계에서
 * 결재가 멈춘다. 반대로 **이미 단계에 있던 승인자가 나중에 사용 중지된 경우**는 단계 응답의
 * 사용 여부가 거짓으로 와서 경고로 드러나며, 그쪽은 지우게 하지 않고 알리기만 한다.
 */
export const useApproverLookup = (enabled: boolean): ApproverLookup => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: approverKeys.users,
    enabled,
    queryFn: () => runRequest(() => client.GET('/app/users', {})),
  });

  const data = query.data;

  return {
    options: data === undefined ? EMPTY_OPTIONS : toApproverOptions(data.items),
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
};
