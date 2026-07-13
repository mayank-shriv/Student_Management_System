import { Mark, Student, Subject, User } from '../models/index.js';
import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import paginate from '../utils/paginate.js';
import { invalidateCache } from '../middleware/cache.js';

export const addMarks = catchAsync(async (req, res, next) => {
  const { subject_id, records } = req.body;

  const subject = await Subject.findById(subject_id);
  if (!subject) {
    throw new AppError('Subject not found.', 404);
  }

  if (subject.faculty_id.toString() !== req.user.id) {
    throw new AppError('You can only add marks for your own subjects.', 403);
  }

  const studentIds = records.map((r) => r.student_id);
  const students = await Student.find({ _id: { $in: studentIds } });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const existingMarks = await Mark.find({
    student_id: { $in: studentIds },
    subject_id,
  });
  const existingSet = new Set(existingMarks.map((m) => m.student_id.toString()));

  // Separate into valid new records, duplicates, and not-found
  const toCreate = [];
  const errorResults = [];
  for (const record of records) {
    const { student_id, marks } = record;

    if (!studentMap.has(student_id)) {
      errorResults.push({ student_id, error: 'Student not found' });
      continue;
    }

    if (existingSet.has(student_id)) {
      errorResults.push({
        student_id,
        error: 'Marks already exist. Use PUT to update.',
      });
      continue;
    }

    toCreate.push({ student_id, subject_id, marks });
    existingSet.add(student_id);
  }

  // Bulk create valid records using insertMany instead of Sequelize bulkCreate
  let createdResults = [];
  if (toCreate.length > 0) {
    const created = await Mark.insertMany(toCreate);
    createdResults = created.map((m) => ({
      student_id: m.student_id,
      marks: m.marks,
      action: 'created',
    }));
  }

  await invalidateCache('marks:*');
  await invalidateCache('student:dashboard:*');
  await invalidateCache('student:marks:*');

  res.status(201).json({
    status: 'success',
    data: { results: [...createdResults, ...errorResults] },
  });
});

export const updateMarks = catchAsync(async (req, res, next) => {
  const { marks } = req.body;

  const mark = await Mark.findById(req.params.id);
  if (!mark) {
    throw new AppError('Mark record not found.', 404);
  }

  const subject = await Subject.findById(mark.subject_id);
  if (!subject || subject.faculty_id.toString() !== req.user.id) {
    throw new AppError('You can only update marks for your own subjects.', 403);
  }

  mark.marks = marks;
  await mark.save();

  await invalidateCache('marks:*');
  await invalidateCache('student:dashboard:*');
  await invalidateCache('student:marks:*');

  res.status(200).json({
    status: 'success',
    data: { mark },
  });
});

export const getMarksBySubject = catchAsync(async (req, res, next) => {
  const { subjectId } = req.params;
  const { limit, offset, meta } = paginate(req.query);

  const subject = await Subject.findById(subjectId);
  if (!subject) {
    throw new AppError('Subject not found.', 404);
  }

  if (subject.faculty_id.toString() !== req.user.id) {
    throw new AppError('You can only view marks for your own subjects.', 403);
  }

  const count = await Mark.countDocuments({ subject_id: subjectId });

  // Use aggregation pipeline to sort by nested student.user.name
  const rows = await Mark.aggregate([
    { $match: { subject_id: new mongoose.Types.ObjectId(subjectId) } },
    {
      $lookup: {
        from: 'students',
        localField: 'student_id',
        foreignField: '_id',
        as: 'student',
      },
    },
    { $unwind: '$student' },
    {
      $lookup: {
        from: 'users',
        localField: 'student.user_id',
        foreignField: '_id',
        as: 'student.user',
      },
    },
    { $unwind: '$student.user' },
    {
      $addFields: {
        id: '$_id',
        'student.id': '$student._id',
        'student.user.id': '$student.user._id',
      },
    },
    {
      $project: {
        id: 1,
        student_id: 1,
        subject_id: 1,
        marks: 1,
        createdAt: 1,
        updatedAt: 1,
        'student.id': 1,
        'student.enrollment_no': 1,
        'student.department': 1,
        'student.user.id': 1,
        'student.user.name': 1,
        'student.user.email': 1,
      },
    },
    { $sort: { 'student.user.name': 1 } },
    { $skip: offset },
    { $limit: limit },
  ]);

  res.status(200).json({
    status: 'success',
    results: rows.length,
    data: { subject: subject.name, marks: rows },
    pagination: meta(count),
  });
});
