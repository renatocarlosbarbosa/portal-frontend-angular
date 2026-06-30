export interface AuthUser {
  readonly name: string;
  readonly email: string;
  readonly roles: readonly string[];
}
