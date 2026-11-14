import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';

export interface PaginatedTasks {
  data: Task[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTaskDto): Promise<Task> {
    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        assignee: dto.assignee,
        dueDate: new Date(dto.dueDate),
      },
    });
  }

  async findAll(query: QueryTasksDto): Promise<PaginatedTasks> {
    const { status, assignee, page, limit } = query;
    const where: Prisma.TaskWhereInput = { status, assignee };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw this.notFound(id);
    return task;
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    try {
      return await this.prisma.task.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          status: dto.status,
          assignee: dto.assignee,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        },
      });
    } catch (error) {
      throw this.mapNotFound(error, id);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.task.delete({ where: { id } });
    } catch (error) {
      throw this.mapNotFound(error, id);
    }
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException(`Task ${id} not found`);
  }

  private mapNotFound(error: unknown, id: string): unknown {
    const isRecordNotFound =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025';
    return isRecordNotFound ? this.notFound(id) : error;
  }
}
