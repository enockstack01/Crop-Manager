import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ai from '../controllers/ai.controller.js';

const router = Router();

// a burst guard on top of the per-user daily allowance (the model calls cost money)
router.use(rateLimit({
  windowMs: 60_000, max: 12, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { message: 'Too many AI requests. Wait a minute and try again.' },
}));

router.get('/status', ai.status);
router.post('/diagnose', ai.diagnose);
router.post('/insights', ai.insights);
router.post('/advice', ai.advice);
router.post('/season-summary', ai.seasonSummary);
router.post('/parse-record', ai.parseRecord);
router.post('/chat', ai.chat);
router.post('/calculator-report', ai.calculatorReport);
router.post('/weather-briefing', ai.weatherBriefing);

export default router;
