export type LiveKitRole = 'capturer' | 'commentator' | 'broadcaster' | 'viewer';

export class GenerateTokenDto {
  identity: string;
  room: string;
  role: LiveKitRole;
}
