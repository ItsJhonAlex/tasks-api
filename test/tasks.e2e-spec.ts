import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const MISSING_ID = '3f2b8a8e-5f0c-4c43-9d7a-2d1d4b6f9c11';

const validBody = {
  title: 'Preparar release',
  assignee: 'alice',
  dueDate: '2026-12-31T00:00:00.000Z',
};

describe('Tasks (e2e, test database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.task.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('POST /tasks creates a task and returns 201', async () => {
    const res = await http().post('/tasks').send(validBody).expect(201);

    expect(res.body).toMatchObject({
      title: 'Preparar release',
      assignee: 'alice',
      status: 'PENDING',
    });
    expect(await prisma.task.count()).toBe(1);
  });

  it('POST /tasks rejects an invalid body with 400 and stores nothing', async () => {
    const res = await http()
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
    expect(await prisma.task.count()).toBe(0);
  });

  it('GET /tasks filters by status and paginates', async () => {
    await prisma.task.createMany({
      data: [
        ...Array.from({ length: 3 }, (_, i) => ({
          ...validBody,
          title: `Done ${i}`,
          dueDate: new Date(validBody.dueDate),
          status: 'DONE' as const,
        })),
        {
          ...validBody,
          title: 'Pending one',
          dueDate: new Date(validBody.dueDate),
        },
      ],
    });

    const res = await http().get('/tasks?status=DONE&limit=2').expect(200);

    expect(res.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(res.body.data).toHaveLength(2);
    expect(
      res.body.data.every((t: { status: string }) => t.status === 'DONE'),
    ).toBe(true);
  });

  it('GET /tasks/:id returns 404 for a missing id and 400 for a malformed one', async () => {
    const missing = await http().get(`/tasks/${MISSING_ID}`).expect(404);
    expect(missing.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      path: `/tasks/${MISSING_ID}`,
    });

    await http().get('/tasks/123').expect(400);
  });

  it('DELETE /tasks/:id returns 204 and then 404', async () => {
    const created = await http().post('/tasks').send(validBody).expect(201);

    const res = await http().delete(`/tasks/${created.body.id}`).expect(204);
    expect(res.text).toBe('');
    expect(await prisma.task.count()).toBe(0);

    await http().delete(`/tasks/${created.body.id}`).expect(404);
  });

  it('PATCH /tasks/:id updates only the given fields', async () => {
    const created = await http().post('/tasks').send(validBody).expect(201);

    const res = await http()
      .patch(`/tasks/${created.body.id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    expect(res.body).toMatchObject({
      title: 'Preparar release',
      status: 'IN_PROGRESS',
    });
  });
});
