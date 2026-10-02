import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UndoToastProvider, useUndoToast } from '@/components/UndoToastProvider';

function Trigger({ onUndo }: { onUndo: () => void }) {
  const { requestUndo } = useUndoToast();
  return <button onClick={() => requestUndo('Meal deleted', onUndo)}>delete</button>;
}

describe('useUndoToast', () => {
  it('throws when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger onUndo={vi.fn()} />)).toThrow(/must be used within UndoToastProvider/);
    spy.mockRestore();
  });
});

describe('UndoToastProvider', () => {
  it('shows no toast until requestUndo is called', () => {
    render(<UndoToastProvider><Trigger onUndo={vi.fn()} /></UndoToastProvider>);
    expect(screen.queryByText('Meal deleted')).not.toBeInTheDocument();
  });

  it('shows a toast after requestUndo, and calls the callback when Undo is tapped', () => {
    const onUndo = vi.fn();
    render(<UndoToastProvider><Trigger onUndo={onUndo} /></UndoToastProvider>);

    fireEvent.click(screen.getByText('delete'));
    expect(screen.getByText('Meal deleted')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Meal deleted')).not.toBeInTheDocument();
  });

  it('auto-dismisses without calling the callback once the duration elapses', () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    render(<UndoToastProvider><Trigger onUndo={onUndo} /></UndoToastProvider>);

    fireEvent.click(screen.getByText('delete'));
    expect(screen.getByText('Meal deleted')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(5000); });

    expect(screen.queryByText('Meal deleted')).not.toBeInTheDocument();
    expect(onUndo).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
