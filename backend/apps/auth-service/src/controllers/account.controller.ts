import { Controller, Post, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AccountService } from '../services/account.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { RolesGuard } from '../guards/roles.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { DisableAccountDto } from '../dto/disable-account.dto';
import { UserRole } from '../constants/roles.constant';
import { SuccessMessageDto } from '../dto/responses.dto';

@ApiTags('Account Lifecycle')
@ApiBearerAuth()
@Controller('account')
@UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable an account (own or another user with coordinator/founder role)' })
  @ApiResponse({ status: 200, description: 'Account disabled successfully', type: SuccessMessageDto })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async disableAccount(
    @CurrentUser() user: any,
    @Body() dto: DisableAccountDto,
  ) {
    return this.accountService.disableAccount(user.sub, user.role, dto.userId);
  }

  @Post(':userId/enable')
  @Roles(UserRole.COORDINATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable a disabled account (coordinator/founder only)' })
  @ApiResponse({ status: 200, description: 'Account enabled successfully', type: SuccessMessageDto })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async enableAccount(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
  ) {
    return this.accountService.enableAccount(user.sub, userId);
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule account for deletion (30-day grace period)' })
  @ApiResponse({ status: 200, description: 'Account scheduled for deletion', type: SuccessMessageDto })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async deleteAccount(@CurrentUser() user: any) {
    return this.accountService.deleteAccount(user.sub);
  }

  @Post('cancel-deletion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending account deletion' })
  @ApiResponse({ status: 200, description: 'Account deletion cancelled', type: SuccessMessageDto })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async cancelDeletion(@CurrentUser() user: any) {
    return this.accountService.cancelDeletion(user.sub);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 1, keyPrefix: 'export' })
  @ApiOperation({ summary: 'Request a data export (1 per 24 hours)' })
  @ApiResponse({ status: 200, description: 'Data export request submitted', type: SuccessMessageDto })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async exportData(@CurrentUser() user: any) {
    return this.accountService.requestDataExport(user.sub);
  }
}
