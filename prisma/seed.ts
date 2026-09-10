import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../src/lib/seed";

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedDemo(prisma);
    console.log("Demo data ready.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
