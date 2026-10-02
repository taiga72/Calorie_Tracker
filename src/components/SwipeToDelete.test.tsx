import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwipeToDelete } from '@/components/SwipeToDelete';

function renderRow(onDelete = vi.fn()) {
  const utils = render(
    <SwipeToDelete onDelete={onDelete}><p>Oatmeal</p></SwipeToDelete>
  );
  return { ...utils, onDelete };
}

describe('SwipeToDelete', () => {
  it('always renders its children', () => {
    renderRow();
    expect(screen.getByText('Oatmeal')).toBeInTheDocument();
  });

  it('deletes via the revealed button without requiring a swipe', () => {
    const { onDelete } = renderRow();
    fireEvent.click(screen.getByLabelText('Delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete after swiping left past the delete threshold', () => {
    const { container, onDelete } = renderRow();
    const row = container.querySelector('.touch-pan-y')!;

    fireEvent.pointerDown(row, { clientX: 300, clientY: 0 });
    fireEvent.pointerMove(row, { clientX: 100, clientY: 0 });
    fireEvent.pointerUp(row, { clientX: 100, clientY: 0 });

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not call onDelete for a short leftward swipe', () => {
    const { container, onDelete } = renderRow();
    const row = container.querySelector('.touch-pan-y')!;

    fireEvent.pointerDown(row, { clientX: 300, clientY: 0 });
    fireEvent.pointerMove(row, { clientX: 270, clientY: 0 });
    fireEvent.pointerUp(row, { clientX: 270, clientY: 0 });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('ignores a primarily vertical drag', () => {
    const { container, onDelete } = renderRow();
    const row = container.querySelector('.touch-pan-y')!;

    fireEvent.pointerDown(row, { clientX: 300, clientY: 0 });
    fireEvent.pointerMove(row, { clientX: 290, clientY: 200 });
    fireEvent.pointerUp(row, { clientX: 290, clientY: 200 });

    expect(onDelete).not.toHaveBeenCalled();
  });
});
