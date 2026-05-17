import { Student, User, Subject, Attendance, Mark } from '../models/index.js';
import AppError from '../utils/AppError.js';
import paginate from '../utils/paginate.js';
import { getCache, setCache } from '../config/redis.js';

// getDashboard is an aggregation endpoint — it computes summaries across all
// records so pagination doesn't apply here (it returns computed stats, not
// a raw list).
export const getDashboard = async (req, res, next) => {
  try {
    // Return cached dashboard if available (avoids 3 DB queries + aggregation).
    const cacheKey = `dashboard:${req.user.id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const student = await Student.findOne({
      where: { user_id: req.user.id },
    });

    if (!student) {
      throw new AppError('Student profile not found.', 404);
    }

    // Run both queries concurrently — they are independent and each takes
    // a full round-trip to the remote DB.  Promise.all cuts total wait time
    // roughly in half compared to sequential execution.
    const [attendanceRecords, marksRecords] = await Promise.all([
      Attendance.findAll({
        where: { student_id: student.id },
        include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] }],
      }),
      Mark.findAll({
        where: { student_id: student.id },
        include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] }],
      }),
    ]);

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

    const responseData = {
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
    };

    // Cache for 2 minutes.
    await setCache(cacheKey, responseData, 120);

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

export const getMyAttendance = async (req, res, next) => {
  try {
    const { limit, offset, meta } = paginate(req.query);

    // Cache the student profile lookup — this same query repeats on every
    // student endpoint.  We store it for 10 minutes keyed by the auth user.
    const studentCacheKey = `studentProfile:${req.user.id}`;
    let student = await getCache(studentCacheKey);
    if (!student) {
      student = await Student.findOne({
        where: { user_id: req.user.id },
        raw: true,
      });
      if (student) {
        await setCache(studentCacheKey, student, 600);
      }
    }

    if (!student) {
      throw new AppError('Student profile not found.', 404);
    }

    const { count, rows } = await Attendance.findAndCountAll({
      where: { student_id: student.id },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
      ],
      order: [['date', 'DESC']],
      limit,
      offset,
    });

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: { attendance: rows },
      pagination: meta(count),
    });
  } catch (error) {
    next(error);
  }
};

export const getMyMarks = async (req, res, next) => {
  try {
    const { limit, offset, meta } = paginate(req.query);

    const studentCacheKey = `studentProfile:${req.user.id}`;
    let student = await getCache(studentCacheKey);
    if (!student) {
      student = await Student.findOne({
        where: { user_id: req.user.id },
        raw: true,
      });
      if (student) {
        await setCache(studentCacheKey, student, 600);
      }
    }

    if (!student) {
      throw new AppError('Student profile not found.', 404);
    }

    const { count, rows } = await Mark.findAndCountAll({
      where: { student_id: student.id },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: { marks: rows },
      pagination: meta(count),
    });
  } catch (error) {
    next(error);
  }
};

export const getMySubjects = async (req, res, next) => {
  try {
    const studentCacheKey = `studentProfile:${req.user.id}`;
    let student = await getCache(studentCacheKey);
    if (!student) {
      student = await Student.findOne({
        where: { user_id: req.user.id },
        raw: true,
      });
      if (student) {
        await setCache(studentCacheKey, student, 600);
      }
    }

    if (!student) {
      throw new AppError('Student profile not found.', 404);
    }

    // Run both subject-ID lookups concurrently.
    const [attendanceRecords, marksRecords] = await Promise.all([
      Attendance.findAll({
        where: { student_id: student.id },
        attributes: ['subject_id'],
        group: ['subject_id'],
      }),
      Mark.findAll({
        where: { student_id: student.id },
        attributes: ['subject_id'],
        group: ['subject_id'],
      }),
    ]);

    const subjectIds = new Set();
    attendanceRecords.forEach((r) => subjectIds.add(r.subject_id));
    marksRecords.forEach((r) => subjectIds.add(r.subject_id));

    const { limit, offset, meta } = paginate(req.query);

    const { count, rows } = await Subject.findAndCountAll({
      where: { id: Array.from(subjectIds) },
      include: [
        { model: User, as: 'faculty', attributes: ['name'] },
      ],
      order: [['name', 'ASC']],
      limit,
      offset,
    });

    res.status(200).json({
      status: 'success',
      results: rows.length,
      data: { subjects: rows },
      pagination: meta(count),
    });
  } catch (error) {
    next(error);
  }
};
