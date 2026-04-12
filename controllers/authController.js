import jwt from 'jsonwebtoken';
import { User, Student } from '../models/index.js';
import AppError from '../utils/AppError.js';

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user.id);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  res.cookie('token', token, cookieOptions);

  res.status(statusCode).json({
    status: 'success',
    data: {
      user: user.toSafeObject(),
    },
  });
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, enrollment_no, department } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new AppError('Email already registered.', 409);
    }

    const user = await User.create({ name, email, password, role });

    if (role === 'student') {
      if (!enrollment_no) {
        await user.destroy();
        throw new AppError('Enrollment number is required for students.', 400);
      }

      await Student.create({
        user_id: user.id,
        enrollment_no,
        department: department || null,
      });
    }

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

export const logout = (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(0),
  });

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully.',
  });
};

export const getMe = async (req, res, next) => {
  try {
    const user = req.user;
    const data = { user: user.toSafeObject() };

    if (user.role === 'student') {
      const studentProfile = await Student.findOne({
        where: { user_id: user.id },
        attributes: ['id', 'enrollment_no', 'department'],
      });
      data.studentProfile = studentProfile;
    }

    res.status(200).json({
      status: 'success',
      data,
    });
  } catch (error) {
    next(error);
  }
};
