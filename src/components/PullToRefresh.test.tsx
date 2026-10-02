import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PullToRefresh } from '@/components/PullToRefresh';

afterEach(() => {
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

describe('PullToRefresh', () => {
  it('always renders its children', () => {
    render(<PullToRefresh onRefresh={vi.fn()} refreshing={false}><p>content</p></PullToRefresh>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('calls onRefresh after a downward pull past the threshold', () => {
    const onRefresh = vi.fn();
    const { container } = render(<PullToRefresh onRefresh={onRefresh} refreshing={false}><p>content</p></PullToRefresh>);
    const root = container.firstElementChild!;

    fireEvent.pointerDown(root, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(root, { clientX: 0, clientY: 200 });
    fireEvent.pointerUp(root, { clientX: 0, clientY: 200 });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not call onRefresh for a short pull', () => {
    const onRefresh = vi.fn();
    const { container } = render(<PullToRefresh onRefresh={onRefresh} refreshing={false}><p>content</p></PullToRefresh>);
    const root = container.firstElementChild!;

    fireEvent.pointerDown(root, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(root, { clientX: 0, clientY: 20 });
    fireEvent.pointerUp(root, { clientX: 0, clientY: 20 });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignores a primarily horizontal drag, even past the vertical threshold distance', () => {
    const onRefresh = vi.fn();
    const { container } = render(<PullToRefresh onRefresh={onRefresh} refreshing={false}><p>content</p></PullToRefresh>);
    const root = container.firstElementChild!;

    fireEvent.pointerDown(root, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(root, { clientX: 200, clientY: 10 });
    fireEvent.pointerUp(root, { clientX: 200, clientY: 10 });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not start the gesture when the page is scrolled down', () => {
    Object.defineProperty(window, 'scrollY', { value: 50, configurable: true });
    const onRefresh = vi.fn();
    const { container } = render(<PullToRefresh onRefresh={onRefresh} refreshing={false}><p>content</p></PullToRefresh>);
    const root = container.firstElementChild!;

    fireEvent.pointerDown(root, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(root, { clientX: 0, clientY: 200 });
    fireEvent.pointerUp(root, { clientX: 0, clientY: 200 });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not start a new gesture while already refreshing', () => {
    const onRefresh = vi.fn();
    const { container } = render(<PullToRefresh onRefresh={onRefresh} refreshing><p>content</p></PullToRefresh>);
    const root = container.firstElementChild!;

    fireEvent.pointerDown(root, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(root, { clientX: 0, clientY: 200 });
    fireEvent.pointerUp(root, { clientX: 0, clientY: 200 });

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
