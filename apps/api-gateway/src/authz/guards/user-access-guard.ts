import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class UserAccessGuard implements CanActivate {
  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    const { user } = request;

    // Block pure client credentials tokens (machine-to-machine) that don't have user context
    // These would have client_id or azp but no email (indicating no user)
    const hasClientId = user.hasOwnProperty('client_id');
    const hasAzp = user.hasOwnProperty('azp');
    const hasEmail = user.email;

    console.log('🔍 UserAccessGuard Debug:', {
      hasClientId,
      hasAzp,
      hasEmail: Boolean(hasEmail),
      userKeys: Object.keys(user)
    });

    if ((hasClientId || hasAzp) && !hasEmail) {
      console.log(
        '🚫 UserAccessGuard: Blocking token - has client info but no email'
      );
      throw new UnauthorizedException('You do not have access');
    }

    console.log('✅ UserAccessGuard: Allowing token through');

    // Allow tokens with client_id/azp if they also have user email (user tokens issued by a client)

    if (user?.userRole && user?.userRole.includes('holder')) {
      throw new ForbiddenException('This role is a holder.');
    }

    return true;
  }
}
