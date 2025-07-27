const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedPlatformRoles() {
  console.log('🌱 Seeding platform user roles...');

  try {
    // Check if roles already exist
    const existingDefaultRole = await prisma.user_role.findFirst({
      where: { role: 'DEFAULT_USER' }
    });

    const existingHolderRole = await prisma.user_role.findFirst({
      where: { role: 'HOLDER' }
    });

    let defaultUserRole = existingDefaultRole;
    let holderRole = existingHolderRole;

    // Create platform user roles if they don't exist
    if (!defaultUserRole) {
      defaultUserRole = await prisma.user_role.create({
        data: {
          role: 'DEFAULT_USER'
        }
      });
      console.log(`✅ Created DEFAULT_USER role: ${defaultUserRole.id}`);
    } else {
      console.log(`✅ DEFAULT_USER role already exists: ${defaultUserRole.id}`);
    }

    if (!holderRole) {
      holderRole = await prisma.user_role.create({
        data: {
          role: 'HOLDER'
        }
      });
      console.log(`✅ Created HOLDER role: ${holderRole.id}`);
    } else {
      console.log(`✅ HOLDER role already exists: ${holderRole.id}`);
    }

    // Assign DEFAULT_USER role to all existing users who don't have platform roles
    const usersWithoutPlatformRoles = await prisma.user.findMany({
      where: {
        user_role_mapping: {
          none: {}
        }
      }
    });

    console.log(`\n👥 Found ${usersWithoutPlatformRoles.length} users without platform roles`);

    for (const user of usersWithoutPlatformRoles) {
      await prisma.user_role_mapping.create({
        data: {
          userId: user.id,
          userRoleId: defaultUserRole.id
        }
      });
      console.log(`✅ Assigned DEFAULT_USER role to: ${user.email}`);
    }

    console.log('\n🎉 Platform role seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding platform roles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedPlatformRoles();
