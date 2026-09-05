import { ConflictException } from '@nestjs/common';

export class EmailAlreadyLinkedException extends ConflictException {
  constructor() {
    super(
      'An account with this email already exists. Please log in with your password and link your Google account from settings.',
    );
  }
}
