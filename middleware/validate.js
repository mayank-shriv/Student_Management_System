import { validationResult } from 'express-validator';

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return res.status(422).json({
      status: 'fail',
      message: 'Validation failed',
      errors: extractedErrors,
    });
  }

  next();
};

export default validate;
