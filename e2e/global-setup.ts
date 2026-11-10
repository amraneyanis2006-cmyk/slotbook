import { resetTestDb } from '../server/tests/setup';

export default () => resetTestDb({ e2eSlot: true });
