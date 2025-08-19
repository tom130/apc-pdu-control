import { Elysia } from 'elysia';

const port = 3001;

const app = new Elysia()
  .get('/health', () => ({ status: 'ok' }))
  .listen(port);

console.log(`Test server running on port ${port}`);