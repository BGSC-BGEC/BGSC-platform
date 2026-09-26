import os from 'os';
import path from 'path';

/**
 * Imported FIRST by the media selfcheck, before anything loads `@bgsc/shared`: `config.uploadDir`
 * is read once at import, and the selfcheck writes and deletes real files. A scratch directory per
 * run keeps them out of the platform's real `Backend/uploads`.
 */
export const SCRATCH_UPLOADS = path.join(os.tmpdir(), `bgsc_selfcheck_media_uploads_${process.pid}`);
process.env.UPLOAD_DIR = SCRATCH_UPLOADS;
