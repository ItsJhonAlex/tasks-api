import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { TaskStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { TasksService } from './tasks.service.js';

describe('TasksService', () => {
  let service: TasksService;

  const prismaMock = {
    $transaction: vi.fn(),
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = moduleRef.get(TasksService);
  });

  it('creates a task converting dueDate to a Date', async () => {
    const created = { id: 'task-1' };
    prismaMock.task.create.mockResolvedValue(created);

    const result = await service.create({
      title: 'Preparar release',
      assignee: 'alice',
      dueDate: '2026-12-31T00:00:00.000Z',
    });

    expect(result).toBe(created);
    expect(prismaMock.task.create).toHaveBeenCalledWith({
      data: {
        title: 'Preparar release',
        description: undefined,
        status: undefined,
        assignee: 'alice',
        dueDate: new Date('2026-12-31T00:00:00.000Z'),
      },
    });
  });

  describe('NotFoundException', () => {
    it('is thrown by findOne when the task does not exist', async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('is thrown by update and remove when Prisma reports P2025', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      });
      prismaMock.task.update.mockRejectedValue(p2025);
      prismaMock.task.delete.mockRejectedValue(p2025);

      await expect(service.update('missing', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not hide other database errors', async () => {
      const failure = new Error('connection lost');
      prismaMock.task.delete.mockRejectedValue(failure);

      await expect(service.remove('id')).rejects.toBe(failure);
    });
  });

  describe('findAll pagination', () => {
    it('computes skip, take and totalPages and applies filters', async () => {
      prismaMock.task.findMany.mockResolvedValue([{ id: 'a' }]);
      prismaMock.task.count.mockResolvedValue(25);

      const query = Object.assign(new QueryTasksDto(), {
        status: TaskStatus.DONE,
        assignee: 'bob',
        page: 3,
        limit: 10,
      });
      const result = await service.findAll(query);

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: { status: TaskStatus.DONE, assignee: 'bob' },
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 10,
      });
      expect(result).toEqual({
        data: [{ id: 'a' }],
        meta: { page: 3, limit: 10, total: 25, totalPages: 3 },
      });
    });

    it('rounds totalPages up and returns 0 when there are no results', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      prismaMock.task.count.mockResolvedValue(21);
      const withResults = await service.findAll(new QueryTasksDto());
      expect(withResults.meta.totalPages).toBe(3);

      prismaMock.task.count.mockResolvedValue(0);
      const empty = await service.findAll(new QueryTasksDto());
      expect(empty.meta).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });
  });
});
