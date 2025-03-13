import fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from 'dotenv'

config()

const server = fastify()
server.register(cors, {
  origin: process.env.CLIENT_URL || 'http://localhost:5173'
})

server.get('/health', async () => {
  return { status: 'ok' }
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