import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { itemResourceMapFixtures } from './fixtures';
import {
  createItemResourceMapFormValues,
  toItemResourceMapFormValues,
  type ItemResourceMapFormValues,
} from './item-resource-map-draft';
import { ItemResourceMapFormDialog } from './item-resource-map-form-dialog';
import type { SelectOption } from './types';

const picker = messages.resourcePicker;

const PROCESSES: SelectOption[] = [{ value: '3001', label: 'SYN-PROC-01 · 합성 공정 가' }];

const page = (items: unknown[]) => ({ items, page: { page: 1, size: 20, total: items.length } });

/** 찾기 창이 서버에 묻는 설비·금형. 창 밖에서는 아무것도 받지 않는다. */
const resourceFetch = createStubFetch([
  {
    match: (request) => new URL(request.url).pathname === '/mdm/equipments',
    respond: () =>
      jsonResponse(
        page([
          {
            equipmentId: 8003,
            plantId: 9001,
            equipmentCode: 'SYN-EQ-03',
            equipmentName: '합성 설비 C',
            productionLineId: null,
            isActive: true,
          },
        ]),
      ),
  },
  {
    match: (request) => new URL(request.url).pathname === '/mdm/molds',
    respond: () =>
      jsonResponse(
        page([
          {
            moldId: 8503,
            plantId: 9001,
            moldCode: 'SYN-MOLD-03',
            moldName: '합성 금형 C',
            isActive: true,
          },
        ]),
      ),
  },
]);

const renderDialog = (overrides: Partial<Parameters<typeof ItemResourceMapFormDialog>[0]> = {}) => {
  const onClose = vi.fn<() => void>();
  const onSave = vi.fn<(values: ItemResourceMapFormValues) => void>();

  renderWithProviders(
    <ItemResourceMapFormDialog
      row={null}
      initialValues={createItemResourceMapFormValues()}
      plantId={9001}
      plantLabel="SYN-PLANT-01 · 합성 공장"
      rows={itemResourceMapFixtures}
      processOptions={() => PROCESSES}
      fieldErrors={{}}
      banner={null}
      isSaving={false}
      onClose={onClose}
      onSave={onSave}
      {...overrides}
    />,
    { fetch: resourceFetch, route: '/' },
  );

  return { onClose, onSave, user: userEvent.setup() };
};

/** 칸을 눌러 찾기 창을 열고 한 줄을 골라 확인한다. */
const pickFrom = async (
  user: ReturnType<typeof userEvent.setup>,
  field: '설비' | '금형',
  code: string,
): Promise<void> => {
  await user.click(screen.getByLabelText(field));
  const dialog = within(
    screen.getByRole('dialog', {
      name: field === '설비' ? picker.title.equipment : picker.title.mold,
    }),
  );
  await user.click(await dialog.findByRole('checkbox', { name: code }));
  await user.click(dialog.getByRole('button', { name: picker.pick }));
};

