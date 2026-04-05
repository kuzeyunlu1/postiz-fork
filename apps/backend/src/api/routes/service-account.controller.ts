import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { OrganizationRepository } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';

/**
 * EOMA: Service account controller for proxy-driven org management.
 * Protected by SERVICE_ACCOUNT_SECRET header — not JWT auth.
 * Only the EOMA backend proxy calls these endpoints.
 */
@Controller('/service-account')
export class ServiceAccountController {
  constructor(
    private _organizationRepository: OrganizationRepository
  ) {}

  @Post('/organizations')
  async createOrg(
    @Headers('x-service-secret') secret: string,
    @Body() body: { name: string; serviceUserId: string }
  ) {
    if (!process.env.SERVICE_ACCOUNT_SECRET || secret !== process.env.SERVICE_ACCOUNT_SECRET) {
      throw new HttpForbiddenException();
    }

    if (
      !body.name ||
      typeof body.name !== 'string' ||
      body.name.length < 1 ||
      body.name.length > 256
    ) {
      throw new BadRequestException('name must be a string between 1 and 256 characters');
    }

    if (
      !body.serviceUserId ||
      typeof body.serviceUserId !== 'string' ||
      body.serviceUserId.length < 1 ||
      body.serviceUserId.length > 256
    ) {
      throw new BadRequestException('serviceUserId must be a string between 1 and 256 characters');
    }

    const org = await this._organizationRepository.createOrgForServiceAccount(
      body.name,
      body.serviceUserId
    );

    return { id: org.id, apiKey: org.apiKey };
  }
}
