import express from 'express';
import * as studentController from '../controllers/studentController.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import { cacheMiddleware } from '../middleware/cache.js';

const router = express.Router();

router.use(auth);
router.use(role('student'));

router.get('/dashboard', cacheMiddleware('student:dashboard', 120), studentController.getDashboard);

router.get('/attendance', cacheMiddleware('student:attendance', 180), studentController.getMyAttendance);

router.get('/marks', cacheMiddleware('student:marks', 180), studentController.getMyMarks);

router.get('/subjects', cacheMiddleware('student:subjects', 300), studentController.getMySubjects);

export default router;
