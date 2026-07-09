import * as migration_20260708_124017 from './20260708_124017';
import * as migration_20260708_145516 from './20260708_145516';
import * as migration_20260708_180128 from './20260708_180128';
import * as migration_20260709_083624 from './20260709_083624';
import * as migration_20260709_112710 from './20260709_112710';
import * as migration_20260709_120418 from './20260709_120418';
import * as migration_20260709_122434 from './20260709_122434';

export const migrations = [
  {
    up: migration_20260708_124017.up,
    down: migration_20260708_124017.down,
    name: '20260708_124017',
  },
  {
    up: migration_20260708_145516.up,
    down: migration_20260708_145516.down,
    name: '20260708_145516',
  },
  {
    up: migration_20260708_180128.up,
    down: migration_20260708_180128.down,
    name: '20260708_180128',
  },
  {
    up: migration_20260709_083624.up,
    down: migration_20260709_083624.down,
    name: '20260709_083624',
  },
  {
    up: migration_20260709_112710.up,
    down: migration_20260709_112710.down,
    name: '20260709_112710',
  },
  {
    up: migration_20260709_120418.up,
    down: migration_20260709_120418.down,
    name: '20260709_120418',
  },
  {
    up: migration_20260709_122434.up,
    down: migration_20260709_122434.down,
    name: '20260709_122434'
  },
];
