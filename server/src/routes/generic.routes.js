import { Router } from 'express';
import { crudController } from '../lib/crudController.js';

/** Standard REST router for a declarative resource. */
export function genericRouter(resource) {
  const c = crudController(resource);
  const router = Router();
  router.get('/', c.list);
  router.post('/', c.create);
  router.get('/:id', c.getOne);
  router.put('/:id', c.update);
  router.patch('/:id', c.update);
  router.delete('/:id', c.remove);
  return { router, controller: c };
}
