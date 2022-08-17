import { Context } from '../context';
import { isLoggedIn } from '../utils';

type UsersArgs = {
  query?: string;
};

type UserArgs = {
  id: string;
  username: string;
  email: string;
};

type FollowingArgs = {
  id?: string;
  username?: string;
  email?: string;
};

type FollowersArgs = {
  id?: string;
  username?: string;
  email?: string;
};

type PostArgs = {
  id: string;
};

type FeedArgs = {
  id: string;
};

type ExploreArgs = {
  id: string;
};

type LikedPostsArgs = {
  id: string;
};

const Query = {
  currentUser: (parent: any, args: any, context: Context) => {
    if (!context.user) {
      return null;
    }

    return context.prisma.user.findUnique({
      where: {
        id: context.user.id,
      },
    });
  },
  users: async (
    parent: any,
    { query }: UsersArgs,
    { user, prisma }: Context,
  ) => {
    isLoggedIn(user?.id);

    const users = await prisma.user.findMany({
      where: query
        ? {
            // just filtering on username for now until OR is added back for mongo connector - https://github.com/prisma/prisma/issues/3897
            username: {
              contains: query,
            },
          }
        : undefined,
    });

    return users;
  },
  user: (parent: any, { id, username, email }: UserArgs, { prisma }: Context) =>
    prisma.user.findUnique({
      where: { id, username, email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        role: true,
        gender: true,
        phoneNumber: true,
        verified: true,
        profile: {
          select: {
            bio: true,
            website: true,
            picture: {
              select: {
                url: true,
              },
            },
          },
        },
        followers: {
          select: {
            id: true,
          },
        },
        following: {
          select: {
            id: true,
          },
        },
        posts: {
          select: {
            id: true,
          },
        },
      },
    }),
  following: (
    parent: any,
    { id, username, email }: FollowingArgs,
    context: Context,
  ) =>
    context.prisma.user
      .findUnique({ where: { id, username, email } })
      .following(),
  followers: (
    parent: any,
    { id, username, email }: FollowersArgs,
    context: Context,
  ) =>
    context.prisma.user
      .findUnique({ where: { id, username, email } })
      .followers(),
  // TODO: this should be prisma.post
  posts: (parent: any, args: any, { user, prisma }: Context) =>
    prisma.post.findMany({
      where: {
        author: {
          id: user.id,
        },
        deletedAt: {
          isSet: false,
        },
      },
    }),
  post: (parent: any, { id }: PostArgs, { prisma }: Context) =>
    prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        caption: true,
        published: true,
        archived: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            username: true,
            verified: true,
            followers: {
              select: {
                id: true,
              },
            },
            following: {
              select: {
                id: true,
              },
            },
            profile: {
              select: {
                picture: {
                  select: {
                    url: true,
                  },
                },
              },
            },
          },
        },
        media: {
          select: {
            type: true,
            url: true,
            publicId: true,
          },
        },
        likes: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        comments: {
          where: {
            deletedAt: {
              isSet: false,
            },
          },
          select: {
            id: true,
            text: true,
            createdAt: true,
            writtenBy: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    }),
  feed: async (
    parent: any,
    { id }: FeedArgs,
    { prisma, user: { id: userId } }: Context,
  ) => {
    const followedUsers = await prisma.user
      .findUnique({ where: { id } })
      .following();
    const followedUserIds = followedUsers.map(user => user.id);

    return prisma.post.findMany({
      where: {
        // return posts of followed users plus posts of current user
        author: { is: { id: { in: [...followedUserIds, userId] } } },
        deletedAt: { isSet: false },
        published: true,
        archived: false,
      },
      select: {
        id: true,
        caption: true,
        published: true,
        archived: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            username: true,
            verified: true,
            followers: {
              select: {
                id: true,
              },
            },
            following: {
              select: {
                id: true,
              },
            },
            profile: {
              select: {
                picture: {
                  select: {
                    url: true,
                  },
                },
              },
            },
          },
        },
        media: {
          select: {
            type: true,
            url: true,
            publicId: true,
          },
        },
        likes: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        comments: {
          where: {
            deletedAt: {
              isSet: false,
            },
          },
          select: {
            id: true,
            text: true,
            createdAt: true,
            writtenBy: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },
  explore: async (
    parent: any,
    { id }: ExploreArgs,
    { prisma, user: { id: userId } }: Context,
  ) => {
    const following = await prisma.user
      .findUnique({ where: { id } })
      .following();
    const followingIds = following.map(follower => follower.id);

    return prisma.post.findMany({
      where: {
        author: { isNot: { id: { in: [...followingIds, userId] } } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },
  likedPosts: async (parent: any, { id }: LikedPostsArgs, context: Context) => {
    return context.prisma.like.findMany({
      where: {
        user: { id },
      },
      orderBy: {
        // TODO: This should be ordered by WHEN liked not when liked post was created
        createdAt: 'desc',
      },
    });
  },
};

export default Query;
