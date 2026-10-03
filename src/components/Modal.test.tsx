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

describe('Modal swipe down to close (touch)', () => {
  const t = (y: number, x = 0) => ({ touches: [{ clientX: x, clientY: y }] });

  function sheetOf(container: HTMLElement) {
    return container.querySelector('.overflow-y-auto') as HTMLElement;
  }

  it('closes when the sheet is dragged down from anywhere', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal open onClose={onClose} title="Quick log"><p>body text</p></Modal>);
    const body = screen.getByText('body text');

    fireEvent.touchStart(body, t(100));
    expect(fireEvent.touchMove(body, t(260))).toBe(false); // claimed from the browser's scroll
    expect(sheetOf(container).style.transform).toBe('translateY(160px)');
    fireEvent.touchEnd(body, { touches: [] });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('snaps back on a short, slow drag', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}><p>body text</p></Modal>);
    const body = screen.getByText('body text');
    vi.useFakeTimers();
    fireEvent.touchStart(body, t(100));
    vi.advanceTimersByTime(500);
    fireEvent.touchMove(body, t(150));
    fireEvent.touchEnd(body, { touches: [] });
    vi.useRealTimers();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a quick flick closes even if it is short', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}><p>body text</p></Modal>);
    const body = screen.getByText('body text');
    fireEvent.touchStart(body, t(100));
    fireEvent.touchMove(body, t(160));
    fireEvent.touchEnd(body, { touches: [] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('scrolls normally (does not close) when the sheet is scrolled down', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal open onClose={onClose}><p>body text</p></Modal>);
    sheetOf(container).scrollTop = 120;
    const body = screen.getByText('body text');
    fireEvent.touchStart(body, t(100));
    expect(fireEvent.touchMove(body, t(300))).toBe(true); // left to the browser
    fireEvent.touchEnd(body, { touches: [] });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores drags that start in a text field or are mostly sideways', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}><textarea aria-label="desc" /><p>body text</p></Modal>);
    const field = screen.getByLabelText('desc');
    fireEvent.touchStart(field, t(100));
    fireEvent.touchMove(field, t(300));
    fireEvent.touchEnd(field, { touches: [] });

    const body = screen.getByText('body text');
    fireEvent.touchStart(body, t(100, 0));
    fireEvent.touchMove(body, t(140, 200));
    fireEvent.touchEnd(body, { touches: [] });
    expect(onClose).not.toHaveBeenCalled();
  });
});
