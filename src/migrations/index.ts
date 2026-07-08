import * as migration_20260708_124017 from './20260708_124017';
import * as migration_20260708_145516 from './20260708_145516';

export const migrations = [
  {
    up: migration_20260708_124017.up,
    down: migration_20260708_124017.down,
    name: '20260708_124017',
  },
  {
    up: migration_20260708_145516.up,
    down: migration_20260708_145516.down,
    name: '20260708_145516'
  },
];
