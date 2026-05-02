import { Mark, Student, Subject, User } from '../models/index.js';
import AppError from '../utils/AppError.js';

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

    const results = [];
    for (const record of records) {
      const { student_id, marks } = record;

      const student = await Student.findByPk(student_id);
      if (!student) {
        results.push({ student_id, error: 'Student not found' });
        continue;
      }

      const existing = await Mark.findOne({
        where: { student_id, subject_id },
      });

      if (existing) {
        results.push({
          student_id,
          error: 'Marks already exist. Use PUT to update.',
        });
        continue;
      }

      const mark = await Mark.create({ student_id, subject_id, marks });
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

    const subject = await Subject.findByPk(subjectId);
    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (subject.faculty_id !== req.user.id) {
      throw new AppError('You can only view marks for your own subjects.', 403);
    }

    const marks = await Mark.findAll({
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
    });

    res.status(200).json({
      status: 'success',
      results: marks.length,
      data: { subject: subject.name, marks },
    });
  } catch (error) {
    next(error);
  }
};
