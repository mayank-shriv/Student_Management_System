import { Student, User, Subject, Attendance, Mark } from '../models/index.js';
import AppError from '../utils/AppError.js';

export const getDashboard = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      where: { user_id: req.user.id },
    });

    if (!student) {
      throw new AppError('Student profile not found.', 404);
    }

    const attendanceRecords = await Attendance.findAll({
      where: { student_id: student.id },
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] }],
    });

    const marksRecords = await Mark.findAll({
      where: { student_id: student.id },
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] }],
    });

    const attendanceBySubject = {};
    attendanceRecords.forEach((record) => {
      const subId = record.subject_id;
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
    attendanceRecords.forEach((r) => subjectSet.add(r.subject_id));
    marksRecords.forEach((r) => subjectSet.add(r.subject_id));

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
  } catch (error) {
    next(error);
  }
};

export const getMyAttendance = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      where: { user_id: req.user.id },
    });

    if (!student) {
      throw new AppError('Student profile not found.', 404);
    }

    const attendance = await Attendance.findAll({
      where: { student_id: student.id },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
      ],
      order: [['date', 'DESC']],
    });

    res.status(200).json({
      status: 'success',
      results: attendance.length,
      data: { attendance },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyMarks = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      where: { user_id: req.user.id },
    });

    if (!student) {
      throw new AppError('Student profile not found.', 404);
    }

    const marks = await Mark.findAll({
      where: { student_id: student.id },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      status: 'success',
      results: marks.length,
      data: { marks },
    });
  } catch (error) {
    next(error);
  }
};

export const getMySubjects = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      where: { user_id: req.user.id },
    });

    if (!student) {
      throw new AppError('Student profile not found.', 404);
    }

    const subjectIds = new Set();
    const attendanceRecords = await Attendance.findAll({
      where: { student_id: student.id },
      attributes: ['subject_id'],
      group: ['subject_id'],
    });
    const marksRecords = await Mark.findAll({
      where: { student_id: student.id },
      attributes: ['subject_id'],
      group: ['subject_id'],
    });

    attendanceRecords.forEach((r) => subjectIds.add(r.subject_id));
    marksRecords.forEach((r) => subjectIds.add(r.subject_id));

    const subjects = await Subject.findAll({
      where: { id: Array.from(subjectIds) },
      include: [
        { model: User, as: 'faculty', attributes: ['name'] },
      ],
      order: [['name', 'ASC']],
    });

    res.status(200).json({
      status: 'success',
      results: subjects.length,
      data: { subjects },
    });
  } catch (error) {
    next(error);
  }
};
