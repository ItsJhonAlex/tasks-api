import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { TasksService } from './tasks.service.js';
import { TaskStatus } from '../generated/prisma/enums.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';

describe('TasksService', () => {
  let service: TasksService;

  const prismaMock = {
    $transaction: vi.fn(),
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
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

  it('converts dueDate to Date on create', async () => {
    prismaMock.task.create.mockResolvedValue({ id: 'x' });

    await service.create({
      title: 'Hello',
      assignee: 'alice',
      dueDate: '2026-12-31T00:00:00.000Z',
    });

    expect(prismaMock.task.create).toHaveBeenCalledWith({
      data: {
        title: 'Hello',
        assignee: 'alice',
        dueDate: new Date('2026-12-31T00:00:00.000Z'),
      },
    });
  });

  describe('findAll', () => {
    it('paginates, filters and orders by createdAt desc', async () => {
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
      expect(prismaMock.task.count).toHaveBeenCalledWith({
        where: { status: TaskStatus.DONE, assignee: 'bob' },
      });
      expect(result).toEqual({
        data: [{ id: 'a' }],
        meta: { page: 3, limit: 10, total: 25, totalPages: 3 },
      });
    });

    it('returns totalPages 0 when there are no results', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.task.count.mockResolvedValue(0);

      const result = await service.findAll(new QueryTasksDto());

      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });
  });

  it('only converts dueDate on update when it is provided', async () => {
    prismaMock.task.update.mockResolvedValue({});

    await service.update('id-1', { title: 'New title' });

    expect(prismaMock.task.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { title: 'New title', dueDate: undefined },
    });
  });
});
