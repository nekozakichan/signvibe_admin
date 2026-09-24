import { Router } from 'express';
import {
  createResetRequest,
  getResetRequests,
  sendResetLink,
  dismissResetRequest,
} from '../controllers/resetRequestController.js';

const router = Router();

router.post('/', createResetRequest);
router.get('/', getResetRequests);
router.post('/:id/send', sendResetLink);
router.patch('/:id/dismiss', dismissResetRequest);

export default router;
