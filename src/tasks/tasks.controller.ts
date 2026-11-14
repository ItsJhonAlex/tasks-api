import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { Task } from '../generated/prisma/client.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { PaginatedTasks, TasksService } from './tasks.service.js';

@ApiTags('tasks')
@ApiBadRequestResponse({
  description: 'Validación fallida o id mal formado',
  type: ErrorResponseDto,
})
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() dto: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryTasksDto): Promise<PaginatedTasks> {
    return this.tasksService.findAll(query);
  }

  @Get(':id')
  @ApiNotFoundResponse({
    description: 'La tarea no existe',
    type: ErrorResponseDto,
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Task> {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @ApiNotFoundResponse({
    description: 'La tarea no existe',
    type: ErrorResponseDto,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<Task> {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNotFoundResponse({
    description: 'La tarea no existe',
    type: ErrorResponseDto,
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tasksService.remove(id);
  }
}
