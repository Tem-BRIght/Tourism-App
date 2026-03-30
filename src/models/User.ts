export interface UserProfile {
  id?: string;
  displayName?: string | null;
  name: {
    firstname: string;
    surname: string;
    suffix?: string;
  };
  email: string;
  dateOfBirth: string;
  nickname?: string;
  img?: string;
  nationality?: string;
  address?: string;
  contactNumber?: string;
  gender?: string;
  isGoogleUser?: boolean;
  createdAt?: string;
  isFullyRegistered?: boolean;
}