import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  IsOptional,
} from 'class-validator';

export class Collaborators {
  @IsDefined()
  @IsString()
  label: string;
}
export class InstagramDto {
  @IsIn(['post', 'story'])
  @IsDefined()
  post_type: 'post' | 'story';

  @IsOptional()
  is_trial_reel?: boolean;

  @IsIn(['MANUAL', 'SS_PERFORMANCE'])
  @IsOptional()
  graduation_strategy?: 'MANUAL' | 'SS_PERFORMANCE';

  @Type(() => Collaborators)
  @ValidateNested({ each: true })
  @IsArray()
  @IsOptional()
  collaborators: Collaborators[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alt_texts?: string[];

  @IsOptional()
  @IsString()
  location_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  first_comment?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  cover_frame_seconds?: number;

  @IsOptional()
  @IsBoolean()
  is_reel?: boolean;
}
