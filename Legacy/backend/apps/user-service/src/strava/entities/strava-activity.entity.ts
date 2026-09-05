import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'strava_activities' })
export class StravaActivity {
  // Strava's own activity ID is the primary key — prevents duplicate inserts.
  @PrimaryColumn({ name: 'strava_id', type: 'varchar', length: 30 })
  stravaId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 100 })
  type!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'distance_meters', type: 'float' })
  distanceMeters!: number;

  @Column({ name: 'moving_time_seconds', type: 'integer' })
  movingTimeSeconds!: number;

  @Column({ name: 'elapsed_time_seconds', type: 'integer' })
  elapsedTimeSeconds!: number;

  @Column({ name: 'total_elevation_gain', type: 'float', nullable: true })
  totalElevationGain?: number | null;

  @Column({ name: 'average_speed', type: 'float', nullable: true })
  averageSpeed?: number | null;

  @Column({ name: 'average_heartrate', type: 'float', nullable: true })
  averageHeartrate?: number | null;

  @Column({ name: 'calories', type: 'float', nullable: true })
  calories?: number | null;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  // Full Strava API response stored for forward compatibility.
  @Column({ name: 'raw', type: 'jsonb', default: () => "'{}'::jsonb" })
  raw!: Record<string, unknown>;

  @CreateDateColumn({ name: 'synced_at', type: 'timestamptz' })
  syncedAt!: Date;
}
