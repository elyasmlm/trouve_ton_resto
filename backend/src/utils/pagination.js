function pageParams(query) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 50);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  return { page, limit, skip: (page - 1) * limit };
}

const pageResult = (items, total, { page, limit }) => ({ items, page, limit, total, pages: Math.ceil(total / limit) });

module.exports = { pageParams, pageResult };