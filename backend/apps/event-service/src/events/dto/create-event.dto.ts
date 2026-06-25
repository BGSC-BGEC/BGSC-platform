import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { EventType } from '../enums/event-type.enum';

function IsBeforeField(otherField: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isBeforeField',
      target: (object as Record<string, unknown>).constructor as Function,
      propertyName,
      constraints: [otherField],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedField] = args.constraints as [string];
          const related = (args.object as Record<string, unknown>)[relatedField];
          if (typeof value !== 'string' || typeof related !== 'string') return true;
          return new Date(value) < new Date(related);
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedField] = args.constraints as [string];
          return `${args.property} must be before ${relatedField}`;
        },
      },
    });
  };
}

export class CreateEventDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(EventType)
  type!: EventType;

  @IsDateString()
  @IsBeforeField('endDate', { message: 'startDate must be before endDate' })
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsDateString()
  @IsBeforeField('startDate', { message: 'registrationDeadline must be before startDate' })
  registrationDeadline!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  venue?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  rulesPdfUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @IsOptional()
  @IsBoolean()
  needsLeaderboard?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
