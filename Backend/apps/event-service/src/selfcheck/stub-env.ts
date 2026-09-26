import os from 'os';
import path from 'path';

/**
 * Imported FIRST by event.db.selfcheck.ts: `config` reads the environment once, at load, so the
 * Registration Service stub's address and a throwaway upload root must be in place before
 * `@bgsc/shared` is imported. dotenv does not override variables that are already set.
 */
export const STUB_PORT = 39417;
process.env.REGISTRATION_SERVICE_URL = `http://127.0.0.1:${STUB_PORT}`;
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `bgsc_selfcheck_event_uploads_${process.pid}`);
