import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import {
  createResetRequest,
  getResetRequests,
  sendResetLink,
  dismissResetRequest,
} from '../controllers/resetRequestController.js';

const router = Router();

// Public on purpose: a teacher who forgot their password isn't logged in.
// (The controller only accepts emails that belong to a teacher account.)
router.post('/', createResetRequest);

// Reviewing and acting on requests is the admin's job.
router.get('/', requireRole('admin'), getResetRequests);
router.post('/:id/send', requireRole('admin'), sendResetLink);
router.patch('/:id/dismiss', requireRole('admin'), dismissResetRequest);

export default router;
