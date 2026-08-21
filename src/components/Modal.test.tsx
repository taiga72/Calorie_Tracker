import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '@/components/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<Modal open={false} onClose={vi.fn()}>content</Modal>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders its content and title when open', () => {
    render(<Modal open onClose={vi.fn()} title="My title">content</Modal>);
    expect(screen.getByText('My title')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal open onClose={onClose}>content</Modal>);
    fireEvent.click(container.querySelector('.bg-black\\/40')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close (X) button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Title">content</Modal>);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}>content</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render the drag handle wired to onClose logic when nothing is dragged', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}>content</Modal>);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('dismisses on a downward swipe past the threshold', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal open onClose={onClose}>content</Modal>);
    const handle = container.querySelector('.cursor-grab')!;

    fireEvent.pointerDown(handle, { clientY: 0 });
    fireEvent.pointerMove(handle, { clientY: 150 });
    fireEvent.pointerUp(handle, { clientY: 150 });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('snaps back without closing on a short swipe', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal open onClose={onClose}>content</Modal>);
    const handle = container.querySelector('.cursor-grab')!;

    fireEvent.pointerDown(handle, { clientY: 0 });
    fireEvent.pointerMove(handle, { clientY: 40 });
    fireEvent.pointerUp(handle, { clientY: 40 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores upward drags (does not close, does not go negative)', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal open onClose={onClose}>content</Modal>);
    const handle = container.querySelector('.cursor-grab')!;

    fireEvent.pointerDown(handle, { clientY: 100 });
    fireEvent.pointerMove(handle, { clientY: 0 });
    fireEvent.pointerUp(handle, { clientY: 0 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('resets drag state when reopened', () => {
    const onClose = vi.fn();
    const { rerender, container } = render(<Modal open onClose={onClose}>content</Modal>);
    const handle = container.querySelector('.cursor-grab')!;
    fireEvent.pointerDown(handle, { clientY: 0 });
    fireEvent.pointerMove(handle, { clientY: 40 });

    rerender(<Modal open={false} onClose={onClose}>content</Modal>);
    rerender(<Modal open onClose={onClose}>content</Modal>);

    // A fresh small drag after reopening should still not trigger close.
    const freshHandle = container.querySelector('.cursor-grab')!;
    fireEvent.pointerDown(freshHandle, { clientY: 0 });
    fireEvent.pointerMove(freshHandle, { clientY: 40 });
    fireEvent.pointerUp(freshHandle, { clientY: 40 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders above the FAB layer (z-index)', () => {
    const { container } = render(<Modal open onClose={vi.fn()}>content</Modal>);
    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.className).toContain('z-[60]');
  });
});
