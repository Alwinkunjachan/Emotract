import { createClient } from 'redis';

// Function to connect to Redis
const connectRedis = async () => {
  const redisOptions = {
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    },
  };

  // Only add auth if password is provided
  if (process.env.REDIS_PASSWORD) {
    redisOptions.username = 'default';
    redisOptions.password = process.env.REDIS_PASSWORD;
  }

  const client = createClient(redisOptions);

  // Error handling for Redis client
  client.on('error', (err) => {
    console.error('Redis Client Error', err);
  });

  try {
    await client.connect();
    console.log("Redis Connection Successful");
  } catch (err) {
    console.error("Redis Connection Unsuccessful", err.message);
    process.exit(1); // Exit the process if DB connection fails
  }

  // Optional: Return the client for use in other parts of your application
  return client;
};

export default connectRedis;
