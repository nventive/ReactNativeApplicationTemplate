import { version, type Version } from '../version/Version';
import type { CurrentVersionRepository } from './CurrentVersionRepository';

/**
 * Fixed-version {@link CurrentVersionRepository} for Tier-1 tests — construct it
 * with the installed version the scenario needs (e.g. `1.0.0`, then push a
 * higher remote minimum to assert the update gate fires).
 */
export class MockCurrentVersionRepository implements CurrentVersionRepository {
  constructor(private readonly current: Version = version(1, 0, 0)) {}

  getCurrentVersion(): Promise<Version> {
    return Promise.resolve(this.current);
  }
}
