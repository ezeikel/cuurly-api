/* eslint-disable no-param-reassign */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  // TODO: maybe should limit query logging to non production evironments only
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
});

// log query logs to console
// eslint-disable-next-line no-console
prisma.$on('query', e => console.log(e.query));

// middleware to measure perfomance
prisma.$use(async (params, next) => {
  const before = Date.now();

  const result = await next(params);

  const after = Date.now();

  // eslint-disable-next-line no-console
  console.log(
    `Query ${params.model}.${params.action} took ${after - before}ms`,
  );

  return result;
});

// soft delete middleware
prisma.$use(async (params, next) => {
  const modelsWithSoftDelete = ['User', 'Post', 'Comment'];
  // check incoming query type
  if (modelsWithSoftDelete.includes(params.model)) {
    if (params.action === 'delete') {
      // delete queries
      // change action to an update
      params.action = 'update';
      params.args.data = { deletedAt: new Date() };
    }

    if (params.action === 'deleteMany') {
      // delete many queries
      params.action = 'updateMany';
      if (typeof params.args.data !== 'undefined') {
        params.args.data.deletedAt = new Date();
      } else {
        params.args.data = { deletedAt: new Date() };
      }
    }
  }
  return next(params);
});

export default prisma;
