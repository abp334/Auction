import { Router } from 'express';
import { login, me, signup, refresh, logout } from '../../controllers/auth.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;


