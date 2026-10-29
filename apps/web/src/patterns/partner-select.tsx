import type { SelectOption } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { forwardRef, useState } from 'react';

import { useApiClient } from './api-context';
import { runRequest } from './request';
import { type PagedOption, PagedSelect, type PagedSelectProps } from './select';

type Partner = components['schemas']['Partner'];
type PartnerRole = 'CUSTOMER' | 'SUPPLIER' | 'SUBCONTRACTOR' | 'DISPOSAL' | 'OTHER';

/** 한 쪽 건수 — 목록이 내려갈 만큼만. */
export const PARTNER_SELECT_PAGE_SIZE = 50;

/** 거래처 선택지 글자 — 거래처코드 · 거래처명. */
export const partnerOptionLabel = (partner: { partnerCode: string; partnerName: string }): string =>
  `${partner.partnerCode} · ${partner.partnerName}`;

/** 목록 줄 글자 — 중지된 거래처는 표식을 붙인다(`includeInactive` 일 때만 섞여 온다). */
const optionLabel = (partner: Partner): string =>
  partner.isActive
    ? partnerOptionLabel(partner)
    : `${partnerOptionLabel(partner)}${messages.common.reference.inactiveSuffix}`;

export interface PartnerSelectProps extends Omit<
  PagedSelectProps,
  'queryKey' | 'fetchPage' | 'onOptionChange'
> {
  /** 중지된 거래처도 고른다 — 지난 자료를 찾는 조건 줄의 것. */
  includeInactive?: boolean;
  /** 역할로 좁힌다(공급사 · 고객 등). 없으면 전체 거래처. */
  roleTypeCode?: PartnerRole;
}

/**
 * 거래처 선택 칸 — 거래처(천여 건)를 통째로 받지 않는다. 펼칠 때 첫 쪽, 검색어는 서버(`q` = 코드 · 명칭)로, 목록 끝에
 * 닿으면 다음 쪽(사용자 지시 2026-10-29). 값은 `partnerId` 문자열이다. 고른 거래처의 이름은 이 칸이 번호로 받는다.
 */
export const PartnerSelect = forwardRef<HTMLButtonElement, PartnerSelectProps>(
  function PartnerSelect({ includeInactive = false, roleTypeCode, selectedOption, ...rest }, ref) {
    const { client } = useApiClient();
    /** 목록에서 고른 거래처 — 이름을 이미 아니 번호로 다시 받지 않는다. */
    const [picked, setPicked] = useState<SelectOption | null>(null);

    const value = rest.value ?? null;
    const partnerId = value !== null && /^\d+$/.test(value) ? Number(value) : null;
    const given =
      selectedOption?.value === value ? selectedOption : picked?.value === value ? picked : null;
    const known = given !== null && given !== undefined;
    const byId = useQuery({
      queryKey: ['partner-select', 'by-id', partnerId],
      enabled: partnerId !== null && !known,
      queryFn: async () => {
        const data = await runRequest(() =>
          client.GET('/mdm/partners/{partnerId}', {
            params: { path: { partnerId: partnerId ?? 0 } },
          }),
        );
        return { value: String(data.partnerId), label: optionLabel(data) };
      },
    });
    const resolved = known ? given : (byId.data ?? null);

    return (
      <PagedSelect
        {...rest}
        ref={ref}
        selectedOption={resolved}
        queryKey={['partner-select', includeInactive, roleTypeCode ?? '']}
        onOptionChange={(option) => setPicked({ value: option.value, label: option.label })}
        fetchPage={async (q, page) => {
          const data = await runRequest(() =>
            client.GET('/mdm/partners', {
              params: {
                query: {
                  /* 빈 검색어는 축을 싣지 않는다 — 빈 문자열을 검색어로 보내지 않는다. */
                  ...(q === '' ? {} : { q }),
                  ...(roleTypeCode === undefined ? {} : { roleTypeCode }),
                  ...(includeInactive ? { includeInactive: true } : {}),
                  page,
                  size: PARTNER_SELECT_PAGE_SIZE,
                },
              },
            }),
          );
          return {
            options: data.items.map((partner): PagedOption => ({
              value: String(partner.partnerId),
              label: optionLabel(partner),
              data: partner,
            })),
            total: data.page.total,
          };
        }}
      />
    );
  },
);
