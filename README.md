# AIAgents

A full-stack application for automating workflows that can't be automated with APIs.

## Prerequisites

- Node.js (>=16.0.0)
- Yarn
- Docker & Docker Compose
- Git

## Initial Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd aiAgents
```

2. Install dependencies:
```bash
yarn install
```

3. Start the PostgreSQL database:
```bash
docker-compose up -d
```

4. Set up the environment variables:
```bash
# Copy the example env file in the server directory
cp server/.env.example server/.env
```

5. Initialize the database with Prisma:
```bash
cd server
npx prisma generate  # Generate Prisma Client
npx prisma migrate dev  # Create and apply migrations
```

## Development

Start both client and server in development mode:
```bash
# From the root directory
yarn dev
```

Or start them separately:
```bash
# Start client only
yarn dev:client

# Start server only
yarn dev:server

# Start desktop app (Electron)
yarn dev:desktop
```

The application will be available at:
- Client: http://localhost:5173
- Server: http://localhost:3000
- Desktop: Launches as an Electron app

## Database Management with Prisma

### Common Prisma Commands

Create a new migration:
```bash
cd server
npx prisma migrate dev --name <migration-name>
```

Reset the database:
```bash
npx prisma migrate reset
```

View the database in Prisma Studio:
```bash
npx prisma studio
```

Generate Prisma Client after schema changes:
```bash
npx prisma generate
```

Apply migrations in production:
```bash
npx prisma migrate deploy
```

### Example Migration

To add a new table, modify `server/prisma/schema.prisma`:
```prisma
model Update {
  id        Int      @id @default(autoincrement())
  title     String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Then run:
```bash
npx prisma migrate dev --name add_updates_table
```

## Building for Production

Build both client and server:
```bash
yarn build
```

Start the production server:
```bash
yarn start
```

## Desktop Application

### Development

Run the desktop application in development mode:
```bash
yarn dev:desktop
```

This will start the Vite dev server for the client and launch the Electron app that connects to it.

### Building the Desktop App

Build the desktop application:
```bash
yarn build:desktop
```

Package the desktop application for distribution:
```bash
yarn package:desktop
```

The packaged application will be available in the `desktop/release` directory.

## Project Structure

```
AIAgents/
├── client/               # React TypeScript frontend
│   ├── src/             # Source files
│   └── package.json     # Client dependencies
├── server/              # Fastify TypeScript backend
│   ├── src/            # Source files
│   ├── prisma/         # Database schema and migrations
│   └── package.json    # Server dependencies
├── desktop/             # Electron desktop application
│   ├── electron/       # Electron main process code
│   └── package.json    # Desktop dependencies
├── docker-compose.yml   # Docker configuration
└── package.json        # Root package.json for running all services
```