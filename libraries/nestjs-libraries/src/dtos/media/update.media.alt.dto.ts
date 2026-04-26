import { IsString, MaxLength } from 'class-validator';

// EOMA Sprint 5 patch: body for `PUT /media/:id` (alt-text edit only).
// Kept narrow on purpose — the existing `SaveMediaInformationDto` carries the
// id+thumbnail+thumbnailTimestamp triple and is used by `POST /media/information`
// (post-upload metadata write). This DTO only validates the inline edit case
// where the caller already has an id (in the URL param) and just wants to
// rewrite the alt-text.
export class UpdateMediaAltDto {
  @IsString()
  @MaxLength(1000)
  alt: string;
}
