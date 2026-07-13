import { Attendance, Student, Subject, User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import paginate from '../utils/paginate.js';
import { invalidateCache } from '../middleware/cache.js';

export const markAttendance = catchAsync(async (req, res, next) => {
  const { subject_id, date, records } = req.body;

  // Validate date is not in the future
  const attendanceDate = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (attendanceDate > today) {
    throw new AppError('Cannot mark attendance for a future date.', 400);
  }

  const subject = await Subject.findById(subject_id);
  if (!subject) {
    throw new AppError('Subject not found.', 404);
  }

  if (subject.faculty_id.toString() !== req.user.id) {
    throw new AppError('You can only mark attendance for your own subjects.', 403);
  }

  const studentIds = records.map((r) => r.student_id);
  const students = await Student.find({ _id: { $in: studentIds } });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Separate valid and invalid records
  const validRecords = [];
  const errorResults = [];
  for (const record of records) {
    if (!studentMap.has(record.student_id)) {
      errorResults.push({ student_id: record.student_id, error: 'Student not found' });
    } else {
      validRecords.push({
        student_id: record.student_id,
        subject_id,
        date,
        status: record.status,
      });
    }
  }

  // Bulk upsert valid records using bulkWrite instead of Sequelize bulkCreate
  let bulkResults = [];
  if (validRecords.length > 0) {
    const bulkOps = validRecords.map((r) => ({
      updateOne: {
        filter: { student_id: r.student_id, subject_id: r.subject_id, date: r.date },
        update: { $set: { status: r.status } },
        upsert: true,
      },
    }));
    await Attendance.bulkWrite(bulkOps);
    bulkResults = validRecords.map((r) => ({
      student_id: r.student_id,
      status: r.status,
      action: 'upserted',
    }));
  }

  // Invalidate attendance and dashboard caches
  await invalidateCache('attendance:*');
  await invalidateCache('student:dashboard:*');
  await invalidateCache('student:attendance:*');

  res.status(200).json({
    status: 'success',
    message: `Attendance marked for ${date}`,
    data: { results: [...bulkResults, ...errorResults] },
  });
});

export const getAttendanceBySubject = catchAsync(async (req, res, next) => {
  const { subjectId } = req.params;
  const { limit, offset, meta } = paginate(req.query);

  const subject = await Subject.findById(subjectId);
  if (!subject) {
    throw new AppError('Subject not found.', 404);
  }

  if (subject.faculty_id.toString() !== req.user.id) {
    throw new AppError('You can only view attendance for your own subjects.', 403);
  }

  const [count, rows] = await Promise.all([
    Attendance.countDocuments({ subject_id: subjectId }),
    Attendance.find({ subject_id: subjectId })
      .populate({
        path: 'student',
        select: 'enrollment_no department',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .sort({ date: -1 })
      .skip(offset)
      .limit(limit),
  ]);

  res.status(200).json({
    status: 'success',
    results: rows.length,
    data: { subject: subject.name, attendance: rows },
    pagination: meta(count),
  });
});
