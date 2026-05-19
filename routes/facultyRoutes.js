import express from 'express';
import { body } from 'express-validator';
import * as subjectController from '../controllers/subjectController.js';
import * as attendanceController from '../controllers/attendanceController.js';
import * as marksController from '../controllers/marksController.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import validate from '../middleware/validate.js';
import { Student, User } from '../models/index.js';
import paginate from '../utils/paginate.js';

const router = express.Router();

router.use(auth);
router.use(role('faculty'));

router.get('/students', async (req, res, next) => {
  try {
    const { limit, offset, meta } = paginate(req.query);

    const { count, rows } = await Student.findAndCountAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [[{ model: User, as: 'user' }, 'name', 'ASC']],
      limit,
      offset,
    });

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: { students: rows },
      pagination: meta(count),
    });
  } catch (error) {
    next(error);
  }
});

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

router.get('/subjects', subjectController.getAllSubjects);

router.delete('/subjects/:id', subjectController.deleteSubject);

router.post(
  '/attendance',
  [
    body('subject_id')
      .isInt({ min: 1 }).withMessage('Valid subject ID is required'),
    body('date')
      .isDate().withMessage('Valid date is required (YYYY-MM-DD)'),
    body('records')
      .isArray({ min: 1 }).withMessage('At least one attendance record is required'),
    body('records.*.student_id')
      .isInt({ min: 1 }).withMessage('Valid student ID is required'),
    body('records.*.status')
      .isIn(['present', 'absent']).withMessage('Status must be present or absent'),
    validate,
  ],
  attendanceController.markAttendance
);

router.get('/attendance/:subjectId', attendanceController.getAttendanceBySubject);

router.post(
  '/marks',
  [
    body('subject_id')
      .isInt({ min: 1 }).withMessage('Valid subject ID is required'),
    body('records')
      .isArray({ min: 1 }).withMessage('At least one marks record is required'),
    body('records.*.student_id')
      .isInt({ min: 1 }).withMessage('Valid student ID is required'),
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

router.get('/marks/:subjectId', marksController.getMarksBySubject);

export default router;
