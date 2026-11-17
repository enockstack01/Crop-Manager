import { Router } from 'express';
import { limiter as rateLimit } from '../lib/rateLimit.js';
import * as g from '../controllers/greenhouse.controller.js';

const router = Router();

// checking a photo runs the fruit counter, which is the costly part: a burst guard per farmer
const heavy = rateLimit({
  name: 'greenhouse-check', windowMs: 60_000, max: Number(process.env.GREENHOUSE_CHECKS_PER_MINUTE || 20), standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { message: 'Too many photo checks. Wait a minute and try again.' },
});

router.get('/dashboard', g.dashboard);
router.get('/catalog', g.catalog);
router.get('/crops', g.listCrops);
router.post('/crops', g.addCrop);
router.delete('/crops/:id', g.removeCrop);

router.post('/check', heavy, g.checkPhoto);
router.get('/counts', g.listCounts);
router.post('/counts', heavy, g.createCount);
router.get('/counts/:id', g.getCount);
router.put('/counts/:id', heavy, g.updateCount);
router.post('/counts/:id/verify', heavy, g.reverify);
router.delete('/counts/:id', g.removeCount);

export default router;
