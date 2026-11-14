import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateTaskDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 120 })
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @Length(3, 120)
  title?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @ValidateIf((_, v) => v !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ maxLength: 100, example: 'alice' })
  @ValidateIf((_, v) => v !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assignee?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @ValidateIf((_, v) => v !== undefined)
  @IsDateString()
  dueDate?: string;
}
