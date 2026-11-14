import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TaskStatus } from '../../generated/prisma/enums.js';

export class CreateTaskDto {
  @ApiProperty({ minLength: 3, maxLength: 120, example: 'Preparar release' })
  @IsString()
  @Length(3, 120)
  title: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.PENDING })
  @ValidateIf((_, v) => v !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ maxLength: 100, example: 'alice' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assignee: string;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
  @IsDateString({ strict: true })
  dueDate: string;
}
