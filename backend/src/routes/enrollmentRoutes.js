import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { enrollStudents, enrollCurrentStudents, updateEnrollment } from '../controllers/enrollmentController.js';

const router = Router();

// Enrollment is managed by teachers (and the admin).
router.use(requireRole('teacher', 'admin'));

router.post('/', enrollStudents);
router.post('/enroll-current', enrollCurrentStudents);
router.patch('/:id', updateEnrollment);

export default router;
