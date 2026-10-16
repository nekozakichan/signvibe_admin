import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import {
  createStudent,
  getStudents,
  toggleStudentStatus,
  archiveStudent,
  restoreStudent,
  sendStudentCredentialsEmail,
} from '../controllers/studentController.js';

const router = Router();

// Student accounts are managed by teachers (and the admin).
router.use(requireRole('teacher', 'admin'));

router.get('/', getStudents);
router.post('/', createStudent);
router.patch('/:uid/status', toggleStudentStatus);
router.patch('/:uid/archive', archiveStudent);
router.patch('/:uid/restore', restoreStudent);
router.post('/:uid/send-credentials', sendStudentCredentialsEmail);

export default router;
