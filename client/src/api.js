// One place for every call to the backend.
// - Sends and receives JSON
// - Includes the login cookie
// - Throws ApiError with the server's error message, so pages can just show err.message

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, url, body) {
  const options = { method, credentials: 'include', headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${url}`, options);
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }

  // 204 No Content has no body
  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    // Session expired or logged out elsewhere: let AuthContext send the user back to login.
    // /auth/me is excluded because a 401 there just means "not logged in yet".
    if (res.status === 401 && url !== '/auth/me') {
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  patch: (url, body) => request('PATCH', url, body),
  delete: (url) => request('DELETE', url)
};
