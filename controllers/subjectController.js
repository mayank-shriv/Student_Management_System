import { Subject, User } from '../models/index.js';
import AppError from '../utils/AppError.js';

export const createSubject = async (req, res, next) => {
  try {
    const { name, code } = req.body;

    const subject = await Subject.create({
      name,
      code: code.toUpperCase(),
      faculty_id: req.user.id,
    });

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

    res.status(200).json({
      status: 'success',
      results: subjects.length,
      data: { subjects },
    });
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

    await subject.destroy();

    res.status(200).json({
      status: 'success',
      message: 'Subject deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
