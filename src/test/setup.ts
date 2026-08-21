import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL's automatic afterEach cleanup relies on detecting global test hooks,
// which aren't set up since this project doesn't use Vitest's globals mode.
afterEach(cleanup);
