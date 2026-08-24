import { Router } from 'express';
import {
  createStudent,
  getStudents,
  toggleStudentStatus,
  archiveStudent,
  restoreStudent,
  sendStudentCredentialsEmail,
} from '../controllers/studentController.js';

const router = Router();

router.get('/', getStudents);
router.post('/', createStudent);
router.patch('/:uid/status', toggleStudentStatus);
router.patch('/:uid/archive', archiveStudent);
router.patch('/:uid/restore', restoreStudent);
router.post('/:uid/send-credentials', sendStudentCredentialsEmail);

export default router;
