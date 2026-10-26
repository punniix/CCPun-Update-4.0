import { createSign } from 'node:crypto';

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function parseServiceAccount(raw) {
  if (!raw) throw new Error('GOOGLE_BACKUP_SERVICE_ACCOUNT_JSON is required');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_BACKUP_SERVICE_ACCOUNT_JSON is invalid JSON');
  }
  if (!parsed?.client_email || !parsed?.private_key) {
    throw new Error('Google service account JSON must contain client_email and private_key');
  }
  return parsed;
}

export async function getGoogleAccessToken(serviceAccount, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64urlJson({
    iss: serviceAccount.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const signingInput = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key).toString('base64url');
  const assertion = `${signingInput}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth token exchange failed (${response.status})`);
  const body = await response.json();
  if (!body?.access_token) throw new Error('Google OAuth response did not contain access_token');
  return body.access_token;
}
