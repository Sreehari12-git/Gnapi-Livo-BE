export class GenerateTokenDto {
  identity: string;
  room: string;
  role: 'capturer' | 'commentator' | 'broadcaster' | 'viewer';
}
