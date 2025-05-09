export default async server => {
  const users = server.prisma.user

  const userInfoSelect = {
    id: true,
    username: true,
    bio: true,
    role: true
  }

  server.decorate('filterUsers', async ({ hasBio, usernameLike }) => {
    const where = {}

    if (hasBio !== undefined) {
      where.bio = hasBio ? { not: null } : null
    }

    if (usernameLike) {
      where.username = { contains: usernameLike }
    }
    return await users.findMany({
      where,
      select: userInfoSelect
    })
  })

  server.decorate('getUser', async id => {
    const user = await users.findUnique({
      where: { id },
      select: userInfoSelect
    })

    if (!user) {
      throw server.httpErrors.notFound('User not found')
    }
    return user
  })

  server.decorate('registerUser', async dto => {
    const isUsernameTaken = await users.findUnique({
      where: { username: dto.username },
      select: { id: true }
    })

    if (isUsernameTaken) {
      throw server.httpErrors.badRequest('Username is already taken')
    }

    const passwordHash = await server.hash(dto.password)

    return await users.create({
      data: {
        username: dto.username,
        bio: dto.bio ?? null,
        role: dto.role,
        passwordHash
      },
      select: userInfoSelect
    })
  })

  server.decorate('loginUser', async ({ username, password }) => {
    const userInfo = await users.findUnique({
      where: { username },
      select: {
        id: true,
        role: true,
        passwordHash: true
      }
    })

    if (!userInfo) {
      throw server.httpErrors.badRequest('Invalid credentials')
    }

    const { id, role, passwordHash } = userInfo

    const isPasswordCorrect = await server.compareHash(password, passwordHash)

    if (isPasswordCorrect) {
      return { id, role }
    }
    throw server.httpErrors.badRequest('Invalid credentials')
  })

  server.decorate('updateUser', async dto => {
    const isOnlyIdPresent = Object.keys(dto).length < 2

    if (isOnlyIdPresent) {
      throw server.httpErrors.badRequest('No fields to update were specified')
    }
    const userExists = await users.findUnique({
      where: { id: dto.id },
      select: { id: true }
    })

    if (!userExists) {
      throw server.httpErrors.notFound('User not found')
    }

    const isUsernameTakenByOther = await users.findFirst({
      where: {
        id: { not: dto.id },
        username: dto.username
      },
      select: { id: true }
    })

    if (isUsernameTakenByOther) {
      throw server.httpErrors.badRequest('Username is taken by other user')
    }

    return await users.update({
      where: { id: dto.id },
      data: {
        username: dto.username,
        bio: dto.bio
      },
      select: userInfoSelect
    })
  })

  server.decorate('resetUserPassword', async dto => {
    const userExists = await users.findUnique({
      where: { id: dto.id },
      select: { id: true }
    })

    if (!userExists) {
      throw server.httpErrors.notFound('User not found')
    }

    const passwordHash = await server.hash(dto.newPassword)

    await users.update({
      where: { id: dto.id },
      data: { passwordHash },
      select: userInfoSelect
    })
  })

  server.decorate('deleteUser', async id => {
    const userExists = await users.findUnique({
      where: { id },
      select: { id: true }
    })

    if (!userExists) {
      throw server.httpErrors.notFound('User not found')
    }

    return await users.delete({
      where: { id },
      select: { id: true }
    })
  })
}
