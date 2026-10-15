function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : err.name === 'MulterError' ? 400 : ['ValidationError', 'CastError'].includes(err.name) ? 400 : 500);
  // seule une vraie erreur interne (500) est masquée ; un 502 (service externe indisponible) garde son message
  if (status === 500) console.error(err);
  else if (status > 500) console.warn(err.message);
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
}

module.exports = { notFound, errorHandler };