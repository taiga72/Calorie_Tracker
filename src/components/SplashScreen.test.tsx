import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import { SplashProvider } from '@/components/SplashScreen';
import { useSplashReady } from '@/lib/splash';

let markReady: () => void = () => {};

function Screen() {
  const [ready, setReady] = useState(false);
  markReady = () => setReady(true);
  useSplashReady(ready);
  return <p>app content</p>;
}

describe('SplashProvider', () => {
  it('covers the app until it reports ready, then fades out and goes away', async () => {
    render(<SplashProvider><Screen /></SplashProvider>);
    const splash = screen.getByLabelText('Loading Calorie Tracker');
    expect(splash).not.toHaveClass('splash-out');
    expect(screen.getByText('app content')).toBeInTheDocument();

    act(() => markReady());

    await waitFor(() => expect(splash).toHaveClass('splash-out'));
    await waitFor(() => expect(screen.queryByLabelText('Loading Calorie Tracker')).not.toBeInTheDocument());
  });
});
