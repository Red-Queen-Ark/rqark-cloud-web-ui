interface TAuth {
  accessToken?: string;
  refreshToken?: string;
  user?: import('@/api').ApiUserDto;
  /** True once the stored session has been checked against the backend. */
  initialized: boolean;
}
