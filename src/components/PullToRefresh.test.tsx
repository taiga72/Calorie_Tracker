import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

describe('PullToRefresh visuals', () => {
  function pull(root: Element, dy: number, release = true) {
    fireEvent.pointerDown(root, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(root, { clientX: 0, clientY: dy });
    if (release) fireEvent.pointerUp(root, { clientX: 0, clientY: dy });
  }

  it('tells you when releasing will sync', () => {
    const { container } = render(<PullToRefresh onRefresh={vi.fn()} refreshing={false}><p>content</p></PullToRefresh>);
    const root = container.firstElementChild!;

    pull(root, 60, false);
    expect(screen.getByText('Pull to sync')).toBeInTheDocument();
    fireEvent.pointerMove(root, { clientX: 0, clientY: 200 });
    expect(screen.getByText('Release to sync')).toBeInTheDocument();
  });

  it('shows syncing, then confirms when the sync succeeded', async () => {
    let finish!: (ok: boolean) => void;
    const onRefresh = vi.fn(() => new Promise<boolean>((r) => { finish = r; }));
    const { container } = render(<PullToRefresh onRefresh={onRefresh} refreshing={false}><p>content</p></PullToRefresh>);

    pull(container.firstElementChild!, 200);
    expect(screen.getByText('Syncing…')).toBeInTheDocument();

    await act(async () => { finish(true); });
    expect(screen.getByText('Up to date')).toBeInTheDocument();
  });

  it('says so when the sync failed', async () => {
    const onRefresh = vi.fn(async () => false);
    const { container } = render(<PullToRefresh onRefresh={onRefresh} refreshing={false}><p>content</p></PullToRefresh>);

    pull(container.firstElementChild!, 200);
    await act(async () => {});
    expect(screen.getByText(/Couldn't sync/)).toBeInTheDocument();
  });
});

describe('PullToRefresh on touch screens', () => {
  const touch = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] });

  it('refreshes on a touch pull, holding off the browser’s own scrolling while pulling', () => {
    const onRefresh = vi.fn();
    const { container } = render(<PullToRefresh onRefresh={onRefresh} refreshing={false}><p>content</p></PullToRefresh>);
    const root = container.firstElementChild!;

    fireEvent.touchStart(root, touch(0, 0));
    const notPrevented = fireEvent.touchMove(root, touch(0, 200));
    expect(notPrevented).toBe(false); // preventDefault was called
    expect(screen.getByText('Release to sync')).toBeInTheDocument();
    fireEvent.touchEnd(root, { touches: [] });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('leaves normal scrolling up the page alone', () => {
    const onRefresh = vi.fn();
    const { container } = render(<PullToRefresh onRefresh={onRefresh} refreshing={false}><p>content</p></PullToRefresh>);
    const root = container.firstElementChild!;

    fireEvent.touchStart(root, touch(0, 300));
    expect(fireEvent.touchMove(root, touch(0, 100))).toBe(true); // not prevented
    fireEvent.touchEnd(root, { touches: [] });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignores touch pointer events (handled as touches instead), so a pull is not counted twice', () => {
    const onRefresh = vi.fn();
    const { container } = render(<PullToRefresh onRefresh={onRefresh} refreshing={false}><p>content</p></PullToRefresh>);
    const root = container.firstElementChild!;

    fireEvent.pointerDown(root, { clientX: 0, clientY: 0, pointerType: 'touch' });
    fireEvent.pointerMove(root, { clientX: 0, clientY: 200, pointerType: 'touch' });
    fireEvent.pointerUp(root, { clientX: 0, clientY: 200, pointerType: 'touch' });
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
