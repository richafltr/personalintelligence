import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  forcePathStyle: false,
  endpoint: process.env.SPACES_ENDPOINT,
  region: process.env.SPACES_REGION,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY!,
  },
});

async function run() {
  try {
    const res = await s3Client.send(new ListBucketsCommand({}));
    console.log('Available buckets:', res.Buckets?.map(b => b.Name));
  } catch (e: any) {
    console.error('Failed to list buckets:', e.message);
  }
}

run();
