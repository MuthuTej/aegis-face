import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import type { Role } from '../types';

export interface JwtPayload {
  sub: string; // employee_id
  role: Role;
  name: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
