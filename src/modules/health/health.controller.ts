import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  liveness() {
    return this.healthService.liveness();
  }

  @Get('ready')
  @Public()
  async readiness() {
    return this.healthService.readiness();
  }
}
