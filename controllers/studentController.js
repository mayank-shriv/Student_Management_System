import { Student, User, Subject, Attendance, Mark } from '../models/index.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import paginate from '../utils/paginate.js';

export const getDashboard = catchAsync(async (req, res, next) => {
  const student = await Student.findOne({
    user_id: req.user.id,
  });

  if (!student) {
    throw new AppError('Student profile not found.', 404);
  }

  const [attendanceRecords, marksRecords] = await Promise.all([
    Attendance.find({ student_id: student._id })
      .populate('subject', 'name code'),
    Mark.find({ student_id: student._id })
      .populate('subject', 'name code'),
  ]);

  const attendanceBySubject = {};
  attendanceRecords.forEach((record) => {
    const subId = record.subject_id.toString();
    if (!attendanceBySubject[subId]) {
      attendanceBySubject[subId] = {
        subject: record.subject,
        total: 0,
        present: 0,
      };
    }
    attendanceBySubject[subId].total++;
    if (record.status === 'present') {
      attendanceBySubject[subId].present++;
    }
  });

  let totalClasses = 0;
  let totalPresent = 0;
  const subjectAttendance = Object.values(attendanceBySubject).map((item) => {
    const percentage = item.total > 0
      ? Math.round((item.present / item.total) * 100)
      : 0;
    totalClasses += item.total;
    totalPresent += item.present;
    return {
      subject: item.subject,
      total: item.total,
      present: item.present,
      percentage,
    };
  });

  const overallAttendance = totalClasses > 0
    ? Math.round((totalPresent / totalClasses) * 100)
    : 0;

  const totalMarks = marksRecords.reduce((sum, m) => sum + m.marks, 0);
  const averageMarks = marksRecords.length > 0
    ? Math.round(totalMarks / marksRecords.length)
    : 0;

  const subjectSet = new Set();
  attendanceRecords.forEach((r) => subjectSet.add(r.subject_id.toString()));
  marksRecords.forEach((r) => subjectSet.add(r.subject_id.toString()));

  res.status(200).json({
    status: 'success',
    data: {
      student: {
        name: req.user.name,
        email: req.user.email,
        enrollment_no: student.enrollment_no,
        department: student.department,
      },
      overview: {
        totalSubjects: subjectSet.size,
        overallAttendance,
        averageMarks,
      },
      subjectAttendance,
      marks: marksRecords.map((m) => ({
        id: m.id,
        subject: m.subject,
        marks: m.marks,
      })),
    },
  });
});

export const getMyAttendance = catchAsync(async (req, res, next) => {
  const { limit, offset, meta } = paginate(req.query);

  const student = await Student.findOne({
    user_id: req.user.id,
  });

  if (!student) {
    throw new AppError('Student profile not found.', 404);
  }

  const [count, rows] = await Promise.all([
    Attendance.countDocuments({ student_id: student._id }),
    Attendance.find({ student_id: student._id })
      .populate('subject', 'name code')
      .sort({ date: -1 })
      .skip(offset)
      .limit(limit),
  ]);

  res.status(200).json({
    status: 'success',
    results: rows.length,
    data: { attendance: rows },
    pagination: meta(count),
  });
});

export const getMyMarks = catchAsync(async (req, res, next) => {
  const { limit, offset, meta } = paginate(req.query);

  const student = await Student.findOne({
    user_id: req.user.id,
  });

  if (!student) {
    throw new AppError('Student profile not found.', 404);
  }

  const [count, rows] = await Promise.all([
    Mark.countDocuments({ student_id: student._id }),
    Mark.find({ student_id: student._id })
      .populate('subject', 'name code')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit),
  ]);

  res.status(200).json({
    status: 'success',
    results: rows.length,
    data: { marks: rows },
    pagination: meta(count),
  });
});

export const getMySubjects = catchAsync(async (req, res, next) => {
  const student = await Student.findOne({
    user_id: req.user.id,
  });

  if (!student) {
    throw new AppError('Student profile not found.', 404);
  }

  // Use distinct() instead of Sequelize.fn('DISTINCT', ...)
  const [attendanceSubjectIds, marksSubjectIds] = await Promise.all([
    Attendance.distinct('subject_id', { student_id: student._id }),
    Mark.distinct('subject_id', { student_id: student._id }),
  ]);

  const subjectIdSet = new Set();
  attendanceSubjectIds.forEach((id) => subjectIdSet.add(id.toString()));
  marksSubjectIds.forEach((id) => subjectIdSet.add(id.toString()));

  if (subjectIdSet.size === 0) {
    return res.status(200).json({
      status: 'success',
      results: 0,
      data: { subjects: [] },
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  }

  const { limit, offset, meta } = paginate(req.query);
  const allSubjectIds = Array.from(subjectIdSet);

  const [count, rows] = await Promise.all([
    Subject.countDocuments({ _id: { $in: allSubjectIds } }),
    Subject.find({ _id: { $in: allSubjectIds } })
      .populate('faculty', 'name')
      .sort({ name: 1 })
      .skip(offset)
      .limit(limit),
  ]);

  res.status(200).json({
    status: 'success',
    results: rows.length,
    data: { subjects: rows },
    pagination: meta(count),
  });
});
