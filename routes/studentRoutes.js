import express from 'express';
import * as studentController from '../controllers/studentController.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';

const router = express.Router();

router.use(auth);
router.use(role('student'));

router.get('/dashboard', studentController.getDashboard);

router.get('/attendance', studentController.getMyAttendance);

router.get('/marks', studentController.getMyMarks);

router.get('/subjects', studentController.getMySubjects);

export default router;
