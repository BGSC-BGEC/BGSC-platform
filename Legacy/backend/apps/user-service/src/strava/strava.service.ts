import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { StravaCredential } from './entities/strava-credential.entity';
import { StravaActivity } from './entities/strava-activity.entity';
import { User } from '../users/entities/user.entity';

interface StravaAthleteActivity {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number | null;
  average_speed: number | null;
  average_heartrate: number | null;
  kilojoules: number | null;
  start_date: string;
  [key: string]: unknown;
}

interface StravaRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

@Injectable()
export class StravaService {
  private readonly logger = new Logger(StravaService.name);

  private readonly encryptionKey: Buffer;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookVerifyToken: string;
  private readonly internalServiceKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @InjectRepository(StravaCredential)
    private readonly credentialRepo: Repository<StravaCredential>,
    @InjectRepository(StravaActivity)
    private readonly activityRepo: Repository<StravaActivity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    const keyStr = configService.get<string>('user.strava.tokenEncryptionKey')!;
    if (!keyStr || !/^[a-fA-F0-9]{64}$/.test(keyStr)) {
      throw new InternalServerErrorException(
        'STRAVA_TOKEN_ENCRYPTION_KEY must be 32 bytes as hex (64 chars)',
      );
    }
    this.encryptionKey = Buffer.from(keyStr, 'hex');
    this.clientId = configService.get<string>('user.strava.clientId')!;
    this.clientSecret = configService.get<string>('user.strava.clientSecret')!;
    this.webhookVerifyToken = configService.get<string>('user.strava.webhookVerifyToken')!;
    this.internalServiceKey = configService.get<string>('user.internalServiceKey')!;
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────

