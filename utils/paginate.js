const paginate = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const meta = (totalRecords) => ({
    page,
    limit,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
  });

  return { limit, offset, page, meta };
};

export default paginate;
