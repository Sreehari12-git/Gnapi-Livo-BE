export class FinalScoreDto {
  teamAName!: string;
  teamBName!: string;
  teamAScore!: number;
  teamBScore!: number;
}

export class UpdateMatchDto {
  name?: string;
  liveStatus?: string;
  finalScore?: FinalScoreDto;
}
