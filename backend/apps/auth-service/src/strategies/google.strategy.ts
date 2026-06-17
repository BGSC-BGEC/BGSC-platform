import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('auth.google.clientId')!,
      clientSecret: configService.get<string>('auth.google.clientSecret')!,
      callbackURL: configService.get<string>('auth.google.callbackUrl')!,
      scope: ['openid', 'email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): {
    accessToken: string;
    refreshToken: string;
    googleId: string;
    email: string | undefined;
    emailVerified: boolean;
    firstName: string | undefined;
    lastName: string | undefined;
    picture: string | undefined;
  } {
    const primaryEmail = profile.emails?.[0];

    return {
      accessToken,
      refreshToken,
      googleId: profile.id,
      email: primaryEmail?.value?.toLowerCase(),
      emailVerified: primaryEmail?.verified ?? false,
      firstName: profile.name?.givenName,
      lastName: profile.name?.familyName,
      picture: profile.photos?.[0]?.value,
    };
  }
}
