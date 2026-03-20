import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';

const bucket = process.env.SPACES_BUCKET!;
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
  console.log(`Checking bucket: ${bucket} at ${process.env.SPACES_ENDPOINT}...`);
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log('Bucket already exists.');
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      console.log('Bucket not found. Attempting to create...');
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log('SUCCESS: Bucket created!');
      } catch (createError) {
        console.error('FAILED to create bucket:', createError);
      }
    } else {
      console.error('Error checking bucket:', error);
    }
  }
}

run();