  verifyServiceKey(key: string | undefined): void {
    // M12: Use constant-time comparison to prevent timing oracle attacks.
    if (!key) {
      throw new ForbiddenException('Invalid service key');
    }
    const provided = Buffer.from(key, 'utf8');
    const expected = Buffer.from(this.internalServiceKey, 'utf8');
    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      throw new ForbiddenException('Invalid service key');
    }
  }

  // ─── Encryption ──────────────────────────────────────────────────────────────

  private encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let enc = cipher.update(plaintext, 'utf8', 'hex');
    enc += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${enc}`;
  }

  private decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new InternalServerErrorException('Invalid encrypted token format');
    const [ivHex, tagHex, enc] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let dec = decipher.update(enc, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  }

  // ─── Token storage ──────────────────────────────────────────────────────────

  async linkAccount(
    userId: string,
    athleteId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: number,
    scope: string,
  ): Promise<void> {
    const existing = await this.credentialRepo.findOneBy({ userId });

    const data = {
      userId,
      athleteId,
      accessTokenEnc: this.encrypt(accessToken),
      refreshTokenEnc: this.encrypt(refreshToken),
      expiresAt: String(expiresAt),
      scope,
    };

    if (existing) {
      Object.assign(existing, data);
      await this.credentialRepo.save(existing);
    } else {
      await this.credentialRepo.save(this.credentialRepo.create(data));
    }

    await this.userRepo.update(userId, { stravaId: athleteId });

    // Fire-and-forget initial backfill for the last 30 days.
    void this.backfillActivities(userId).catch((err) =>
      this.logger.warn(`Backfill failed for ${userId}: ${err}`),
    );
  }

  async unlinkAccount(userId: string): Promise<void> {
    await this.credentialRepo.delete({ userId });
    await this.userRepo.update(userId, { stravaId: null });
  }

  private async getValidAccessToken(userId: string): Promise<string> {
    const cred = await this.credentialRepo.findOneBy({ userId });
    if (!cred) throw new NotFoundException('Strava not connected');

    const nowSec = Math.floor(Date.now() / 1000);
    const expiry = parseInt(cred.expiresAt, 10);

    if (expiry - nowSec > 300) {
      return this.decrypt(cred.accessTokenEnc);
    }

    // Token within 5 min of expiry — refresh it.
    return this.refreshToken(cred);
  }

  private async refreshToken(cred: StravaCredential): Promise<string> {
    const refreshToken = this.decrypt(cred.refreshTokenEnc);

    let data: StravaRefreshResponse;
    try {
      const resp = await firstValueFrom(
        this.httpService.post<StravaRefreshResponse>(
          'https://www.strava.com/oauth/token',
          new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );
      data = resp.data;
    } catch {
      throw new InternalServerErrorException('Failed to refresh Strava token');
    }

    cred.accessTokenEnc = this.encrypt(data.access_token);
    cred.refreshTokenEnc = this.encrypt(data.refresh_token);
    cred.expiresAt = String(data.expires_at);
    await this.credentialRepo.save(cred);

    return data.access_token;
  }

  // ─── Strava API ──────────────────────────────────────────────────────────────

  private async fetchActivity(
    accessToken: string,
    activityId: string,
  ): Promise<StravaAthleteActivity> {
    const resp = await firstValueFrom(
      this.httpService.get<StravaAthleteActivity>(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    );
    return resp.data;
  }

  private mapActivity(userId: string, a: StravaAthleteActivity): StravaActivity {
    const entity = new StravaActivity();
    entity.stravaId = String(a.id);
    entity.userId = userId;
    entity.type = a.type;
    entity.name = a.name;
    entity.distanceMeters = a.distance ?? 0;
    entity.movingTimeSeconds = a.moving_time ?? 0;
    entity.elapsedTimeSeconds = a.elapsed_time ?? 0;
    entity.totalElevationGain = a.total_elevation_gain ?? null;
    entity.averageSpeed = a.average_speed ?? null;
    entity.averageHeartrate = a.average_heartrate ?? null;
    entity.calories = a.kilojoules ? a.kilojoules * 0.239006 : null;
    entity.startDate = new Date(a.start_date);
    entity.raw = a as Record<string, unknown>;
    return entity;
  }

  private async upsertActivity(userId: string, a: StravaAthleteActivity): Promise<void> {
    const mapped = this.mapActivity(userId, a);
    await this.activityRepo
      .createQueryBuilder()
      .insert()
      .into(StravaActivity)
      .values(mapped as unknown as Record<string, unknown>)
      .orUpdate(
        ['type', 'name', 'distance_meters', 'moving_time_seconds', 'elapsed_time_seconds',
          'total_elevation_gain', 'average_speed', 'average_heartrate', 'calories',
          'start_date', 'raw'],
        ['strava_id'],
      )
      .execute();
  }

  // ─── Backfill ────────────────────────────────────────────────────────────────

  private async backfillActivities(userId: string): Promise<void> {
    const accessToken = await this.getValidAccessToken(userId);
    const after = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    let page = 1;

    while (true) {
      let activities: StravaAthleteActivity[];
      try {
        const resp = await firstValueFrom(
          this.httpService.get<StravaAthleteActivity[]>(
            'https://www.strava.com/api/v3/athlete/activities',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              params: { after, per_page: 100, page },
            },
          ),
        );
        activities = resp.data;
      } catch (err) {
        this.logger.warn(`Backfill page ${page} failed for ${userId}: ${err}`);
        break;
      }

      if (!activities.length) break;

      for (const activity of activities) {
        await this.upsertActivity(userId, activity);
      }

      if (activities.length < 100) break;
      page++;
    }
  }

  // ─── Webhook ─────────────────────────────────────────────────────────────────

  verifyWebhookChallenge(
    mode: string,
    verifyToken: string,
    challenge: string,
  ): string {
    if (mode !== 'subscribe' || verifyToken !== this.webhookVerifyToken) {
      throw new BadRequestException('Invalid webhook verification request');
    }
    return challenge;
  }

  async handleWebhookEvent(event: {
    object_type: string;
    object_id: number;
    aspect_type: string;
    owner_id: number;
  }): Promise<void> {
    if (event.object_type !== 'activity') return;

    const athleteId = String(event.owner_id);
    const cred = await this.credentialRepo.findOneBy({ athleteId });
    if (!cred) return; // Athlete not linked to any BGSC account.

    const activityId = String(event.object_id);

    if (event.aspect_type === 'delete') {
      await this.activityRepo.delete({ stravaId: activityId });
      return;
    }

    try {
      const accessToken = await this.getValidAccessToken(cred.userId);
      const activity = await this.fetchActivity(accessToken, activityId);
      await this.upsertActivity(cred.userId, activity);
    } catch (err) {
      this.logger.warn(`Webhook activity sync failed (${activityId}): ${err}`);
    }
  }

  // ─── Public queries ──────────────────────────────────────────────────────────

  async getActivities(
    userId: string,
    page: number,
    limit: number,
  ): Promise<StravaActivity[]> {
    return this.activityRepo.find({
      where: { userId },
      order: { startDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getWeeklyStats(userId: string): Promise<{
    totalDistance: number;
    totalTime: number;
    activityCount: number;
    byType: Record<string, { distance: number; time: number; count: number }>;
  }> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activities = await this.activityRepo
      .createQueryBuilder('a')
      .where('a.user_id = :userId', { userId })
      .andWhere('a.start_date >= :weekAgo', { weekAgo })
      .getMany();

    const byType: Record<string, { distance: number; time: number; count: number }> = {};
    let totalDistance = 0;
    let totalTime = 0;

    for (const a of activities) {
      totalDistance += a.distanceMeters;
      totalTime += a.movingTimeSeconds;
      if (!byType[a.type]) byType[a.type] = { distance: 0, time: 0, count: 0 };
      byType[a.type].distance += a.distanceMeters;
      byType[a.type].time += a.movingTimeSeconds;
      byType[a.type].count++;
    }

    return { totalDistance, totalTime, activityCount: activities.length, byType };
  }

  async isConnected(userId: string): Promise<boolean> {
    const count = await this.credentialRepo.countBy({ userId });
    return count > 0;
  }
}
