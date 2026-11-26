// Adds DOM matchers such as toBeInTheDocument() / toHaveAttribute() to Vitest's expect.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmounts rendered components after each test, so tests don't affect each other.
afterEach(cleanup);
