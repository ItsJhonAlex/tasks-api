import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ID = '3f2b8a8e-5f0c-4c43-9d7a-2d1d4b6f9c11';
const task = {
  id: ID,
  title: 'Preparar release',
  description: null,
  status: 'PENDING',
  assignee: 'alice',
  dueDate: '2026-12-31T00:00:00.000Z',
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
};
const validBody = {
  title: 'Preparar release',
  assignee: 'alice',
  dueDate: '2026-12-31T00:00:00.000Z',
};

const notFound = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: 'test',
  });

describe('Tasks (e2e)', () => {
  let app: INestApplication<App>;

  const prismaMock = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
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

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://unused';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /tasks', () => {
    it('creates a task and returns 201', async () => {
      prismaMock.task.create.mockResolvedValue(task);

      const res = await request(app.getHttpServer())
        .post('/tasks')
        .send(validBody)
        .expect(201);

      expect(res.body.id).toBe(ID);
    });

    it('rejects a title shorter than 3 characters with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/tasks')
        .send({ ...validBody, title: 'ab' })
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        path: '/tasks',
      });
      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('title')]),
      );
      expect(typeof res.body.timestamp).toBe('string');
      expect(prismaMock.task.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid status and dueDate with 400', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .send({ ...validBody, status: 'NOPE', dueDate: 'not-a-date' })
        .expect(400);
    });

    it('rejects unknown properties with 400', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .send({ ...validBody, hacker: true })
        .expect(400);
    });
  });

  describe('GET /tasks', () => {
    it('returns data and meta with defaults', async () => {
      prismaMock.task.findMany.mockResolvedValue([task]);
      prismaMock.task.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer()).get('/tasks').expect(200);

      expect(res.body).toEqual({
        data: [task],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('applies filters and pagination from the query string', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.task.count.mockResolvedValue(0);

      await request(app.getHttpServer())
        .get('/tasks?status=DONE&assignee=bob&page=2&limit=5')
        .expect(200);

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: { status: 'DONE', assignee: 'bob' },
        orderBy: { createdAt: 'desc' },
        skip: 5,
        take: 5,
      });
    });

    it.each(['limit=101', 'limit=0', 'page=0', 'page=abc', 'status=NOPE'])(
      'rejects %s with 400',
      async (qs) => {
        await request(app.getHttpServer()).get(`/tasks?${qs}`).expect(400);
      },
    );
  });

  describe('GET /tasks/:id', () => {
    it('returns the task', async () => {
      prismaMock.task.findUniqueOrThrow.mockResolvedValue(task);
      await request(app.getHttpServer()).get(`/tasks/${ID}`).expect(200);
    });

    it('returns 404 when the task does not exist', async () => {
      prismaMock.task.findUniqueOrThrow.mockRejectedValue(notFound());

      const res = await request(app.getHttpServer())
        .get(`/tasks/${ID}`)
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        path: `/tasks/${ID}`,
      });
    });

    it('returns 400 when the id is not a uuid', async () => {
      await request(app.getHttpServer()).get('/tasks/123').expect(400);
      expect(prismaMock.task.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('updates the task', async () => {
      prismaMock.task.update.mockResolvedValue({ ...task, status: 'DONE' });

      const res = await request(app.getHttpServer())
        .patch(`/tasks/${ID}`)
        .send({ status: 'DONE' })
        .expect(200);

      expect(res.body.status).toBe('DONE');
    });

    it('returns 404 when the task does not exist', async () => {
      prismaMock.task.update.mockRejectedValue(notFound());
      await request(app.getHttpServer())
        .patch(`/tasks/${ID}`)
        .send({ status: 'DONE' })
        .expect(404);
    });

    it('returns 400 for an invalid id or body', async () => {
      await request(app.getHttpServer())
        .patch('/tasks/123')
        .send({ status: 'DONE' })
        .expect(400);
      await request(app.getHttpServer())
        .patch(`/tasks/${ID}`)
        .send({ status: 'NOPE' })
        .expect(400);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('deletes the task and returns 204', async () => {
      prismaMock.task.delete.mockResolvedValue(task);
      const res = await request(app.getHttpServer())
        .delete(`/tasks/${ID}`)
        .expect(204);
      expect(res.text).toBe('');
    });

    it('returns 404 when the task does not exist', async () => {
      prismaMock.task.delete.mockRejectedValue(notFound());
      await request(app.getHttpServer()).delete(`/tasks/${ID}`).expect(404);
    });

    it('returns 400 when the id is not a uuid', async () => {
      await request(app.getHttpServer()).delete('/tasks/nope').expect(400);
    });
  });

  describe('unexpected errors', () => {
    it('returns 500 without leaking the error details', async () => {
      prismaMock.task.findUniqueOrThrow.mockRejectedValue(
        new Error('connection string postgres://secret@db is broken'),
      );

      const res = await request(app.getHttpServer())
        .get(`/tasks/${ID}`)
        .expect(500);

      expect(res.body).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      });
      expect(JSON.stringify(res.body)).not.toContain('secret');
      expect(JSON.stringify(res.body)).not.toContain('stack');
    });
  });
});
