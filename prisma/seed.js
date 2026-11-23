const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const salt = bcrypt.genSaltSync(10);
  const defaultPasswordHash = bcrypt.hashSync('=2wsx1qaz', salt);

  const initialUsers = [
    { name: 'Yusauf Cok', email: 'yusaufcok@gmail.com', active: true, role: 'superadmin', password: defaultPasswordHash },
    { name: 'Yusuf Mustofa', email: 'yusufmustofa146@gmail.com', active: true, role: 'pm', password: defaultPasswordHash },
    { name: 'Sariden', email: 'sariden256@gmail.com', active: true, role: 'contractor', password: defaultPasswordHash }
  ];

  console.log('Seeding initial users...');
  
  // 1. Upsert initial users
  const seededUsers = [];
  for (const user of initialUsers) {
    const res = await prisma.pm_users.upsert({
      where: { email: user.email },
      update: { name: user.name, active: user.active, role: user.role },
      create: user,
    });
    seededUsers.push(res);
    console.log(`Upserted: ${user.email} (${user.role})`);
  }

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