describe('ItemResourceMapFormDialog — 표시', () => {
  /* 공장은 창에서 바꾸지 않는다 — 어느 공장의 줄인지는 제목이 말한다. */
  it('등록 제목에 공장이 들어가고 공장 칸은 없다', () => {
    renderDialog();

    expect(
      screen.getByRole('dialog', { name: '설비·금형 추가 · SYN-PLANT-01 · 합성 공장' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('공장')).not.toBeInTheDocument();
  });

  it('수정 창은 수정 제목이고 지금 설비·금형을 코드와 이름으로 보인다', () => {
    const row = itemResourceMapFixtures[0]!;
    renderDialog({ row, initialValues: toItemResourceMapFormValues(row) });

    expect(
      screen.getByRole('dialog', { name: '설비·금형 수정 · SYN-PLANT-01 · 합성 공장' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('설비')).toHaveValue('SYN-EQ-01 · 합성 설비 A');
    expect(screen.getByLabelText('금형')).toHaveValue('SYN-MOLD-01 · 합성 금형 A');
  });

  /* 공정을 비운 것이 정상 값(전체 공정)이다 — 자리표시가 아니라 값으로 보인다. */
  it('공정을 비우면 「전체 공정」으로 보인다', () => {
    renderDialog();

    expect(screen.getByLabelText('공정')).toHaveTextContent('전체 공정');
  });

  it('추천 순서의 처음 값은 서버 기본값과 같다', () => {
    renderDialog();

    expect(screen.getByLabelText(/추천 순서/)).toHaveValue(100);
  });

  /* 열기만 해서는 설비·금형을 받지 않는다 — 금형은 공장마다 수백 건이다. */
  it('설비·금형 칸은 비어 있고 창을 열기 전에는 찾기 창이 없다', () => {
    renderDialog();

    expect(screen.getByLabelText('설비')).toHaveValue('');
    expect(screen.getByLabelText('금형')).toHaveValue('');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});

describe('ItemResourceMapFormDialog — 사용 중지한 줄의 자동 배정', () => {
  /* 서버가 자동 배정 자리를 사용 중인 줄로만 센다 — 체크해 저장해도 자동 배정이 되지 않는다. */
  it('사용 중지한 줄을 고칠 때는 자동 배정 칸이 없다', () => {
    const row = itemResourceMapFixtures[2]!;
    renderDialog({ row, initialValues: toItemResourceMapFormValues(row) });

    expect(screen.queryByRole('checkbox', { name: '자동 배정' })).not.toBeInTheDocument();
  });

  it('사용 중인 줄과 새 줄은 자동 배정을 고를 수 있다', () => {
    renderDialog();

    expect(screen.getByRole('checkbox', { name: '자동 배정' })).toBeEnabled();
  });
});

describe('ItemResourceMapFormDialog — 찾기 창으로 고르기', () => {
  it('설비를 고르면 칸에 코드와 이름이 서고 그 설비로 저장한다', async () => {
    const { onSave, user } = renderDialog();

    await pickFrom(user, '설비', 'SYN-EQ-03');

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByLabelText('설비')).toHaveValue('SYN-EQ-03 · 합성 설비 C');

    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentId: '8003', moldId: '' }),
    );
  });

  it('지우기는 칸을 비우고 저장 값에서도 뺀다', async () => {
    const row = itemResourceMapFixtures[0]!;
    const { onSave, user } = renderDialog({ row, initialValues: toItemResourceMapFormValues(row) });

    await user.click(screen.getByRole('button', { name: picker.clear.mold }));

    expect(screen.getByLabelText('금형')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentId: '8001', moldId: '' }),
    );
  });

  /* 찾기 창을 닫아도 바깥 창은 남는다 — 고르던 줄을 잃지 않는다. */
  it('찾기 창을 취소하면 값이 그대로다', async () => {
    const { onClose, user } = renderDialog();

    await user.click(screen.getByLabelText('금형'));
    await user.click(
      within(screen.getByRole('dialog', { name: picker.title.mold })).getByRole('button', {
        name: picker.cancel,
      }),
    );

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByLabelText('금형')).toHaveValue('');
  });

  it('찾기 창의 검색칸에서 엔터를 쳐도 저장하지 않는다', async () => {
    const { onSave, user } = renderDialog({
      initialValues: { ...createItemResourceMapFormValues(), moldId: '8503' },
    });

    await user.click(screen.getByLabelText('금형'));
    await user.type(
      within(screen.getByRole('dialog', { name: picker.title.mold })).getByLabelText(
        picker.keywordLabel,
      ),
      'x{Enter}',
    );

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: picker.title.mold })).toBeInTheDocument();
  });
});

describe('ItemResourceMapFormDialog — 저장', () => {
  it('설비·금형이 둘 다 비면 저장하지 않고 설비 칸에 오류를 낸다', async () => {
    const { onSave, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('설비나 금형 중 하나는 골라야 합니다.')).toBeInTheDocument();
  });

  it('금형만 골라도 저장한다', async () => {
    const { onSave, user } = renderDialog();

    await pickFrom(user, '금형', 'SYN-MOLD-03');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ moldId: '8503', equipmentId: '' }),
    );
  });

  it('설비를 고르면 「하나는 있어야」 오류가 사라진다', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '저장' }));
    await pickFrom(user, '설비', 'SYN-EQ-03');

    expect(screen.queryByText('설비나 금형 중 하나는 골라야 합니다.')).not.toBeInTheDocument();
  });

  it('이미 있는 조합이면 저장하지 않는다', async () => {
    const { onSave, user } = renderDialog({
      initialValues: { ...createItemResourceMapFormValues(), moldId: '8502' },
    });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/같은 공정·설비·금형 줄이 이미 있습니다/)).toBeInTheDocument();
  });

  it('수정 창은 고친 것이 없으면 저장이 닫혀 있다', async () => {
    const row = itemResourceMapFixtures[0]!;
    const { user } = renderDialog({ row, initialValues: toItemResourceMapFormValues(row) });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();

    await user.clear(screen.getByLabelText('비고'));
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });

  it('서버가 준 칸 오류를 그 칸에 낸다', () => {
    renderDialog({ fieldErrors: { equipmentId: '이 공장의 설비가 아닙니다.' } });

    expect(screen.getByText('이 공장의 설비가 아닙니다.')).toBeInTheDocument();
  });
});
