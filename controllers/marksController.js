import { Mark, Student, Subject, User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import paginate from '../utils/paginate.js';

export const addMarks = async (req, res, next) => {
  try {
    const { subject_id, records } = req.body;

    const subject = await Subject.findByPk(subject_id);
    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (subject.faculty_id !== req.user.id) {
      throw new AppError('You can only add marks for your own subjects.', 403);
    }

    const studentIds = records.map((r) => r.student_id);
    const students = await Student.findAll({ where: { id: studentIds } });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const existingMarks = await Mark.findAll({
      where: { student_id: studentIds, subject_id },
    });
    const existingSet = new Set(existingMarks.map((m) => m.student_id));

    const results = [];
    for (const record of records) {
      const { student_id, marks } = record;

      if (!studentMap.has(student_id)) {
        results.push({ student_id, error: 'Student not found' });
        continue;
      }

      if (existingSet.has(student_id)) {
        results.push({
          student_id,
          error: 'Marks already exist. Use PUT to update.',
        });
        continue;
      }

      const mark = await Mark.create({ student_id, subject_id, marks });
      existingSet.add(student_id);
      results.push({ student_id, marks: mark.marks, action: 'created' });
    }

    res.status(201).json({
      status: 'success',
      data: { results },
    });
  } catch (error) {
    next(error);
  }
};

export const updateMarks = async (req, res, next) => {
  try {
    const { marks } = req.body;

    const mark = await Mark.findByPk(req.params.id);
    if (!mark) {
      throw new AppError('Mark record not found.', 404);
    }

    const subject = await Subject.findByPk(mark.subject_id);
    if (!subject || subject.faculty_id !== req.user.id) {
      throw new AppError('You can only update marks for your own subjects.', 403);
    }

    mark.marks = marks;
    await mark.save();

    res.status(200).json({
      status: 'success',
      data: { mark },
    });
  } catch (error) {
    next(error);
  }
};

export const getMarksBySubject = async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    const { limit, offset, meta } = paginate(req.query);

    const subject = await Subject.findByPk(subjectId);
    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (subject.faculty_id !== req.user.id) {
      throw new AppError('You can only view marks for your own subjects.', 403);
    }

    const { count, rows } = await Mark.findAndCountAll({
      where: { subject_id: subjectId },
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['id', 'enrollment_no', 'department'],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['name', 'email'],
            },
          ],
        },
      ],
      order: [[{ model: Student, as: 'student' }, { model: User, as: 'user' }, 'name', 'ASC']],
      limit,
      offset,
    });

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: { subject: subject.name, marks: rows },
      pagination: meta(count),
    });
  } catch (error) {
    next(error);
  }
};
