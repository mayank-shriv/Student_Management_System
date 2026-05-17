import { Attendance, Student, Subject, User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import paginate from '../utils/paginate.js';
import { delCache, delPattern, getCache, setCache } from '../config/redis.js';

export const markAttendance = async (req, res, next) => {
  try {
    const { subject_id, date, records } = req.body;

    const subject = await Subject.findByPk(subject_id);
    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (subject.faculty_id !== req.user.id) {
      throw new AppError('You can only mark attendance for your own subjects.', 403);
    }

    // Batch-fetch all referenced students in a single query instead of
    // hitting the database once per record (eliminates N+1 problem).
    const studentIds = records.map((r) => r.student_id);
    const students = await Student.findAll({ where: { id: studentIds } });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const results = [];
    for (const record of records) {
      const { student_id, status } = record;

      if (!studentMap.has(student_id)) {
        results.push({ student_id, error: 'Student not found' });
        continue;
      }

      const [attendance, created] = await Attendance.findOrCreate({
        where: { student_id, subject_id, date },
        defaults: { status },
      });

      if (!created) {
        attendance.status = status;
        await attendance.save();
      }

      results.push({
        student_id,
        status,
        action: created ? 'created' : 'updated',
      });
    }

    // Invalidate caches: dashboard for affected students + attendance list for this subject.
    const affectedStudents = await Student.findAll({
      where: { id: studentIds },
      attributes: ['user_id'],
    });
    const invalidations = affectedStudents.map((s) => delCache(`dashboard:${s.user_id}`));
    invalidations.push(delPattern(`attendance:subject:${subject_id}:*`));
    await Promise.all(invalidations);

    res.status(200).json({
      status: 'success',
      message: `Attendance marked for ${date}`,
      data: { results },
    });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceBySubject = async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    const { limit, offset, meta } = paginate(req.query);

    // Cache per subject + page to avoid repeating the expensive 3-table JOIN.
    const cacheKey = `attendance:subject:${subjectId}:page${req.query.page || 1}:limit${limit}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const subject = await Subject.findByPk(subjectId);
    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (subject.faculty_id !== req.user.id) {
      throw new AppError('You can only view attendance for your own subjects.', 403);
    }

    const { count, rows } = await Attendance.findAndCountAll({
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
      order: [['date', 'DESC']],
      limit,
      offset,
    });

    const responseData = {
      status: 'success',
      results: rows.length,
      data: { subject: subject.name, attendance: rows },
      pagination: meta(count),
    };

    // Cache for 2 minutes.
    await setCache(cacheKey, responseData, 120);

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};
