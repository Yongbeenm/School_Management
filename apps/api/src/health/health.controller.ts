import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Public()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
