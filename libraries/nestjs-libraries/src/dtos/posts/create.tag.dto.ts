import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  name: string;

  @IsString()
  color: string;

  // EOMA Sprint 6 patch: optional human-readable description (max 200 chars)
  // surfaced as a Textarea in the EOMA Tags settings sub-page so end-users can
  // remember the purpose of a tag (e.g. "Used on weekly product round-ups").
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
