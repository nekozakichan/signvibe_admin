import { Router } from 'express';
import {
  getResetRequests,
  sendResetLink,
  dismissResetRequest,
} from '../controllers/resetRequestController.js';

const router = Router();

router.get('/', getResetRequests);
router.post('/:id/send', sendResetLink);
router.patch('/:id/dismiss', dismissResetRequest);

export default router;
