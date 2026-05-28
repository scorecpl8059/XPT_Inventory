import jwksRsa from 'jwks-rsa'
import jwt from 'jsonwebtoken'

const jwksClient = jwksRsa({
  cache: true,
  cacheMaxAge: 86_400_000,
  rateLimit: true,
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
})

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    jwksClient.getSigningKey(kid, (err, key) => {
      if (err) return reject(err)
      resolve(key!.getPublicKey())
    })
  })
}

export interface JwtPayload {
  sub: string
  email?: string
  iss: string
  aud: string | string[]
  exp: number
  iat: number
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const decoded = jwt.decode(token, { complete: true })

  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new Error('INVALID_TOKEN')
  }

  const signingKey = await getSigningKey(decoded.header.kid).catch(() => {
    throw new Error('INVALID_TOKEN')
  })

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      signingKey,
      {
        algorithms: ['RS256'],
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      },
      (err, payload) => {
        if (err) {
          if (err.name === 'TokenExpiredError') return reject(new Error('TOKEN_EXPIRED'))
          return reject(new Error('INVALID_TOKEN'))
        }
        resolve(payload as JwtPayload)
      }
    )
  })
}
