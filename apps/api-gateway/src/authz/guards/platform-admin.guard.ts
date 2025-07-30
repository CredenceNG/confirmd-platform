import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  private readonly logger = new Logger('PlatformAdminGuard');

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    this.logger.log(`🔍 Checking platform admin access for user: ${user?.email}`);

    if (!user) {
      this.logger.error('❌ No user found in request');
      throw new ForbiddenException('User not found in request');
    }

    // Check if user has platform admin role in various possible formats
    const isPlatformAdmin = this.checkPlatformAdminRole(user);

    this.logger.log(`📊 Platform admin check result: ${isPlatformAdmin} for user: ${user?.email}`);

    if (!isPlatformAdmin) {
      this.logger.error(`❌ User ${user?.email} does not have platform admin role`);
      throw new ForbiddenException('Access denied. Platform admin role required.');
    }

    this.logger.log(`✅ Platform admin access granted to user: ${user?.email}`);
    return true;
  }

  /**
   * Check if user has platform admin role in various possible formats
   * @param user User object from JWT token
   * @returns true if user has platform admin role
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private checkPlatformAdminRole(user: any): boolean {
    try {
      // Check realm_access roles (standard Keycloak JWT format)
      if (user?.realm_access?.roles) {
        const hasRealmRole = user.realm_access.roles.some((role: string) => (
          'platform_admin' === role || 'platform-admin' === role || 'PLATFORM_ADMIN' === role
        ));
        if (hasRealmRole) {
          this.logger.log('✅ Found platform admin role in realm_access.roles');
          return true;
        }
      }

      // Check userOrgRoles format (platform-specific format)
      if (user?.userOrgRoles && Array.isArray(user.userOrgRoles)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasPlatformAdminOrgRole = user.userOrgRoles.some((orgRole: any) => (
          'platform_admin' === orgRole?.orgRole?.name || 'platform-admin' === orgRole?.orgRole?.name || 'PLATFORM_ADMIN' === orgRole?.orgRole?.name
        ));
        if (hasPlatformAdminOrgRole) {
          this.logger.log('✅ Found platform admin role in userOrgRoles');
          return true;
        }
      }

      // Check direct role properties
      if ('platform_admin' === user?.role || 'platform-admin' === user?.role || 'platform_admin' === user?.userRole || 'platform-admin' === user?.userRole) {
        this.logger.log('✅ Found platform admin role in direct role property');
        return true;
      }

      // Check roles array format
      if (user?.roles && Array.isArray(user.roles)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasRole = user.roles.some((role: any) => (
          'platform_admin' === role?.role || 'platform_admin' === role?.name || 'platform_admin' === role || 'platform-admin' === role?.role || 'platform-admin' === role?.name || 'platform-admin' === role
        ));
        if (hasRole) {
          this.logger.log('✅ Found platform admin role in roles array');
          return true;
        }
      }

      // Check clientId pattern as fallback (admin user has 'platform-admin' as clientId)
      if (user?.clientId && user.clientId.includes('platform-admin')) {
        this.logger.log('✅ Found platform admin pattern in clientId');
        return true;
      }

      this.logger.log('❌ No platform admin role found in any format');
      return false;
    } catch (error) {
      this.logger.error(`❌ Error checking platform admin role: ${error.message}`);
      return false;
    }
  }
}
