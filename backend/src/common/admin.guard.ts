import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) throw new ForbiddenException('Not authenticated');

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
      if (!payload.isAdmin) {
        throw new ForbiddenException('Admin access required');
      }
      return true;
    } catch (e) {
      throw new ForbiddenException(e.message || 'Access denied');
    }
  }
}
