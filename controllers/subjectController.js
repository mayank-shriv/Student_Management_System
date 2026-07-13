import { Subject } from '../models/index.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { invalidateCache } from '../middleware/cache.js';

export const createSubject = catchAsync(async (req, res, next) => {
  const { name, code } = req.body;

  if (!code) {
    throw new AppError('Subject code is required.', 400);
  }

  const subject = await Subject.create({
    name,
    code: code.toUpperCase(),
    faculty_id: req.user.id,
  });

  await invalidateCache('subjects:*');

  res.status(201).json({
    status: 'success',
    data: { subject },
  });
});

export const getAllSubjects = catchAsync(async (req, res, next) => {
  const subjects = await Subject.find({ faculty_id: req.user.id })
    .populate('faculty', 'name email')
    .sort({ name: 1 });

  res.status(200).json({
    status: 'success',
    results: subjects.length,
    data: { subjects },
  });
});

export const deleteSubject = catchAsync(async (req, res, next) => {
  const subject = await Subject.findById(req.params.id);

  if (!subject) {
    throw new AppError('Subject not found.', 404);
  }

  if (subject.faculty_id.toString() !== req.user.id) {
    throw new AppError('You can only delete your own subjects.', 403);
  }

  await subject.deleteOne();

  await invalidateCache('subjects:*');

  res.status(200).json({
    status: 'success',
    message: 'Subject deleted successfully.',
  });
});
