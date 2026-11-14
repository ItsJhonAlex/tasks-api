import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { TaskStatus } from '../src/generated/prisma/enums.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const assignees = ['alice', 'bob', 'carla', 'diego'];
const statuses = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.DONE];
const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  await prisma.task.deleteMany();

  const now = Date.now();
  const tasks = Array.from({ length: 20 }, (_, i) => ({
    title: `Tarea de ejemplo ${String(i + 1).padStart(2, '0')}`,
    description:
      i % 3 === 0 ? undefined : `Descripción de la tarea de ejemplo ${i + 1}`,
    status: statuses[i % statuses.length],
    assignee: assignees[i % assignees.length],
    dueDate: new Date(now + (i - 5) * DAY_MS),
  }));

  const result = await prisma.task.createMany({ data: tasks });
  console.log(`Seed completado: ${result.count} tareas creadas`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
