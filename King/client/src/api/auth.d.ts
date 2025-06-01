// client/src/api/auth.d.ts
declare interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  user?: UserInfo;
  requires2FA?: boolean;
  tempToken?: string;
}

declare interface UserInfo {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  avatar?: string;
  last_login?: string;
  is_verified: boolean;
}

declare interface LoginParams {
  username: string;
  password: string;
  captcha?: string;
}

declare interface ResetPasswordParams {
  token: string;
  newPassword: string;
}

declare class AuthError extends Error {
  code: string;
  details?: any;
}