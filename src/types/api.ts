export interface Profile {
  id: string;
  user_id: string;
  name: string;
  profile_type: string | null;
  avatar_id: string;
  created_at: string;
  updated_at: string;
  preferences: unknown[];
}

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  customer_id: string | null;
  created_at: string;
  updated_at: string;
  confirmed: boolean;
  is_subscribed: boolean;
  admin: boolean;
  subscription?: Record<string, unknown>;
  profiles: Profile[];
  current_profile: Profile | null;
}

export interface CurrentSessionResponse {
  current_user: CurrentUser;
  admin: boolean;
}
