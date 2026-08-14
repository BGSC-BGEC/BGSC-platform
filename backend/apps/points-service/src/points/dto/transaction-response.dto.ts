import { PointsSource } from '../enums/points-source.enum';
import { TransactionType } from '../enums/transaction-type.enum';

export class TransactionResponseDto {
  id!: string;
  userId!: string;
  amount!: number;
  type!: TransactionType;
  source!: PointsSource;
  referenceId?: string | null;
  createdAt!: Date;
}
