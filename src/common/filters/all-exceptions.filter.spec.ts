import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  const reply = vi.fn();
  const adapterHost = {
    httpAdapter: {
      reply,
      getRequestUrl: () => '/tasks/1',
    },
  } as unknown as HttpAdapterHost;
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
  } as unknown as ArgumentsHost;

  const filter = new AllExceptionsFilter(adapterHost);

  beforeEach(() => {
    reply.mockReset();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  const lastReply = () => reply.mock.calls[0] as [unknown, any, number];

  it('keeps the status and message of HttpExceptions', () => {
    filter.catch(new BadRequestException(['title is too short']), host);

    const [, body, status] = lastReply();
    expect(status).toBe(400);
    expect(body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: ['title is too short'],
      path: '/tasks/1',
    });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it('maps Prisma P2025 to 404', () => {
    filter.catch(
      new Prisma.PrismaClientKnownRequestError('gone', {
        code: 'P2025',
        clientVersion: 'test',
      }),
      host,
    );

    const [, body, status] = lastReply();
    expect(status).toBe(404);
    expect(body.error).toBe('Not Found');
  });

  it('maps unexpected errors to 500 without leaking details', () => {
    const error = new Error('postgres://user:secret@db is down');

    filter.catch(error, host);

    const [, body, status] = lastReply();
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain(error.stack);
  });
});
