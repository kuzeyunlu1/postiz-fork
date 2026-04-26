import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class LinkedinDto {
  @IsBoolean()
  @IsOptional()
  post_as_images_carousel: boolean;

  @IsString()
  @IsOptional()
  carousel_name?: string;

  @IsOptional()
  @IsIn(['text', 'image', 'document', 'article'])
  media_type?: 'text' | 'image' | 'document' | 'article';

  @IsOptional()
  @IsString()
  document_url?: string;
}