import express from 'express';
import { body, param } from 'express-validator';
import * as subjectController from '../controllers/subjectController.js';
import * as attendanceController from '../controllers/attendanceController.js';
import * as marksController from '../controllers/marksController.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import validate from '../middleware/validate.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { Student } from '../models/index.js';
import paginate from '../utils/paginate.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

router.use(auth);
router.use(role('faculty'));

router.get('/students', cacheMiddleware('students', 300), catchAsync(async (req, res) => {
  const { limit, offset, meta } = paginate(req.query);

  const allStudents = await Student.find()
    .populate('user', 'name email');

  // Sort by user name (in-memory since student list is bounded by class size)
  allStudents.sort((a, b) => {
    const nameA = a.user?.name || '';
    const nameB = b.user?.name || '';
    return nameA.localeCompare(nameB);
  });

  const count = allStudents.length;
  const rows = allStudents.slice(offset, offset + limit);

  res.status(200).json({
    status: 'success',
    results: rows.length,
    data: { students: rows },
    pagination: meta(count),
  });
}));

router.post(
  '/subjects',
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Subject name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Subject name must be 2-100 characters'),
    body('code')
      .trim()
      .notEmpty().withMessage('Subject code is required')
      .isLength({ min: 2, max: 20 }).withMessage('Subject code must be 2-20 characters'),
    validate,
  ],
  subjectController.createSubject
);

router.get('/subjects', cacheMiddleware('subjects', 600), subjectController.getAllSubjects);

router.delete(
  '/subjects/:id',
  [
    param('id').isMongoId().withMessage('Valid subject ID is required'),
    validate,
  ],
  subjectController.deleteSubject
);

router.post(
  '/attendance',
  [
    body('subject_id')
      .isMongoId().withMessage('Valid subject ID is required'),
    body('date')
      .isDate().withMessage('Valid date is required (YYYY-MM-DD)'),
    body('records')
      .isArray({ min: 1 }).withMessage('At least one attendance record is required'),
    body('records.*.student_id')
      .isMongoId().withMessage('Valid student ID is required'),
    body('records.*.status')
      .isIn(['present', 'absent']).withMessage('Status must be present or absent'),
    validate,
  ],
  attendanceController.markAttendance
);

router.get('/attendance/:subjectId', cacheMiddleware('attendance', 180), attendanceController.getAttendanceBySubject);

router.post(
  '/marks',
  [
    body('subject_id')
      .isMongoId().withMessage('Valid subject ID is required'),
    body('records')
      .isArray({ min: 1 }).withMessage('At least one marks record is required'),
    body('records.*.student_id')
      .isMongoId().withMessage('Valid student ID is required'),
    body('records.*.marks')
      .isInt({ min: 0, max: 100 }).withMessage('Marks must be between 0 and 100'),
    validate,
  ],
  marksController.addMarks
);

router.put(
  '/marks/:id',
  [
    body('marks')
      .isInt({ min: 0, max: 100 }).withMessage('Marks must be between 0 and 100'),
    validate,
  ],
  marksController.updateMarks
);

router.get('/marks/:subjectId', cacheMiddleware('marks', 180), marksController.getMarksBySubject);

export default router;
