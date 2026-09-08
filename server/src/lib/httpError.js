export default function createHttpError(status, message, details) {
  const err = new Error(message || 'Error');
  err.status = status;
  err.expose = true;
  if (details) err.details = details;
  return err;
}
