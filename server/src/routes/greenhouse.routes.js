import { Router } from 'express';
import { limiter as rateLimit } from '../lib/rateLimit.js';
import * as g from '../controllers/greenhouse.controller.js';
import * as h from '../controllers/greenhouseHouses.controller.js';
import { greenhouseContext, only } from '../lib/greenhouse/access.js';

const router = Router();

// checking a photo runs the fruit counter, which is the costly part: a burst guard per farmer
const heavy = rateLimit({
  name: 'greenhouse-check', windowMs: 60_000, max: Number(process.env.GREENHOUSE_CHECKS_PER_MINUTE || 20), standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { message: 'Too many photo checks. Wait a minute and try again.' },
});

// who is asking, and for which farm (their own, or one they were invited to)
router.use(greenhouseContext);
router.get('/access', g.access);
router.get('/team', only('owner'), g.listTeam);
router.post('/team', only('owner'), g.inviteMember);
router.put('/team/:id', only('owner'), g.changeMember);
router.delete('/team/:id', only('owner'), g.removeMember);

router.get('/dashboard', only('owner', 'manager'), g.dashboard);
router.get('/houses', h.listHouses);
router.post('/houses', only('owner'), h.createHouse);
router.get('/houses/:id/layout', only('owner', 'collector'), h.getLayout); // the plan and 3D data: not for the farm manager
router.get('/houses/:id/health', only('owner', 'manager'), h.healthReport); // the diseased plants, with every detail
router.get('/houses/:id/plants/:row/:plant', h.plantHistory);
router.put('/houses/:id/positions', only('owner', 'collector'), h.setPosition);
router.post('/houses/:id/positions', only('owner', 'collector'), h.addPositions);
router.get('/houses/:id/positions/log', only('owner', 'manager'), h.positionLog);
router.put('/houses/:id', only('owner'), h.updateHouse);
router.delete('/houses/:id', only('owner'), h.removeHouse);
router.get('/catalog', g.catalog);
router.get('/crops', g.listCrops);
router.post('/crops', only('owner'), g.addCrop);
router.delete('/crops/:id', only('owner'), g.removeCrop);

router.post('/check', only('owner', 'collector'), heavy, g.checkPhoto);
router.get('/counts', g.listCounts);
router.post('/counts', only('owner', 'collector'), heavy, g.createCount);
router.get('/counts/:id', g.getCount);
router.put('/counts/:id', only('owner', 'collector'), heavy, g.updateCount);
router.post('/counts/:id/verify', only('owner'), heavy, g.reverify);
router.delete('/counts/:id', only('owner'), g.removeCount);

export default router;
