import { IsOptional, IsString, ValidateIf, IsUrl } from 'class-validator';

export class FacebookDto {
  @IsOptional()
  @ValidateIf(p => p.url)
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  page_id?: string;
}
