import fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from 'dotenv'
import ws from '@fastify/websocket'

config()

const server = fastify({
  logger: true
})

server.register(cors, {
  origin: process.env.CLIENT_URL || 'http://localhost:5173'
})
server.register(ws)

server.get('/health', async () => {
  return { status: 'ok' }
})

interface ChatMessage {
  message: string
}
server.register(async function (server) {
  server.get("/browser", { websocket: true }, (connection, req) => {
    connection.on('message', (message) => {
      console.log(message)
    });
  });
});

server.post<{ Body: ChatMessage }>('/chat', async (request, reply) => {
  const { message } = request.body
  // Process message here if needed
  return reply.code(200).send({ success: true })
})

const start = async () => {
  try {
    await server.listen({ port: 3000 })
    console.log('Server running at http://localhost:3000')
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()