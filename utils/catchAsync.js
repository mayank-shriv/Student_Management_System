/**
 * Wraps an async Express route handler to catch errors
 * and pass them to the error-handling middleware via next().
 *
 * Usage:
 *   router.get('/route', catchAsync(async (req, res) => { ... }));
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

export default catchAsync;
