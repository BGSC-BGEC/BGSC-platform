import os from 'os';
import path from 'path';

/**
 * Imported FIRST by every selfcheck: `config.uploadDir` is read once when @bgsc/shared loads, and a
 * selfcheck must not write registration files into the developer's real upload directory.
 */
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `bgsc-selfcheck-registration-${process.pid}`);
