import { ForbiddenException } from '@nestjs/common';

export class AccountDisabledException extends ForbiddenException {
  constructor(message = 'Account is disabled. Contact support.') {
    super(message);
  }
}
