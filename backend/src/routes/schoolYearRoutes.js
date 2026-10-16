import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { startNewSchoolYear } from '../controllers/schoolYearController.js';

const router = Router();

// Admin only — this changes every student's grade.
router.post('/start', requireRole('admin'), startNewSchoolYear);

export default router;
