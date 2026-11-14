import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Task 3f2b8a8e-5f0c-4c43-9d7a-2d1d4b6f9c11 not found' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['title must be longer than or equal to 3 characters'],
      },
    ],
  })
  message: string | string[];

  @ApiProperty({ example: '/tasks' })
  path: string;

  @ApiProperty({ example: '2026-11-14T18:00:00.000Z' })
  timestamp: string;
}
