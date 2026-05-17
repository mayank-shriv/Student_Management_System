/**
 * Extracts pagination parameters from a request query string and returns
 * Sequelize-compatible `limit` and `offset` values alongside metadata
 * helpers that can be included in the API response.
 *
 * Usage:
 *   const { limit, offset, page, meta } = paginate(req.query);
 *   const { count, rows } = await Model.findAndCountAll({ limit, offset, ... });
 *   res.json({ data: rows, pagination: meta(count) });
 *
 * Supported query params:
 *   ?page=2         → page number (1-indexed, default 1)
 *   ?limit=25       → items per page (default 20, max 100)
 *
 * @param {object} query — Express req.query object
 * @returns {{ limit: number, offset: number, page: number, meta: (totalRecords: number) => object }}
 */
const paginate = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  /**
   * Call with the total record count (from `findAndCountAll`) to produce a
   * pagination metadata object suitable for inclusion in API responses.
   */
  const meta = (totalRecords) => ({
    page,
    limit,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
  });

  return { limit, offset, page, meta };
};

export default paginate;
