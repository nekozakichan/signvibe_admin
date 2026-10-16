import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import {
  createTeacher,
  getTeachers,
  toggleTeacherStatus,
  archiveTeacher,
  restoreTeacher,
  sendTeacherCredentialsEmail,
} from '../controllers/teacherController.js';

const router = Router();

// Managing teacher accounts is the admin's job only.
router.use(requireRole('admin'));

router.get('/', getTeachers);
router.post('/', createTeacher);
router.patch('/:uid/status', toggleTeacherStatus);
router.patch('/:uid/archive', archiveTeacher);
router.patch('/:uid/restore', restoreTeacher);
router.post('/:uid/send-credentials', sendTeacherCredentialsEmail);

export default router;
