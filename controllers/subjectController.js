import { Subject, User } from '../models/index.js';
import AppError from '../utils/AppError.js';
import { getCache, setCache, delCache } from '../config/redis.js';

export const createSubject = async (req, res, next) => {
  try {
    const { name, code } = req.body;

    const subject = await Subject.create({
      name,
      code: code.toUpperCase(),
      faculty_id: req.user.id,
    });

    // Invalidate the faculty's cached subject list so it includes the new one.
    await delCache(`subjects:faculty:${req.user.id}`);

    res.status(201).json({
      status: 'success',
      data: { subject },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllSubjects = async (req, res, next) => {
  try {
    // Cache the subject list per faculty for 5 minutes — it rarely changes.
    const cacheKey = `subjects:faculty:${req.user.id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const subjects = await Subject.findAll({
      include: [
        {
          model: User,
          as: 'faculty',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['name', 'ASC']],
    });

    const responseData = {
      status: 'success',
      results: subjects.length,
      data: { subjects },
    };

    await setCache(cacheKey, responseData, 300);

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

export const deleteSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findByPk(req.params.id);

    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    if (subject.faculty_id !== req.user.id) {
      throw new AppError('You can only delete your own subjects.', 403);
    }

    await subject.destroy();

    // Invalidate the faculty's cached subject list.
    await delCache(`subjects:faculty:${req.user.id}`);

    res.status(200).json({
      status: 'success',
      message: 'Subject deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
